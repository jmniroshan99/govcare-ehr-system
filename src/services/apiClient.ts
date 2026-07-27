const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4001";
const API_TOKEN_KEY = "govcare-api-token";

export type ApiErrorPayload = {
  message?: string;
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
    throw new Error(payload.message ?? `API request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export function setApiToken(token: string | null) {
  if (token) window.localStorage.setItem(API_TOKEN_KEY, token);
  else window.localStorage.removeItem(API_TOKEN_KEY);
}

