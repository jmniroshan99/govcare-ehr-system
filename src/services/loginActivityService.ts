import type { AppUser, AuthenticationMethod, LoginActivity, LogoutActivityStatus, Role } from "../types/ehr";
import { apiRequest } from "./apiClient";

const SESSION_KEY = "govcare-login-activity-session";

type LoginEventInput = {
  email: string;
  loginStatus: "success" | "failed";
  authenticationMethod: AuthenticationMethod;
  profile?: AppUser | null;
  failureReason?: string;
};

function randomId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function clientContext() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Microsoft Edge" : /Chrome\//.test(ua) ? "Google Chrome" : /Firefox\//.test(ua) ? "Mozilla Firefox" : /Safari\//.test(ua) ? "Safari" : "Unknown browser";
  const os = /Windows NT/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  return { deviceBrowser: `${browser} / ${navigator.platform || "device"}`, operatingSystem: os };
}

export async function recordLoginActivity(input: LoginEventInput) {
  const sessionId = randomId("SESSION");
  if (input.loginStatus === "success") localStorage.setItem(SESSION_KEY, JSON.stringify({ sessionId, loginTime: Date.now() }));
  await apiRequest("/api/login-activities", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      loginStatus: input.loginStatus,
      authenticationMethod: input.authenticationMethod,
      failureReason: input.failureReason,
      sessionId,
      ...clientContext(),
    }),
  });
}

export async function closeLoginSession(logoutStatus: Exclude<LogoutActivityStatus, "active" | "unknown"> = "logged_out") {
  const stored = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as { sessionId?: string; loginTime?: number } | null;
  if (!stored?.sessionId) return;
  await apiRequest("/api/login-activities/session/close", {
    method: "POST",
    body: JSON.stringify({ sessionId: stored.sessionId, logoutStatus, ...clientContext() }),
  });
  localStorage.removeItem(SESSION_KEY);
}

export function subscribeToLoginActivities(_hospitalId: string, _role: Role, callback: (rows: LoginActivity[]) => void, onError: (error: Error) => void) {
  let cancelled = false;
  async function load() {
    try {
      const result = await apiRequest<{ items: LoginActivity[] }>("/api/login-activities");
      if (!cancelled) callback(result.items);
    } catch (error) {
      if (!cancelled) onError(error instanceof Error ? error : new Error(String(error)));
    }
  }
  void load();
  const interval = window.setInterval(load, 30_000);
  return () => {
    cancelled = true;
    window.clearInterval(interval);
  };
}

export function seedLoginActivitiesForDemo(_hospitalId: string) {
  // Demo seeding was removed. Login records now come only from PostgreSQL.
}
