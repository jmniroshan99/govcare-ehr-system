const MEDIA_API_BASE_URL = import.meta.env.VITE_MEDIA_API_BASE_URL ?? import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4002";

export type SpringMediaDocument = {
  id: string;
  hospitalId: string;
  patientId?: string;
  module: string;
  fileUrl: string;
  fileName: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256Checksum: string;
  visibilityLevel: string;
  releaseStatus: string;
  createdAt: string;
};

export type SpringUploadMediaInput = {
  file: File;
  patientId?: string;
  module: string;
  visibilityLevel?: "private" | "care-team" | "patient-released";
  auth: {
    userId: string;
    hospitalId: string;
    role: string;
    patientId?: string;
    fullName?: string;
  };
};

function authHeaders(auth: SpringUploadMediaInput["auth"]) {
  return {
    "X-User-Id": auth.userId,
    "X-Hospital-Id": auth.hospitalId,
    "X-Role": auth.role,
    ...(auth.patientId ? { "X-Patient-Id": auth.patientId } : {}),
    ...(auth.fullName ? { "X-Full-Name": auth.fullName } : {}),
  };
}

export async function uploadMediaToSpring(input: SpringUploadMediaInput) {
  const form = new FormData();
  form.append("file", input.file);
  form.append("module", input.module);
  form.append("visibilityLevel", input.visibilityLevel ?? "private");
  if (input.patientId) form.append("patientId", input.patientId);

  const response = await fetch(`${MEDIA_API_BASE_URL}/api/media`, {
    method: "POST",
    headers: authHeaders(input.auth),
    body: form,
  });

  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json() as Promise<SpringMediaDocument>;
}

export async function listSpringMedia(auth: SpringUploadMediaInput["auth"], patientId?: string) {
  const params = patientId ? `?patientId=${encodeURIComponent(patientId)}` : "";
  const response = await fetch(`${MEDIA_API_BASE_URL}/api/media${params}`, {
    headers: authHeaders(auth),
  });

  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json() as Promise<SpringMediaDocument[]>;
}

export function springMediaDownloadUrl(id: string) {
  return `${MEDIA_API_BASE_URL}/api/media/${id}/download`;
}

async function errorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { message?: string };
    return payload.message ?? `Media API failed with status ${response.status}`;
  } catch {
    return `Media API failed with status ${response.status}`;
  }
}

