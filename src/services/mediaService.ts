import type { GlobalMediaFile, MediaModule, MediaVisibility, Role } from "../types/ehr";
import { listSpringMedia, uploadMediaToSpring } from "./springMediaService";

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

export async function uploadGlobalMedia(payload: UploadMediaPayload) {
  validateMediaFile(payload.file);
  const now = new Date().toISOString();
  try {
    const uploaded = await uploadMediaToSpring({
      file: payload.file,
      patientId: payload.patientId,
      module: payload.module,
      visibilityLevel: payload.visibilityLevel === "admin-only" ? "private" : payload.visibilityLevel,
      auth: {
        userId: payload.uploadedBy,
        hospitalId: payload.hospitalId,
        role: payload.role,
        patientId: payload.role === "patient" ? payload.patientId : undefined,
        fullName: payload.uploadedByName,
      },
    });
    return {
      id: uploaded.id,
      hospitalId: uploaded.hospitalId,
      status: "active",
      createdAt: uploaded.createdAt,
      updatedAt: uploaded.createdAt,
      createdBy: payload.uploadedBy,
      updatedBy: payload.uploadedBy,
      fileName: uploaded.originalFileName || uploaded.fileName,
      fileType: uploaded.mimeType,
      fileSize: uploaded.fileSizeBytes,
      fileUrl: uploaded.fileUrl,
      storagePath: uploaded.fileUrl,
      uploadedBy: payload.uploadedBy,
      uploadedByName: payload.uploadedByName,
      role: payload.role,
      patientId: uploaded.patientId,
      module: payload.module,
      visibilityLevel: payload.visibilityLevel,
      description: payload.description,
      reviewStatus: payload.requiresReview ? "pending-review" : "not-required",
    } satisfies GlobalMediaFile;
  } catch {
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
      storagePath: payload.file.name,
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
}

export async function listGlobalMedia(hospitalId: string, role: Role, patientId?: string) {
  try {
    const items = await listSpringMedia({
      userId: "current-user",
      hospitalId,
      role,
      patientId,
    }, role === "patient" ? patientId : undefined);
    return items.map((item) => ({
      id: item.id,
      hospitalId: item.hospitalId,
      status: "active",
      createdAt: item.createdAt,
      updatedAt: item.createdAt,
      createdBy: "postgres-api",
      updatedBy: "postgres-api",
      fileName: item.originalFileName || item.fileName,
      fileType: item.mimeType,
      fileSize: item.fileSizeBytes,
      fileUrl: item.fileUrl,
      storagePath: item.fileUrl,
      uploadedBy: "postgres-api",
      uploadedByName: "PostgreSQL API",
      role,
      patientId: item.patientId,
      module: item.module as MediaModule,
      visibilityLevel: item.visibilityLevel as MediaVisibility,
      reviewStatus: item.releaseStatus === "released" ? "approved" : "not-required",
    })) satisfies GlobalMediaFile[];
  } catch {
    return [] as GlobalMediaFile[];
  }
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
