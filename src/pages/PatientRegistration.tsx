import { zodResolver } from "@hookform/resolvers/zod";
import { Baby, Camera, Fingerprint, QrCode, ScanBarcode, Settings2, ShieldAlert, UserPlus } from "lucide-react";
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
  const submissionLockRef = useRef(false);
  const { register, handleSubmit, control, reset, getValues, setFocus, setValue, formState: { errors, isSubmitting } } = useForm<PatientInput>({
    resolver: zodResolver(patientSchema),
    defaultValues: { sex: "", riskCategory: "routine", consentToShare: false, patientId: generatedId, preferredLanguage: "English", nationality: "Sri Lankan" },
  });
  const riskCategory = useWatch({ control, name: "riskCategory" });
  const dateOfBirth = useWatch({ control, name: "dateOfBirth" });
  const watchedTitle = useWatch({ control, name: "title" });
  const watchedFirstName = useWatch({ control, name: "firstName" });
  const watchedMiddleName = useWatch({ control, name: "middleName" });
  const watchedLastName = useWatch({ control, name: "lastName" });
  const watchedNic = useWatch({ control, name: "nicOrPassport" });
  const watchedPassport = useWatch({ control, name: "passportNumber" });
  const watchedBirthCertificate = useWatch({ control, name: "birthCertificateNo" });
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
  const requiresGuardian = patientAge !== undefined && patientAge < 16;
  const barcodeValue = `*${generatedId.replaceAll("-", "")}*`;
  const [duplicates, setDuplicates] = useState<PatientRecord[]>([]);

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
    const payload = {
      nic: watchedNic?.trim() || undefined,
      passportNo: watchedPassport?.trim() || undefined,
      birthCertificateNo: watchedBirthCertificate?.trim() || undefined,
      phone: watchedPhone?.trim() || undefined,
      fullName: fullName || undefined,
      dateOfBirth: dateOfBirth?.trim() || undefined,
      email: watchedEmail?.trim() || undefined,
    };
    const hasIdentifier = Boolean(payload.nic || payload.passportNo || payload.birthCertificateNo || payload.email);
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
    watchedBirthCertificate,
    watchedEmail,
    watchedFirstName,
    watchedLastName,
    watchedMiddleName,
    watchedNic,
    watchedPassport,
    watchedPhone,
    watchedTitle,
  ]);

  const shownFields = (fieldIds: PatientFieldId[]) => fieldIds.filter((id) => fieldPolicy(id, role).visible);

  function renderInput(name: PatientFieldId, label?: string) {
    const policy = fieldPolicy(name, role);
    if (!policy.visible) return null;
    const definition = label ?? name;
    const common = register(name as keyof PatientInput);
    const disabled = policy.readOnly || name === "patientId" || name === "age";
    const valueProps = name === "patientId" ? { value: generatedId } : name === "age" ? { value: patientAge ?? "" } : {};
    return (
      <label key={name} className="block text-sm font-medium">
        <FormFieldLabel required={policy.required} optional={!policy.required && !disabled}>{definition}</FormFieldLabel>
        <Input
          type={name === "dateOfBirth" ? "date" : name === "email" ? "email" : name.includes("Phone") || name === "phone" ? "tel" : "text"}
          max={name === "dateOfBirth" ? new Date().toISOString().slice(0, 10) : undefined}
          inputMode={name.includes("Phone") || name === "phone" ? "tel" : undefined}
          autoCapitalize={name === "passportNumber" || name === "nicOrPassport" || name === "birthCertificateNo" || name === "guardianNic" ? "characters" : undefined}
          pattern={name === "nicOrPassport" || name === "guardianNic" ? "(?:[0-9]{9}[VvXx]|[0-9]{12}|[A-Za-z0-9]{5,32})" : name === "passportNumber" ? "[A-Za-z0-9]{5,32}" : undefined}
          disabled={disabled}
          autoComplete={name === "email" ? "email" : name === "phone" ? "tel" : "off"}
          aria-invalid={errors[name as keyof PatientInput] ? "true" : undefined}
          {...common}
          {...valueProps}
        />
        {errors[name as keyof PatientInput] && <span className="text-xs text-destructive">{String(errors[name as keyof PatientInput]?.message ?? "Required valid value")}</span>}
      </label>
    );
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
    const passportNumber = String(sanitized.passportNumber ?? "");
    const adultIdentifier = String(sanitized.nicOrPassport ?? "");

    try {
      const duplicateCheck = await checkPatientDuplicate({
        nic: adultIdentifier,
        passportNo: passportNumber,
        birthCertificateNo: String(sanitized.birthCertificateNo ?? ""),
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
        nic: adultIdentifier,
        passportNo: passportNumber,
        birthCertificateNo: String(sanitized.birthCertificateNo ?? ""),
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
            nic: patient.nic ?? adultIdentifier,
            passportNumber: patient.passport_no ?? passportNumber,
            birthCertificateNo: patient.birth_certificate_no ?? String(sanitized.birthCertificateNo ?? ""),
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
      navigate(`/patients/${encodeURIComponent(patient.id)}`);
      const nextId = nextPatientId();
      reset({ sex: "", riskCategory: "routine", consentToShare: false, patientId: nextId, preferredLanguage: "English", nationality: "Sri Lankan" });
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
    const identifier = age !== undefined && age < 16 ? values.birthCertificateNo : values.nicOrPassport || values.passportNumber;
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
            bgColor="#ffffff"
            fgColor="#0f172a"
            title={`GovCare patient QR code for ${generatedId}`}
          />,
        )
      : "";
    const guardianLine = age !== undefined && age < 16
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
    body { margin: 0; padding: 24px; background: #e2e8f0; color: #0f172a; font-family: Arial, Helvetica, sans-serif; }
    .card { width: min(100%, 620px); margin: 0 auto; border: 2px solid #0f766e; border-radius: 18px; background: #fff; overflow: hidden; box-shadow: 0 14px 40px rgba(15, 23, 42, .16); }
    .header { padding: 18px 24px; background: #0f766e; color: #fff; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 5px 0 0; font-size: 14px; }
    .content { padding: 24px; text-align: center; }
    .patient-no { margin: 0; font-size: 32px; letter-spacing: .5px; }
    .patient-name { margin: 8px 0 18px; font-size: 24px; }
    .details { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; margin: 0 auto 18px; max-width: 520px; text-align: left; font-size: 15px; }
    .details p { margin: 0; padding: 8px 10px; border-radius: 8px; background: #f1f5f9; overflow-wrap: anywhere; }
    .qr-code { display: inline-flex; align-items: center; justify-content: center; min-width: 300px; min-height: 300px; margin: 6px auto 8px; padding: 10px; border: 1px solid #cbd5e1; border-radius: 14px; background: #fff; }
    .qr-code svg { display: block; width: 280px !important; height: 280px !important; shape-rendering: crispEdges; }
    .barcode-value { margin: 24px auto 10px; padding: 22px; border: 1px solid #cbd5e1; border-radius: 12px; font-family: 'Courier New', monospace; font-size: 30px; font-weight: 700; letter-spacing: 5px; overflow-wrap: anywhere; }
    .scan-note { margin: 8px 0 0; color: #475569; font-size: 14px; }
    .security-note { margin: 16px 0 0; padding-top: 14px; border-top: 1px solid #cbd5e1; color: #64748b; font-size: 12px; }
    .actions { display: flex; justify-content: center; gap: 10px; padding: 0 24px 24px; }
    button { padding: 11px 20px; border: 0; border-radius: 9px; background: #0f766e; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; }
    @page { size: A5 portrait; margin: 10mm; }
    @media print {
      body { padding: 0; background: #fff; }
      .card { width: 100%; border: 1.5px solid #0f766e; border-radius: 10px; box-shadow: none; }
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

  return (
    <div className="space-y-5">
      <PatientCodeScanner open={scannerMode !== null} mode={scannerMode ?? "qr"} onClose={() => setScannerMode(null)} onDetected={handleScannedCode} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Advanced patient registration</h1>
          <p className="text-sm text-muted-foreground">Policy-driven fields, unique NIC checks, pediatric guardian linking, QR/barcode card, consent, and medical-risk capture.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-muted" to="/admin/patient-fields"><Settings2 className="h-4 w-4" />Field policy</Link>
          <Button type="button" variant="outline" onClick={() => setGeneratedId(nextPatientId())}><Fingerprint className="h-4 w-4" />Regenerate ID</Button>
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-amber-600" />Duplicate detection</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-[1fr_auto]">
            <SmartSearch placeholder="Search NIC, passport, birth certificate, name, or phone" scope="patients" value={duplicateTerm} onChange={setDuplicateTerm} />
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" onClick={() => setScannerMode("qr")}><QrCode className="h-4 w-4" />QR scan</Button>
              <Button type="button" variant="outline" onClick={() => setScannerMode("barcode")}><ScanBarcode className="h-4 w-4" />Barcode scan</Button>
            </div>
            <div className="md:col-span-2">
              {isCheckingDuplicate ? (
                <p className="text-sm font-medium text-cyan-300">Checking PostgreSQL for an existing patient…</p>
              ) : automaticDuplicate?.duplicate && automaticDuplicate.patient ? (
                <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-400/60 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
                  <div>
                    <p className="font-bold">Duplicate patient detected — registration is blocked.</p>
                    <p className="mt-0.5">{automaticDuplicate.patient.full_name} • {automaticDuplicate.patient.patient_no} • Matched by {duplicateMatchLabel(automaticDuplicate.matchedBy)}</p>
                  </div>
                  <Button type="button" variant="outline" onClick={() => navigate(`/patients/${encodeURIComponent(automaticDuplicate.patient!.id)}`)}>Open existing patient</Button>
                </div>
              ) : automaticDuplicate?.possibleMatch && automaticDuplicate.patient ? (
                <div className="rounded-md border border-cyan-400/50 bg-cyan-950/25 px-3 py-2 text-sm text-cyan-100">
                  Possible match: {automaticDuplicate.patient.full_name} ({automaticDuplicate.patient.patient_no}) by {duplicateMatchLabel(automaticDuplicate.matchedBy)}. Verify before registering.
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Automatic identifier check: no exact duplicate found.</p>
              )}
            </div>
            <div className="md:col-span-2">
              {duplicates.length ? (
                <div className="grid gap-2">
                  {duplicates.map((patient) => <Badge key={patient.id} tone="warning">Existing record: {patient.patient_no} - {patient.full_name} - {patient.nic || patient.birth_certificate_no || patient.phone || "No identifier"}</Badge>)}
                </div>
              ) : <p className="text-sm text-muted-foreground">No duplicate warning for the current search.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <QRCodeSVG value={generatedId} size={112} />
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Patient ID</p>
                <p className="text-lg font-bold">{generatedId}</p>
                <p className="mt-3 font-mono text-2xl tracking-widest">{barcodeValue}</p>
                <p className="text-xs text-muted-foreground">Barcode-ready ID</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <form className="space-y-4" noValidate autoComplete="off" onSubmit={handleSubmit(onSubmit, onInvalid)}>
        <div className="rounded-lg border border-cyan-700/60 bg-cyan-950/25 px-4 py-3 text-sm text-cyan-50">
          <p className="font-semibold">Minimum registration data only</p>
          <p className="mt-1 text-cyan-100">Only fields marked with <strong>*</strong> are required. Other details may be left blank and completed later from the patient profile.</p>
        </div>
        {validationSummary.length > 0 && (
          <div role="alert" className="rounded-lg border border-rose-400/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
            <p className="font-semibold">Patient registration was not submitted.</p>
            <p className="mt-1 text-rose-200">{validationSummary.slice(0, 3).join(" • ")}</p>
          </div>
        )}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" />Personal, contact, and location details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {shownFields(["patientId", "nicOrPassport", "passportNumber", "birthCertificateNo", "title", "firstName", "middleName", "lastName", "preferredName", "dateOfBirth", "age", "maritalStatus", "bloodGroup", "nationality", "ethnicity", "religion", "phone", "email", "address", "province", "district", "postalCode", "preferredLanguage"]).map((name) => {
              if (name === "province") {
                const field = register("province");
                return <label key={name} className="block text-sm font-medium"><FormFieldLabel>Province</FormFieldLabel><SriLankaProvinceSelect {...field} value={watchedProvince} onChange={(event) => { field.onChange(event); const nextProvince = event.target.value; if (watchedDistrict && !isDistrictInProvince(watchedDistrict, nextProvince)) setValue("district", "", { shouldDirty: true, shouldValidate: true }); }} /></label>;
              }
              if (name === "district") {
                const field = register("district");
                return <label key={name} className="block text-sm font-medium"><FormFieldLabel>District</FormFieldLabel><SriLankaDistrictSelect {...field} province={watchedProvince} value={watchedDistrict} onChange={(event) => { field.onChange(event); const inferredProvince = provinceForDistrict(event.target.value); if (inferredProvince && inferredProvince !== watchedProvince) setValue("province", inferredProvince, { shouldDirty: true, shouldValidate: true }); }} /></label>;
              }
              if (name === "title") return <label key={name} className="block text-sm font-medium"><FormFieldLabel>Title</FormFieldLabel><Select {...register("title")}><option value="">Not stated</option><option>Mr</option><option>Mrs</option><option>Ms</option><option>Miss</option><option>Dr</option><option>Prof</option><option>Rev</option><option>Other</option></Select></label>;
              if (name === "preferredLanguage") return <label key={name} className="block text-sm font-medium"><FormFieldLabel>Language preference</FormFieldLabel><Select {...register("preferredLanguage")}><option>English</option><option>Sinhala</option><option>Tamil</option><option>Other</option></Select></label>;
              if (name === "maritalStatus") return <label key={name} className="block text-sm font-medium"><FormFieldLabel>Marital status</FormFieldLabel><Select {...register("maritalStatus")}><option value="">Not stated</option><option>Single</option><option>Married</option><option>Divorced</option><option>Separated</option><option>Widowed</option></Select></label>;
              if (name === "bloodGroup") return <label key={name} className="block text-sm font-medium"><FormFieldLabel>Blood group</FormFieldLabel><Select value={watchedBloodGroup} onChange={(event) => setValue("bloodGroup", event.target.value, { shouldDirty: true, shouldValidate: true })}><option value="">Not recorded</option>{BLOOD_GROUP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></label>;
              if (name === "nationality") return <label key={name} className="block text-sm font-medium"><FormFieldLabel>Nationality</FormFieldLabel><AsyncSearchableSelect value={watchedNationality} selectedOption={watchedNationality ? { value: watchedNationality, label: watchedNationality } : null} loadOptions={searchCountries} minQueryLength={0} placeholder="Search country" onChange={(value) => setValue("nationality", value, { shouldDirty: true, shouldValidate: true })} /></label>;
              const labels: Record<string, string> = { nicOrPassport: "NIC number", birthCertificateNo: "Birth certificate number", patientId: "Patient ID", passportNumber: "Passport number" };
              return renderInput(name, labels[name] ?? name.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()));
            })}
            {config.genderEnabled && fieldPolicy("sex", role).visible && (
              <label className="block text-sm font-medium">
                <FormFieldLabel required={fieldPolicy("sex", role).required} optional={!fieldPolicy("sex", role).required}>Gender</FormFieldLabel>
                <Select {...register("sex")} disabled={fieldPolicy("sex", role).readOnly}>
                  <option value="">Not stated</option>
                  {config.genderOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </Select>
              </label>
            )}
            <label className="block text-sm font-medium">
              <FormFieldLabel optional>Risk category</FormFieldLabel>
              <Select {...register("riskCategory")}><option value="routine">Routine</option><option value="moderate">Moderate</option><option value="high">High</option><option value="critical">Critical</option></Select>
            </label>
            {fieldPolicy("photo", role).visible && <label className="block text-sm font-medium xl:col-span-2">
              <FormFieldLabel optional>Patient photo</FormFieldLabel>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <div className="aspect-square h-24 w-24 overflow-hidden rounded-xl border border-teal-200 bg-teal-50 dark:border-teal-800 dark:bg-teal-950/40">
                  {photoDataUrl ? <img src={photoDataUrl} alt="Patient profile preview" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-xs font-semibold text-muted-foreground">No photo</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <Input type="file" accept="image/*" autoComplete="off" onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setPhotoName(file.name);
                    void preparePatientProfilePhoto(file)
                      .then(setPhotoDataUrl)
                      .catch((error) => {
                        setPhotoName("");
                        setPhotoDataUrl("");
                        showToast(error instanceof Error ? error.message : "Unable to process the patient photo.", "danger");
                      });
                  }} />
                  <p className="mt-1 truncate text-xs text-muted-foreground">{photoName || "The image is cropped to a square and stored with the PostgreSQL patient record."}</p>
                </div>
              </div>
            </label>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Baby className="h-5 w-5 text-primary" />Guardian, emergency, and consent</CardTitle><p className="text-xs text-muted-foreground">These details are optional at initial registration and can be completed later. Guardian contact is strongly recommended for patients under 16.</p></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {requiresGuardian && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950 xl:col-span-3">
                Patient age is {patientAge}. Birth certificate and guardian details are recommended for safe paediatric care, but the record can be registered and completed later.
              </div>
            )}
            {shownFields(["guardianName", "guardianRelationship", "guardianNic", "guardianPhone", "emergencyContactName", "emergencyContactRelationship", "emergencyContactPhone"]).map((name) => {
              if (name === "guardianRelationship") {
                return <label key={name} className="block text-sm font-medium"><FormFieldLabel optional>Guardian relationship</FormFieldLabel><Select {...register("guardianRelationship")}><option value="">Not stated</option>{guardianRelationships.map((item) => <option key={item}>{item}</option>)}</Select>{errors.guardianRelationship && <span className="text-xs text-destructive">{String(errors.guardianRelationship.message)}</span>}</label>;
              }
              const labels: Record<string, string> = { guardianName: "Guardian / parent name", guardianNic: "Guardian NIC", guardianPhone: "Guardian phone", emergencyContactName: "Emergency contact", emergencyContactRelationship: "Emergency relationship", emergencyContactPhone: "Emergency phone" };
              return renderInput(name, labels[name] ?? name);
            })}
            <label className="flex items-center gap-2 text-sm font-medium xl:col-span-3">
              <input type="checkbox" className="h-4 w-4" {...register("consentToShare")} />
              Patient consent recorded for data sharing where clinically required
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Medical background</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shownFields(["allergies", "chronicDiseases", "disabilityStatus", "immunizationHistory", "familyHistory", "pregnancyHistory", "smokingStatus", "alcoholUse", "organDonorStatus", "insuranceDetails", "socialHistory", "communicationPreferences", "occupation", "employer"]).map((name) => {
              if (name === "allergies") return <label key={name} className="block text-sm font-medium"><FormFieldLabel>Allergies</FormFieldLabel><MultiSelectChips values={listFromText(watchedAllergies)} options={COMMON_ALLERGY_OPTIONS} allowCustom onChange={(values) => setValue("allergies", values.join(", "), { shouldDirty: true })} noValueLabel="No allergy information recorded" /></label>;
              if (name === "chronicDiseases") return <label key={name} className="block text-sm font-medium"><FormFieldLabel>Chronic diseases</FormFieldLabel><MultiSelectChips values={listFromText(watchedChronicDiseases)} options={COMMON_CHRONIC_DISEASE_OPTIONS} allowCustom onChange={(values) => setValue("chronicDiseases", values.join(", "), { shouldDirty: true })} noValueLabel="No chronic diseases recorded" /></label>;
              if (name === "smokingStatus") return <label key={name} className="block text-sm font-medium"><FormFieldLabel>Smoking status</FormFieldLabel><Select value={watchedSmokingStatus} onChange={(event) => setValue("smokingStatus", event.target.value, { shouldDirty: true })}><option value="">Not recorded</option>{SMOKING_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></label>;
              if (name === "alcoholUse") return <label key={name} className="block text-sm font-medium"><FormFieldLabel>Alcohol use</FormFieldLabel><Select value={watchedAlcoholUse} onChange={(event) => setValue("alcoholUse", event.target.value, { shouldDirty: true })}><option value="">Not recorded</option>{ALCOHOL_USE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></label>;
              if (name === "organDonorStatus") return <label key={name} className="block text-sm font-medium"><FormFieldLabel>Organ donor status</FormFieldLabel><Select value={watchedOrganDonorStatus} onChange={(event) => setValue("organDonorStatus", event.target.value, { shouldDirty: true })}><option value="">Not recorded</option>{ORGAN_DONOR_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></label>;
              return renderInput(name, name.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()));
            })}
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isSubmitting || isSavingPatient || isCheckingDuplicate || Boolean(automaticDuplicate?.duplicate)}>
            <UserPlus className="h-4 w-4" />
            {isSavingPatient ? "Registering…" : isCheckingDuplicate ? "Checking duplicate…" : "Register patient"}
          </Button>
          <Button type="button" variant="outline" onClick={() => printPatientIdentifier("qr")}><QrCode className="h-4 w-4" />Print QR card</Button>
          <Button type="button" variant="outline" onClick={() => printPatientIdentifier("barcode")}><ScanBarcode className="h-4 w-4" />Print barcode</Button>
          <Button type="button" variant="outline" onClick={() => showToast("Use the Patient photo file picker above to capture or upload a photo.", "info")}><Camera className="h-4 w-4" />Capture photo</Button>
          {riskCategory === "critical" && <Badge tone="danger">Critical risk selected</Badge>}
        </div>
      </form>
    </div>
  );
}
