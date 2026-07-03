import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp, where } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import type { GlobalMediaFile, MediaModule, MediaVisibility, Role } from "../types/ehr";

const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
];

const maxFileSize = 20 * 1024 * 1024;

export interface UploadMediaPayload {
  file: File;
  hospitalId: string;
  uploadedBy: string;
  uploadedByName: string;
  role: Role;
  patientId?: string;
  module: MediaModule;
  visibilityLevel: MediaVisibility;
  description?: string;
  requiresReview?: boolean;
}

export function validateMediaFile(file: File) {
  if (!allowedTypes.includes(file.type)) {
    throw new Error("Only images, PDF, and plain text documents are allowed.");
  }
  if (file.size > maxFileSize) {
    throw new Error("File size must be under 20 MB.");
  }
}

function cleanSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 80);
}

export async function uploadGlobalMedia(payload: UploadMediaPayload) {
  validateMediaFile(payload.file);
  const now = new Date().toISOString();
  const safePatient = cleanSegment(payload.patientId || "general");
  const safeModule = cleanSegment(payload.module);
  const safeName = cleanSegment(payload.file.name);
  const storagePath = `hospitals/${payload.hospitalId}/media/${safeModule}/${safePatient}/${Date.now()}-${safeName}`;

  if (!db || !storage) {
    return {
      id: `demo-media-${Date.now()}`,
      hospitalId: payload.hospitalId,
      status: "active",
      createdAt: now,
      updatedAt: now,
      createdBy: payload.uploadedBy,
      updatedBy: payload.uploadedBy,
      fileName: payload.file.name,
      fileType: payload.file.type,
      fileSize: payload.file.size,
      fileUrl: URL.createObjectURL(payload.file),
      storagePath,
      uploadedBy: payload.uploadedBy,
      uploadedByName: payload.uploadedByName,
      role: payload.role,
      patientId: payload.patientId,
      module: payload.module,
      visibilityLevel: payload.visibilityLevel,
      description: payload.description,
      reviewStatus: payload.requiresReview ? "pending-review" : "not-required",
    } satisfies GlobalMediaFile;
  }

  const uploadRef = ref(storage, storagePath);
  await uploadBytes(uploadRef, payload.file, {
    contentType: payload.file.type,
    customMetadata: {
      hospitalId: payload.hospitalId,
      uploadedBy: payload.uploadedBy,
      role: payload.role,
      module: payload.module,
      visibilityLevel: payload.visibilityLevel,
      patientId: payload.patientId || "",
    },
  });
  const fileUrl = await getDownloadURL(uploadRef);
  const reviewStatus = payload.requiresReview ? "pending-review" : "not-required";

  const docRef = await addDoc(collection(db, "globalMedia"), {
    hospitalId: payload.hospitalId,
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: payload.uploadedBy,
    updatedBy: payload.uploadedBy,
    fileName: payload.file.name,
    fileType: payload.file.type,
    fileSize: payload.file.size,
    fileUrl,
    storagePath,
    uploadedBy: payload.uploadedBy,
    uploadedByName: payload.uploadedByName,
    role: payload.role,
    patientId: payload.patientId || null,
    module: payload.module,
    visibilityLevel: payload.visibilityLevel,
    description: payload.description || "",
    reviewStatus,
    beforeState: null,
    afterState: {
      fileName: payload.file.name,
      module: payload.module,
      visibilityLevel: payload.visibilityLevel,
      reviewStatus,
    },
  });

  return {
    id: docRef.id,
    hospitalId: payload.hospitalId,
    status: "active",
    createdAt: now,
    updatedAt: now,
    createdBy: payload.uploadedBy,
    updatedBy: payload.uploadedBy,
    fileName: payload.file.name,
    fileType: payload.file.type,
    fileSize: payload.file.size,
    fileUrl,
    storagePath,
    uploadedBy: payload.uploadedBy,
    uploadedByName: payload.uploadedByName,
    role: payload.role,
    patientId: payload.patientId,
    module: payload.module,
    visibilityLevel: payload.visibilityLevel,
    description: payload.description,
    reviewStatus,
  } satisfies GlobalMediaFile;
}

export async function listGlobalMedia(hospitalId: string, role: Role, patientId?: string) {
  if (!db) return [] as GlobalMediaFile[];
  const constraints = [where("hospitalId", "==", hospitalId), orderBy("updatedAt", "desc"), limit(50)];
  const scopedQuery = role === "patient" && patientId
    ? query(collection(db, "globalMedia"), where("patientId", "==", patientId), where("visibilityLevel", "==", "patient-released"), ...constraints)
    : query(collection(db, "globalMedia"), ...constraints);
  const snap = await getDocs(scopedQuery);
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })) as GlobalMediaFile[];
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
