import type { TFunction } from "i18next";

export function getFirebaseAuthCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : "";
}

export function getFirebaseAuthMessage(error: unknown) {
  return typeof error === "object" && error !== null && "message" in error ? String((error as { message?: unknown }).message) : "";
}

export function friendlyAuthError(error: unknown, t: TFunction) {
  const code = getFirebaseAuthCode(error);
  const fallback = getFirebaseAuthMessage(error) || t("authErrors.generic");
  const keyByCode: Record<string, string> = {
    "auth/invalid-email": "authErrors.invalidEmail",
    "auth/user-not-found": "authErrors.invalidEmail",
    "auth/missing-email": "authErrors.invalidEmail",
    "auth/invalid-credential": "authErrors.invalidCredential",
    "auth/invalid-action-code": "authErrors.expiredResetLink",
    "auth/expired-action-code": "authErrors.expiredResetLink",
    "auth/weak-password": "authErrors.weakPassword",
    "auth/wrong-password": "authErrors.wrongCurrentPassword",
    "auth/too-many-requests": "authErrors.tooManyAttempts",
    "auth/network-request-failed": "authErrors.network",
    "auth/requires-recent-login": "authErrors.recentLoginRequired",
    "auth/operation-not-allowed": "authErrors.operationNotAllowed",
    "functions/resource-exhausted": "authErrors.tooManyAttempts",
    "functions/deadline-exceeded": "authErrors.expiredOtp",
    "functions/permission-denied": "authErrors.invalidOtp",
    "functions/failed-precondition": "authErrors.otpNotFound",
    "functions/not-found": "authErrors.invalidEmail",
    "functions/invalid-argument": "authErrors.generic",
    "functions/internal": "authErrors.internalReset",
    "functions/unavailable": "authErrors.network",
  };
  const key = keyByCode[code];
  return key ? t(key) : fallback;
}
