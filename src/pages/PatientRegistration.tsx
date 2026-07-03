import { zodResolver } from "@hookform/resolvers/zod";
import { Baby, Camera, Fingerprint, QrCode, ScanBarcode, Settings2, ShieldAlert, UserPlus } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link } from "react-router-dom";
import { PatientCodeScanner } from "../components/patient/PatientCodeScanner";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { useToast } from "../components/ui/toast-context";
import { fieldPolicy, getPatientFieldConfiguration, type PatientFieldId } from "../utils/patientFieldPolicy";
import { findDuplicatePatient, getSavedPatientsForDoctors, guardianRelationships, savePatientForDoctors, syncGuardianPatientClassification, upsertGuardianForPatient } from "../utils/patientRegistry";
import { sanitizeInput } from "../utils/sanitize";
import { patientSchema } from "../validations/patient";
import type { PatientInput } from "../validations/patient";
import { useAuthStore } from "../stores/authStore";

const existingPatients = [
  { patientId: "PAT-2026-000001", nic: "812345678V", passport: "", birthCertificateNo: "", name: "Nimal Silva", phone: "0771234567" },
  { patientId: "PAT-2026-000088", nic: "", passport: "", birthCertificateNo: "BC-2018-4551", name: "Sahan Perera", phone: "0715558888" },
];

function nextPatientId() {
  return `PAT-${new Date().getFullYear()}-${String(Math.floor(100000 + Math.random() * 899999))}`;
}

function calculateAge(dateOfBirth: string) {
  const birthday = new Date(dateOfBirth);
  if (Number.isNaN(birthday.getTime())) return undefined;
  const today = new Date();
  let age = today.getFullYear() - birthday.getFullYear();
  const hasBirthdayPassed = today.getMonth() > birthday.getMonth() || (today.getMonth() === birthday.getMonth() && today.getDate() >= birthday.getDate());
  if (!hasBirthdayPassed) age -= 1;
  return age >= 0 ? age : undefined;
}

export function PatientRegistration() {
  const { showToast } = useToast();
  const role = useAuthStore((state) => state.role);
  const config = getPatientFieldConfiguration();
  const [generatedId, setGeneratedId] = useState(nextPatientId());
  const [photoName, setPhotoName] = useState("");
  const [duplicateTerm, setDuplicateTerm] = useState("");
  const [scannerMode, setScannerMode] = useState<"qr" | "barcode" | null>(null);
  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<PatientInput>({
    resolver: zodResolver(patientSchema),
    defaultValues: { sex: config.genderOptions[0] ?? "Female", riskCategory: "routine", consentToShare: false, patientId: generatedId, preferredLanguage: "English", nationality: "Sri Lankan" },
  });
  const riskCategory = useWatch({ control, name: "riskCategory" });
  const dateOfBirth = useWatch({ control, name: "dateOfBirth" });
  const patientAge = calculateAge(dateOfBirth ?? "");
  const requiresGuardian = patientAge !== undefined && patientAge < 16;
  const barcodeValue = `*${generatedId.replaceAll("-", "")}*`;
  const duplicates = useMemo(
    () => {
      const saved = getSavedPatientsForDoctors().map((patient) => ({ patientId: patient.patientId, nic: patient.nicOrPassport ?? "", birthCertificateNo: patient.birthCertificateNo ?? "", name: patient.name, phone: patient.phone, passport: patient.passportNumber ?? "" }));
      return [...existingPatients, ...saved].filter((patient) => duplicateTerm && [patient.nic, patient.birthCertificateNo, patient.name, patient.phone, patient.patientId, patient.passport].some((value) => value.toLowerCase().includes(duplicateTerm.toLowerCase())));
    },
    [duplicateTerm],
  );
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
        {definition}{policy.required || (requiresGuardian && ["birthCertificateNo", "guardianName", "guardianRelationship", "guardianNic", "guardianPhone"].includes(name)) ? <span className="text-destructive"> *</span> : null}
        <Input type={name === "dateOfBirth" ? "date" : name === "email" ? "email" : "text"} disabled={disabled} {...common} {...valueProps} />
        {errors[name as keyof PatientInput] && <span className="text-xs text-destructive">{String(errors[name as keyof PatientInput]?.message ?? "Required valid value")}</span>}
      </label>
    );
  }

  function onSubmit(values: PatientInput) {
    const sanitized = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === "string" ? sanitizeInput(value) : value]));
    const firstName = String(sanitized.firstName ?? "");
    const lastName = String(sanitized.lastName ?? "");
    const patientName = `${String(sanitized.title ?? "")} ${firstName} ${lastName}`.trim() || generatedId;
    const age = calculateAge(String(sanitized.dateOfBirth ?? ""));
    const passportNumber = String(sanitized.passportNumber ?? "");
    const adultIdentifier = String(sanitized.nicOrPassport ?? "");
    const duplicateFromRegistry = findDuplicatePatient({
      age,
      nicOrPassport: adultIdentifier,
      passportNumber,
      birthCertificateNo: String(sanitized.birthCertificateNo ?? ""),
      phone: String(sanitized.phone ?? ""),
      fullName: patientName,
    });
    const seededDuplicate = existingPatients.find((patient) => {
      const adultMatch = age !== undefined && age >= 16 && patient.nic && patient.nic.toUpperCase() === adultIdentifier.toUpperCase();
      const childMatch = age !== undefined && age < 16 && patient.birthCertificateNo && patient.birthCertificateNo.toUpperCase() === String(sanitized.birthCertificateNo ?? "").toUpperCase();
      return adultMatch || childMatch;
    });
    const duplicate = duplicateFromRegistry ?? seededDuplicate;
    if (duplicate) {
      setDuplicateTerm(duplicate.patientId);
      showToast(`Existing patient found: ${duplicate.patientId}. Duplicate registration blocked.`, "warning");
      return;
    }
    const guardian = requiresGuardian
      ? upsertGuardianForPatient({
          patientId: generatedId,
          nic: String(sanitized.guardianNic ?? ""),
          fullName: String(sanitized.guardianName ?? ""),
          address: String(sanitized.address ?? ""),
          phone: String(sanitized.guardianPhone ?? ""),
          relationshipToPatient: guardianRelationships.includes(String(sanitized.guardianRelationship ?? "") as never) ? String(sanitized.guardianRelationship) as never : "Legal Guardian",
          emergencyContactName: String(sanitized.emergencyContactName ?? ""),
          emergencyContactPhone: String(sanitized.emergencyContactPhone ?? ""),
        })
      : undefined;
    savePatientForDoctors({
      patientId: generatedId,
      hospitalId: "hosp-colombo-national",
      name: patientName,
      nicOrPassport: String(sanitized.nicOrPassport ?? ""),
      passportNumber,
      birthCertificateNo: String(sanitized.birthCertificateNo ?? ""),
      phone: String(sanitized.phone ?? ""),
      sex: String(sanitized.sex ?? ""),
      age,
      district: String(sanitized.district ?? ""),
      bloodGroup: String(sanitized.bloodGroup ?? ""),
      riskCategory: values.riskCategory ?? "routine",
      allergies: String(sanitized.allergies ?? ""),
      chronicDiseases: String(sanitized.chronicDiseases ?? ""),
      guardianId: guardian?.guardianId,
      guardianName: String(sanitized.guardianName ?? ""),
      guardianNic: String(sanitized.guardianNic ?? ""),
      guardianPhone: String(sanitized.guardianPhone ?? ""),
      dependentType: age !== undefined && age < 16 ? "child" : "adult",
      assignedDoctor: "Unassigned",
      visitReason: "New registration",
      status: "new",
      registeredAt: new Date().toISOString(),
    });
    if (guardian?.guardianId) syncGuardianPatientClassification(generatedId, guardian.guardianId);
    console.info("Validated advanced patient payload ready for Cloud Function:", { patientId: generatedId, ...sanitized, photoName });
    showToast(`${patientName} saved and visible to doctors.`, "success");
    const nextId = nextPatientId();
    reset({ sex: config.genderOptions[0] ?? "Female", riskCategory: "routine", consentToShare: false, patientId: nextId, preferredLanguage: "English", nationality: "Sri Lankan" });
    setPhotoName("");
    setDuplicateTerm("");
    setGeneratedId(nextId);
  }

  function handleScannedCode(value: string) {
    setDuplicateTerm(value);
    showToast(`Scanned value added: ${value}`, "success");
  }

  function printPatientIdentifier(kind: "qr" | "barcode") {
    const printWindow = window.open("", "_blank", "width=520,height=520");
    if (!printWindow) {
      showToast("Popup blocked. Allow popups to print the patient card.", "warning");
      return;
    }
    printWindow.document.write(`<html><head><title>GovCare ${kind.toUpperCase()} Card</title></head><body style="font-family:Arial;padding:24px;text-align:center"><h2>GovCare EHR</h2><p>Patient ID</p><h1>${generatedId}</h1><p>${kind === "barcode" ? barcodeValue : "QR card ready in the registration screen"}</p><button onclick="window.print()">Print</button></body></html>`);
    printWindow.document.close();
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
            <Input placeholder="Search NIC, passport, birth certificate, name, or phone" value={duplicateTerm} onChange={(event) => setDuplicateTerm(event.target.value)} />
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" onClick={() => setScannerMode("qr")}><QrCode className="h-4 w-4" />QR scan</Button>
              <Button type="button" variant="outline" onClick={() => setScannerMode("barcode")}><ScanBarcode className="h-4 w-4" />Barcode scan</Button>
            </div>
            <div className="md:col-span-2">
              {duplicates.length ? (
                <div className="grid gap-2">
                  {duplicates.map((patient) => <Badge key={`${patient.patientId}-${patient.nic || patient.birthCertificateNo}`} tone="warning">Existing record: {patient.patientId} - {patient.name} - {patient.nic || patient.birthCertificateNo || patient.phone}</Badge>)}
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

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" />Personal, contact, and location details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {shownFields(["patientId", "nicOrPassport", "passportNumber", "birthCertificateNo", "title", "firstName", "middleName", "lastName", "preferredName", "dateOfBirth", "age", "maritalStatus", "bloodGroup", "nationality", "ethnicity", "religion", "phone", "email", "address", "district", "province", "postalCode", "preferredLanguage"]).map((name) => {
              if (name === "title") return <label key={name} className="block text-sm font-medium">Title<Select {...register("title")}><option>Mr</option><option>Mrs</option><option>Ms</option><option>Master</option><option>Dr</option><option>Rev</option></Select></label>;
              if (name === "preferredLanguage") return <label key={name} className="block text-sm font-medium">Language preference<Select {...register("preferredLanguage")}><option>English</option><option>Sinhala</option><option>Tamil</option></Select></label>;
              if (name === "maritalStatus") return <label key={name} className="block text-sm font-medium">Marital status<Select {...register("maritalStatus")}><option>Single</option><option>Married</option><option>Separated</option><option>Widowed</option><option>Not stated</option></Select></label>;
              const labels: Record<string, string> = { nicOrPassport: "NIC number (16+ required)", birthCertificateNo: "Birth certificate no (required under 16)", patientId: "Patient ID", passportNumber: "Passport number" };
              return renderInput(name, labels[name] ?? name.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()));
            })}
            {config.genderEnabled && fieldPolicy("sex", role).visible && (
              <label className="block text-sm font-medium">
                Gender{fieldPolicy("sex", role).required ? <span className="text-destructive"> *</span> : null}
                <Select {...register("sex")} disabled={fieldPolicy("sex", role).readOnly}>
                  {config.genderOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </Select>
              </label>
            )}
            <label className="block text-sm font-medium">
              Risk category
              <Select {...register("riskCategory")}><option value="routine">Routine</option><option value="moderate">Moderate</option><option value="high">High</option><option value="critical">Critical</option></Select>
            </label>
            {fieldPolicy("photo", role).visible && <label className="block text-sm font-medium xl:col-span-2">
              Patient photo
              <Input type="file" accept="image/*" onChange={(event) => setPhotoName(event.target.files?.[0]?.name ?? "")} />
            </label>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Baby className="h-5 w-5 text-primary" />Guardian, emergency, and consent</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {requiresGuardian && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950 xl:col-span-3">
                Patient age is {patientAge}. Children under 16 usually do not have a NIC. Use birth certificate number and guardian or parent name, NIC, and phone.
              </div>
            )}
            {shownFields(["guardianName", "guardianRelationship", "guardianNic", "guardianPhone", "emergencyContactName", "emergencyContactRelationship", "emergencyContactPhone"]).map((name) => {
              if (name === "guardianRelationship") {
                return <label key={name} className="block text-sm font-medium">Guardian relationship{requiresGuardian ? <span className="text-destructive"> *</span> : null}<Select {...register("guardianRelationship")}>{guardianRelationships.map((item) => <option key={item}>{item}</option>)}</Select>{errors.guardianRelationship && <span className="text-xs text-destructive">{String(errors.guardianRelationship.message)}</span>}</label>;
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
            {shownFields(["allergies", "chronicDiseases", "disabilityStatus", "immunizationHistory", "familyHistory", "pregnancyHistory", "smokingStatus", "alcoholUse", "organDonorStatus", "insuranceDetails", "socialHistory", "communicationPreferences", "occupation", "employer"]).map((name) => renderInput(name, name.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase())))}
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isSubmitting}><UserPlus className="h-4 w-4" />Register patient</Button>
          <Button type="button" variant="outline" onClick={() => printPatientIdentifier("qr")}><QrCode className="h-4 w-4" />Print QR card</Button>
          <Button type="button" variant="outline" onClick={() => printPatientIdentifier("barcode")}><ScanBarcode className="h-4 w-4" />Print barcode</Button>
          <Button type="button" variant="outline" onClick={() => showToast("Use the Patient photo file picker above to capture or upload a photo.", "info")}><Camera className="h-4 w-4" />Capture photo</Button>
          {riskCategory === "critical" && <Badge tone="danger">Critical risk selected</Badge>}
        </div>
      </form>
    </div>
  );
}
