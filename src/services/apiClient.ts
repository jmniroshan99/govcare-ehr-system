const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4001";

export type ApiErrorPayload = {
  message?: string;
};

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = window.localStorage.getItem("govcare-api-token");
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

  return response.json() as Promise<T>;
}

