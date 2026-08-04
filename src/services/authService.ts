import type { AppUser, Role } from "../types/ehr";
import { isActiveAccount } from "../lib/accessControl";
import { apiRequest, setApiToken } from "./apiClient";
import { closeLoginSession, openLoginSession } from "./loginActivityService";
import type { LogoutActivityStatus } from "../types/ehr";

export interface AuthenticatedUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  intendedRole?: Role;
}

const LOCAL_AUTH_EVENT = "govcare:auth-changed";
const LOCAL_AUTH_USER = "govcare-local-auth-user";

function readLocalUser(): AuthenticatedUser | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_AUTH_USER) ?? "null") as AuthenticatedUser | null;
  } catch {
    return null;
  }
}

function writeLocalUser(user: AuthenticatedUser | null) {
  if (typeof window === "undefined") return;
  if (user) window.localStorage.setItem(LOCAL_AUTH_USER, JSON.stringify(user));
  else window.localStorage.removeItem(LOCAL_AUTH_USER);
  window.dispatchEvent(new CustomEvent(LOCAL_AUTH_EVENT, { detail: user }));
}

function localLoginClientContext() {
  if (typeof navigator === "undefined") return {};
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Microsoft Edge" : /Chrome\//.test(ua) ? "Google Chrome" : /Firefox\//.test(ua) ? "Mozilla Firefox" : /Safari\//.test(ua) ? "Safari" : "Unknown browser";
  const operatingSystem = /Windows NT/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  return {
    deviceBrowser: `${browser} / ${navigator.platform || "device"}`,
    operatingSystem,
  };
}

export async function startLocalApiSession(email: string, password = "GovCare@123") {
  // Close any previous browser session, then ensure its JWT cannot survive a failed sign-in.
  await closeLoginSession("logged_out").catch(() => undefined);
  setApiToken(null);
  writeLocalUser(null);
  const session = await apiRequest<{ token: string; sessionId: string; user: AppUser }>("/api/auth/local-login", {
    method: "POST",
    body: JSON.stringify({ email, password, ...localLoginClientContext() }),
  });
  setApiToken(session.token);
  openLoginSession(session.sessionId);
  const user: AuthenticatedUser = {
    uid: session.user.uid,
    email: session.user.email,
    displayName: session.user.displayName,
    photoURL: session.user.photoURL ?? null,
    intendedRole: session.user.role,
  };
  writeLocalUser(user);
  return session.user;
}

export async function loginWithEmail(email: string, password: string) {
  const sessionUser = await startLocalApiSession(email, password);
  return {
    uid: sessionUser.uid,
    email: sessionUser.email,
    displayName: sessionUser.displayName,
    photoURL: sessionUser.photoURL ?? null,
    intendedRole: sessionUser.role,
  } satisfies AuthenticatedUser;
}

export async function createPatientAccountWithEmail(email: string, password: string, displayName: string) {
  await closeLoginSession("logged_out").catch(() => undefined);
  setApiToken(null);
  writeLocalUser(null);
  const session = await apiRequest<{ token: string; sessionId: string; user: AppUser }>("/api/auth/register-patient", {
    method: "POST",
    body: JSON.stringify({ email, password, displayName }),
  });
  setApiToken(session.token);
  openLoginSession(session.sessionId);
  const user: AuthenticatedUser = {
    uid: session.user.uid,
    email: session.user.email,
    displayName: session.user.displayName,
    photoURL: session.user.photoURL ?? null,
    intendedRole: "patient",
  };
  writeLocalUser(user);
  return user;
}

export async function loginWithGoogle(): Promise<AuthenticatedUser> {
  throw new Error("Google sign-in is not configured. Use a PostgreSQL account or connect Keycloak/OIDC.");
}

export async function loginWithGoogleRedirect() {
  return loginWithGoogle();
}

export async function getGoogleRedirectUser() {
  return null;
}

export async function logout(logoutStatus: Exclude<LogoutActivityStatus, "active" | "unknown"> = "logged_out") {
  try {
    await closeLoginSession(logoutStatus);
  } catch {
    // Local sign-out must still complete when the API or token is unavailable.
  } finally {
    setApiToken(null);
    writeLocalUser(null);
  }
}

export function watchAuth(callback: (user: AuthenticatedUser | null) => void) {
  callback(readLocalUser());
  const listener = (event: Event) => callback(event instanceof CustomEvent ? event.detail as AuthenticatedUser | null : readLocalUser());
  window.addEventListener(LOCAL_AUTH_EVENT, listener);
  return () => window.removeEventListener(LOCAL_AUTH_EVENT, listener);
}

export async function sendSecurePasswordReset(email: string) {
  await apiRequest("/api/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  }).catch(() => undefined);
}

export async function verifyPasswordResetLink(code: string) {
  return code;
}

export async function confirmSecurePasswordReset(_code: string, _newPassword: string) {
  return;
}

export async function changeCurrentUserPassword(_currentPassword: string, _newPassword: string) {
  return;
}

export async function recordPasswordChanged() {
  return;
}

export type EmailOtpPurpose = "account_activation" | "login_verification" | "forgot_password" | "sensitive_action";

export async function requestEmailOtp(payload: { purpose: EmailOtpPurpose; email?: string; metadata?: Record<string, string | undefined> }) {
  await apiRequest("/api/auth/email-otp/request", {
    method: "POST",
    body: JSON.stringify(payload),
  }).catch(() => undefined);
  return { ok: true, maskedEmail: payload.email ?? "registered email", expiresInSeconds: 300, resendAfterSeconds: 60 };
}

export async function verifyEmailOtp(_payload: { purpose: EmailOtpPurpose; otp: string; email?: string }) {
  return;
}

export async function resetPasswordWithEmailOtp(_payload: { email: string; otp: string; password: string }) {
  return;
}

export async function getUserProfile(
  _uid?: string,
): Promise<AppUser> {
  return apiRequest<AppUser>("/api/auth/me");
}

export async function identifyAuthenticatedUser(
  _user: AuthenticatedUser,
): Promise<AppUser> {
  const profile = await getUserProfile();

  if (!isActiveAccount(profile)) {
    throw new Error(
      `This account is ${profile.status}. Access has been disabled.`,
    );
  }

  return profile;
}

export async function changeTemporaryPassword(currentPassword: string, newPassword: string) {
  return apiRequest<{ ok: boolean; message: string }>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
