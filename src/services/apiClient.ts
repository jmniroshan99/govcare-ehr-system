const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4001";
const API_TOKEN_KEY = "govcare-api-token";

export type ApiErrorPayload = {
  message?: string;
  issues?: Array<{ path?: string; message?: string }>;
};

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = window.localStorage.getItem(API_TOKEN_KEY);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    let payload: ApiErrorPayload = {};
    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      payload = {};
    }
    const issueSummary = payload.issues
      ?.map((issue) => [issue.path, issue.message].filter(Boolean).join(": "))
      .filter(Boolean)
      .join("; ");
    const message = payload.message ?? `API request failed with status ${response.status}`;
    throw new Error(issueSummary ? `${message} ${issueSummary}` : message);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export type ApiFileDownload = {
  blob: Blob;
  filename: string;
};

export async function apiDownload(path: string): Promise<ApiFileDownload> {
  const token = window.localStorage.getItem(API_TOKEN_KEY);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    let payload: ApiErrorPayload = {};
    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      payload = {};
    }
    const issueSummary = payload.issues
      ?.map((issue) => [issue.path, issue.message].filter(Boolean).join(": "))
      .filter(Boolean)
      .join("; ");
    const message = payload.message ?? `File download failed with status ${response.status}`;
    throw new Error(issueSummary ? `${message} ${issueSummary}` : message);
  }

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const basicMatch = disposition.match(/filename="?([^";]+)"?/i);
  const filename = decodeURIComponent(utf8Match?.[1] ?? basicMatch?.[1] ?? "govcare-report.pdf");
  return { blob: await response.blob(), filename };
}

export function setApiToken(token: string | null) {
  if (token) window.localStorage.setItem(API_TOKEN_KEY, token);
  else window.localStorage.removeItem(API_TOKEN_KEY);
}

