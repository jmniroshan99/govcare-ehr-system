const MEDIA_API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4001";

const API_TOKEN_KEY = "govcare-api-token";

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

function authHeaders(
  _auth: SpringUploadMediaInput["auth"],
): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }

  const storedToken = window.localStorage.getItem(API_TOKEN_KEY);
  const token = storedToken?.trim();

  if (!token) {
    return {};
  }

  return {
    Authorization: token.startsWith("Bearer ")
      ? token
      : `Bearer ${token}`,
  };
}

export async function uploadMediaToSpring(
  input: SpringUploadMediaInput,
): Promise<SpringMediaDocument> {
  const form = new FormData();

  form.append("file", input.file);
  form.append("module", input.module);
  form.append("visibilityLevel", input.visibilityLevel ?? "private");

  if (input.patientId) {
    form.append("patientId", input.patientId);
  }

  const response = await fetch(`${MEDIA_API_BASE_URL}/api/media`, {
    method: "POST",
    headers: authHeaders(input.auth),
    body: form,
  });

  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }

  return (await response.json()) as SpringMediaDocument;
}

export async function listSpringMedia(
  auth: SpringUploadMediaInput["auth"],
  patientId?: string,
): Promise<SpringMediaDocument[]> {
  const queryParameters = new URLSearchParams();

  if (patientId) {
    queryParameters.set("patientId", patientId);
  }

  const queryString = queryParameters.toString();
  const requestUrl = queryString
    ? `${MEDIA_API_BASE_URL}/api/media?${queryString}`
    : `${MEDIA_API_BASE_URL}/api/media`;

  const response = await fetch(requestUrl, {
    method: "GET",
    headers: authHeaders(auth),
  });

  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }

  return (await response.json()) as SpringMediaDocument[];
}

export function springMediaDownloadUrl(id: string): string {
  return `${MEDIA_API_BASE_URL}/api/media/${encodeURIComponent(id)}/download`;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      message?: string;
      error?: string;
    };

    return (
      payload.message ??
      payload.error ??
      `Media API failed with status ${response.status}`
    );
  } catch {
    return `Media API failed with status ${response.status}`;
  }
}
