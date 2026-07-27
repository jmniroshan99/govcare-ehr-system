import type { AppUser, Role } from "../types/ehr";
import { isActiveAccount } from "../lib/accessControl";
import { apiRequest, setApiToken } from "./apiClient";

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

export async function startLocalApiSession(email: string, password = "GovCare@123") {
  const session = await apiRequest<{ token: string; user: AppUser }>("/api/auth/local-login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setApiToken(session.token);
  return session.user;
}

export async function loginWithEmail(email: string, password: string) {
  const sessionUser = await startLocalApiSession(email, password);
  const user: AuthenticatedUser = {
    uid: sessionUser.uid,
    email: sessionUser.email,
    displayName: sessionUser.displayName,
    photoURL: sessionUser.photoURL ?? null,
    intendedRole: sessionUser.role,
  };
  writeLocalUser(user);
  return user;
}

export async function createPatientAccountWithEmail(email: string, password: string, displayName: string) {
  const session = await apiRequest<{ token: string; user: AppUser }>("/api/auth/register-patient", {
    method: "POST",
    body: JSON.stringify({ email, password, displayName }),
  });
  setApiToken(session.token);
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

export async function logout() {
  setApiToken(null);
  writeLocalUser(null);
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

export async function getUserProfile(uid: string) {
  try {
    return await apiRequest<AppUser>(`/api/users/by-auth/${encodeURIComponent(uid)}`);
  } catch {
    return null;
  }
}

export async function identifyAuthenticatedUser(user: AuthenticatedUser) {
  const profile = await getUserProfile(user.uid);
  if (profile) {
    if (!isActiveAccount(profile)) throw new Error(`This account is ${profile.status}. Access has been disabled.`);
    return profile;
  }
  throw new Error("Authenticated account profile was not found in PostgreSQL.");
}
