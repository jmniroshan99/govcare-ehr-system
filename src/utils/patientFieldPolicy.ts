import type { Role } from "../types/ehr";

export type PatientFieldState = "visible" | "hidden" | "required" | "optional" | "read-only";

export type PatientFieldId =
  | "patientId"
  | "nicOrPassport"
  | "passportNumber"
  | "birthCertificateNo"
  | "title"
  | "firstName"
  | "middleName"
  | "lastName"
  | "preferredName"
  | "dateOfBirth"
  | "age"
  | "sex"
  | "maritalStatus"
  | "bloodGroup"
  | "nationality"
  | "ethnicity"
  | "religion"
  | "address"
  | "district"
  | "province"
  | "postalCode"
  | "phone"
  | "email"
  | "emergencyContactName"
  | "emergencyContactRelationship"
  | "emergencyContactPhone"
  | "guardianName"
  | "guardianRelationship"
  | "guardianNic"
  | "guardianPhone"
  | "occupation"
  | "employer"
  | "preferredLanguage"
  | "allergies"
  | "chronicDiseases"
  | "disabilityStatus"
  | "immunizationHistory"
  | "familyHistory"
  | "pregnancyHistory"
  | "smokingStatus"
  | "alcoholUse"
  | "organDonorStatus"
  | "insuranceDetails"
  | "socialHistory"
  | "communicationPreferences"
  | "photo";

export interface PatientFieldDefinition {
  id: PatientFieldId;
  label: string;
  section: "identity" | "contact" | "guardian" | "medical" | "social";
  type: "text" | "date" | "select" | "file" | "email";
  sensitive?: boolean;
}

export interface PatientFieldPolicy {
  fieldId: PatientFieldId;
  state: PatientFieldState;
  visibleToRoles: Role[];
}

export interface PatientFieldConfiguration {
  hospitalId: string;
  genderEnabled: boolean;
  genderOptions: string[];
  fields: Record<PatientFieldId, PatientFieldPolicy>;
  customFields: Array<{ id: string; label: string; state: PatientFieldState; section: string }>;
  updatedAt: string;
  updatedBy: string;
}

const CONFIG_KEY = "govcare-patient-field-config";

export const genderDefaults = ["Male", "Female", "Other", "Prefer Not to Say"];

export const patientFieldDefinitions: PatientFieldDefinition[] = [
  { id: "patientId", label: "Patient ID", section: "identity", type: "text" },
  { id: "nicOrPassport", label: "NIC number", section: "identity", type: "text", sensitive: true },
  { id: "passportNumber", label: "Passport number", section: "identity", type: "text", sensitive: true },
  { id: "birthCertificateNo", label: "Birth certificate number", section: "identity", type: "text", sensitive: true },
  { id: "title", label: "Title", section: "identity", type: "select" },
  { id: "firstName", label: "First name", section: "identity", type: "text" },
  { id: "middleName", label: "Middle name", section: "identity", type: "text" },
  { id: "lastName", label: "Last name", section: "identity", type: "text" },
  { id: "preferredName", label: "Preferred name", section: "identity", type: "text" },
  { id: "dateOfBirth", label: "Date of birth", section: "identity", type: "date" },
  { id: "age", label: "Age", section: "identity", type: "text" },
  { id: "sex", label: "Gender", section: "identity", type: "select", sensitive: true },
  { id: "maritalStatus", label: "Marital status", section: "identity", type: "select" },
  { id: "bloodGroup", label: "Blood group", section: "identity", type: "text" },
  { id: "nationality", label: "Nationality", section: "identity", type: "text" },
  { id: "ethnicity", label: "Ethnicity", section: "identity", type: "text", sensitive: true },
  { id: "religion", label: "Religion", section: "identity", type: "text", sensitive: true },
  { id: "address", label: "Address", section: "contact", type: "text" },
  { id: "district", label: "District", section: "contact", type: "text" },
  { id: "province", label: "Province", section: "contact", type: "text" },
  { id: "postalCode", label: "Postal code", section: "contact", type: "text" },
  { id: "phone", label: "Phone number", section: "contact", type: "text" },
  { id: "email", label: "Email address", section: "contact", type: "email" },
  { id: "emergencyContactName", label: "Emergency contact", section: "contact", type: "text" },
  { id: "emergencyContactRelationship", label: "Emergency relationship", section: "contact", type: "text" },
  { id: "emergencyContactPhone", label: "Emergency phone", section: "contact", type: "text" },
  { id: "guardianName", label: "Guardian name", section: "guardian", type: "text" },
  { id: "guardianRelationship", label: "Guardian relationship", section: "guardian", type: "select" },
  { id: "guardianNic", label: "Guardian NIC", section: "guardian", type: "text", sensitive: true },
  { id: "guardianPhone", label: "Guardian phone", section: "guardian", type: "text" },
  { id: "occupation", label: "Occupation", section: "social", type: "text" },
  { id: "employer", label: "Employer", section: "social", type: "text" },
  { id: "preferredLanguage", label: "Language preference", section: "social", type: "select" },
  { id: "allergies", label: "Allergies", section: "medical", type: "text" },
  { id: "chronicDiseases", label: "Chronic diseases", section: "medical", type: "text" },
  { id: "disabilityStatus", label: "Disabilities", section: "medical", type: "text" },
  { id: "immunizationHistory", label: "Immunization history", section: "medical", type: "text" },
  { id: "familyHistory", label: "Family medical history", section: "medical", type: "text" },
  { id: "pregnancyHistory", label: "Pregnancy status/history", section: "medical", type: "text" },
  { id: "smokingStatus", label: "Smoking status", section: "social", type: "select" },
  { id: "alcoholUse", label: "Alcohol use", section: "social", type: "select" },
  { id: "organDonorStatus", label: "Organ donor status", section: "medical", type: "select" },
  { id: "insuranceDetails", label: "Insurance details", section: "social", type: "text" },
  { id: "socialHistory", label: "Social history", section: "social", type: "text" },
  { id: "communicationPreferences", label: "Communication preferences", section: "social", type: "text" },
  { id: "photo", label: "Profile photo", section: "identity", type: "file" },
];

const defaultVisibleRoles: Role[] = ["super_admin", "hospital_admin", "doctor", "nurse", "receptionist", "records_officer", "patient"];

export function createDefaultPatientFieldConfiguration(hospitalId = "hosp-colombo-national"): PatientFieldConfiguration {
  const required = new Set<PatientFieldId>(["firstName", "lastName", "dateOfBirth", "phone", "address", "emergencyContactName", "emergencyContactRelationship", "emergencyContactPhone"]);
  const readOnly = new Set<PatientFieldId>(["patientId", "age"]);
  const optional = new Set<PatientFieldId>(["middleName", "preferredName", "passportNumber", "email", "occupation", "employer", "ethnicity", "religion", "insuranceDetails", "socialHistory", "communicationPreferences"]);
  const fields = Object.fromEntries(
    patientFieldDefinitions.map((field) => [
      field.id,
      {
        fieldId: field.id,
        state: readOnly.has(field.id) ? "read-only" : required.has(field.id) ? "required" : optional.has(field.id) ? "optional" : "visible",
        visibleToRoles: defaultVisibleRoles,
      },
    ]),
  ) as Record<PatientFieldId, PatientFieldPolicy>;
  return { hospitalId, genderEnabled: true, genderOptions: genderDefaults, fields, customFields: [], updatedAt: new Date().toISOString(), updatedBy: "local-admin" };
}

export function getPatientFieldConfiguration() {
  if (typeof window === "undefined") return createDefaultPatientFieldConfiguration();
  try {
    const stored = window.localStorage.getItem(CONFIG_KEY);
    if (!stored) return createDefaultPatientFieldConfiguration();
    const parsed = JSON.parse(stored) as PatientFieldConfiguration;
    return { ...createDefaultPatientFieldConfiguration(parsed.hospitalId), ...parsed, fields: { ...createDefaultPatientFieldConfiguration(parsed.hospitalId).fields, ...parsed.fields } };
  } catch {
    return createDefaultPatientFieldConfiguration();
  }
}

export function savePatientFieldConfiguration(config: PatientFieldConfiguration) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...config, updatedAt: new Date().toISOString() }));
  window.dispatchEvent(new CustomEvent("govcare:patient-field-config-updated"));
}

export function fieldPolicy(fieldId: PatientFieldId, role?: Role | null) {
  const config = getPatientFieldConfiguration();
  const policy = config.fields[fieldId] ?? createDefaultPatientFieldConfiguration(config.hospitalId).fields[fieldId];
  const visible = policy.state !== "hidden" && (!role || policy.visibleToRoles.includes(role));
  return { config, policy, visible, required: policy.state === "required", readOnly: policy.state === "read-only" };
}
