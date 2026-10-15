// Legacy browser workflows contain patient and guardian details. Drop their shared
// cache whenever an account changes or signs out so a later login cannot read it.
const SENSITIVE_KEYS = [
  "govcare-saved-patients",
  "govcare-guardian-profiles",
  "govcare-guardian-dependent-links",
  "govcare-doctor-check-workflow",
  "govcare.admissionCounterRequests",
  "govcare.clinicalIntegration",
  "govcare-medical-decision-requests",
  "govcare-patient-activities",
  "govcare.pharmacyQueue",
  "govcare-doctor-session-actions",
  "govcare-recent-saved-details",
  "govcare-care-messages",
];

export const AUTHORIZATION_CHANGED_EVENT = "govcare:authorization-changed";

export function clearBrowserClinicalCache() {
  if (typeof window === "undefined") return;
  for (const key of SENSITIVE_KEYS) window.localStorage.removeItem(key);
  window.dispatchEvent(new Event(AUTHORIZATION_CHANGED_EVENT));
}
