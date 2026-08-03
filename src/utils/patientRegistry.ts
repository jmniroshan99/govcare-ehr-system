import { normalizePatientGender, recommendWardCategory, type PatientGenderForWard, type WardCategory } from "./wardPolicy";

export type PatientDependentCategory = "adult_male" | "adult_female" | "child_under_guardian" | "clinical_review";

export interface PatientClinicalClassification {
  patientId: string;
  guardianId?: string;
  hospitalId?: string;
  age?: number;
  gender: PatientGenderForWard;
  dependentCategory: PatientDependentCategory;
  recommendedWardCategory: WardCategory;
  recommendedWardLabel: string;
  reason: string;
  evaluatedAt: string;
  source: "patient-registration" | "guardian-management" | "patient-update" | "fallback";
}

export interface SavedPatientForDoctor {
  patientId: string;
  hospitalId?: string;
  name: string;
  nicOrPassport?: string;
  passportNumber?: string;
  birthCertificateNo?: string;
  phone: string;
  sex: string;
  age?: number;
  district?: string;
  bloodGroup?: string;
  dateOfBirth?: string;
  address?: string;
  province?: string;
  nationality?: string;
  profilePhotoUrl?: string;
  riskCategory: "routine" | "moderate" | "high" | "critical";
  allergies?: string;
  chronicDiseases?: string;
  guardianId?: string;
  guardianName?: string;
  guardianNic?: string;
  guardianPhone?: string;
  dependentType?: "adult" | "child" | "dependent";
  clinicalClassification?: PatientClinicalClassification;
  assignedDoctor: string;
  visitReason: string;
  status: "new" | "waiting" | "assigned";
  registeredAt: string;
}

export type GuardianRelationship = "Father" | "Mother" | "Grandparent" | "Spouse" | "Sibling" | "Legal Guardian" | "Other";

export interface GuardianProfile {
  guardianId: string;
  nic: string;
  fullName: string;
  address?: string;
  phone: string;
  secondaryPhone?: string;
  email?: string;
  relationshipToPatient: GuardianRelationship;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  dependentPatientIds: string[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "govcare-saved-patients";
const GUARDIAN_STORAGE_KEY = "govcare-guardian-profiles";
const GUARDIAN_LINK_STORAGE_KEY = "govcare-guardian-dependent-links";
export const PATIENTS_UPDATED_EVENT = "govcare:patients-updated";
export const GUARDIANS_UPDATED_EVENT = "govcare:guardians-updated";

export const guardianRelationships: GuardianRelationship[] = ["Father", "Mother", "Grandparent", "Spouse", "Sibling", "Legal Guardian", "Other"];

function normaliseIdentifier(value?: string) {
  return (value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

function normalisePhone(value?: string) {
  return normaliseIdentifier(value).replace(/[-()]/g, "");
}

function isSavedPatient(value: unknown): value is SavedPatientForDoctor {
  if (!value || typeof value !== "object") return false;
  const patient = value as Partial<SavedPatientForDoctor>;
  return typeof patient.patientId === "string" && typeof patient.name === "string";
}

function isGuardianProfile(value: unknown): value is GuardianProfile {
  if (!value || typeof value !== "object") return false;
  const guardian = value as Partial<GuardianProfile>;
  return typeof guardian.guardianId === "string" && typeof guardian.nic === "string" && typeof guardian.fullName === "string";
}

export function getSavedPatientsForDoctors(): SavedPatientForDoctor[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isSavedPatient) : [];
  } catch {
    return [];
  }
}

export function getGuardianProfiles(): GuardianProfile[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(GUARDIAN_STORAGE_KEY);
    if (!stored) return seedGuardianProfiles();
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isGuardianProfile) : [];
  } catch {
    return [];
  }
}

function seedGuardianProfiles(): GuardianProfile[] {
  const patients = getSavedPatientsForDoctors();
  const seeded: GuardianProfile[] = [
    {
      guardianId: "GRD-2026-000001",
      nic: "887654321V",
      fullName: "Kumari Perera",
      address: "No 18, Temple Road, Colombo",
      phone: "0715558888",
      email: "kumari.perera@example.com",
      relationshipToPatient: "Mother",
      emergencyContactName: "Sunil Perera",
      emergencyContactPhone: "0779991111",
      dependentPatientIds: ["PAT-2026-000088", ...patients.filter((patient) => patient.guardianNic === "887654321V").map((patient) => patient.patientId)],
      createdAt: "2026-06-01T08:30:00.000Z",
      updatedAt: "2026-06-01T08:30:00.000Z",
    },
  ];
  if (typeof window !== "undefined") {
    window.localStorage.setItem(GUARDIAN_STORAGE_KEY, JSON.stringify(seeded));
  }
  return seeded;
}

export function savePatientForDoctors(patient: SavedPatientForDoctor) {
  if (typeof window === "undefined") return;

  const patients = getSavedPatientsForDoctors();
  const existing = patients.find((item) => item.patientId === patient.patientId);
  const classification = classifyPatientForClinicalFlow(patient, patient.guardianId ?? existing?.guardianId, "patient-registration");
  const normalizedPatient: SavedPatientForDoctor = {
    ...patient,
    clinicalClassification: classification,
    nicOrPassport: normaliseIdentifier(patient.nicOrPassport),
    passportNumber: normaliseIdentifier(patient.passportNumber),
    birthCertificateNo: normaliseIdentifier(patient.birthCertificateNo),
    guardianNic: normaliseIdentifier(patient.guardianNic),
    guardianPhone: normalisePhone(patient.guardianPhone),
    phone: normalisePhone(patient.phone),
  };
  const nextPatients = [normalizedPatient, ...patients.filter((item) => item.patientId !== patient.patientId)].slice(0, 100);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPatients));
  window.dispatchEvent(new CustomEvent(PATIENTS_UPDATED_EVENT, { detail: { patientId: patient.patientId } }));
}

export function saveGuardianProfile(guardian: GuardianProfile) {
  if (typeof window === "undefined") return;

  const guardians = getGuardianProfiles();
  const nextGuardians = [guardian, ...guardians.filter((item) => item.guardianId !== guardian.guardianId)].slice(0, 100);
  window.localStorage.setItem(GUARDIAN_STORAGE_KEY, JSON.stringify(nextGuardians));
  window.dispatchEvent(new CustomEvent(GUARDIANS_UPDATED_EVENT, { detail: { guardianId: guardian.guardianId } }));
}

export function findPatientByNic(nic?: string) {
  const normalized = normaliseIdentifier(nic);
  if (!normalized) return undefined;
  return getSavedPatientsForDoctors().find((patient) => normaliseIdentifier(patient.nicOrPassport) === normalized);
}

export function findPatientByPassport(passport?: string) {
  const normalized = normaliseIdentifier(passport);
  if (!normalized) return undefined;
  return getSavedPatientsForDoctors().find((patient) => normaliseIdentifier(patient.passportNumber) === normalized || normaliseIdentifier(patient.nicOrPassport) === normalized);
}

export function findPatientByBirthCertificate(birthCertificateNo?: string) {
  const normalized = normaliseIdentifier(birthCertificateNo);
  if (!normalized) return undefined;
  return getSavedPatientsForDoctors().find((patient) => normaliseIdentifier(patient.birthCertificateNo) === normalized);
}

export function findDuplicatePatient(input: { age?: number; nicOrPassport?: string; passportNumber?: string; birthCertificateNo?: string; phone?: string; fullName?: string }) {
  if (input.age !== undefined && input.age >= 16) {
    return findPatientByNic(input.nicOrPassport) ?? findPatientByPassport(input.passportNumber) ?? findPatientByPassport(input.nicOrPassport);
  }
  if (input.age !== undefined && input.age < 16) {
    return findPatientByBirthCertificate(input.birthCertificateNo);
  }
  const normalizedPhone = normalisePhone(input.phone);
  const normalizedName = normaliseIdentifier(input.fullName);
  return getSavedPatientsForDoctors().find((patient) => {
    const phoneMatch = normalizedPhone && normalisePhone(patient.phone) === normalizedPhone;
    const nameMatch = normalizedName && normaliseIdentifier(patient.name) === normalizedName;
    return Boolean(phoneMatch || nameMatch);
  });
}

export function findGuardianByNic(nic?: string) {
  const normalized = normaliseIdentifier(nic);
  if (!normalized) return undefined;
  return getGuardianProfiles().find((guardian) => normaliseIdentifier(guardian.nic) === normalized);
}

export function generateGuardianId() {
  return `GRD-${new Date().getFullYear()}-${String(Math.floor(100000 + Math.random() * 899999))}`;
}

export function upsertGuardianForPatient(input: Omit<GuardianProfile, "guardianId" | "dependentPatientIds" | "createdAt" | "updatedAt"> & { patientId: string }) {
  const now = new Date().toISOString();
  const existing = findGuardianByNic(input.nic);
  const guardian: GuardianProfile = {
    ...(existing ?? {
      guardianId: generateGuardianId(),
      dependentPatientIds: [],
      createdAt: now,
    }),
    nic: normaliseIdentifier(input.nic),
    fullName: input.fullName,
    address: input.address,
    phone: normalisePhone(input.phone),
    secondaryPhone: input.secondaryPhone,
    email: input.email,
    relationshipToPatient: input.relationshipToPatient,
    emergencyContactName: input.emergencyContactName,
    emergencyContactPhone: normalisePhone(input.emergencyContactPhone),
    dependentPatientIds: Array.from(new Set([...(existing?.dependentPatientIds ?? []), input.patientId])),
    updatedAt: now,
  };
  saveGuardianProfile(guardian);
  const patient = getSavedPatientsForDoctors().find((item) => item.patientId === input.patientId);
  const classification = patient ? classifyPatientForClinicalFlow(patient, guardian.guardianId, "guardian-management") : undefined;
  saveGuardianDependentLink({
    guardianId: guardian.guardianId,
    patientId: input.patientId,
    relationshipToPatient: input.relationshipToPatient,
    dependentCategory: classification?.dependentCategory,
    recommendedWardCategory: classification?.recommendedWardCategory,
    classificationEvaluatedAt: classification?.evaluatedAt,
    linkedAt: now,
    status: "active",
  });
  return guardian;
}

export interface GuardianDependentLink {
  guardianId: string;
  patientId: string;
  relationshipToPatient: GuardianRelationship;
  dependentCategory?: PatientDependentCategory;
  recommendedWardCategory?: WardCategory;
  classificationEvaluatedAt?: string;
  linkedAt: string;
  status: "active" | "revoked";
}

function isGuardianDependentLink(value: unknown): value is GuardianDependentLink {
  if (!value || typeof value !== "object") return false;
  const link = value as Partial<GuardianDependentLink>;
  return typeof link.guardianId === "string" && typeof link.patientId === "string" && typeof link.relationshipToPatient === "string";
}

export function getGuardianDependentLinks(): GuardianDependentLink[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(GUARDIAN_LINK_STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isGuardianDependentLink) : [];
  } catch {
    return [];
  }
}

export function saveGuardianDependentLink(link: GuardianDependentLink) {
  if (typeof window === "undefined") return;

  const links = getGuardianDependentLinks();
  const nextLinks = [link, ...links.filter((item) => !(item.guardianId === link.guardianId && item.patientId === link.patientId))].slice(0, 250);
  window.localStorage.setItem(GUARDIAN_LINK_STORAGE_KEY, JSON.stringify(nextLinks));
  window.dispatchEvent(new CustomEvent(GUARDIANS_UPDATED_EVENT, { detail: { guardianId: link.guardianId, patientId: link.patientId } }));
}

export function getDependentsForGuardian(guardianId: string) {
  const activeLinks = getGuardianDependentLinks().filter((link) => link.guardianId === guardianId && link.status === "active");
  const linkedIds = new Set(activeLinks.map((link) => link.patientId));
  return getSavedPatientsForDoctors().filter((patient) => linkedIds.has(patient.patientId) || patient.guardianId === guardianId);
}

export function classifyPatientForClinicalFlow(patient: Pick<SavedPatientForDoctor, "patientId" | "age" | "sex" | "guardianId" | "hospitalId">, guardianId?: string, source: PatientClinicalClassification["source"] = "fallback"): PatientClinicalClassification {
  const gender = normalizePatientGender(patient.sex);
  const recommendation = recommendWardCategory({ age: patient.age ?? 0, gender });
  const dependentCategory: PatientDependentCategory = patient.age !== undefined && patient.age < 10
    ? "child_under_guardian"
    : gender === "male"
      ? "adult_male"
      : gender === "female"
        ? "adult_female"
        : "clinical_review";

  return {
    patientId: patient.patientId,
    guardianId: guardianId ?? patient.guardianId,
    hospitalId: patient.hospitalId,
    age: patient.age,
    gender,
    dependentCategory,
    recommendedWardCategory: recommendation.category,
    recommendedWardLabel: recommendation.label,
    reason: recommendation.reason,
    evaluatedAt: new Date().toISOString(),
    source,
  };
}

export function syncGuardianPatientClassification(patientId: string, guardianId?: string) {
  if (!guardianId) return undefined;
  const patient = getSavedPatientsForDoctors().find((item) => item.patientId === patientId);
  if (!patient) return undefined;
  const link = getGuardianDependentLinks().find((item) => item.guardianId === guardianId && item.patientId === patientId);
  const classification = classifyPatientForClinicalFlow(patient, guardianId, "guardian-management");
  saveGuardianDependentLink({
    guardianId,
    patientId,
    relationshipToPatient: link?.relationshipToPatient ?? "Legal Guardian",
    linkedAt: link?.linkedAt ?? new Date().toISOString(),
    status: "active",
    dependentCategory: classification.dependentCategory,
    recommendedWardCategory: classification.recommendedWardCategory,
    classificationEvaluatedAt: classification.evaluatedAt,
  });
  return classification;
}

export function getPatientClinicalClassification(patientId: string, fallback?: { age?: number; gender?: string; guardianId?: string; hospitalId?: string }) {
  const patient = getSavedPatientsForDoctors().find((item) => item.patientId === patientId);
  if (patient) return patient.clinicalClassification ?? classifyPatientForClinicalFlow(patient, patient.guardianId, "fallback");

  return classifyPatientForClinicalFlow({
    patientId,
    age: fallback?.age,
    sex: fallback?.gender ?? "unknown",
    guardianId: fallback?.guardianId,
    hospitalId: fallback?.hospitalId,
  }, fallback?.guardianId, "fallback");
}
