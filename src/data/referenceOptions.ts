export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  keywords?: string[];
  meta?: Record<string, unknown>;
};

export const TITLE_OPTIONS: SelectOption[] = [
  ["Mr", "Mr"], ["Mrs", "Mrs"], ["Ms", "Ms"], ["Miss", "Miss"], ["Dr", "Dr"],
  ["Prof", "Prof"], ["Rev", "Rev"], ["Other", "Other"], ["Not stated", "Not stated"],
].map(([value, label]) => ({ value, label }));

export const GENDER_OPTIONS: SelectOption[] = [
  ["male", "Male"], ["female", "Female"], ["other", "Other"], ["unknown", "Unknown"], ["prefer_not_to_say", "Not stated"],
].map(([value, label]) => ({ value, label }));

export const MARITAL_STATUS_OPTIONS: SelectOption[] = [
  "Single", "Married", "Divorced", "Widowed", "Separated", "Not stated",
].map((value) => ({ value, label: value }));

export const BLOOD_GROUP_OPTIONS: SelectOption[] = [
  "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown",
].map((value) => ({ value, label: value }));

export const LANGUAGE_OPTIONS: SelectOption[] = [
  ["English", "English"], ["Sinhala", "Sinhala"], ["Tamil", "Tamil"], ["Other", "Other"],
].map(([value, label]) => ({ value, label }));

export const RISK_CATEGORY_OPTIONS: SelectOption[] = [
  ["routine", "Routine"], ["moderate", "Moderate"], ["high", "High"], ["critical", "Critical"],
].map(([value, label]) => ({ value, label }));

export const PRIORITY_OPTIONS: SelectOption[] = [
  ["routine", "Routine"], ["urgent", "Urgent"], ["stat", "Emergency / STAT"], ["critical", "Critical"],
].map(([value, label]) => ({ value, label }));

export const ADMISSION_TYPE_OPTIONS: SelectOption[] = [
  ["emergency", "Emergency"], ["elective", "Elective"], ["transfer", "Transfer"], ["observation", "Observation"], ["maternity", "Maternity"], ["icu", "ICU"],
].map(([value, label]) => ({ value, label }));

export const ISOLATION_OPTIONS: SelectOption[] = [
  ["none", "No isolation"], ["contact", "Contact"], ["droplet", "Droplet"], ["airborne", "Airborne"], ["protective", "Protective"], ["other", "Other"],
].map(([value, label]) => ({ value, label }));

export const SMOKING_STATUS_OPTIONS: SelectOption[] = [
  "Never", "Former", "Current", "Unknown", "Not stated",
].map((value) => ({ value, label: value }));

export const ALCOHOL_USE_OPTIONS: SelectOption[] = [
  "None", "Occasional", "Regular", "Former", "Unknown", "Not stated",
].map((value) => ({ value, label: value }));

export const ORGAN_DONOR_OPTIONS: SelectOption[] = [
  "Yes", "No", "Unknown", "Not stated",
].map((value) => ({ value, label: value }));

export const MEDICINE_ROUTE_OPTIONS: SelectOption[] = [
  "Oral", "IV", "IM", "Subcutaneous", "Topical", "Inhaled", "Rectal", "Vaginal", "Ophthalmic", "Otic", "Other",
].map((value) => ({ value, label: value }));

export const MEDICINE_FREQUENCY_OPTIONS: SelectOption[] = [
  ["OD", "Once daily"], ["BD", "Twice daily"], ["TDS", "Three times daily"], ["QDS", "Four times daily"],
  ["Q4H", "Every 4 hours"], ["Q6H", "Every 6 hours"], ["Q8H", "Every 8 hours"], ["Q12H", "Every 12 hours"],
  ["ON", "At night"], ["PRN", "As required"], ["STAT", "Stat"], ["CUSTOM", "Custom"],
].map(([value, label]) => ({ value, label }));

export const DURATION_UNIT_OPTIONS: SelectOption[] = [
  "Hours", "Days", "Weeks", "Months", "Until review",
].map((value) => ({ value, label: value }));

export const DOSE_UNIT_OPTIONS: SelectOption[] = [
  "mg", "g", "microgram", "mL", "L", "tablet", "capsule", "unit", "puff", "drop", "application",
].map((value) => ({ value, label: value }));

export const SPECIMEN_TYPE_OPTIONS: SelectOption[] = [
  "Blood", "Serum", "Plasma", "Urine", "Stool", "Sputum", "Swab", "CSF", "Tissue", "Other",
].map((value) => ({ value, label: value }));

export const RADIOLOGY_MODALITY_OPTIONS: SelectOption[] = [
  "X-ray", "Ultrasound", "CT", "MRI", "Mammography", "Fluoroscopy", "Other",
].map((value) => ({ value, label: value }));

export const BODY_REGION_OPTIONS: SelectOption[] = [
  "Head", "Brain", "Neck", "Chest", "Abdomen", "Pelvis", "Spine", "Upper limb", "Lower limb", "Whole body", "Other",
].map((value) => ({ value, label: value }));

export const YES_NO_UNKNOWN_OPTIONS: SelectOption[] = [
  ["yes", "Yes"], ["no", "No"], ["unknown", "Unknown / not recorded"],
].map(([value, label]) => ({ value, label }));

export const MEASUREMENT_LIMITS = {
  temperature: { min: 25, max: 45, step: 0.1, unit: "°C" },
  pulse: { min: 20, max: 250, step: 1, unit: "bpm" },
  respiratoryRate: { min: 5, max: 80, step: 1, unit: "/min" },
  systolic: { min: 40, max: 300, step: 1, unit: "mmHg" },
  diastolic: { min: 20, max: 200, step: 1, unit: "mmHg" },
  spo2: { min: 50, max: 100, step: 1, unit: "%" },
  height: { min: 20, max: 250, step: 0.1, unit: "cm" },
  weight: { min: 0.5, max: 500, step: 0.1, unit: "kg" },
  pain: { min: 0, max: 10, step: 1, unit: "/10" },
  glucose: { min: 0, max: 1000, step: 0.1, unit: "mg/dL" },
  urineOutput: { min: 0, max: 10000, step: 1, unit: "mL" },
  gcs: { min: 3, max: 15, step: 1, unit: "/15" },
} as const;

export const COMMON_ALLERGY_OPTIONS: SelectOption[] = [
  "No known allergies", "Penicillin", "Sulfonamides", "NSAIDs", "Aspirin", "Latex", "Peanuts", "Seafood", "Egg", "Milk", "Dust", "Pollen", "Unknown allergy",
].map((value) => ({ value, label: value }));

export const COMMON_CHRONIC_DISEASE_OPTIONS: SelectOption[] = [
  "None recorded", "Diabetes mellitus", "Hypertension", "Asthma", "Ischaemic heart disease", "Chronic kidney disease", "Epilepsy", "Thyroid disease", "Arthritis", "Chronic obstructive pulmonary disease",
].map((value) => ({ value, label: value }));
