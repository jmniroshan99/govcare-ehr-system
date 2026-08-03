export type PatientGenderDisplay = "Male" | "Female" | "Other" | "Prefer Not to Say" | string;

export function normaliseGenderLabel(value?: string) {
  const gender = (value ?? "").trim().toLowerCase();
  if (gender === "male" || gender === "m") return "Male";
  if (gender === "female" || gender === "f") return "Female";
  if (gender === "prefer not to say" || gender === "prefer_not_to_say" || gender === "not stated") return "Prefer Not to Say";
  if (gender === "other") return "Other";
  return value?.trim() || "Not recorded";
}

export function genderShortLabel(value?: string) {
  const gender = normaliseGenderLabel(value);
  if (gender === "Male") return "M";
  if (gender === "Female") return "F";
  if (gender === "Prefer Not to Say") return "PNTS";
  if (gender === "Not recorded") return "NR";
  return gender.slice(0, 3).toUpperCase();
}
