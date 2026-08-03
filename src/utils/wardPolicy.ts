export type PatientGenderForWard = "male" | "female" | "other" | "unknown";
export type WardCategory = "male" | "female" | "children";

export interface WardPolicyPatient {
  age: number;
  gender: PatientGenderForWard;
}

export interface WardPolicyDecision {
  category: WardCategory;
  label: string;
  reason: string;
  requiresOverride: boolean;
}

export function normalizePatientGender(value: string): PatientGenderForWard {
  const gender = value.trim().toLowerCase();
  if (gender === "male" || gender === "m") return "male";
  if (gender === "female" || gender === "f") return "female";
  if (gender === "other") return "other";
  return "unknown";
}

export function recommendWardCategory(patient: WardPolicyPatient): WardPolicyDecision {
  if (Number.isFinite(patient.age) && patient.age < 10) {
    return {
      category: "children",
      label: "Children Ward",
      reason: "Patients under 10 years must be allocated to a children ward.",
      requiresOverride: false,
    };
  }

  if (patient.gender === "male") {
    return {
      category: "male",
      label: "Male Ward",
      reason: "Adult male patient should be allocated to a male ward.",
      requiresOverride: false,
    };
  }

  if (patient.gender === "female") {
    return {
      category: "female",
      label: "Female Ward",
      reason: "Adult female patient should be allocated to a female ward.",
      requiresOverride: false,
    };
  }

  return {
    category: "children",
    label: "Clinical review required",
    reason: "Ward category cannot be safely decided without a male/female gender classification or authorized clinical override.",
    requiresOverride: true,
  };
}

export function wardAssignmentAllowed(patient: WardPolicyPatient, selectedCategory: WardCategory, overrideApproved: boolean) {
  const recommendation = recommendWardCategory(patient);
  return {
    allowed: selectedCategory === recommendation.category || overrideApproved,
    recommendation,
    needsOverride: selectedCategory !== recommendation.category || recommendation.requiresOverride,
  };
}

