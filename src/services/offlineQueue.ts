import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";

export type OfflineCallableName =
  | "saveConsultationDraft"
  | "sendSecureChatMessage"
  | "createPrescriptionFromConsultation"
  | "pushPrescriptionToPharmacyQueue"
  | "generateAdminReport"
  | "submitMedicalDecisionRequest"
  | "reviewMedicalDecisionRequest"
  | "updateProfile"
  | "updateCareSummary";

export interface OfflineAction {
  id: string;
  callableName: OfflineCallableName;
  payload: Record<string, unknown>;
  dedupeKey?: string;
  label: string;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

export const OFFLINE_QUEUE_UPDATED = "govcare:offline-queue-updated";
export const OFFLINE_SYNC_COMPLETED = "govcare:offline-sync-completed";

const DB_NAME = "govcare-offline";
const STORE_NAME = "actions";
const KEY_STORE_NAME = "keys";
const DB_VERSION = 2;
const MAX_ATTEMPTS = 8;

interface StoredOfflineAction extends Omit<OfflineAction, "payload"> {
  encryptedPayload?: ArrayBuffer;
  iv?: ArrayBuffer;
  payload?: Record<string, unknown>;
}

function openQueueDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("dedupeKey", "dedupeKey", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!database.objectStoreNames.contains(KEY_STORE_NAME)) {
        database.createObjectStore(KEY_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getDeviceEncryptionKey() {
  const database = await openQueueDb();
  const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
    const transaction = database.transaction(KEY_STORE_NAME, "readonly");
    const request = transaction.objectStore(KEY_STORE_NAME).get("queue-key");
    request.onsuccess = () => resolve(request.result instanceof CryptoKey ? request.result : undefined);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
  if (existing) return existing;
  const generated = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const writeDatabase = await openQueueDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = writeDatabase.transaction(KEY_STORE_NAME, "readwrite");
    transaction.objectStore(KEY_STORE_NAME).put(generated, "queue-key");
    transaction.oncomplete = () => {
      writeDatabase.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
  return generated;
}

async function encryptPayload(payload: Record<string, unknown>) {
  const key = await getDeviceEncryptionKey();
  const iv = new Uint8Array(new ArrayBuffer(12));
  crypto.getRandomValues(iv);
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const encryptedPayload = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes);
  return { encryptedPayload, iv: iv.buffer };
}

async function decryptAction(action: StoredOfflineAction): Promise<OfflineAction> {
  if (action.payload) return { ...action, payload: action.payload };
  if (!action.encryptedPayload || !action.iv) throw new Error("Offline action payload is unavailable.");
  const key = await getDeviceEncryptionKey();
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(action.iv) }, key, action.encryptedPayload);
  const payload = JSON.parse(new TextDecoder().decode(decrypted)) as Record<string, unknown>;
  return { ...action, payload };
}

async function withStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openQueueDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

function notifyQueueChanged() {
  window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_UPDATED));
}

export async function getOfflineActions() {
  if (typeof indexedDB === "undefined") return [];
  const actions = await withStore<StoredOfflineAction[]>("readonly", (store) => store.getAll());
  const decrypted = await Promise.all(actions.map(decryptAction));
  return decrypted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getOfflineActionCount() {
  if (typeof indexedDB === "undefined") return 0;
  return withStore<number>("readonly", (store) => store.count());
}

export async function queueOfflineCallable(input: {
  callableName: OfflineCallableName;
  payload: Record<string, unknown>;
  label: string;
  dedupeKey?: string;
}) {
  const existing = input.dedupeKey
    ? (await getOfflineActions()).find((action) => action.dedupeKey === input.dedupeKey)
    : undefined;
  const action: OfflineAction = {
    id: existing?.id ?? crypto.randomUUID(),
    callableName: input.callableName,
    payload: input.payload,
    label: input.label,
    dedupeKey: input.dedupeKey,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    attempts: existing?.attempts ?? 0,
  };
  const encrypted = await encryptPayload(action.payload);
  const stored: StoredOfflineAction = { ...action, payload: undefined, ...encrypted };
  await withStore("readwrite", (store) => store.put(stored));
  notifyQueueChanged();
  await requestBackgroundSync();
  return action;
}

export async function removeOfflineAction(id: string) {
  await withStore("readwrite", (store) => store.delete(id));
  notifyQueueChanged();
}

async function updateOfflineAction(action: OfflineAction) {
  const encrypted = await encryptPayload(action.payload);
  const stored: StoredOfflineAction = { ...action, payload: undefined, ...encrypted };
  await withStore("readwrite", (store) => store.put(stored));
}

export function isOfflineCapableNetworkError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : "";
  return !navigator.onLine
    || code === "functions/unavailable"
    || code === "functions/deadline-exceeded"
    || code === "functions/internal"
    || code === "auth/network-request-failed";
}

export async function syncOfflineActions() {
  if (!navigator.onLine || !functions) return { synced: 0, remaining: await getOfflineActionCount() };
  const actions = await getOfflineActions();
  let synced = 0;
  for (const action of actions) {
    try {
      const callable = httpsCallable(functions, action.callableName);
      await callable(action.payload);
      await removeOfflineAction(action.id);
      synced += 1;
    } catch (error) {
      const attempts = action.attempts + 1;
      await updateOfflineAction({
        ...action,
        attempts,
        lastError: error instanceof Error ? error.message : String(error),
      });
      if (isOfflineCapableNetworkError(error)) break;
      if (attempts >= MAX_ATTEMPTS) continue;
    }
  }
  const remaining = await getOfflineActionCount();
  window.dispatchEvent(new CustomEvent(OFFLINE_SYNC_COMPLETED, { detail: { synced, remaining } }));
  notifyQueueChanged();
  return { synced, remaining };
}

async function requestBackgroundSync() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready.catch(() => null);
  const syncRegistration = registration as (ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } }) | null;
  await syncRegistration?.sync?.register("govcare-sync-actions").catch(() => undefined);
}

export function registerOfflineSynchronization() {
  function synchronize() {
    void syncOfflineActions();
  }
  window.addEventListener("online", synchronize);
  navigator.serviceWorker?.addEventListener("message", (event) => {
    if (event.data?.type === "GOVCARE_SYNC_REQUESTED") synchronize();
  });
  if (navigator.onLine) synchronize();
  return () => window.removeEventListener("online", synchronize);
}
