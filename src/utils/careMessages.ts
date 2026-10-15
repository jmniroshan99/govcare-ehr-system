export type CareMessageRole = "patient" | "doctor" | "system";
export type CareMessagePriority = "normal" | "urgent" | "emergency";

export interface CareMessage {
  id: string;
  sender: string;
  role: CareMessageRole;
  time: string;
  text: string;
  linkedTo: string;
  receipt: string;
  priority?: CareMessagePriority;
  createdAt: string;
}

const STORAGE_KEY = "govcare-care-messages";
export const CARE_MESSAGES_UPDATED_EVENT = "govcare:care-messages-updated";

function isCareMessage(value: unknown): value is CareMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<CareMessage>;
  return typeof message.id === "string" && typeof message.text === "string" && typeof message.role === "string";
}

export function getCareMessages(fallback: CareMessage[] = []) {
  if (typeof window === "undefined") return fallback;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return fallback;
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isCareMessage) : fallback;
  } catch {
    return fallback;
  }
}

export function saveCareMessages(messages: CareMessage[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  window.dispatchEvent(new CustomEvent(CARE_MESSAGES_UPDATED_EVENT));
}

export function appendCareMessage(message: CareMessage) {
  const messages = [...getCareMessages(), message];
  saveCareMessages(messages);
  return messages;
}
