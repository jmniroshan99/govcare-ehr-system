import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";
import type { AppUser, AuthenticationMethod, LoginActivity, LogoutActivityStatus, Role } from "../types/ehr";

const SESSION_KEY = "govcare-login-activity-session";
const LOCAL_KEY = "govcare-login-activities";

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

function readLocal(): LoginActivity[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]") as LoginActivity[];
  } catch {
    return [];
  }
}

function writeLocal(rows: LoginActivity[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(0, 500)));
  window.dispatchEvent(new Event("govcare:login-activity"));
}

function localRecord(input: LoginEventInput, sessionId: string) {
  const now = new Date().toISOString();
  const profile = input.profile;
  const row: LoginActivity = {
    id: randomId("LOGIN"), sessionId, userId: profile?.uid, fullName: profile?.displayName ?? "Unknown user",
    role: profile?.role, hospitalId: profile?.hospitalId ?? "unknown", hospitalName: profile?.hospitalName,
    departmentId: profile?.departmentId, departmentName: profile?.departmentName, email: input.email.toLowerCase(),
    loginStatus: input.loginStatus, logoutStatus: input.loginStatus === "success" ? "active" : "unknown",
    loginTime: now, deviceBrowser: clientContext().deviceBrowser, operatingSystem: clientContext().operatingSystem,
    authenticationMethod: input.authenticationMethod, failureReason: input.failureReason, lastActivityTime: now,
    timestamp: now, createdAt: now, updatedAt: now, createdBy: profile?.uid ?? "anonymous", updatedBy: profile?.uid ?? "anonymous", status: "active",
  };
  writeLocal([row, ...readLocal()]);
  return row;
}

export async function recordLoginActivity(input: LoginEventInput) {
  const sessionId = randomId("SESSION");
  if (input.loginStatus === "success") localStorage.setItem(SESSION_KEY, JSON.stringify({ sessionId, loginTime: Date.now() }));
  const payload = { ...input, profile: input.profile ? {
    uid: input.profile.uid, displayName: input.profile.displayName, role: input.profile.role, hospitalId: input.profile.hospitalId,
    hospitalName: input.profile.hospitalName, departmentId: input.profile.departmentId, departmentName: input.profile.departmentName,
  } : undefined, sessionId, ...clientContext() };
  if (functions && window.sessionStorage.getItem("govcare-auth-mode") !== "demo") {
    try {
      await httpsCallable(functions, "recordLoginActivity")(payload);
      return;
    } catch (error) {
      console.warn("Login activity Cloud Function unavailable; retained locally.", error);
    }
  }
  localRecord(input, sessionId);
}

export async function closeLoginSession(logoutStatus: Exclude<LogoutActivityStatus, "active" | "unknown"> = "logged_out") {
  const stored = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as { sessionId?: string; loginTime?: number } | null;
  if (!stored?.sessionId) return;
  const payload = { sessionId: stored.sessionId, logoutStatus, ...clientContext() };
  if (functions && window.sessionStorage.getItem("govcare-auth-mode") !== "demo") {
    try { await httpsCallable(functions, "closeLoginSession")(payload); } catch (error) { console.warn("Session close audit retained locally.", error); }
  }
  const now = new Date().toISOString();
  writeLocal(readLocal().map((row) => row.sessionId === stored.sessionId ? {
    ...row, logoutStatus, logoutTime: now, lastActivityTime: now, updatedAt: now,
    sessionDurationSeconds: Math.max(0, Math.round((Date.now() - (stored.loginTime ?? Date.now())) / 1000)),
  } : row));
  localStorage.removeItem(SESSION_KEY);
}

export function subscribeToLoginActivities(hospitalId: string, role: Role, callback: (rows: LoginActivity[]) => void, onError: (error: Error) => void) {
  if (!db || window.sessionStorage.getItem("govcare-auth-mode") === "demo") {
    const emit = () => callback(readLocal());
    emit();
    window.addEventListener("govcare:login-activity", emit);
    return () => window.removeEventListener("govcare:login-activity", emit);
  }
  const base = collection(db, "loginActivities");
  const activityQuery = role === "super_admin"
    ? query(base, orderBy("timestamp", "desc"), limit(500))
    : query(base, where("hospitalId", "==", hospitalId), orderBy("timestamp", "desc"), limit(500));
  return onSnapshot(activityQuery, (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as LoginActivity))), (error) => onError(error));
}

export function seedLoginActivitiesForDemo(hospitalId: string) {
  if (readLocal().length) return;
  const roles: Role[] = ["doctor", "nurse", "pharmacist", "lab_technician", "receptionist", "patient"];
  const now = Date.now();
  const rows = roles.map((role, index): LoginActivity => {
    const login = new Date(now - index * 3_600_000).toISOString();
    return {
      id: `LOGIN-DEMO-${index + 1}`, sessionId: `SESSION-DEMO-${index + 1}`, userId: `demo-${role}`,
      fullName: role === "doctor" ? "Dr. Anjali Perera" : role.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      role, hospitalId, hospitalName: "Colombo National Hospital", departmentName: role.replaceAll("_", " "),
      email: `${role.replaceAll("_", ".")}@govcare.gov.lk`, loginStatus: index === 4 ? "failed" : "success",
      logoutStatus: index < 2 ? "active" : index === 4 ? "unknown" : "logged_out", loginTime: login,
      logoutTime: index > 1 && index !== 4 ? new Date(now - index * 3_600_000 + 2_400_000).toISOString() : undefined,
      sessionDurationSeconds: index > 1 && index !== 4 ? 2400 : undefined, ipAddress: "Protected",
      deviceBrowser: index % 2 ? "Microsoft Edge / Windows" : "Google Chrome / Windows", operatingSystem: "Windows",
      location: "Sri Lanka", authenticationMethod: index === 5 ? "google" : "email_password",
      failureReason: index === 4 ? "Invalid credentials" : undefined, lastActivityTime: login, timestamp: login,
      createdAt: login, updatedAt: login, createdBy: "system", updatedBy: "system", status: "active",
    };
  });
  writeLocal(rows);
}
