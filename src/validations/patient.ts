import { z } from "zod";

function ageFromDateOfBirth(dateOfBirth: string) {
  const birthday = new Date(dateOfBirth);
  if (Number.isNaN(birthday.getTime())) return undefined;
  const today = new Date();
  let age = today.getFullYear() - birthday.getFullYear();
  const hasBirthdayPassed = today.getMonth() > birthday.getMonth() || (today.getMonth() === birthday.getMonth() && today.getDate() >= birthday.getDate());
  if (!hasBirthdayPassed) age -= 1;
  return age >= 0 ? age : undefined;
}

const oldNicPattern = /^[0-9]{9}[VX]$/i;
const newNicPattern = /^[0-9]{12}$/;
const passportPattern = /^[A-Z0-9]{5,32}$/i;
const birthCertificatePattern = /^[A-Z0-9/-]{4,40}$/i;
const phonePattern = /^(?:\+94|0)?[0-9]{9}$/;

function normalizeIdentifier(value?: string) {
  return (value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidNic(value?: string) {
  const normalized = normalizeIdentifier(value);
  return oldNicPattern.test(normalized) || newNicPattern.test(normalized);
}

export function isValidPassport(value?: string) {
  const normalized = normalizeIdentifier(value);
  return passportPattern.test(normalized);
}

export function isValidBirthCertificate(value?: string) {
  const normalized = normalizeIdentifier(value);
  return birthCertificatePattern.test(normalized);
}

export function isValidSriLankanPhone(value?: string) {
  const normalized = normalizeIdentifier(value).replace(/[-()]/g, "");
  return phonePattern.test(normalized);
}

export const patientSchema = z.object({
  patientId: z.string().optional(),
  title: z.string().optional(),
  firstName: z.string().min(2).max(80),
  middleName: z.string().max(80).optional(),
  lastName: z.string().min(2).max(80),
  preferredName: z.string().max(80).optional(),
  nicOrPassport: z.string().max(32).optional(),
  passportNumber: z.string().max(32).optional(),
  birthCertificateNo: z.string().max(40).optional(),
  dateOfBirth: z.string().min(1),
  age: z.string().optional(),
  sex: z.string().min(1).optional(),
  maritalStatus: z.string().optional(),
  phone: z.string().min(7).max(20),
  email: z.string().max(120).optional(),
  address: z.string().min(5).max(240),
  district: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  gnDivision: z.string().optional(),
  bloodGroup: z.string().optional(),
  nationality: z.string().optional(),
  ethnicity: z.string().optional(),
  religion: z.string().optional(),
  allergies: z.string().optional(),
  chronicDiseases: z.string().optional(),
  currentMedications: z.string().optional(),
  pastSurgeries: z.string().optional(),
  familyHistory: z.string().optional(),
  immunizationHistory: z.string().optional(),
  pregnancyHistory: z.string().optional(),
  disabilityStatus: z.string().optional(),
  riskCategory: z.enum(["routine", "moderate", "high", "critical"]).default("routine"),
  guardianName: z.string().optional(),
  guardianRelationship: z.string().optional(),
  guardianNic: z.string().optional(),
  guardianPhone: z.string().optional(),
  occupation: z.string().optional(),
  employer: z.string().optional(),
  preferredLanguage: z.string().optional(),
  smokingStatus: z.string().optional(),
  alcoholUse: z.string().optional(),
  organDonorStatus: z.string().optional(),
  insuranceDetails: z.string().optional(),
  socialHistory: z.string().optional(),
  communicationPreferences: z.string().optional(),
  emergencyContactName: z.string().min(2),
  emergencyContactRelationship: z.string().min(2),
  emergencyContactPhone: z.string().min(7).max(20),
  consentToShare: z.boolean().default(false),
}).superRefine((value, ctx) => {
  const age = ageFromDateOfBirth(value.dateOfBirth);
  if (age === undefined) return;
  if (!isValidSriLankanPhone(value.phone)) {
    ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a valid Sri Lankan phone number." });
  }
  if (!isValidSriLankanPhone(value.emergencyContactPhone)) {
    ctx.addIssue({ code: "custom", path: ["emergencyContactPhone"], message: "Enter a valid emergency contact phone number." });
  }
  if (age >= 16) {
    const hasValidNic = isValidNic(value.nicOrPassport);
    const hasValidPassport = isValidPassport(value.passportNumber) || isValidPassport(value.nicOrPassport);
    if (!hasValidNic && !hasValidPassport) {
      ctx.addIssue({ code: "custom", path: ["nicOrPassport"], message: "Adults must have a valid Sri Lankan NIC or passport number." });
    }
    return;
  }
  if (!isValidBirthCertificate(value.birthCertificateNo)) {
    ctx.addIssue({ code: "custom", path: ["birthCertificateNo"], message: "Birth certificate number is required for patients under 16 years old." });
  }
  if (!value.guardianName?.trim()) {
    ctx.addIssue({ code: "custom", path: ["guardianName"], message: "Guardian name is required for patients under 16 years old." });
  }
  if (!value.guardianRelationship?.trim()) {
    ctx.addIssue({ code: "custom", path: ["guardianRelationship"], message: "Guardian relationship is required for patients under 16 years old." });
  }
  if (!isValidNic(value.guardianNic)) {
    ctx.addIssue({ code: "custom", path: ["guardianNic"], message: "Valid guardian NIC is required for patients under 16 years old." });
  }
  if (!isValidSriLankanPhone(value.guardianPhone)) {
    ctx.addIssue({ code: "custom", path: ["guardianPhone"], message: "Valid guardian phone is required for patients under 16 years old." });
  }
});

export type PatientInput = z.input<typeof patientSchema>;
