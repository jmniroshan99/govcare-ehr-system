import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp, startAfter, where } from "firebase/firestore";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";
import type { Patient } from "../types/ehr";

export async function createPatient(payload: Omit<Patient, "id" | "patientId" | "createdAt" | "updatedAt">) {
  if (!db || !functions) throw new Error("Firebase is not configured.");
  const generatePatientId = httpsCallable(functions, "generatePatientId");
  const { data } = await generatePatientId({ hospitalId: payload.hospitalId });
  return addDoc(collection(db, "patients"), {
    ...payload,
    patientId: (data as { patientId: string }).patientId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function searchPatients(hospitalId: string, term: string) {
  if (!db) return [];
  const field = term.match(/^[0-9A-Z-]{5,}$/i) ? "nicOrPassport" : "lastName";
  const patientsQuery = query(collection(db, "patients"), where("hospitalId", "==", hospitalId), where(field, ">=", term), where(field, "<=", `${term}\uf8ff`), limit(20));
  const snap = await getDocs(patientsQuery);
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })) as Patient[];
}

export async function listCollection<T>(collectionName: string, hospitalId: string, pageSize = 25, cursor?: QueryDocumentSnapshot<DocumentData>) {
  if (!db) return { items: [] as T[], cursor: undefined };
  const clauses = [where("hospitalId", "==", hospitalId), orderBy("updatedAt", "desc"), limit(pageSize)];
  const q = cursor ? query(collection(db, collectionName), ...clauses, startAfter(cursor)) : query(collection(db, collectionName), ...clauses);
  const snap = await getDocs(q);
  return {
    items: snap.docs.map((item) => ({ id: item.id, ...item.data() })) as T[],
    cursor: snap.docs.at(-1),
  };
}
