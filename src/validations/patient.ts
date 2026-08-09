import { z } from "zod";
import { isDistrictInProvince, isSriLankaDistrict, isSriLankaProvince } from "../data/sriLankaLocations";

function ageFromDateOfBirth(dateOfBirth: string) {
  const birthday = new Date(`${dateOfBirth}T00:00:00`);
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

const optionalText = (max: number) => z.string().max(max).optional();

const optionalEmail = z.string().email("Enter a valid email address.").max(120).optional().or(z.literal(""));

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

/**
 * System-wide patient registration policy:
 * - Only the minimum safe demographic set is mandatory.
 * - Supporting contact, identity, guardian and medical fields are optional.
 * - Optional values are still validated when staff enter them.
 */
export const patientSchema = z.object({
  patientId: optionalText(40),
  title: optionalText(30),
  firstName: z.string().trim().min(2, "First name is required.").max(80),
  middleName: optionalText(80),
  lastName: z.string().trim().min(2, "Last name is required.").max(80),
  preferredName: optionalText(80),
  nicOrPassport: optionalText(32),
  passportNumber: optionalText(32),
  birthCertificateNo: optionalText(40),
  dateOfBirth: z.string().min(1, "Date of birth is required."),
  age: optionalText(10),
  sex: optionalText(40),
  maritalStatus: optionalText(40),
  phone: optionalText(20),
  email: optionalEmail,
  address: optionalText(240),
  district: optionalText(80),
  province: optionalText(80),
  postalCode: optionalText(20),
  gnDivision: optionalText(120),
  bloodGroup: optionalText(20),
  nationality: optionalText(80),
  ethnicity: optionalText(80),
  religion: optionalText(80),
  allergies: optionalText(1000),
  chronicDiseases: optionalText(1000),
  currentMedications: optionalText(1000),
  pastSurgeries: optionalText(1000),
  familyHistory: optionalText(1000),
  immunizationHistory: optionalText(1000),
  pregnancyHistory: optionalText(1000),
  disabilityStatus: optionalText(1000),
  riskCategory: z.enum(["routine", "moderate", "high", "critical"]).default("routine"),
  guardianName: optionalText(120),
  guardianRelationship: optionalText(80),
  guardianNic: optionalText(32),
  guardianPhone: optionalText(20),
  occupation: optionalText(120),
  employer: optionalText(160),
  preferredLanguage: optionalText(40),
  smokingStatus: optionalText(80),
  alcoholUse: optionalText(80),
  organDonorStatus: optionalText(80),
  insuranceDetails: optionalText(500),
  socialHistory: optionalText(1000),
  communicationPreferences: optionalText(500),
  emergencyContactName: optionalText(120),
  emergencyContactRelationship: optionalText(80),
  emergencyContactPhone: optionalText(20),
  consentToShare: z.boolean().default(false),
}).superRefine((value, ctx) => {
  const age = ageFromDateOfBirth(value.dateOfBirth);
  if (age === undefined) {
    ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Enter a valid date of birth that is not in the future." });
    return;
  }

  if (value.phone && !isValidSriLankanPhone(value.phone)) {
    ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a valid Sri Lankan phone number or leave it blank." });
  }
  if (value.emergencyContactPhone && !isValidSriLankanPhone(value.emergencyContactPhone)) {
    ctx.addIssue({ code: "custom", path: ["emergencyContactPhone"], message: "Enter a valid emergency contact phone number or leave it blank." });
  }
  if (value.guardianPhone && !isValidSriLankanPhone(value.guardianPhone)) {
    ctx.addIssue({ code: "custom", path: ["guardianPhone"], message: "Enter a valid guardian phone number or leave it blank." });
  }

  if (value.nicOrPassport && !isValidNic(value.nicOrPassport) && !isValidPassport(value.nicOrPassport)) {
    ctx.addIssue({ code: "custom", path: ["nicOrPassport"], message: "Enter a valid Sri Lankan NIC/passport number or leave it blank." });
  }
  if (value.passportNumber && !isValidPassport(value.passportNumber)) {
    ctx.addIssue({ code: "custom", path: ["passportNumber"], message: "Enter a valid passport number or leave it blank." });
  }
  if (value.birthCertificateNo && !isValidBirthCertificate(value.birthCertificateNo)) {
    ctx.addIssue({ code: "custom", path: ["birthCertificateNo"], message: "Enter a valid birth certificate number or leave it blank." });
  }
  if (value.guardianNic && !isValidNic(value.guardianNic)) {
    ctx.addIssue({ code: "custom", path: ["guardianNic"], message: "Enter a valid guardian NIC or leave it blank." });
  }
  if (value.province && !isSriLankaProvince(value.province)) {
    ctx.addIssue({ code: "custom", path: ["province"], message: "Select a valid Sri Lankan province." });
  }
  if (value.district && !isSriLankaDistrict(value.district)) {
    ctx.addIssue({ code: "custom", path: ["district"], message: "Select a valid Sri Lankan district." });
  }
  if (value.province && value.district && !isDistrictInProvince(value.district, value.province)) {
    ctx.addIssue({ code: "custom", path: ["district"], message: "The selected district does not belong to the selected province." });
  }
});

export type PatientInput = z.input<typeof patientSchema>;
