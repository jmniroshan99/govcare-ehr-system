import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BedDouble,
  Building2,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Hospital,
  IdCard,
  Loader2,
  RefreshCcw,
  Search,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PatientPhoto } from "../components/patient/PatientPhoto";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { FormFieldLabel } from "../components/ui/form-field-label";
import { Select } from "../components/ui/select";
import { useToast } from "../components/ui/toast-context";
import { SearchableSelect } from "../components/forms";
import { DiagnosisSearchSelector } from "../components/selectors";
import type { SelectOption } from "../data/referenceOptions";
import {
  confirmPatientIdentity,
  createAdmission,
  dischargeAdmission,
  getAdmissionReference,
  getAdmissionWards,
  getAvailableWardBeds,
  type ActiveAdmission,
  type AdmissionPriority,
  type AdmissionReference,
  type AdmissionType,
  type IdentityConfirmation,
} from "../services/admissionService";
import { searchPatientRecords, type PatientRecord } from "../services/patientService";
import type { WardBed, WardSummary } from "../types/ward";
import { formatPatientAge } from "../utils/age";

const steps = [
  "Identify patient",
  "Confirm patient",
  "Admission details",
  "Select ward",
  "Select bed",
  "Review and confirm",
];

const emptyReference: AdmissionReference = { hospital: { id: "", code: "", name: "" }, departments: [], doctors: [] };

function stringList(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return value.split(/[,;]/).map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function patientValue(patient: PatientRecord | null, snake: keyof PatientRecord, camel: string) {
  if (!patient) return undefined;
  const record = patient as unknown as Record<string, unknown>;
  return record[snake as string] ?? record[camel];
}

function patientName(patient: PatientRecord | null) {
  return String(patientValue(patient, "full_name", "fullName") ?? "Unknown patient");
}

function patientNumber(patient: PatientRecord | null) {
  return String(patientValue(patient, "patient_no", "patientNumber") ?? "Not recorded");
}

function dateOfBirth(patient: PatientRecord | null) {
  const value = patientValue(patient, "date_of_birth", "dateOfBirth");
  return value ? String(value) : undefined;
}

function ageYears(patient: PatientRecord | null) {
  const value = patientValue(patient, "age_years", "ageYears");
  return typeof value === "number" ? value : undefined;
}

function patientGender(patient: PatientRecord | null) {
  return String(patientValue(patient, "gender", "gender") ?? "Not recorded");
}

function patientAllergies(patient: PatientRecord | null) {
  return stringList(patientValue(patient, "allergies", "allergies"));
}

type WardCompatibility = {
  blocking: string[];
  advisories: string[];
};

function getWardCompatibility(ward: WardSummary, patient: PatientRecord | null, isolationRequired: boolean, referringDepartmentId = ""): WardCompatibility {
  const blocking: string[] = [];
  const advisories: string[] = [];
  const gender = patientGender(patient).toUpperCase();
  const genderRestriction = (ward.genderRestriction ?? "ANY").toUpperCase();
  if (genderRestriction !== "ANY" && gender !== "NOT RECORDED" && genderRestriction !== gender) blocking.push("Gender restriction does not match");
  const age = ageYears(patient);
  const ageGroup = age === undefined ? "ANY" : age < 14 ? "PAEDIATRIC" : "ADULT";
  const ageRestriction = (ward.ageRestriction ?? "ANY").toUpperCase();
  if (ageRestriction !== "ANY" && ageGroup !== "ANY" && ageRestriction !== ageGroup) blocking.push("Age restriction does not match");
  if (isolationRequired && !ward.isolationCapable && !(ward.isolationBeds ?? 0)) blocking.push("Isolation support is unavailable");

  // The referring department is the source of the admission. A different ward
  // department is common (for example OPD or Emergency referring to a medical
  // or surgical ward), so this is guidance rather than a hard blocker.
  if (referringDepartmentId && ward.departmentId && ward.departmentId !== referringDepartmentId) {
    advisories.push("Ward department differs from the referring department");
  }
  if (ward.availableBeds <= 0) blocking.push("No available beds");
  if (ward.status !== "ACTIVE") blocking.push("Ward is not active");
  return { blocking, advisories };
}

function bedCompatibilityWarnings(bed: WardBed, patient: PatientRecord | null, isolationRequired: boolean) {
  const warnings: string[] = [];
  const gender = patientGender(patient).toUpperCase();
  const genderRestriction = (bed.genderRestriction ?? "ANY").toUpperCase();
  if (genderRestriction !== "ANY" && gender !== "NOT RECORDED" && genderRestriction !== gender) warnings.push("Gender restriction");
  const age = ageYears(patient);
  const ageGroup = age === undefined ? "ANY" : age < 14 ? "PAEDIATRIC" : "ADULT";
  const ageRestriction = (bed.ageRestriction ?? "ANY").toUpperCase();
  if (ageRestriction !== "ANY" && ageRestriction !== ageGroup) warnings.push("Age restriction");
  if (isolationRequired && !bed.isolationSupport) warnings.push("No isolation support");
  return warnings;
}

export function NewAdmission() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState(searchParams.get("patientId") ?? "");
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [identity, setIdentity] = useState<IdentityConfirmation | null>(null);
  const [activeAdmission, setActiveAdmission] = useState<ActiveAdmission | null>(null);
  const [reference, setReference] = useState<AdmissionReference>(emptyReference);
  const [wards, setWards] = useState<WardSummary[]>([]);
  const [beds, setBeds] = useState<WardBed[]>([]);
  const [selectedWardId, setSelectedWardId] = useState("");
  const [selectedBedId, setSelectedBedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingBeds, setLoadingBeds] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdAdmission, setCreatedAdmission] = useState<ActiveAdmission | null>(null);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<SelectOption | null>(null);
  const [wardDepartmentFilter, setWardDepartmentFilter] = useState("");
  const [wardTypeFilter, setWardTypeFilter] = useState("");
  const [bedTypeFilter, setBedTypeFilter] = useState("");
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [form, setForm] = useState({
    admissionType: "EMERGENCY" as AdmissionType,
    admissionReason: "",
    presentingComplaint: "",
    provisionalDiagnosis: "",
    referringDepartmentId: "",
    admittingDoctorId: "",
    priority: "routine" as AdmissionPriority,
    isolationRequired: false,
    isolationType: "none",
    specialNursingRequirement: "",
    admissionNotes: "",
  });

  const selectedWard = useMemo(() => wards.find((item) => item.id === selectedWardId) ?? null, [selectedWardId, wards]);
  const selectedBed = useMemo(() => beds.find((item) => item.id === selectedBedId) ?? null, [selectedBedId, beds]);
  const filteredWards = useMemo(() => wards.filter((ward) => {
    if (wardDepartmentFilter && ward.departmentId !== wardDepartmentFilter) return false;
    if (wardTypeFilter && ward.wardType !== wardTypeFilter) return false;
    return true;
  }), [wardDepartmentFilter, wardTypeFilter, wards]);
  const wardDepartmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    wards.forEach((ward) => {
      if (ward.departmentId) counts.set(ward.departmentId, (counts.get(ward.departmentId) ?? 0) + 1);
    });
    return counts;
  }, [wards]);
  const filteredBeds = useMemo(() => beds.filter((bed) => {
    if (bedTypeFilter && bed.bedType !== bedTypeFilter) return false;
    if (accessibleOnly && !bed.accessibleBed) return false;
    return true;
  }), [accessibleOnly, bedTypeFilter, beds]);
  const wardTypes = useMemo(() => [...new Set(
    wards
      .filter((ward) => !wardDepartmentFilter || ward.departmentId === wardDepartmentFilter)
      .map((ward) => ward.wardType)
      .filter(Boolean),
  )], [wardDepartmentFilter, wards]);
  const bedTypes = useMemo(() => [...new Set(beds.map((bed) => bed.bedType).filter(Boolean))], [beds]);
  const allergies = patientAllergies(patient);

  useEffect(() => {
    Promise.all([getAdmissionReference(), getAdmissionWards()])
      .then(([referenceData, wardData]) => {
        setReference(referenceData);
        setWards(wardData);
      })
      .catch((error: unknown) => showToast(error instanceof Error ? error.message : "Unable to load admission reference data.", "danger"));
  }, [showToast]);

  useEffect(() => {
    if (!searchParams.get("patientId")) return;
    void identify(searchParams.get("patientId") ?? "");
    // Intentionally run only for the preloaded patient query parameter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function identify(value = search) {
    const identifier = value.trim();
    if (!identifier) {
      showToast("Enter a patient ID, NIC, passport, phone number, or name.", "warning");
      return;
    }
    setLoading(true);
    setIdentity(null);
    setActiveAdmission(null);
    try {
      const result = await searchPatientRecords(identifier);
      setPatients(result.items);
      if (result.items.length === 1) setPatient(result.items[0]);
      if (!result.items.length) showToast("No patient matched this identifier.", "warning");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to identify the patient.", "danger");
    } finally {
      setLoading(false);
    }
  }

  function selectPatient(item: PatientRecord) {
    setPatient(item);
    setIdentity(null);
    setActiveAdmission(null);
    setSelectedWardId("");
    setSelectedBedId("");
    setStep(1);
  }

  async function confirmIdentity() {
    if (!patient) return;
    setLoading(true);
    try {
      const result = await confirmPatientIdentity(String(patient.id || patientNumber(patient)));
      setIdentity(result);
      setActiveAdmission(result.activeAdmission);
      if (result.activeAdmission) showToast("Patient identity confirmed, but an active admission already exists.", "warning");
      else showToast("Patient identity confirmed.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to confirm the patient identity.", "danger");
    } finally {
      setLoading(false);
    }
  }


  async function dischargeExistingAdmission() {
    if (!activeAdmission) return;
    const reason = window.prompt("Enter the discharge reason for the current admission:");
    if (!reason?.trim()) return;
    setLoading(true);
    try {
      await dischargeAdmission(activeAdmission.id, reason.trim(), "Discharged from the verified admission workflow.");
      setActiveAdmission(null);
      setIdentity((current) => current ? { ...current, activeAdmission: null } : current);
      showToast("The previous admission was discharged and its bed moved to CLEANING.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to discharge the current admission.", "danger");
    } finally {
      setLoading(false);
    }
  }

  function validateAdmissionDetails() {
    if (!form.admissionReason.trim()) {
      showToast("Admission reason is required.", "warning");
      return false;
    }
    if (!form.admittingDoctorId && form.admissionType !== "OBSERVATION") {
      showToast("Select an admitting doctor for this admission.", "warning");
      return false;
    }
    return true;
  }

  async function refreshAdmissionWards(options: { resetFilters?: boolean } = {}) {
    setLoadingWards(true);
    try {
      const items = await getAdmissionWards();
      setWards(items);
      if (options.resetFilters) {
        setWardDepartmentFilter("");
        setWardTypeFilter("");
        setSelectedWardId("");
        setSelectedBedId("");
        setBeds([]);
      }
      if (!items.length) showToast("No active wards were returned by the hospital database.", "warning");
      return items;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to refresh wards from the database.", "danger");
      return [];
    } finally {
      setLoadingWards(false);
    }
  }

  async function openWardSelection() {
    const items = await refreshAdmissionWards({ resetFilters: true });
    if (items.length) setStep(3);
  }

  function changeWardDepartment(nextDepartmentId: string) {
    setWardDepartmentFilter(nextDepartmentId);
    setSelectedWardId("");
    setSelectedBedId("");
    setBeds([]);
    if (wardTypeFilter && !wards.some((ward) => (!nextDepartmentId || ward.departmentId === nextDepartmentId) && ward.wardType === wardTypeFilter)) {
      setWardTypeFilter("");
      showToast("The ward type filter was cleared because it is not available in the selected department.", "info");
    }
  }

  function changeWardType(nextWardType: string) {
    setWardTypeFilter(nextWardType);
    setSelectedWardId("");
    setSelectedBedId("");
    setBeds([]);
  }

  function clearWardFilters() {
    setWardDepartmentFilter("");
    setWardTypeFilter("");
    setSelectedWardId("");
    setSelectedBedId("");
    setBeds([]);
  }

  async function selectWard(ward: WardSummary) {
    const compatibility = getWardCompatibility(ward, patient, form.isolationRequired, form.referringDepartmentId);
    if (compatibility.blocking.length) {
      showToast(compatibility.blocking.join(". "), "warning");
      return;
    }
    setSelectedWardId(ward.id);
    setSelectedBedId("");
    setLoadingBeds(true);
    try {
      const items = await getAvailableWardBeds(ward.id, { isolationRequired: form.isolationRequired });
      setBeds(items);
      if (!items.length) showToast("No compatible available beds remain in this ward.", "warning");
      else setStep(4);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to load available beds.", "danger");
    } finally {
      setLoadingBeds(false);
    }
  }

  async function refreshBeds() {
    if (!selectedWardId) return;
    setLoadingBeds(true);
    try {
      const items = await getAvailableWardBeds(selectedWardId, { isolationRequired: form.isolationRequired });
      setBeds(items);
      if (!items.some((item) => item.id === selectedBedId)) setSelectedBedId("");
      showToast("Available beds refreshed.", "info");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to refresh available beds.", "danger");
    } finally {
      setLoadingBeds(false);
    }
  }

  async function submitAdmission() {
    if (!patient || !identity || !selectedWard || !selectedBed) return;
    setSubmitting(true);
    try {
      const result = await createAdmission({
        patientId: String(patient.id),
        identityConfirmationId: identity.confirmationId,
        wardId: selectedWard.id,
        bedId: selectedBed.id,
        referringDepartmentId: form.referringDepartmentId || null,
        admittingDoctorId: form.admittingDoctorId || null,
        admissionType: form.admissionType,
        admissionReason: form.admissionReason.trim(),
        presentingComplaint: form.presentingComplaint.trim(),
        provisionalDiagnosis: form.provisionalDiagnosis.trim(),
        priority: form.priority,
        isolationRequired: form.isolationRequired,
        specialNursingRequirement: form.specialNursingRequirement.trim(),
        admissionNotes: form.admissionNotes.trim(),
      });
      setCreatedAdmission(result.admission);
      showToast(`${result.admission.admissionNumber} created and ${result.admission.bedCode} assigned.`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to complete the admission.";
      showToast(message, "danger");
      if (/identity confirmation/i.test(message)) {
        setIdentity(null);
        setStep(1);
      } else if (/bed.*available|allocated|another staff/i.test(message)) {
        setStep(4);
        await refreshBeds();
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (createdAdmission) {
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <Card className="border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/20">
          <CardContent className="space-y-5 p-8 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
            <div>
              <h1 className="text-2xl font-bold">Admission confirmed and bed assigned</h1>
              <p className="mt-2 text-muted-foreground">The admission, ward assignment, bed allocation, movement history, notification, and audit record were committed together.</p>
            </div>
            <div className="mx-auto grid max-w-2xl gap-3 rounded-xl border bg-background p-5 text-left sm:grid-cols-2">
              <p><strong>Admission:</strong> {createdAdmission.admissionNumber}</p>
              <p><strong>Patient:</strong> {createdAdmission.patientName}</p>
              <p><strong>Ward:</strong> {createdAdmission.wardCode} — {createdAdmission.wardName}</p>
              <p><strong>Bed:</strong> {createdAdmission.bedCode} ({createdAdmission.bedNumber})</p>
              <p><strong>Doctor:</strong> {createdAdmission.admittingDoctor ?? "Not assigned"}</p>
              <p><strong>Status:</strong> Currently admitted</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => navigate(`/patients/${createdAdmission.patientId}`)}>Open patient profile</Button>
              <Button variant="outline" onClick={() => navigate(`/wards/bed-board?wardId=${encodeURIComponent(createdAdmission.wardId ?? "")}`)}>Open bed board</Button>
              <Button variant="outline" onClick={() => navigate(`/nurse-notes?wardId=${encodeURIComponent(createdAdmission.wardId ?? "")}`)}>Open Nurse Module</Button>
              <Button variant="outline" onClick={() => navigate("/admissions")}>Admissions list</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-primary">Atomic inpatient admission</p>
          <h1 className="text-2xl font-bold">Patient identification → ward → bed</h1>
          <p className="text-sm text-muted-foreground">Confirm the patient before selecting a compatible active ward and an available bed.</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/admissions")}><ArrowLeft className="h-4 w-4" />Admissions</Button>
      </div>

      <div className="grid gap-2 md:grid-cols-6">
        {steps.map((label, index) => (
          <div key={label} className={`rounded-xl border p-3 text-sm ${index === step ? "border-primary bg-primary/10" : index < step ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20" : "bg-card"}`}>
            <div className="flex items-center gap-2">
              <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${index <= step ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{index < step ? <Check className="h-3 w-3" /> : index + 1}</span>
              <span className="font-semibold">{label}</span>
            </div>
          </div>
        ))}
      </div>

      {step === 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5 text-primary" />Identify patient</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void identify(); }}>
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Patient ID, NIC, passport, phone, or patient name" />
              <Button type="submit" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Identify</Button>
            </form>
            <div className="space-y-2">
              {patients.map((item) => (
                <button key={item.id} type="button" onClick={() => selectPatient(item)} className="flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left hover:border-primary">
                  <PatientPhoto src={item.profile_photo_url} name={item.full_name} className="h-16 w-16 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><strong>{item.full_name}</strong><Badge tone="info">{item.patient_no}</Badge></div>
                    <p className="text-sm text-muted-foreground">NIC {item.nic || "Not recorded"} · DOB {item.date_of_birth || "Not recorded"} · {formatPatientAge(item.date_of_birth, item.age_years)}</p>
                    <p className="text-sm text-muted-foreground">{item.gender || "Gender not recorded"} · Blood group {item.blood_group || "Not recorded"}</p>
                  </div>
                  <ArrowRight className="h-5 w-5" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && patient && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-primary" />Confirm patient identity</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 rounded-xl border bg-card p-5 md:grid-cols-[auto_1fr]">
              <PatientPhoto src={String(patientValue(patient, "profile_photo_url", "profilePhotoUrl") ?? "")} name={patientName(patient)} className="h-28 w-28 rounded-xl" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <p><span className="text-xs text-muted-foreground">Full name</span><br /><strong>{patientName(patient)}</strong></p>
                <p><span className="text-xs text-muted-foreground">Patient ID</span><br /><strong>{patientNumber(patient)}</strong></p>
                <p><span className="text-xs text-muted-foreground">NIC</span><br /><strong>{String(patientValue(patient, "nic", "nic") ?? "Not recorded")}</strong></p>
                <p><span className="text-xs text-muted-foreground">Date of birth</span><br /><strong>{dateOfBirth(patient) ?? "Not recorded"}</strong></p>
                <p><span className="text-xs text-muted-foreground">Current age</span><br /><strong>{formatPatientAge(dateOfBirth(patient), ageYears(patient))}</strong></p>
                <p><span className="text-xs text-muted-foreground">Gender</span><br /><strong>{patientGender(patient)}</strong></p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {allergies.length ? allergies.map((allergy) => <Badge key={allergy} tone="danger">Allergy: {allergy}</Badge>) : <Badge tone="success">No known allergies</Badge>}
            </div>
            {!identity ? (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void confirmIdentity()} disabled={loading}><ShieldCheck className="h-4 w-4" />{loading ? "Confirming..." : "Confirm this patient"}</Button>
                <Button variant="outline" onClick={() => setStep(0)}>Choose another patient</Button>
              </div>
            ) : activeAdmission ? (
              <div className="space-y-4 rounded-xl border border-amber-300 bg-amber-50 p-5 dark:bg-amber-950/20">
                <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" /><div><strong>Active admission already exists</strong><p className="text-sm">Do not create another admission for this patient.</p></div></div>
                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <p><strong>Admission:</strong> {activeAdmission.admissionNumber}</p>
                  <p><strong>Hospital:</strong> {activeAdmission.hospitalName}</p>
                  <p><strong>Ward:</strong> {activeAdmission.wardCode} — {activeAdmission.wardName}</p>
                  <p><strong>Bed:</strong> {activeAdmission.bedCode}</p>
                  <p><strong>Admitted:</strong> {new Date(activeAdmission.admittedAt).toLocaleString()}</p>
                  <p><strong>Status:</strong> {activeAdmission.status}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => navigate(`/patients/${activeAdmission.patientId}`)}>Open current admission</Button>
                  <Button variant="outline" onClick={() => navigate(`/wards/bed-board?wardId=${encodeURIComponent(activeAdmission.wardId ?? "")}`)}>View ward</Button>
                  <Button variant="outline" onClick={() => navigate("/transfers/internal")}>Transfer patient</Button>
                  <Button variant="outline" onClick={() => void dischargeExistingAdmission()} disabled={loading}>Discharge patient</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:bg-emerald-950/20">
                <CheckCircle2 className="h-5 w-5 text-emerald-700" /><strong>Identity confirmed by {identity.confirmedBy}</strong>
                <Button className="ml-auto" onClick={() => setStep(2)}>Continue to admission details<ArrowRight className="h-4 w-4" /></Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && patient && identity && !activeAdmission && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-primary" />Admission information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-cyan-700/60 bg-cyan-950/25 px-4 py-3 text-sm text-cyan-100">Only the admission reason is required here. Optional clinical details may be completed later in the admission record.</div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <label className="space-y-1 text-sm font-semibold"><FormFieldLabel>Admission type</FormFieldLabel><SearchableSelect value={form.admissionType} clearable={false} options={["EMERGENCY", "ELECTIVE", "TRANSFER", "OBSERVATION", "MATERNITY", "ICU"].map((item) => ({ value: item, label: item.replaceAll("_", " ") }))} onChange={(value) => setForm((current) => ({ ...current, admissionType: value as AdmissionType }))} /></label>
              <label className="space-y-1 text-sm font-semibold"><FormFieldLabel>Priority</FormFieldLabel><SearchableSelect value={form.priority} clearable={false} options={[{ value: "routine", label: "Routine" }, { value: "urgent", label: "Urgent" }, { value: "emergency", label: "Emergency" }, { value: "critical", label: "Critical" }]} onChange={(value) => setForm((current) => ({ ...current, priority: value as AdmissionPriority }))} /></label>
              <label className="space-y-1 text-sm font-semibold"><FormFieldLabel>Referring department</FormFieldLabel><SearchableSelect value={form.referringDepartmentId} options={reference.departments.map((item) => ({ value: item.id, label: item.name, description: item.code }))} onChange={(value) => setForm((current) => ({ ...current, referringDepartmentId: value }))} placeholder="Not specified" /></label>
              <label className="space-y-1 text-sm font-semibold"><FormFieldLabel>Admitting doctor</FormFieldLabel><SearchableSelect value={form.admittingDoctorId} options={reference.doctors.map((item) => ({ value: item.id, label: item.fullName, description: item.departmentName ?? item.role }))} onChange={(value) => setForm((current) => ({ ...current, admittingDoctorId: value }))} placeholder="Search and select doctor" /></label>
              <label className="space-y-1 text-sm font-semibold md:col-span-2"><FormFieldLabel required>Admission reason</FormFieldLabel><Input value={form.admissionReason} onChange={(event) => setForm((current) => ({ ...current, admissionReason: event.target.value }))} placeholder="Why inpatient admission is required" /></label>
              <label className="space-y-1 text-sm font-semibold md:col-span-2"><FormFieldLabel optional>Presenting complaint</FormFieldLabel><Input value={form.presentingComplaint} onChange={(event) => setForm((current) => ({ ...current, presentingComplaint: event.target.value }))} /></label>
              <label className="space-y-1 text-sm font-semibold"><FormFieldLabel>Provisional diagnosis / ICD-10</FormFieldLabel><DiagnosisSearchSelector value={selectedDiagnosis?.value ?? ""} selectedOption={selectedDiagnosis} onChange={(_, option) => { setSelectedDiagnosis(option ?? null); if (option) setForm((current) => ({ ...current, provisionalDiagnosis: `${option.label}${option.description ? ` — ${option.description}` : ""}` })); }} /><Input className="mt-2" value={form.provisionalDiagnosis} onChange={(event) => { setSelectedDiagnosis(null); setForm((current) => ({ ...current, provisionalDiagnosis: event.target.value })); }} placeholder="Or enter a free-text provisional diagnosis" /></label>
              <label className="space-y-1 text-sm font-semibold md:col-span-2"><FormFieldLabel optional>Special nursing requirement</FormFieldLabel><Input value={form.specialNursingRequirement} onChange={(event) => setForm((current) => ({ ...current, specialNursingRequirement: event.target.value }))} placeholder="Falls, pressure care, monitoring, accessibility..." /></label>
              <label className="space-y-1 text-sm font-semibold"><FormFieldLabel optional>Admission notes</FormFieldLabel><Input value={form.admissionNotes} onChange={(event) => setForm((current) => ({ ...current, admissionNotes: event.target.value }))} /></label>
            </div>
            <label className="block rounded-xl border p-4 text-sm font-semibold"><FormFieldLabel>Isolation requirement</FormFieldLabel><SearchableSelect value={form.isolationType} clearable={false} options={[{ value: "none", label: "No isolation" }, { value: "contact", label: "Contact" }, { value: "droplet", label: "Droplet" }, { value: "airborne", label: "Airborne" }, { value: "protective", label: "Protective" }, { value: "other", label: "Other" }]} onChange={(value) => setForm((current) => ({ ...current, isolationType: value, isolationRequired: value !== "none" }))} /></label>
            <div className="flex justify-between"><Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4" />Back</Button><Button disabled={loadingWards} onClick={() => { if (validateAdmissionDetails()) void openWardSelection(); }}>{loadingWards ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{loadingWards ? "Loading wards..." : "Select ward"}<ArrowRight className="h-4 w-4" /></Button></div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" />Select a compatible ward</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1 text-sm font-semibold"><FormFieldLabel optional={false}>Hospital</FormFieldLabel><Input value={reference.hospital.name} readOnly /></label>
              <label className="space-y-1 text-sm font-semibold"><FormFieldLabel optional>Department filter</FormFieldLabel><Select value={wardDepartmentFilter} onChange={(event) => changeWardDepartment(event.target.value)}><option value="">All ward departments</option>{reference.departments.map((item) => { const count = wardDepartmentCounts.get(item.id) ?? 0; return <option key={item.id} value={item.id} disabled={count === 0}>{item.name} ({count} ward{count === 1 ? "" : "s"})</option>; })}</Select></label>
              <label className="space-y-1 text-sm font-semibold"><FormFieldLabel optional>Ward type filter</FormFieldLabel><Select value={wardTypeFilter} onChange={(event) => changeWardType(event.target.value)}><option value="">All ward types</option>{wardTypes.map((item) => <option key={item}>{item}</option>)}</Select></label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3 text-sm">
              <span><strong>{filteredWards.length}</strong> of <strong>{wards.length}</strong> wards loaded from the hospital database.</span>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={loadingWards} onClick={() => void refreshAdmissionWards()}>
                  <RefreshCcw className={`h-4 w-4 ${loadingWards ? "animate-spin" : ""}`} />Refresh wards
                </Button>
                {(wardDepartmentFilter || wardTypeFilter) && <Button type="button" variant="outline" onClick={clearWardFilters}><RefreshCcw className="h-4 w-4" />Clear ward filters</Button>}
              </div>
            </div>
            {wards.length > 0 && wards.length < 10 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
                <AlertTriangle className="mr-2 inline h-5 w-5" />The database returned only <strong>{wards.length}</strong> ward{wards.length === 1 ? "" : "s"}. The configured NHSL catalog should contain W-01 through W-10. Restart the Spring API so the ward catalog bootstrap can repair the database, then press Refresh wards.
              </div>
            )}
            {!wards.length && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
                <AlertTriangle className="mr-2 inline h-5 w-5" />No wards are configured for this hospital. Create an active ward and at least one available bed in Ward Management before admitting the patient.
              </div>
            )}
            {wards.length > 0 && !filteredWards.length && (
              <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
                <p><AlertTriangle className="mr-2 inline h-5 w-5" /><strong>No wards match both selected filters.</strong> This is a filter combination issue; the admission has not failed.</p>
                <p>Clear the filters to display all active wards, then select a ward card to load its available beds.</p>
                <Button type="button" onClick={clearWardFilters}><RefreshCcw className="h-4 w-4" />Show all wards</Button>
              </div>
            )}
            {loadingWards && <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Refreshing ward and bed availability from PostgreSQL...</div>}
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {filteredWards.map((ward) => {
                const compatibility = getWardCompatibility(ward, patient, form.isolationRequired, form.referringDepartmentId);
                const disabled = compatibility.blocking.length > 0 || loadingBeds;
                return (
                  <button key={ward.id} type="button" disabled={disabled} onClick={() => void selectWard(ward)} className={`rounded-xl border p-4 text-left ${disabled ? "cursor-not-allowed opacity-60" : "hover:border-primary hover:bg-primary/5"}`}>
                    <div className="flex items-start justify-between gap-3"><div><strong>{ward.wardCode} — {ward.wardName}</strong><p className="text-sm text-muted-foreground">{ward.departmentName ?? "Department not assigned"} · {ward.wardType}</p></div><Badge tone={ward.availableBeds ? "success" : "warning"}>{ward.availableBeds} available</Badge></div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs"><span>Total {ward.totalBeds}</span><span>Occupied {ward.occupiedBeds}</span><span>{ward.occupancyPercent}% full</span><span>Reserved {ward.reservedBeds}</span><span>Cleaning {ward.cleaningBeds}</span><span>Isolation {ward.isolationBeds ?? 0}</span></div>
                    {compatibility.blocking.length > 0 && <p className="mt-3 text-xs font-semibold text-rose-700">Cannot select: {compatibility.blocking.join(" · ")}</p>}
                    {!compatibility.blocking.length && compatibility.advisories.length > 0 && <p className="mt-3 text-xs font-semibold text-amber-700">Check: {compatibility.advisories.join(" · ")}. Selection is still allowed.</p>}
                    {!compatibility.blocking.length && !compatibility.advisories.length && <p className="mt-3 text-xs text-emerald-700">Compatible ward — select to load beds</p>}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap justify-between gap-2"><Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4" />Back</Button>{filteredWards.length > 0 && <p className="self-center text-sm text-muted-foreground">Select a ward card above to continue to bed selection.</p>}</div>
          </CardContent>
        </Card>
      )}

      {step === 4 && selectedWard && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><BedDouble className="h-5 w-5 text-primary" />Select an available bed in {selectedWard.wardName}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-56 space-y-1 text-sm font-semibold"><FormFieldLabel optional>Bed type</FormFieldLabel><Select value={bedTypeFilter} onChange={(event) => setBedTypeFilter(event.target.value)}><option value="">All available types</option>{bedTypes.map((item) => <option key={item}>{item}</option>)}</Select></label>
              <label className="flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-semibold"><input type="checkbox" checked={accessibleOnly} onChange={(event) => setAccessibleOnly(event.target.checked)} />Accessible beds only</label>
              <Button variant="outline" onClick={() => void refreshBeds()} disabled={loadingBeds}><RefreshCcw className={`h-4 w-4 ${loadingBeds ? "animate-spin" : ""}`} />Refresh availability</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredBeds.map((bed) => {
                const warnings = bedCompatibilityWarnings(bed, patient, form.isolationRequired);
                return (
                  <button key={bed.id} type="button" disabled={warnings.length > 0} onClick={() => setSelectedBedId(bed.id)} className={`rounded-xl border p-4 text-left ${selectedBedId === bed.id ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "hover:border-primary"} ${warnings.length ? "cursor-not-allowed opacity-60" : ""}`}>
                    <div className="flex justify-between gap-2"><strong>{bed.bedCode}</strong><Badge tone="success">Available</Badge></div>
                    <p className="mt-1 text-sm">Bed {bed.bedNumber} · {bed.bedType}</p>
                    <p className="text-xs text-muted-foreground">Room {bed.roomNumber ?? "General"}</p>
                    <div className="mt-2 flex flex-wrap gap-1">{bed.isolationSupport && <Badge tone="info">Isolation</Badge>}{bed.accessibleBed && <Badge tone="info">Accessible</Badge>}{bed.oxygenSupport && <Badge tone="info">Oxygen</Badge>}{bed.monitorSupport && <Badge tone="info">Monitor</Badge>}</div>
                    {warnings.length > 0 && <p className="mt-2 text-xs text-amber-700">{warnings.join(" · ")}</p>}
                  </button>
                );
              })}
            </div>
            {!filteredBeds.length && <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">No available beds match the selected requirements.</div>}
            <div className="flex justify-between"><Button variant="outline" onClick={() => setStep(3)}><ArrowLeft className="h-4 w-4" />Change ward</Button><Button disabled={!selectedBedId} onClick={() => setStep(5)}>Review admission<ArrowRight className="h-4 w-4" /></Button></div>
          </CardContent>
        </Card>
      )}

      {step === 5 && patient && selectedWard && selectedBed && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-primary" />Review and confirm</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-3">
              <section className="rounded-xl border p-4"><h3 className="mb-3 flex items-center gap-2 font-bold"><IdCard className="h-4 w-4" />Patient</h3><p><strong>{patientName(patient)}</strong></p><p>{patientNumber(patient)}</p><p>{formatPatientAge(dateOfBirth(patient), ageYears(patient))} · {patientGender(patient)}</p><p className={allergies.length ? "text-rose-700" : "text-emerald-700"}>{allergies.length ? `Allergies: ${allergies.join(", ")}` : "No known allergies"}</p></section>
              <section className="rounded-xl border p-4"><h3 className="mb-3 flex items-center gap-2 font-bold"><Stethoscope className="h-4 w-4" />Admission</h3><p><strong>{form.admissionType}</strong> · {form.priority}</p><p>{form.admissionReason}</p><p>{reference.doctors.find((item) => item.id === form.admittingDoctorId)?.fullName ?? "No doctor selected"}</p><p>{new Date().toLocaleString()}</p></section>
              <section className="rounded-xl border p-4"><h3 className="mb-3 flex items-center gap-2 font-bold"><Hospital className="h-4 w-4" />Location</h3><p><strong>{reference.hospital.name}</strong></p><p>{selectedWard.wardCode} — {selectedWard.wardName}</p><p>{selectedBed.bedCode} · Bed {selectedBed.bedNumber}</p><p>Room {selectedBed.roomNumber ?? "General"}</p></section>
            </div>
            <div className="rounded-xl border border-blue-300 bg-blue-50 p-4 text-sm dark:bg-blue-950/20"><ShieldCheck className="mr-2 inline h-4 w-4" />Confirmation creates the admission and bed assignment in one database transaction. A failure rolls back all changes.</div>
            <div className="flex flex-wrap justify-between gap-2"><Button variant="outline" onClick={() => setStep(4)}><ArrowLeft className="h-4 w-4" />Back</Button><div className="flex gap-2"><Button variant="outline" onClick={() => navigate("/admissions")}><XCircle className="h-4 w-4" />Cancel</Button><Button onClick={() => void submitAdmission()} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{submitting ? "Confirming..." : "Confirm admission and assign bed"}</Button></div></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
