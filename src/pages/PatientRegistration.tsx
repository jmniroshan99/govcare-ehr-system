import { exportColors, themeColors } from "../theme/colors";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Baby, Camera, ChevronDown, CircleCheckBig, ClipboardCheck, Contact, Fingerprint, MapPin, QrCode, RotateCcw, ScanBarcode, Search, Settings2, ShieldAlert, Stethoscope, UserPlus } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useForm, useWatch, type FieldErrors } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { PatientCodeScanner } from "../components/patient/PatientCodeScanner";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { SmartSearch } from "../components/search/SmartSearch";
import { Input } from "../components/ui/input";
import { FormFieldLabel } from "../components/ui/form-field-label";
import { AsyncSearchableSelect, MultiSelectChips } from "../components/forms";
import { Select } from "../components/ui/select";
import { SriLankaDistrictSelect, SriLankaProvinceSelect } from "../components/location/SriLankaLocationSelects";
import { useToast } from "../components/ui/toast-context";
import {
  checkPatientDuplicate,
  createPatientRecord,
  searchPatientRecords,
  type DuplicatePatientCheckResult,
  type PatientRecord,
} from "../services/patientService";
import { calculateAgeYears } from "../utils/age";
import { ALCOHOL_USE_OPTIONS, BLOOD_GROUP_OPTIONS, COMMON_ALLERGY_OPTIONS, COMMON_CHRONIC_DISEASE_OPTIONS, ORGAN_DONOR_OPTIONS, SMOKING_STATUS_OPTIONS } from "../data/referenceOptions";
import { searchCountries } from "../services/referenceDataService";
import { isDistrictInProvince, provinceForDistrict } from "../data/sriLankaLocations";
import { fieldPolicy, getPatientFieldConfiguration, type PatientFieldId } from "../utils/patientFieldPolicy";
import { generateNewPatientPdf } from "../utils/patientPdf";
import { sanitizeInput } from "../utils/sanitize";
import { patientSchema } from "../validations/patient";
import type { PatientInput } from "../validations/patient";
import { useAuthStore } from "../stores/authStore";
import { preparePatientProfilePhoto } from "../utils/profilePhoto";

const guardianRelationships: readonly string[] = [
  "Parent",
  "Mother",
  "Father",
  "Legal guardian",
  "Spouse",
  "Sibling",
  "Other",
];

type IdentificationType = "nic" | "passport" | "birth_certificate";

const identificationOptions: ReadonlyArray<{ value: IdentificationType; label: string; placeholder: string }> = [
  { value: "nic", label: "Sri Lankan NIC", placeholder: "Enter 10- or 12-character NIC" },
  { value: "passport", label: "Passport", placeholder: "Enter passport number" },
  { value: "birth_certificate", label: "Birth certificate", placeholder: "Enter birth-certificate number" },
];

const registrationTypeOptions = [
  { value: "walk_in", label: "Walk-in" },
  { value: "appointment", label: "Appointment" },
  { value: "emergency", label: "Emergency" },
  { value: "referral", label: "Referral" },
  { value: "transfer", label: "Transfer" },
  { value: "newborn", label: "Newborn" },
] as const;

const quickRegistrationFields = new Set<keyof PatientInput>([
  "identificationType",
  "identificationNumber",
  "firstName",
  "lastName",
  "dateOfBirth",
  "sex",
  "phone",
  "province",
  "district",
  "registrationType",
  "riskCategory",
]);

function registrationDefaults(patientId: string): Partial<PatientInput> {
  return {
    identificationType: "nic",
    identificationNumber: "",
    registrationType: "walk_in",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    sex: "",
    phone: "",
    province: "",
    district: "",
    riskCategory: "routine",
    consentToShare: false,
    patientId,
    preferredLanguage: "English",
    nationality: "Sri Lankan",
  };
}

function mapIdentification(type: IdentificationType, value?: string) {
  const identifier = value?.trim() || undefined;
  return {
    nic: type === "nic" ? identifier : undefined,
    passportNo: type === "passport" ? identifier : undefined,
    birthCertificateNo: type === "birth_certificate" ? identifier : undefined,
  };
}

function nextPatientId() {
  return `PAT-${new Date().getFullYear()}-${String(Math.floor(100000 + Math.random() * 899999))}`;
}

function listFromText(value: unknown) {
  return String(value ?? "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapePrintHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function duplicateMatchLabel(matches: string[]) {
  const labels: Record<string, string> = {
    nic: "NIC",
    passport: "passport number",
    birthCertificate: "birth certificate number",
    phone: "phone number",
    nameAndDateOfBirth: "name and date of birth",
    email: "email address",
  };
  return matches.map((match) => labels[match] ?? match).join(", ");
}

export function PatientRegistration() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.role);
  const profile = useAuthStore((state) => state.profile);
  const config = getPatientFieldConfiguration();
  const [generatedId, setGeneratedId] = useState(nextPatientId());
  const [photoName, setPhotoName] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [duplicateTerm, setDuplicateTerm] = useState("");
  const [scannerMode, setScannerMode] = useState<"qr" | "barcode" | null>(null);
  const [validationSummary, setValidationSummary] = useState<string[]>([]);
  const [automaticDuplicate, setAutomaticDuplicate] = useState<DuplicatePatientCheckResult | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [isSavingPatient, setIsSavingPatient] = useState(false);
  const [showAdditional, setShowAdditional] = useState(false);
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const submissionLockRef = useRef(false);
  const allowNavigationRef = useRef(false);
  const { register, handleSubmit, control, reset, getValues, setFocus, setValue, formState: { errors, isSubmitting, isDirty } } = useForm<PatientInput>({
    resolver: zodResolver(patientSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: registrationDefaults(generatedId),
  });
  const identificationType = (useWatch({ control, name: "identificationType" }) ?? "nic") as IdentificationType;
  const identificationNumber = useWatch({ control, name: "identificationNumber" }) ?? "";
  const registrationType = useWatch({ control, name: "registrationType" }) ?? "walk_in";
  const riskCategory = useWatch({ control, name: "riskCategory" });
  const dateOfBirth = useWatch({ control, name: "dateOfBirth" });
  const watchedTitle = useWatch({ control, name: "title" });
  const watchedFirstName = useWatch({ control, name: "firstName" });
  const watchedMiddleName = useWatch({ control, name: "middleName" });
  const watchedLastName = useWatch({ control, name: "lastName" });
  const watchedSex = useWatch({ control, name: "sex" }) ?? "";
  const watchedPhone = useWatch({ control, name: "phone" });
  const watchedEmail = useWatch({ control, name: "email" });
  const watchedProvince = useWatch({ control, name: "province" }) ?? "";
  const watchedDistrict = useWatch({ control, name: "district" }) ?? "";
  const watchedBloodGroup = useWatch({ control, name: "bloodGroup" }) ?? "";
  const watchedNationality = useWatch({ control, name: "nationality" }) ?? "";
  const watchedAllergies = useWatch({ control, name: "allergies" }) ?? "";
  const watchedChronicDiseases = useWatch({ control, name: "chronicDiseases" }) ?? "";
  const watchedSmokingStatus = useWatch({ control, name: "smokingStatus" }) ?? "";
  const watchedAlcoholUse = useWatch({ control, name: "alcoholUse" }) ?? "";
  const watchedOrganDonorStatus = useWatch({ control, name: "organDonorStatus" }) ?? "";
  const patientAge = calculateAgeYears(dateOfBirth ?? "");
  const requiresGuardian = patientAge !== undefined && patientAge < 18;
  const barcodeValue = `*${generatedId.replaceAll("-", "")}*`;
  const [duplicates, setDuplicates] = useState<PatientRecord[]>([]);
  const selectedIdentification = identificationOptions.find((option) => option.value === identificationType) ?? identificationOptions[0];
  const requiredProgressValues = [
    identificationType,
    identificationNumber,
    watchedFirstName,
    watchedLastName,
    dateOfBirth,
    watchedSex,
    watchedPhone,
    watchedProvince,
    watchedDistrict,
    registrationType,
    riskCategory,
  ];
  const completedRequired = requiredProgressValues.filter((value) => String(value ?? "").trim().length > 0).length;
  const requiredProgress = Math.round((completedRequired / requiredProgressValues.length) * 100);
  const hasUnsavedChanges = isDirty || Boolean(photoDataUrl);

  useEffect(() => {
    const timer = window.setTimeout(() => setFocus("identificationNumber"), 0);
    return () => window.clearTimeout(timer);
  }, [setFocus]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (allowNavigationRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const protectInternalNavigation = (event: MouseEvent) => {
      if (allowNavigationRef.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const target = new URL(anchor.href, window.location.href);
      if (target.origin !== window.location.origin || target.pathname === window.location.pathname) return;
      if (!window.confirm("Leave patient registration? Unsaved patient information will be discarded.")) {
        event.preventDefault();
        event.stopPropagation();
      } else {
        allowNavigationRef.current = true;
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", protectInternalNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", protectInternalNavigation, true);
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const term = duplicateTerm.trim();
    if (term.length < 2) {
      setDuplicates([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void searchPatientRecords(term)
        .then(({ items }) => {
          if (!cancelled) setDuplicates(items);
        })
        .catch(() => {
          if (!cancelled) setDuplicates([]);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [duplicateTerm]);

  useEffect(() => {
    const fullName = [watchedTitle, watchedFirstName, watchedMiddleName, watchedLastName]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const identifiers = mapIdentification(identificationType, identificationNumber);
    const payload = {
      ...identifiers,
      phone: watchedPhone?.trim() || undefined,
      fullName: fullName || undefined,
      dateOfBirth: dateOfBirth?.trim() || undefined,
      email: watchedEmail?.trim() || undefined,
    };
    const minimumIdentifierLength = identificationType === "nic" ? 10 : identificationType === "passport" ? 5 : 4;
    const hasIdentifier = identificationNumber.trim().length >= minimumIdentifierLength || Boolean(payload.email);
    const hasPossibleMatchData = Boolean(payload.phone && payload.fullName && payload.dateOfBirth);

    if (!hasIdentifier && !hasPossibleMatchData) {
      setAutomaticDuplicate(null);
      setIsCheckingDuplicate(false);
      return;
    }

    let cancelled = false;
    setIsCheckingDuplicate(true);
    const timer = window.setTimeout(() => {
      void checkPatientDuplicate(payload)
        .then((result) => {
          if (!cancelled) setAutomaticDuplicate(result);
        })
        .catch(() => {
          if (!cancelled) setAutomaticDuplicate(null);
        })
        .finally(() => {
          if (!cancelled) setIsCheckingDuplicate(false);
        });
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    dateOfBirth,
    watchedEmail,
    watchedFirstName,
    watchedLastName,
    watchedMiddleName,
    watchedPhone,
    watchedTitle,
    identificationNumber,
    identificationType,
  ]);

  const shownFields = (fieldIds: PatientFieldId[]) => fieldIds.filter((id) => fieldPolicy(id, role).visible);

  function renderInput(name: PatientFieldId, label?: string, options: { required?: boolean; forceVisible?: boolean } = {}) {
    const policy = fieldPolicy(name, role);
    if (!policy.visible && !options.forceVisible) return null;
    const definition = label ?? name;
    const common = register(name as keyof PatientInput);
    const disabled = policy.readOnly || name === "patientId" || name === "age";
    const required = (options.required ?? policy.required) && !disabled;
    const error = errors[name as keyof PatientInput];
    const inputId = `patient-${name}`;
    const errorId = `${inputId}-error`;
    const valueProps = name === "patientId" ? { value: generatedId } : name === "age" ? { value: patientAge ?? "" } : {};
    return (
      <label key={name} htmlFor={inputId} className="registration-field block text-sm font-medium">
        <FormFieldLabel required={required} optional={!required && !disabled}>{definition}</FormFieldLabel>
        <Input
          id={inputId}
          type={name === "dateOfBirth" ? "date" : name === "email" ? "email" : name.includes("Phone") || name === "phone" ? "tel" : "text"}
          max={name === "dateOfBirth" ? new Date().toISOString().slice(0, 10) : undefined}
          inputMode={name.includes("Phone") || name === "phone" ? "tel" : undefined}
          autoCapitalize={name === "passportNumber" || name === "nicOrPassport" || name === "birthCertificateNo" || name === "guardianNic" ? "characters" : undefined}
          pattern={name === "nicOrPassport" || name === "guardianNic" ? "(?:[0-9]{9}[VvXx]|[0-9]{12}|[A-Za-z0-9]{5,32})" : name === "passportNumber" ? "[A-Za-z0-9]{5,32}" : undefined}
          disabled={disabled}
          required={required}
          autoComplete={name === "email" ? "email" : name === "phone" ? "tel" : "off"}
          aria-required={required || undefined}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? errorId : undefined}
          {...common}
          {...valueProps}
        />
        {error && <span id={errorId} role="alert" className="form-error flex items-start gap-1.5"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{String(error.message ?? "Enter a valid value.")}</span>}
      </label>
    );
  }

  function resetRegistration() {
    if (hasUnsavedChanges && !window.confirm("Clear this registration form? All unsaved patient information will be discarded.")) return;
    const nextId = nextPatientId();
    reset(registrationDefaults(nextId));
    setGeneratedId(nextId);
    setPhotoName("");
    setPhotoDataUrl("");
    setPhotoInputKey((current) => current + 1);
    setDuplicateTerm("");
    setDuplicates([]);
    setAutomaticDuplicate(null);
    setValidationSummary([]);
    setShowAdditional(false);
    allowNavigationRef.current = false;
    window.setTimeout(() => setFocus("identificationNumber"), 0);
  }

  function openExistingPatient(patientId: string) {
    if (hasUnsavedChanges && !window.confirm("Open the existing patient? Unsaved registration information will be discarded.")) return;
    allowNavigationRef.current = true;
    navigate(`/patients/${encodeURIComponent(patientId)}`);
  }

  async function onSubmit(values: PatientInput) {
    if (submissionLockRef.current) return;
    submissionLockRef.current = true;
    setValidationSummary([]);
    setIsSavingPatient(true);
    const sanitized = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === "string" ? sanitizeInput(value) : value]));
    const firstName = String(sanitized.firstName ?? "");
    const lastName = String(sanitized.lastName ?? "");
    const patientName = `${String(sanitized.title ?? "")} ${firstName} ${lastName}`.trim() || generatedId;
    const age = calculateAgeYears(String(sanitized.dateOfBirth ?? ""));
    const submittedIdentificationType = String(sanitized.identificationType ?? "nic") as IdentificationType;
    const submittedIdentification = String(sanitized.identificationNumber ?? "");
    const identifiers = mapIdentification(submittedIdentificationType, submittedIdentification);

    try {
      const duplicateCheck = await checkPatientDuplicate({
        ...identifiers,
        phone: String(sanitized.phone ?? ""),
        fullName: patientName,
        dateOfBirth: String(sanitized.dateOfBirth ?? ""),
        email: String(sanitized.email ?? ""),
      });
      setAutomaticDuplicate(duplicateCheck);
      if (duplicateCheck.duplicate && duplicateCheck.patient) {
        showToast(
          `${duplicateCheck.patient.full_name} is already registered as ${duplicateCheck.patient.patient_no}. Duplicate registration was blocked.`,
          "warning",
        );
        return;
      }

      const saved = await createPatientRecord({
        patientId: generatedId,
        title: String(sanitized.title ?? ""),
        fullName: patientName,
        preferredName: String(sanitized.preferredName ?? ""),
        dateOfBirth: String(sanitized.dateOfBirth ?? ""),
        gender: String(sanitized.sex ?? ""),
        registrationType: String(sanitized.registrationType ?? "walk_in"),
        ...identifiers,
        bloodGroup: String(sanitized.bloodGroup ?? ""),
        nationality: String(sanitized.nationality ?? ""),
        phone: String(sanitized.phone ?? ""),
        email: String(sanitized.email ?? ""),
        address: String(sanitized.address ?? ""),
        district: String(sanitized.district ?? ""),
        province: String(sanitized.province ?? ""),
        profilePhotoUrl: photoDataUrl || undefined,
        languagePreference: String(sanitized.preferredLanguage ?? "English"),
        emergencyContact: {
          name: String(sanitized.emergencyContactName ?? sanitized.guardianName ?? ""),
          relationship: String(sanitized.emergencyContactRelationship ?? sanitized.guardianRelationship ?? ""),
          phone: String(sanitized.emergencyContactPhone ?? sanitized.guardianPhone ?? ""),
          guardianNic: String(sanitized.guardianNic ?? ""),
        },
        allergies: listFromText(sanitized.allergies),
        chronicDiseases: listFromText(sanitized.chronicDiseases),
        disabilities: listFromText(sanitized.disabilityStatus),
        familyHistory: listFromText(sanitized.familyHistory),
        riskFlags: [values.riskCategory ?? "routine"].filter(Boolean),
      });

      const patient = saved.patient;
      if (!saved.duplicate) {
        try {
          generateNewPatientPdf({
            patientId: patient.patient_no,
            fullName: patient.full_name,
            dateOfBirth: patient.date_of_birth,
            age: patient.age_years ?? age,
            gender: patient.gender ?? String(sanitized.sex ?? ""),
            nic: patient.nic ?? identifiers.nic ?? "",
            passportNumber: patient.passport_no ?? identifiers.passportNo ?? "",
            birthCertificateNo: patient.birth_certificate_no ?? identifiers.birthCertificateNo ?? "",
            bloodGroup: patient.blood_group ?? String(sanitized.bloodGroup ?? ""),
            nationality: patient.nationality ?? String(sanitized.nationality ?? ""),
            phone: patient.phone ?? String(sanitized.phone ?? ""),
            email: patient.email ?? String(sanitized.email ?? ""),
            address: patient.address ?? String(sanitized.address ?? ""),
            district: patient.district ?? String(sanitized.district ?? ""),
            province: patient.province ?? String(sanitized.province ?? ""),
            guardianName: String(sanitized.guardianName ?? ""),
            guardianRelationship: String(sanitized.guardianRelationship ?? ""),
            allergies: String(sanitized.allergies ?? ""),
            chronicDiseases: String(sanitized.chronicDiseases ?? ""),
            riskCategory: values.riskCategory ?? "routine",
            preparedBy: profile?.displayName ?? role ?? "Records officer",
          });
        } catch (pdfError) {
          console.error("Failed to generate new patient registration PDF:", pdfError);
        }
      }

      showToast(
        saved.duplicate
          ? `Existing PostgreSQL patient ${patient.patient_no} opened. Duplicate registration was prevented.`
          : `${patient.full_name} registered as ${patient.patient_no}.`,
        saved.duplicate ? "warning" : "success",
      );
      allowNavigationRef.current = true;
      navigate(`/patients/${encodeURIComponent(patient.id)}`);
      const nextId = nextPatientId();
      reset(registrationDefaults(nextId));
      setPhotoName("");
      setPhotoDataUrl("");
      setDuplicateTerm("");
      setGeneratedId(nextId);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to save the patient to PostgreSQL.", "danger");
    } finally {
      submissionLockRef.current = false;
      setIsSavingPatient(false);
    }
  }

  function onInvalid(formErrors: FieldErrors<PatientInput>) {
    const entries = Object.entries(formErrors);
    const messages = entries.map(([field, error]) => {
      const message = typeof error?.message === "string" ? error.message : "Enter a valid value.";
      return `${field}: ${message}`;
    });
    setValidationSummary(messages);

    const firstField = entries[0]?.[0] as keyof PatientInput | undefined;
    const firstMessage = entries[0]?.[1]?.message;
    showToast(
      firstMessage
        ? `Registration was not submitted: ${String(firstMessage)}`
        : "Registration was not submitted. Correct the highlighted fields.",
      "danger",
    );

    if (firstField) {
      if (!quickRegistrationFields.has(firstField)) setShowAdditional(true);
      window.setTimeout(() => {
        try {
          setFocus(firstField);
        } catch {
          // Some policy-controlled fields may not be mounted. The fallback scroll still works.
        }
        const target = document.querySelector<HTMLElement>(`[name="${String(firstField)}"]`);
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 0);
    }
  }

  function handleScannedCode(value: string) {
    setDuplicateTerm(value);
    showToast(`Scanned value added: ${value}`, "success");
  }

  function printPatientIdentifier(kind: "qr" | "barcode") {
    const values = getValues();
    const patientName = `${values.title ?? ""} ${values.firstName ?? ""} ${values.middleName ?? ""} ${values.lastName ?? ""}`.replace(/\s+/g, " ").trim() || "Pending patient name";
    const age = calculateAgeYears(values.dateOfBirth ?? "");
    const identifier = values.identificationNumber;
    const hospitalId = profile?.hospitalId ?? "current-hospital";
    const qrValue = JSON.stringify({
      version: 1,
      type: "govcare-patient",
      patientNo: generatedId,
      identifier: identifier || undefined,
      hospitalId,
    });
    const qrMarkup = kind === "qr"
      ? renderToStaticMarkup(
          <QRCodeSVG
            value={qrValue}
            size={280}
            level="H"
            marginSize={4}
            bgColor={exportColors.paper}
            fgColor={exportColors.qrInk}
            title={`GovCare patient QR code for ${generatedId}`}
          />,
        )
      : "";
    const guardianLine = age !== undefined && age < 18
      ? `<p><strong>Guardian:</strong> ${escapePrintHtml(values.guardianName || "Not recorded")} (${escapePrintHtml(values.guardianRelationship || "Guardian")})</p>`
      : "";
    const printWindow = window.open("", "_blank", "width=760,height=900");
    if (!printWindow) {
      showToast("Popup blocked. Allow popups to print the patient card.", "warning");
      return;
    }

    const codeBlock = kind === "qr"
      ? `<div class="qr-code" aria-label="Patient QR code">${qrMarkup}</div><p class="scan-note">Scan this QR code to identify the patient in GovCare EHR.</p>`
      : `<div class="barcode-value">${escapePrintHtml(barcodeValue)}</div><p class="scan-note">Patient barcode value</p>`;

    printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>GovCare ${kind.toUpperCase()} Card</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; background: ${themeColors.light.background}; color: ${exportColors.qrInk}; font-family: Arial, Helvetica, sans-serif; }
    .card { width: min(100%, 620px); margin: 0 auto; border: 2px solid ${exportColors.brand}; border-radius: 18px; background: ${exportColors.paper}; overflow: hidden; box-shadow: ${themeColors.light.shadow}; }
    .header { padding: 18px 24px; background: ${exportColors.brand}; color: ${exportColors.paper}; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 5px 0 0; font-size: 14px; }
    .content { padding: 24px; text-align: center; }
    .patient-no { margin: 0; font-size: 32px; letter-spacing: .5px; }
    .patient-name { margin: 8px 0 18px; font-size: 24px; }
    .details { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; margin: 0 auto 18px; max-width: 520px; text-align: left; font-size: 15px; }
    .details p { margin: 0; padding: 8px 10px; border-radius: 8px; background: ${themeColors.light.surfaceMuted}; overflow-wrap: anywhere; }
    .qr-code { display: inline-flex; align-items: center; justify-content: center; min-width: 300px; min-height: 300px; margin: 6px auto 8px; padding: 10px; border: 1px solid ${themeColors.light.border}; border-radius: 14px; background: ${exportColors.paper}; }
    .qr-code svg { display: block; width: 280px !important; height: 280px !important; shape-rendering: crispEdges; }
    .barcode-value { margin: 24px auto 10px; padding: 22px; border: 1px solid ${themeColors.light.border}; border-radius: 12px; font-family: 'Courier New', monospace; font-size: 30px; font-weight: 700; letter-spacing: 5px; overflow-wrap: anywhere; }
    .scan-note { margin: 8px 0 0; color: ${themeColors.light.muted}; font-size: 14px; }
    .security-note { margin: 16px 0 0; padding-top: 14px; border-top: 1px solid ${themeColors.light.border}; color: ${themeColors.light.muted}; font-size: 12px; }
    .actions { display: flex; justify-content: center; gap: 10px; padding: 0 24px 24px; }
    button { padding: 11px 20px; border: 0; border-radius: 9px; background: ${exportColors.brand}; color: ${exportColors.paper}; font-size: 15px; font-weight: 700; cursor: pointer; }
    @page { size: A5 portrait; margin: 10mm; }
    @media print {
      body { padding: 0; background: ${exportColors.paper}; }
      .card { width: 100%; border: 1.5px solid ${exportColors.brand}; border-radius: 10px; box-shadow: none; }
      .actions { display: none; }
      .qr-code { break-inside: avoid; }
    }
    @media (max-width: 560px) {
      body { padding: 10px; }
      .content { padding: 18px; }
      .details { grid-template-columns: 1fr; }
      .qr-code { min-width: 270px; min-height: 270px; }
      .qr-code svg { width: 250px !important; height: 250px !important; }
    }
  </style>
</head>
<body>
  <article class="card">
    <header class="header">
      <h1>GovCare EHR</h1>
      <p>Government Hospital Patient Identifier</p>
    </header>
    <main class="content">
      <h2 class="patient-no">${escapePrintHtml(generatedId)}</h2>
      <h3 class="patient-name">${escapePrintHtml(patientName)}</h3>
      <div class="details">
        <p><strong>Gender:</strong> ${escapePrintHtml(values.sex || "Not recorded")}</p>
        <p><strong>Age:</strong> ${escapePrintHtml(age ?? "Not recorded")}</p>
        <p><strong>Identifier:</strong> ${escapePrintHtml(identifier || "Not recorded")}</p>
        <p><strong>Phone:</strong> ${escapePrintHtml(values.phone || "Not recorded")}</p>
        <p><strong>District:</strong> ${escapePrintHtml(values.district || "Not recorded")}</p>
        <p><strong>Hospital:</strong> ${escapePrintHtml(profile?.hospitalName || "GovCare Hospital")}</p>
      </div>
      ${guardianLine}
      ${codeBlock}
      <p class="security-note">The QR code contains a GovCare patient identifier payload. Clinical information is not printed inside the QR code.</p>
    </main>
    <footer class="actions"><button type="button" onclick="window.print()">Print ${kind === "qr" ? "QR card" : "barcode"}</button></footer>
  </article>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    showToast(`${kind.toUpperCase()} card opened for printing.`, "success");
  }

  const provinceRegistration = register("province");
  const districtRegistration = register("district");

  return (
    <div className="patient-registration-page space-y-5">
      <PatientCodeScanner open={scannerMode !== null} mode={scannerMode ?? "qr"} onClose={() => setScannerMode(null)} onDetected={handleScannedCode} />
      <header className="page-hero flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success"><CircleCheckBig className="h-3.5 w-3.5" />Quick Registration</Badge>
            <Badge tone="neutral">Patient ID: {generatedId}</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-bold">Register a patient</h1>
          <p className="mt-1 text-sm text-muted-foreground">Complete the essential fields first. Optional demographic, contact, guardian, and medical information stays collapsed until it is needed.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(role === "super_admin" || role === "hospital_admin") && <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-control-border bg-surface px-4 text-sm font-semibold text-foreground hover:bg-muted" to="/admin/patient-fields"><Settings2 className="h-4 w-4" />Field policy</Link>}
          <Button type="button" variant="outline" onClick={() => { const nextId = nextPatientId(); setGeneratedId(nextId); setValue("patientId", nextId); }}><Fingerprint className="h-4 w-4" />New patient ID</Button>
        </div>
      </header>

      <details className="rounded-lg border border-border bg-card shadow-sm">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-foreground">
          <span className="flex items-center gap-2"><Search className="h-4 w-4 text-accent" />Find an existing patient before creating a new record</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </summary>
        <div className="grid gap-3 border-t border-border p-4 md:grid-cols-[1fr_auto]">
            <SmartSearch placeholder="Search NIC, passport, birth certificate, name, or phone" scope="patients" value={duplicateTerm} onChange={setDuplicateTerm} />
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" onClick={() => setScannerMode("qr")}><QrCode className="h-4 w-4" />QR scan</Button>
              <Button type="button" variant="outline" onClick={() => setScannerMode("barcode")}><ScanBarcode className="h-4 w-4" />Barcode scan</Button>
            </div>
            <div className="md:col-span-2">
              {duplicates.length ? (
                <div className="grid gap-2">
                  {duplicates.map((patient) => <button type="button" key={patient.id} className="rounded-md border border-warning-border bg-warning-surface px-3 py-2 text-left text-sm font-semibold text-warning" onClick={() => openExistingPatient(patient.id)}>Existing record: {patient.patient_no} — {patient.full_name} — {patient.nic || patient.passport_no || patient.birth_certificate_no || patient.phone || "No identifier"}</button>)}
                </div>
              ) : <p className="text-sm text-muted-foreground">Enter at least two characters to search within your authorized hospital scope.</p>}
            </div>
        </div>
      </details>

      <form className="space-y-4 pb-2" noValidate autoComplete="off" onSubmit={handleSubmit(onSubmit, onInvalid)}>
        <div className="rounded-lg border border-info-border bg-info-surface px-4 py-3 text-sm text-info">
          <p className="font-semibold">Fields marked Required must be completed.</p>
          <p className="mt-1">GovCare validates each field when you leave it and keeps correctly entered information if another field needs attention.</p>
        </div>
        {validationSummary.length > 0 && (
          <div role="alert" aria-live="assertive" className="rounded-lg border border-danger-border bg-danger-surface px-4 py-3 text-sm text-danger">
            <p className="flex items-center gap-2 font-semibold"><AlertCircle className="h-4 w-4" />Patient registration was not submitted.</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">{validationSummary.slice(0, 5).map((message) => <li key={message}>{message}</li>)}</ul>
          </div>
        )}
        <Card className="registration-section">
          <CardHeader><CardTitle className="flex items-center gap-2"><Fingerprint className="h-5 w-5 text-accent" />1. Patient identification</CardTitle><p className="mt-1 text-xs text-muted-foreground">One identification selector replaces the three separate NIC, passport, and birth-certificate rows.</p></CardHeader>
          <CardContent className="registration-grid">
            <label htmlFor="identification-type" className="registration-field block text-sm font-medium">
              <FormFieldLabel required>Identification type</FormFieldLabel>
              <Select id="identification-type" required aria-required="true" aria-invalid={errors.identificationType ? "true" : undefined} aria-describedby={errors.identificationType ? "identification-type-error" : undefined} {...register("identificationType")}>
                {identificationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
              {errors.identificationType && <span id="identification-type-error" role="alert" className="form-error flex items-start gap-1.5"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{String(errors.identificationType.message)}</span>}
            </label>
            <label htmlFor="identification-number" className="registration-field block text-sm font-medium">
              <FormFieldLabel required>{selectedIdentification.label} number</FormFieldLabel>
              <Input id="identification-number" className="uppercase" required aria-required="true" aria-invalid={errors.identificationNumber ? "true" : undefined} aria-describedby={errors.identificationNumber ? "identification-number-error" : "identification-number-help"} autoCapitalize="characters" autoComplete="off" placeholder={selectedIdentification.placeholder} {...register("identificationNumber")} />
              {errors.identificationNumber ? <span id="identification-number-error" role="alert" className="form-error flex items-start gap-1.5"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{String(errors.identificationNumber.message)}</span> : <span id="identification-number-help" className="mt-1 block text-xs text-muted-foreground">Duplicate checking starts automatically after a complete identifier is entered.</span>}
            </label>
            {renderInput("patientId", "Patient ID", { forceVisible: true })}
            <div className="registration-grid-full" aria-live="polite">
              {isCheckingDuplicate ? (
                <div className="rounded-md border border-info-border bg-info-surface px-3 py-2 text-sm font-semibold text-info">Checking PostgreSQL for an existing patient…</div>
              ) : automaticDuplicate?.duplicate && automaticDuplicate.patient ? (
                <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning-border bg-warning-surface px-3 py-3 text-sm text-warning">
                  <div><p className="font-bold">Duplicate patient detected — registration is blocked.</p><p className="mt-0.5">{automaticDuplicate.patient.full_name} • {automaticDuplicate.patient.patient_no} • Matched by {duplicateMatchLabel(automaticDuplicate.matchedBy)}</p></div>
                  <Button type="button" variant="outline" onClick={() => openExistingPatient(automaticDuplicate.patient!.id)}>Open existing patient</Button>
                </div>
              ) : automaticDuplicate?.possibleMatch && automaticDuplicate.patient ? (
                <div role="status" className="rounded-md border border-info-border bg-info-surface px-3 py-2 text-sm text-info">Possible match: {automaticDuplicate.patient.full_name} ({automaticDuplicate.patient.patient_no}) by {duplicateMatchLabel(automaticDuplicate.matchedBy)}. Verify before registering.</div>
              ) : automaticDuplicate && !automaticDuplicate.possibleMatch ? (
                <div role="status" className="flex items-center gap-2 rounded-md border border-success-border bg-success-surface px-3 py-2 text-sm font-semibold text-success"><CircleCheckBig className="h-4 w-4" />No exact identifier duplicate found in the authorized hospital scope.</div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="registration-section registration-section-alternate">
          <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-accent" />2. Personal information</CardTitle></CardHeader>
          <CardContent className="registration-grid">
            {renderInput("firstName", "First name", { required: true, forceVisible: true })}
            {renderInput("lastName", "Last name", { required: true, forceVisible: true })}
            {renderInput("dateOfBirth", "Date of birth", { required: true, forceVisible: true })}
            {renderInput("age", "Age", { forceVisible: true })}
            <label htmlFor="patient-gender" className="registration-field block text-sm font-medium">
              <FormFieldLabel required>Gender</FormFieldLabel>
              <Select id="patient-gender" required aria-required="true" aria-invalid={errors.sex ? "true" : undefined} aria-describedby={errors.sex ? "patient-gender-error" : undefined} {...register("sex")}>
                <option value="">Select gender</option>
                {(config.genderOptions.length ? config.genderOptions : ["Male", "Female", "Other", "Prefer Not to Say"]).map((option) => <option key={option} value={option}>{option}</option>)}
              </Select>
              {errors.sex && <span id="patient-gender-error" role="alert" className="form-error flex items-start gap-1.5"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{String(errors.sex.message)}</span>}
            </label>
            {renderInput("phone", "Phone number", { required: true, forceVisible: true })}
          </CardContent>
        </Card>

        <Card className="registration-section">
          <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-accent" />3. Contact and location</CardTitle></CardHeader>
          <CardContent className="registration-grid">
            <label htmlFor="patient-province" className="registration-field block text-sm font-medium">
              <FormFieldLabel required>Province</FormFieldLabel>
              <SriLankaProvinceSelect id="patient-province" required aria-required="true" aria-invalid={errors.province ? "true" : undefined} aria-describedby={errors.province ? "patient-province-error" : undefined} {...provinceRegistration} value={watchedProvince} onChange={(event) => { provinceRegistration.onChange(event); const nextProvince = event.target.value; if (watchedDistrict && !isDistrictInProvince(watchedDistrict, nextProvince)) setValue("district", "", { shouldDirty: true, shouldValidate: true }); }} />
              {errors.province && <span id="patient-province-error" role="alert" className="form-error flex items-start gap-1.5"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{String(errors.province.message)}</span>}
            </label>
            <label htmlFor="patient-district" className="registration-field block text-sm font-medium">
              <FormFieldLabel required>District</FormFieldLabel>
              <SriLankaDistrictSelect id="patient-district" required disabled={!watchedProvince} aria-required="true" aria-invalid={errors.district ? "true" : undefined} aria-describedby={errors.district ? "patient-district-error" : "patient-district-help"} {...districtRegistration} province={watchedProvince} value={watchedDistrict} onChange={(event) => { districtRegistration.onChange(event); const inferredProvince = provinceForDistrict(event.target.value); if (inferredProvince && inferredProvince !== watchedProvince) setValue("province", inferredProvince, { shouldDirty: true, shouldValidate: true }); }} />
              {errors.district ? <span id="patient-district-error" role="alert" className="form-error flex items-start gap-1.5"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{String(errors.district.message)}</span> : !watchedProvince && <span id="patient-district-help" className="mt-1 block text-xs text-muted-foreground">Select a province before selecting a district.</span>}
            </label>
          </CardContent>
        </Card>

        <details open={showAdditional} onToggle={(event) => setShowAdditional(event.currentTarget.open)} className="additional-registration-details rounded-lg border border-border bg-card shadow-sm">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
            <span><span className="block font-bold text-foreground">Additional patient details</span><span className="mt-0.5 block text-xs text-muted-foreground">Optional information can be completed now or later from the patient profile.</span></span>
            <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </summary>
          <div className="space-y-4 border-t border-border p-4 sm:p-5">
            <Card className="registration-section registration-section-alternate">
              <CardHeader><CardTitle>4. Demographic information</CardTitle></CardHeader>
              <CardContent className="registration-grid">
                {fieldPolicy("title", role).visible && <label htmlFor="patient-title" className="registration-field block text-sm font-medium"><FormFieldLabel>Title</FormFieldLabel><Select id="patient-title" {...register("title")}><option value="">Not stated</option><option>Mr</option><option>Mrs</option><option>Ms</option><option>Miss</option><option>Dr</option><option>Prof</option><option>Rev</option><option>Other</option></Select></label>}
                {renderInput("middleName", "Middle name")}
                {renderInput("preferredName", "Preferred name")}
                {fieldPolicy("maritalStatus", role).visible && <label htmlFor="marital-status" className="registration-field block text-sm font-medium"><FormFieldLabel>Marital status</FormFieldLabel><Select id="marital-status" {...register("maritalStatus")}><option value="">Not stated</option><option>Single</option><option>Married</option><option>Divorced</option><option>Separated</option><option>Widowed</option></Select></label>}
                {fieldPolicy("bloodGroup", role).visible && <label htmlFor="blood-group" className="registration-field block text-sm font-medium"><FormFieldLabel>Blood group</FormFieldLabel><Select id="blood-group" value={watchedBloodGroup} onChange={(event) => setValue("bloodGroup", event.target.value, { shouldDirty: true, shouldValidate: true })}><option value="">Not recorded</option>{BLOOD_GROUP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></label>}
                {fieldPolicy("nationality", role).visible && <label htmlFor="nationality" className="registration-field block text-sm font-medium"><FormFieldLabel>Nationality</FormFieldLabel><AsyncSearchableSelect id="nationality" value={watchedNationality} selectedOption={watchedNationality ? { value: watchedNationality, label: watchedNationality } : null} loadOptions={searchCountries} minQueryLength={0} placeholder="Search country" onChange={(value) => setValue("nationality", value, { shouldDirty: true, shouldValidate: true })} /></label>}
                {renderInput("ethnicity", "Ethnicity")}
                {renderInput("religion", "Religion")}
                {fieldPolicy("preferredLanguage", role).visible && <label htmlFor="preferred-language" className="registration-field block text-sm font-medium"><FormFieldLabel>Language preference</FormFieldLabel><Select id="preferred-language" {...register("preferredLanguage")}><option>English</option><option>Sinhala</option><option>Tamil</option><option>Other</option></Select></label>}
                {renderInput("email", "Email address")}
                {renderInput("address", "Address")}
                {renderInput("postalCode", "Postal code")}
                {fieldPolicy("photo", role).visible && <label htmlFor="patient-photo" className="registration-field registration-grid-span-two block text-sm font-medium">
                  <FormFieldLabel>Patient photo</FormFieldLabel>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <div className="aspect-square h-24 w-24 overflow-hidden rounded-xl border border-accent-border bg-accent-surface">{photoDataUrl ? <img src={photoDataUrl} alt="Patient profile preview" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-xs font-semibold text-muted-foreground">No photo</div>}</div>
                    <div className="min-w-0 flex-1"><Input key={photoInputKey} id="patient-photo" type="file" accept="image/*" autoComplete="off" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; setPhotoName(file.name); void preparePatientProfilePhoto(file).then(setPhotoDataUrl).catch((error) => { setPhotoName(""); setPhotoDataUrl(""); showToast(error instanceof Error ? error.message : "Unable to process the patient photo.", "danger"); }); }} /><p className="mt-1 truncate text-xs text-muted-foreground">{photoName || "The image is cropped to a square and stored with the PostgreSQL patient record."}</p></div>
                  </div>
                </label>}
              </CardContent>
            </Card>

            {!requiresGuardian && (
              <Card className="registration-section">
                <CardHeader><CardTitle className="flex items-center gap-2"><Contact className="h-5 w-5 text-accent" />5. Guardian or emergency contact</CardTitle></CardHeader>
                <CardContent className="registration-grid">
                  {renderInput("emergencyContactName", "Emergency contact name")}
                  {renderInput("emergencyContactRelationship", "Emergency relationship")}
                  {renderInput("emergencyContactPhone", "Emergency phone")}
                  <label className="registration-field registration-grid-full flex min-h-14 items-center gap-3 text-sm font-medium"><input type="checkbox" className="h-5 w-5 shrink-0 accent-primary" {...register("consentToShare")} /><span>Patient consent recorded for data sharing where clinically required</span></label>
                </CardContent>
              </Card>
            )}

            <Card className="registration-section registration-section-alternate">
              <CardHeader><CardTitle className="flex items-center gap-2"><Stethoscope className="h-5 w-5 text-accent" />Medical background</CardTitle></CardHeader>
              <CardContent className="registration-grid">
                {shownFields(["allergies", "chronicDiseases", "disabilityStatus", "immunizationHistory", "familyHistory", "pregnancyHistory", "smokingStatus", "alcoholUse", "organDonorStatus", "insuranceDetails", "socialHistory", "communicationPreferences", "occupation", "employer"]).map((name) => {
                  if (name === "allergies") return <label key={name} className="registration-field block text-sm font-medium"><FormFieldLabel>Allergies</FormFieldLabel><MultiSelectChips values={listFromText(watchedAllergies)} options={COMMON_ALLERGY_OPTIONS} allowCustom onChange={(values) => setValue("allergies", values.join(", "), { shouldDirty: true })} noValueLabel="No allergy information recorded" /></label>;
                  if (name === "chronicDiseases") return <label key={name} className="registration-field block text-sm font-medium"><FormFieldLabel>Chronic diseases</FormFieldLabel><MultiSelectChips values={listFromText(watchedChronicDiseases)} options={COMMON_CHRONIC_DISEASE_OPTIONS} allowCustom onChange={(values) => setValue("chronicDiseases", values.join(", "), { shouldDirty: true })} noValueLabel="No chronic diseases recorded" /></label>;
                  if (name === "smokingStatus") return <label key={name} className="registration-field block text-sm font-medium"><FormFieldLabel>Smoking status</FormFieldLabel><Select value={watchedSmokingStatus} onChange={(event) => setValue("smokingStatus", event.target.value, { shouldDirty: true })}><option value="">Not recorded</option>{SMOKING_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></label>;
                  if (name === "alcoholUse") return <label key={name} className="registration-field block text-sm font-medium"><FormFieldLabel>Alcohol use</FormFieldLabel><Select value={watchedAlcoholUse} onChange={(event) => setValue("alcoholUse", event.target.value, { shouldDirty: true })}><option value="">Not recorded</option>{ALCOHOL_USE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></label>;
                  if (name === "organDonorStatus") return <label key={name} className="registration-field block text-sm font-medium"><FormFieldLabel>Organ donor status</FormFieldLabel><Select value={watchedOrganDonorStatus} onChange={(event) => setValue("organDonorStatus", event.target.value, { shouldDirty: true })}><option value="">Not recorded</option>{ORGAN_DONOR_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></label>;
                  return renderInput(name, name.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()));
                })}
              </CardContent>
            </Card>

            <Card className="registration-section">
              <CardHeader><CardTitle className="flex items-center gap-2"><Camera className="h-5 w-5 text-accent" />Registration tools</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3">
                <QRCodeSVG value={generatedId} size={80} bgColor={exportColors.paper} fgColor={exportColors.qrInk} title={`Pending patient QR code for ${generatedId}`} />
                <div className="min-w-0 flex-1"><p className="font-mono text-base font-bold text-foreground">{generatedId}</p><p className="text-xs text-muted-foreground">Print identifiers only after verifying the patient details.</p></div>
                <Button type="button" variant="outline" onClick={() => printPatientIdentifier("qr")}><QrCode className="h-4 w-4" />Print QR card</Button>
                <Button type="button" variant="outline" onClick={() => printPatientIdentifier("barcode")}><ScanBarcode className="h-4 w-4" />Print barcode</Button>
              </CardContent>
            </Card>
          </div>
        </details>

        {requiresGuardian && (
          <Card className="registration-section">
            <CardHeader><CardTitle className="flex items-center gap-2"><Baby className="h-5 w-5 text-accent" />5. Guardian or emergency contact</CardTitle><p className="mt-1 text-xs text-muted-foreground">The patient is {patientAge} years old. Capture a parent or legal guardian and an emergency contact when available.</p></CardHeader>
            <CardContent className="registration-grid">
              <div className="registration-grid-full rounded-md border border-warning-border bg-warning-surface p-3 text-sm font-semibold text-warning">For safer paediatric identification, verify whether a birth-certificate number should be used and record the responsible guardian.</div>
              {renderInput("guardianName", "Guardian / parent name")}
              {fieldPolicy("guardianRelationship", role).visible && <label htmlFor="guardian-relationship" className="registration-field block text-sm font-medium"><FormFieldLabel>Guardian relationship</FormFieldLabel><Select id="guardian-relationship" {...register("guardianRelationship")}><option value="">Not stated</option>{guardianRelationships.map((item) => <option key={item}>{item}</option>)}</Select></label>}
              {renderInput("guardianNic", "Guardian NIC")}
              {renderInput("guardianPhone", "Guardian phone")}
              {renderInput("emergencyContactName", "Emergency contact name")}
              {renderInput("emergencyContactRelationship", "Emergency relationship")}
              {renderInput("emergencyContactPhone", "Emergency phone")}
              <label className="registration-field registration-grid-full flex min-h-14 items-center gap-3 text-sm font-medium"><input type="checkbox" className="h-5 w-5 shrink-0 accent-primary" {...register("consentToShare")} /><span>Patient consent recorded for data sharing where clinically required</span></label>
            </CardContent>
          </Card>
        )}

        <Card className="registration-section registration-section-alternate">
          <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-accent" />6. Registration and risk information</CardTitle></CardHeader>
          <CardContent className="registration-grid">
            <label htmlFor="registration-type" className="registration-field block text-sm font-medium">
              <FormFieldLabel required>Registration type</FormFieldLabel>
              <Select id="registration-type" required aria-required="true" aria-invalid={errors.registrationType ? "true" : undefined} aria-describedby={errors.registrationType ? "registration-type-error" : undefined} {...register("registrationType")}>{registrationTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select>
              {errors.registrationType && <span id="registration-type-error" role="alert" className="form-error flex items-start gap-1.5"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{String(errors.registrationType.message)}</span>}
            </label>
            <label htmlFor="risk-category" className="registration-field block text-sm font-medium">
              <FormFieldLabel required>Risk category</FormFieldLabel>
              <Select id="risk-category" required aria-required="true" aria-invalid={errors.riskCategory ? "true" : undefined} aria-describedby={errors.riskCategory ? "risk-category-error" : undefined} {...register("riskCategory")}><option value="routine">Routine</option><option value="moderate">Moderate</option><option value="high">High</option><option value="critical">Critical</option></Select>
              {errors.riskCategory && <span id="risk-category-error" role="alert" className="form-error flex items-start gap-1.5"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{String(errors.riskCategory.message)}</span>}
              {riskCategory === "critical" && <span className="mt-2 flex items-center gap-1.5 text-xs font-bold text-danger"><ShieldAlert className="h-3.5 w-3.5" />Critical risk selected</span>}
            </label>
          </CardContent>
        </Card>

        <section className="registration-sticky-actions" aria-label="Review and submit patient registration">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">7. Review and submit</p>
            <p className="truncate text-xs text-muted-foreground">{[watchedFirstName, watchedLastName].filter(Boolean).join(" ") || "Patient name pending"} • {generatedId} • {patientAge === undefined ? "Age pending" : `Age ${patientAge}`} • {registrationTypeOptions.find((item) => item.value === registrationType)?.label ?? "Walk-in"}</p>
            <div className="mt-2 flex items-center gap-2"><div className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Required fields completed" aria-valuemin={0} aria-valuemax={100} aria-valuenow={requiredProgress}><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${requiredProgress}%` }} /></div><span className="whitespace-nowrap text-xs font-bold text-muted-foreground">{completedRequired}/{requiredProgressValues.length} required</span></div>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
            <Button className="flex-1 sm:flex-none" type="button" variant="outline" onClick={resetRegistration}><RotateCcw className="h-4 w-4" />Clear form</Button>
            <Button className="flex-1 sm:flex-none" type="submit" disabled={isSubmitting || isSavingPatient || isCheckingDuplicate || Boolean(automaticDuplicate?.duplicate)}><UserPlus className="h-4 w-4" />{isSavingPatient ? "Saving patient…" : isCheckingDuplicate ? "Checking duplicate…" : "Save and Register"}</Button>
          </div>
        </section>
      </form>
    </div>
  );
}
