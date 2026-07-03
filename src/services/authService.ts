import { confirmPasswordReset, createUserWithEmailAndPassword, EmailAuthProvider, getRedirectResult, getIdTokenResult, onAuthStateChanged, reauthenticateWithCredential, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, GoogleAuthProvider, signOut, updatePassword, updateProfile as updateAuthProfile, verifyPasswordResetCode } from "firebase/auth";
import type { User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "../lib/firebase";
import type { AppUser } from "../types/ehr";
import type { Role } from "../types/ehr";
import { isActiveAccount } from "../lib/accessControl";

export async function loginWithEmail(email: string, password: string) {
  if (!auth) throw new Error("Firebase is not configured.");
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function createPatientAccountWithEmail(email: string, password: string, displayName: string) {
  if (!auth) throw new Error("Firebase is not configured.");
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName.trim()) await updateAuthProfile(credential.user, { displayName: displayName.trim() });
  return credential.user;
}

export async function loginWithGoogle() {
  if (!auth) throw new Error("Firebase is not configured.");
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const credential = await signInWithPopup(auth, provider);
  return credential.user;
}

export async function loginWithGoogleRedirect() {
  if (!auth) throw new Error("Firebase is not configured.");
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithRedirect(auth, provider);
}

export async function getGoogleRedirectUser() {
  if (!auth) return null;
  const credential = await getRedirectResult(auth);
  return credential?.user ?? null;
}

export async function logout() {
  if (!auth) return;
  try {
    await signOut(auth);
  } catch (error) {
    console.warn("Firebase sign-out failed; local session will still be cleared.", error);
  }
}

export function watchAuth(callback: (user: User | null) => void) {
  if (!auth) {
    callback(null);
    return () => undefined;
  }
  return onAuthStateChanged(auth, callback);
}

export async function sendSecurePasswordReset(email: string) {
  if (!auth) throw new Error("Firebase is not configured.");
  const actionCodeSettings = typeof window === "undefined" ? undefined : {
    url: `${window.location.origin}/reset-password`,
    handleCodeInApp: true,
  };
  await sendPasswordResetEmail(auth, email, actionCodeSettings);
}

export async function verifyPasswordResetLink(code: string) {
  if (!auth) throw new Error("Firebase is not configured.");
  return verifyPasswordResetCode(auth, code);
}

export async function confirmSecurePasswordReset(code: string, newPassword: string) {
  if (!auth) throw new Error("Firebase is not configured.");
  await confirmPasswordReset(auth, code, newPassword);
}

export async function changeCurrentUserPassword(currentPassword: string, newPassword: string) {
  if (!auth) throw new Error("Firebase is not configured.");
  const user = auth.currentUser;
  if (!user?.email) throw new Error("No email/password Firebase session is available for this account.");
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

export async function recordPasswordChanged() {
  if (!functions) return;
  const callable = httpsCallable(functions, "recordPasswordChanged");
  await callable({});
}

export type EmailOtpPurpose = "account_activation" | "login_verification" | "forgot_password" | "sensitive_action";

export async function requestEmailOtp(payload: { purpose: EmailOtpPurpose; email?: string; metadata?: Record<string, string | undefined> }) {
  if (!functions) throw new Error("Firebase is not configured.");
  const callable = httpsCallable(functions, "requestEmailOtp");
  const { data } = await callable(payload);
  return data as { ok: boolean; maskedEmail: string; expiresInSeconds: number; resendAfterSeconds: number };
}

export async function verifyEmailOtp(payload: { purpose: EmailOtpPurpose; otp: string; email?: string }) {
  if (!functions) throw new Error("Firebase is not configured.");
  const callable = httpsCallable(functions, "verifyEmailOtp");
  await callable(payload);
}

export async function resetPasswordWithEmailOtp(payload: { email: string; otp: string; password: string }) {
  if (!functions) throw new Error("Firebase is not configured.");
  const callable = httpsCallable(functions, "resetPasswordWithEmailOtp");
  await callable(payload);
}

export async function getUserProfile(uid: string) {
  if (!db) return null;
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as AppUser) : null;
}

export async function identifyAuthenticatedUser(user: User) {
  const profile = await getUserProfile(user.uid);
  if (!profile) throw new Error("No EHR user profile was found for this account. Ask an administrator to create the user record.");
  if (!isActiveAccount(profile)) throw new Error(`This account is ${profile.status}. Access has been disabled.`);
  const token = await getIdTokenResult(user, navigator.onLine);
  const claimRole = token.claims.role as Role | undefined;
  const claimHospitalId = token.claims.hospitalId as string | undefined;
  const claimDepartmentId = token.claims.departmentId as string | undefined;
  if (claimRole && claimRole !== profile.role) throw new Error("Role mismatch between Firebase custom claims and Firestore profile.");
  if (claimHospitalId && claimHospitalId !== profile.hospitalId) throw new Error("Hospital access mismatch between Firebase custom claims and Firestore profile.");
  if (claimDepartmentId && profile.departmentId && claimDepartmentId !== profile.departmentId) throw new Error("Department access mismatch between Firebase custom claims and Firestore profile.");
  return profile;
}
