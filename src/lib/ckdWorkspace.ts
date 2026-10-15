import type { AppUser } from "../types/ehr";
import { canAccessPath } from "./roleAccess";
import { patientUuidPattern } from "../utils/patientNavigation";

export type CkdWorkspaceView = "assessment" | "intelligence" | "outlook";
export function canUsePredictiveWorkspace(profile: AppUser | null | undefined) {
  return canAccessPath(profile, "/ai-cdss/ckd") && canAccessPath(profile, "/ai-cdss/ckd/predictive-intelligence");
}
export function resolveCkdWorkspaceView(requested: string | null, profile: AppUser | null | undefined): CkdWorkspaceView {
  return (requested === "intelligence" || requested === "outlook") && canUsePredictiveWorkspace(profile) ? requested : "assessment";
}
/** Preserve authorized deep-link resolution while consolidating the old route. */
export function integratedCkdHref(search: string) {
  const incoming = new URLSearchParams(search), params = new URLSearchParams({ view: "intelligence" });
  const patientId = incoming.get("patientId");
  if (patientId && patientUuidPattern.test(patientId)) params.set("patientId", patientId);
  return `/ai-cdss/ckd?${params}`;
}
