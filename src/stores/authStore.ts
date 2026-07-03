import { create } from "zustand";
import type { AppUser, Role } from "../types/ehr";

interface AuthState {
  profile: AppUser | null;
  role: Role | null;
  hospitalId: string | null;
  sessionExpiresAt: number | null;
  setProfile: (profile: AppUser | null) => void;
  refreshSession: () => void;
  clear: () => void;
}

const SESSION_MS = 1000 * 60 * 30;
const PROFILE_OVERRIDES_KEY = "govcare-profile-overrides";
const AUTH_SESSION_KEY = "govcare-auth-session";

function getProfileOverrides() {
  try {
    return JSON.parse(window.localStorage.getItem(PROFILE_OVERRIDES_KEY) ?? "{}") as Record<string, Partial<AppUser>>;
  } catch {
    return {};
  }
}

function mergeProfileOverride(profile: AppUser | null) {
  if (!profile) return null;
  const override = getProfileOverrides()[profile.uid] ?? {};
  const safeOverride: Partial<AppUser> = {
    displayName: override.displayName,
    phone: override.phone,
    address: override.address,
    city: override.city,
    district: override.district,
    hospitalCity: override.hospitalCity,
    preferredHospital: override.preferredHospital,
    preferredLanguage: override.preferredLanguage,
    emergencyContactName: override.emergencyContactName,
    emergencyContactPhone: override.emergencyContactPhone,
    photoURL: override.photoURL,
  };
  return { ...profile, ...Object.fromEntries(Object.entries(safeOverride).filter(([, value]) => value !== undefined)) };
}

function loadStoredSession() {
  if (typeof window === "undefined") return { profile: null, sessionExpiresAt: null };
  try {
    const stored = JSON.parse(window.localStorage.getItem(AUTH_SESSION_KEY) ?? "null") as { profile?: AppUser; sessionExpiresAt?: number } | null;
    if (!stored?.profile || !stored.sessionExpiresAt || Date.now() > stored.sessionExpiresAt) {
      window.localStorage.removeItem(AUTH_SESSION_KEY);
      return { profile: null, sessionExpiresAt: null };
    }
    return { profile: mergeProfileOverride(stored.profile), sessionExpiresAt: stored.sessionExpiresAt };
  } catch {
    window.localStorage.removeItem(AUTH_SESSION_KEY);
    return { profile: null, sessionExpiresAt: null };
  }
}

function saveStoredSession(profile: AppUser | null, sessionExpiresAt: number | null) {
  if (typeof window === "undefined") return;
  if (!profile || !sessionExpiresAt) {
    window.localStorage.removeItem(AUTH_SESSION_KEY);
    return;
  }
  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ profile, sessionExpiresAt }));
}

export function saveProfileOverride(uid: string, values: Partial<AppUser>) {
  const overrides = getProfileOverrides();
  overrides[uid] = { ...(overrides[uid] ?? {}), ...values };
  window.localStorage.setItem(PROFILE_OVERRIDES_KEY, JSON.stringify(overrides));
}

const initialSession = loadStoredSession();

export const useAuthStore = create<AuthState>((set) => ({
  profile: initialSession.profile,
  role: initialSession.profile?.role ?? null,
  hospitalId: initialSession.profile?.hospitalId ?? null,
  sessionExpiresAt: initialSession.sessionExpiresAt,
  setProfile: (profile) => {
    const mergedProfile = mergeProfileOverride(profile);
    const sessionExpiresAt = mergedProfile ? Date.now() + SESSION_MS : null;
    saveStoredSession(mergedProfile, sessionExpiresAt);
    set({
      profile: mergedProfile,
      role: mergedProfile?.role ?? null,
      hospitalId: mergedProfile?.hospitalId ?? null,
      sessionExpiresAt,
    });
  },
  refreshSession: () => set((state) => {
    const sessionExpiresAt = Date.now() + SESSION_MS;
    saveStoredSession(state.profile, sessionExpiresAt);
    return { sessionExpiresAt };
  }),
  clear: () => {
    saveStoredSession(null, null);
    set({ profile: null, role: null, hospitalId: null, sessionExpiresAt: null });
  },
}));
