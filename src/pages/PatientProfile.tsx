import { QRCodeSVG } from "qrcode.react";
import { Activity, AlertTriangle, Bell, BrainCircuit, CalendarDays, CalendarPlus, Camera, Download, FileText, HeartPulse, LockKeyhole, MapPin, Pencil, QrCode, ScanBarcode, Stethoscope, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GenderBadge } from "../components/patient/GenderBadge";
import { PdfActionButtons } from "../components/reports/PdfActionButtons";
import { PatientCodeScanner } from "../components/patient/PatientCodeScanner";
import { PatientPhoto } from "../components/patient/PatientPhoto";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import { getPatientActivities, PATIENT_ACTIVITIES_UPDATED_EVENT } from "../services/patientActivityService";
import { getPatientRecord, updatePatientRecord } from "../services/patientService";
import { downloadTextFile, timestampedFilename } from "../utils/download";
import { normaliseGenderLabel } from "../utils/gender";
import { diffPatientFields, generatePatientUpdatePdf } from "../utils/patientPdf";
import { getSavedPatientsForDoctors, PATIENTS_UPDATED_EVENT, savePatientForDoctors } from "../utils/patientRegistry";
import type { SavedPatientForDoctor } from "../utils/patientRegistry";
import { getSelfRegisteredPatients, SELF_REGISTRATION_UPDATED_EVENT, type SelfRegisteredPatient } from "../services/selfRegistrationService";
import { useAuthStore } from "../stores/authStore";
import { apiRequest } from "../services/apiClient";
import { preparePatientProfilePhoto } from "../utils/profilePhoto";


type VitalPoint = { slot: string; bp: number; pulse: number; spo2: number; sugar: number };
type AppointmentRow = { id: string; date: string; time: string; department: string; doctor: string; type: string; mode: string; status: string; location: string };
const vitals: VitalPoint[] = [];
const appointments: AppointmentRow[] = [];

export function PatientProfile() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [scannerMode, setScannerMode] = useState<"qr" | "barcode" | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [savedPatients, setSavedPatients] = useState(() => getSavedPatientsForDoctors());
  const [selfRegisteredPatients, setSelfRegisteredPatients] = useState<SelfRegisteredPatient[]>([]);
  const [databasePatient, setDatabasePatient] = useState<SavedPatientForDoctor | null>(null);
  const [databasePatientUuid, setDatabasePatientUuid] = useState("");
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [editForm, setEditForm] = useState({
    phone: "",
    district: "",
    bloodGroup: "",
    allergies: "",
    chronicDiseases: "",
  });
  const role = useAuthStore((state) => state.role);
  const profile = useAuthStore((state) => state.profile);
  const requestedPatientId = decodeURIComponent(id ?? "");
  useEffect(() => {
    async function loadDatabasePatient() {
      if (!requestedPatientId) return;
      try {
        const response = await apiRequest<{ patient: any }>(`/api/patients/${requestedPatientId}`);
        if (response.patient) {
          setDatabasePatient(databasePatientToProfile(response.patient));
          setDatabasePatientUuid(response.patient.id ?? "");
        }
      } catch (error) {
        console.warn("Database patient loading failed", error);
      }
    }
    loadDatabasePatient();
  }, [requestedPatientId]);

  const profilePatient = databasePatient ?? resolveProfilePatient(requestedPatientId, savedPatients, selfRegisteredPatients);
  const patientName = profilePatient.name;
  const patientId = profilePatient.patientId;
  const documentPatientId = databasePatientUuid || (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedPatientId) ? requestedPatientId : "");
  const patientGender = normaliseGenderLabel(profilePatient.sex);
  const patientAge = profilePatient.age;
  const patientPhone = profilePatient.phone;
  const patientDistrict = profilePatient.district;
  const patientBloodGroup = profilePatient.bloodGroup;
  const bmi = (72 / ((1.68 * 1.68))).toFixed(1);
  const allergyList = splitClinicalList(profilePatient.allergies).filter((item) => !/no known/i.test(item));
  const chronicDiseaseList = splitClinicalList(profilePatient.chronicDiseases).filter((item) => !/no chronic/i.test(item));
  const activeProblems = chronicDiseaseList.length ? chronicDiseaseList.join(", ") : "No chronic diseases recorded";
  const profileImageUrl = profilePhoto ?? profilePatient.profilePhotoUrl ?? null;
  const [patientActivities, setPatientActivities] = useState(() => getPatientActivities(patientId));
  const visibleTimeline = patientActivities;

  useEffect(() => {
    function refreshPatients() {
      setSavedPatients(getSavedPatientsForDoctors());
      void getSelfRegisteredPatients().then(setSelfRegisteredPatients).catch(() => setSelfRegisteredPatients([]));
    }
    window.addEventListener(PATIENTS_UPDATED_EVENT, refreshPatients);
    window.addEventListener(SELF_REGISTRATION_UPDATED_EVENT, refreshPatients);
    window.addEventListener("storage", refreshPatients);
    void getSelfRegisteredPatients().then(setSelfRegisteredPatients).catch(() => setSelfRegisteredPatients([]));
    return () => {
      window.removeEventListener(PATIENTS_UPDATED_EVENT, refreshPatients);
      window.removeEventListener(SELF_REGISTRATION_UPDATED_EVENT, refreshPatients);
      window.removeEventListener("storage", refreshPatients);
    };
  }, []);

  useEffect(() => {
    function refreshActivities() {
      setPatientActivities(getPatientActivities(patientId));
    }
    refreshActivities();
    window.addEventListener(PATIENT_ACTIVITIES_UPDATED_EVENT, refreshActivities);
    window.addEventListener("storage", refreshActivities);
    return () => {
      window.removeEventListener(PATIENT_ACTIVITIES_UPDATED_EVENT, refreshActivities);
      window.removeEventListener("storage", refreshActivities);
    };
  }, [patientId]);

  function downloadMedicalSummary() {
    downloadTextFile(
      timestampedFilename("patient-medical-summary", "txt"),
      `GovCare EHR System\nMedical Summary\n\nPatient: ${patientName}\nPatient ID: ${patientId}\nNIC: ${profilePatient.nicOrPassport || "Not recorded"}\nGender: ${patientGender}\nAge: ${patientAge ?? "Not recorded"}\nBlood group: ${patientBloodGroup}\nAllergies: ${allergyList.join(", ") || "No known allergies"}\nActive problems: ${activeProblems}\nTimeline records: ${visibleTimeline.length}`,
      "text/plain;charset=utf-8",
    );
    showToast("Medical summary downloaded.", "success");
  }

  function openEditDetails() {
    setEditForm({
      phone: profilePatient.phone === "Not recorded" ? "" : (profilePatient.phone ?? ""),
      district: profilePatient.district === "Pending review" ? "" : (profilePatient.district ?? ""),
      bloodGroup: profilePatient.bloodGroup === "Not recorded" ? "" : (profilePatient.bloodGroup ?? ""),
      allergies: profilePatient.allergies === "Pending clinical review" ? "" : (profilePatient.allergies ?? ""),
      chronicDiseases: profilePatient.chronicDiseases === "Pending clinical review" ? "" : (profilePatient.chronicDiseases ?? ""),
    });
    setIsEditingDetails(true);
  }

  async function saveEditedDetails() {
    setIsSavingDetails(true);
    const before = {
      phone: profilePatient.phone === "Not recorded" ? "" : profilePatient.phone,
      district: profilePatient.district === "Pending review" ? "" : profilePatient.district,
      blood_group: profilePatient.bloodGroup === "Not recorded" ? "" : profilePatient.bloodGroup,
      allergies: profilePatient.allergies === "Pending clinical review" ? "" : profilePatient.allergies,
      chronic_diseases: profilePatient.chronicDiseases === "Pending clinical review" ? "" : profilePatient.chronicDiseases,
    };
    const after = {
      phone: editForm.phone,
      district: editForm.district,
      blood_group: editForm.bloodGroup,
      allergies: editForm.allergies,
      chronic_diseases: editForm.chronicDiseases,
    };
    const fieldLabels = {
      phone: "Phone",
      district: "District",
      blood_group: "Blood group",
      allergies: "Allergies",
      chronic_diseases: "Chronic diseases",
    };
    const changes = diffPatientFields(before, after, fieldLabels);

    if (changes.length === 0) {
      showToast("No changes to save.", "warning");
      setIsSavingDetails(false);
      return;
    }

    let statusMessage = "";
    try {
      // The DB stores patients by UUID, but this page is keyed by the human-readable patient
      // number (e.g. PAT-2026-000001), so look the record up by patient_no first.
      const lookup = await fetch(
        `${(import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4001")}/api/patients?search=${encodeURIComponent(patientId)}`,
        { headers: { Authorization: `Bearer ${window.localStorage.getItem("govcare-api-token") ?? ""}` } },
      ).then((response) => (response.ok ? response.json() : { items: [] }));
      const match = (lookup.items ?? []).find((item: { patient_no?: string }) => item.patient_no === patientId);

      if (match?.id) {
        await updatePatientRecord(match.id, {
          phone: editForm.phone,
          district: editForm.district,
          bloodGroup: editForm.bloodGroup,
          allergies: editForm.allergies ? editForm.allergies.split(/[,;]/).map((item) => item.trim()).filter(Boolean) : [],
          chronicDiseases: editForm.chronicDiseases ? editForm.chronicDiseases.split(/[,;]/).map((item) => item.trim()).filter(Boolean) : [],
        });
        statusMessage = "Saved to PostgreSQL database.";
      } else {
        statusMessage = "Saved locally only. This patient was not found in the PostgreSQL database.";
      }
    } catch (error) {
      statusMessage = `Saved locally only. PostgreSQL did not record it: ${error instanceof Error ? error.message : "database connection failed"}`;
    }

    savePatientForDoctors({
      ...profilePatient,
      phone: editForm.phone || profilePatient.phone,
      district: editForm.district || profilePatient.district,
      bloodGroup: editForm.bloodGroup || profilePatient.bloodGroup,
      allergies: editForm.allergies || profilePatient.allergies,
      chronicDiseases: editForm.chronicDiseases || profilePatient.chronicDiseases,
    });

    try {
      generatePatientUpdatePdf(
        {
          patientId,
          fullName: patientName,
          gender: patientGender,
          age: patientAge,
          phone: editForm.phone,
          district: editForm.district,
          bloodGroup: editForm.bloodGroup,
          allergies: editForm.allergies,
          chronicDiseases: editForm.chronicDiseases,
          preparedBy: profile?.displayName ?? role ?? "Records officer",
        },
        changes,
      );
    } catch (pdfError) {
      console.error("Failed to generate patient update PDF:", pdfError);
    }

    setIsSavingDetails(false);
    setIsEditingDetails(false);
    showToast(`Patient details updated. ${statusMessage}`, statusMessage.startsWith("Saved locally") ? "warning" : "success");
  }


  function handleScannedCode(value: string) {
    showToast(`Patient scanner captured: ${value}`, "success");
  }

  async function handleProfilePhotoUpload(file?: File) {
    if (!file) return;
    try {
      const photoDataUrl = await preparePatientProfilePhoto(file);
      const current = await getPatientRecord(requestedPatientId || patientId);
      const updated = await updatePatientRecord(current.patient.id, { profilePhotoUrl: photoDataUrl });
      setProfilePhoto(updated.patient.profile_photo_url ?? photoDataUrl);
      setDatabasePatient(databasePatientToProfile(updated.patient));
      showToast("Patient profile picture saved to PostgreSQL and updated across the patient workflow.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to save the patient profile picture.", "danger");
    } finally {
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-5">
      <PatientCodeScanner open={scannerMode !== null} mode={scannerMode ?? "qr"} onClose={() => setScannerMode(null)} onDetected={handleScannedCode} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Modern patient profile</h1>
          <p className="text-sm text-muted-foreground">Longitudinal record with timeline, health summary, alerts, vitals, documents, consent, and audit-aware access.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={openEditDetails}><Pencil className="h-4 w-4" />Edit patient details</Button>
          <Button onClick={() => navigate("/opd")}><CalendarPlus className="h-4 w-4" />New visit</Button>
          <Button variant="outline" onClick={() => documentPatientId ? navigate(`/patients/${documentPatientId}/documents`) : showToast("The PostgreSQL patient record must be loaded before opening documents.", "warning")}><FileText className="h-4 w-4" />Documents & PDFs</Button>
          <Button variant="outline" onClick={() => navigate("/media")}><Upload className="h-4 w-4" />Media Center</Button>
          <PdfActionButtons kind="patients" recordId={requestedPatientId || patientId} />
          <Button variant="outline" onClick={downloadMedicalSummary}><Download className="h-4 w-4" />Text summary</Button>
        </div>
      </div>

      {isEditingDetails && (
        <Card className="border-teal-200 bg-teal-50/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Pencil className="h-5 w-5 text-primary" />Edit patient details</CardTitle>
            <button type="button" aria-label="Close edit panel" className="rounded-md p-1 text-slate-500 hover:bg-white" onClick={() => setIsEditingDetails(false)}>
              <X className="h-4 w-4" />
            </button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-medium text-slate-800">
                Phone
                <Input value={editForm.phone} onChange={(event) => setEditForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="e.g. 0771234567" />
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-800">
                District
                <Input value={editForm.district} onChange={(event) => setEditForm((prev) => ({ ...prev, district: event.target.value }))} placeholder="e.g. Colombo" />
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-800">
                Blood group
                <Input value={editForm.bloodGroup} onChange={(event) => setEditForm((prev) => ({ ...prev, bloodGroup: event.target.value }))} placeholder="e.g. O+" />
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-800">
                Allergies
                <Input value={editForm.allergies} onChange={(event) => setEditForm((prev) => ({ ...prev, allergies: event.target.value }))} placeholder="Comma-separated, e.g. Penicillin" />
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-800 sm:col-span-2">
                Chronic diseases
                <Input value={editForm.chronicDiseases} onChange={(event) => setEditForm((prev) => ({ ...prev, chronicDiseases: event.target.value }))} placeholder="Comma-separated, e.g. Diabetes, hypertension" />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">Saving updates PostgreSQL, refreshes this profile, and downloads a "changed details" PDF listing exactly what was updated.</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={saveEditedDetails} disabled={isSavingDetails}>{isSavingDetails ? "Saving..." : "Save changes"}</Button>
              <Button variant="outline" onClick={() => setIsEditingDetails(false)} disabled={isSavingDetails}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 xl:grid-cols-[340px_1fr]">
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative">
                <PatientPhoto
                  src={profileImageUrl}
                  name={patientName}
                  className="h-28 w-28 rounded-xl bg-teal-50 ring-2 ring-teal-100"
                  fallbackClassName="text-3xl font-bold text-teal-950"
                />
                <button
                  type="button"
                  className="absolute -bottom-2 -right-2 grid h-9 w-9 place-items-center rounded-full bg-primary text-white shadow-md"
                  onClick={() => photoInputRef.current?.click()}
                  aria-label="Upload patient profile picture"
                >
                  <Camera className="h-4 w-4" />
                </button>
                <input ref={photoInputRef} className="hidden" type="file" accept="image/*" onChange={(event) => handleProfilePhotoUpload(event.target.files?.[0])} />
              </div>
              <QRCodeSVG value={patientId} size={118} />
              <div className="text-right">
                <p className="font-mono text-xl tracking-widest">*{patientId.replaceAll("-", "")}*</p>
                <p className="text-xs text-muted-foreground">Barcode scan supported</p>
              </div>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold">{patientName}</h2>
                <GenderBadge value={patientGender} />
              </div>
              <p className="text-sm text-muted-foreground">{patientId} | NIC {profilePatient.nicOrPassport || "Not recorded"}</p>
              <p className="text-sm text-muted-foreground">{patientBloodGroup} | {patientAge} years | {patientDistrict} | {patientPhone}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {allergyList.length
                ? allergyList.map((item) => <Badge key={`allergy-${item}`} tone="danger">Allergy: {item}</Badge>)
                : <Badge tone="success">No known allergies</Badge>}
              {chronicDiseaseList.map((item) => <Badge key={`condition-${item}`} tone="warning">{item}</Badge>)}
              <Badge tone="info">PostgreSQL patient record</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="outline" onClick={() => setScannerMode("qr")}><QrCode className="h-4 w-4" />QR scan</Button>
              <Button variant="outline" onClick={() => setScannerMode("barcode")}><ScanBarcode className="h-4 w-4" />Barcode scan</Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Active problems", activeProblems, AlertTriangle, chronicDiseaseList.length ? "warning" : "success"],
            ["Recent activity", visibleTimeline[0]?.note ?? "No clinical activity recorded", Stethoscope, "info"],
            ["Latest vitals", vitals.length ? `BP ${vitals.at(-1)?.bp ?? "N/A"}, BMI ${bmi}` : "No vitals recorded", HeartPulse, "success"],
            ["Critical warnings", allergyList.length ? `${allergyList.length} allergy warning(s)` : "No allergy warnings", Bell, allergyList.length ? "danger" : "success"],
          ].map(([label, value, Icon, tone]) => (
            <Card key={label as string}>
              <CardContent className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">{label as string}</p>
                  <p className="mt-2 font-bold text-slate-950">{value as string}</p>
                </div>
                <Badge tone={tone as "warning" | "info" | "success" | "danger"}><Icon className="h-4 w-4" /></Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {allergyList.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex flex-wrap items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-700" />
            <p className="text-sm font-semibold text-amber-950">Allergy alert: {allergyList.join(", ")}. Medication interaction and contraindication checks must run before prescribing.</p>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />Smart medical timeline</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {visibleTimeline.length ? visibleTimeline.map((activity) => (
              <div key={activity.id} className="grid gap-2 rounded-md border border-border bg-white p-3 sm:grid-cols-[130px_120px_1fr]">
                <Badge tone={activity.type === "Admission" ? "danger" : activity.type === "Laboratory" ? "info" : activity.status === "pending" ? "warning" : "neutral"}>{activity.type}</Badge>
                <p className="text-sm font-semibold">{activity.date}</p>
                <p className="text-sm text-slate-700"><span className="font-semibold">{activity.unit}</span> - {activity.note}</p>
              </div>
            )) : (
              <div className="rounded-md border border-dashed border-border bg-white p-4 text-sm text-muted-foreground">
                No patient activities recorded yet. Create an OPD ticket, appointment, consultation, prescription, lab request, or admission for this patient to build the timeline.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Vitals trend</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
              <Badge tone="neutral">{vitals.length ? `${vitals.length} recorded points` : "No vitals recorded"}</Badge>
              <Badge tone="neutral">BMI unavailable until current height/weight are recorded</Badge>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={vitals}>
                  <XAxis dataKey="slot" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="bp" stroke="#0f766e" strokeWidth={2} />
                  <Line type="monotone" dataKey="pulse" stroke="#155e75" strokeWidth={2} />
                  <Line type="monotone" dataKey="sugar" stroke="#f59e0b" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" />Appointments</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-950">
            <span className="font-semibold">Appointments linked to this patient profile and visible in Patient Portal.</span>
            <Button variant="outline" onClick={() => navigate("/portal/appointments")}><CalendarPlus className="h-4 w-4" />Book appointment</Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <thead><tr><Th>ID</Th><Th>Date / Time</Th><Th>Department</Th><Th>Doctor</Th><Th>Type</Th><Th>Mode</Th><Th>Status</Th><Th>Location</Th></tr></thead>
              <tbody>
                {appointments.map((appointment) => (
                  <tr key={appointment.id}>
                    <Td className="font-semibold">{appointment.id}</Td>
                    <Td>{appointment.date}<br /><span className="text-xs text-muted-foreground">{appointment.time}</span></Td>
                    <Td>{appointment.department}</Td>
                    <Td>{appointment.doctor}</Td>
                    <Td>{appointment.type}</Td>
                    <Td>{appointment.mode}</Td>
                    <Td><Badge tone={appointment.status === "confirmed" ? "success" : appointment.status === "pending" ? "warning" : "info"}>{appointment.status}</Badge></Td>
                    <Td><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-primary" />{appointment.location}</span></Td>
                  </tr>
                ))}
                {!appointments.length && <tr><Td colSpan={8}><p className="p-3 text-sm text-muted-foreground">No PostgreSQL appointments are linked to this profile yet.</p></Td></tr>}
              </tbody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Digital health summary</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <p><strong>Allergies:</strong> {allergyList.join(", ") || "No known allergies"}</p>
            <p><strong>Chronic diseases:</strong> {activeProblems}</p>
            <p><strong>Risk category:</strong> {profilePatient.riskCategory}</p>
            <p><strong>Recorded timeline events:</strong> {visibleTimeline.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-primary" />Privacy and consent</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <p>Data-sharing permission: granted</p>
            <p>Emergency access mode: audited break-glass only</p>
            <p>Restricted records: pregnancy history and disability notes</p>
            <p>Every view/edit writes an audit log entry.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-primary" />AI-ready signals</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <p>Duplicate probability: low</p>
            <p>Department suggestion: Medical OPD</p>
            <p>Abnormal vitals alert: blood sugar trend</p>
            <p>Missed medication reminder: enabled structure</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Documents and PDFs</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Central inter-department document record</p>
            <p className="mt-1 text-sm text-muted-foreground">View authorized consultation, prescription, laboratory, radiology, admission, discharge, nursing, and administrative PDFs.</p>
          </div>
          <Button onClick={() => documentPatientId ? navigate(`/patients/${documentPatientId}/documents`) : showToast("The PostgreSQL patient record must be loaded before opening documents.", "warning")}><FileText className="h-4 w-4" />Open document center</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function splitClinicalList(value?: string) {
  return (value ?? "")
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePatientId(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "").replace(/^PATIENT:/, "");
}

function isSamePatientId(left: string, right: string) {
  const normalizedLeft = normalizePatientId(left);
  const normalizedRight = normalizePatientId(right);
  return normalizedLeft === normalizedRight || normalizedLeft.replaceAll("-", "") === normalizedRight.replaceAll("-", "");
}

function selfRegisteredToSavedPatient(patient: SelfRegisteredPatient): SavedPatientForDoctor {
  return {
    patientId: patient.patient_no ?? patient.patientNo ?? patient.id ?? "PT-PENDING",
    hospitalId: "hosp-colombo-national",
    name: patient.full_name ?? patient.fullName ?? "New self-registered patient",
    nicOrPassport: patient.nic ?? patient.passport_no ?? "",
    phone: patient.phone ?? "Not recorded",
    sex: patient.gender ?? "Not stated",
    age: undefined,
    district: "Pending review",
    bloodGroup: "Not recorded",
    riskCategory: "routine",
    allergies: "Pending clinical review",
    chronicDiseases: "Pending clinical review",
    assignedDoctor: "Unassigned",
    visitReason: "Self-registration review",
    status: patient.status === "active" ? "assigned" : "new",
    registeredAt: patient.created_at ?? new Date().toISOString(),
  };
}

function databasePatientToProfile(patient: any): SavedPatientForDoctor {
  return {
    patientId: patient.patient_no ?? patient.id,
    hospitalId: patient.hospital_id,
    name: patient.full_name ?? "Unknown Patient",
    nicOrPassport: patient.nic ?? patient.passport_no ?? "",
    phone: patient.phone ?? "Not recorded",
    sex: patient.gender ?? "Not stated",
    age: patient.age_years ?? undefined,
    district: patient.district ?? "Not recorded",
    bloodGroup: patient.blood_group ?? "Not recorded",
    dateOfBirth: patient.date_of_birth ?? undefined,
    address: patient.address ?? undefined,
    province: patient.province ?? undefined,
    nationality: patient.nationality ?? "Sri Lankan",
    profilePhotoUrl: patient.profile_photo_url ?? undefined,
    riskCategory: "routine",
    allergies: Array.isArray(patient.allergies) && patient.allergies.length ? patient.allergies.join(", ") : "No known allergies",
    chronicDiseases: Array.isArray(patient.chronic_diseases) && patient.chronic_diseases.length ? patient.chronic_diseases.join(", ") : "No chronic diseases",
    assignedDoctor: "Unassigned",
    visitReason: "Patient record",
    status: patient.status === "active" ? "assigned" : "new",
    registeredAt: patient.created_at ?? new Date().toISOString(),
  };
}

function resolveProfilePatient(routeId: string, savedPatients: SavedPatientForDoctor[], selfRegisteredPatients: SelfRegisteredPatient[]): SavedPatientForDoctor {
  const allSaved = [...savedPatients];
  const selfRegistered = selfRegisteredPatients.map(selfRegisteredToSavedPatient);
  if (routeId) {
    const found = [...allSaved, ...selfRegistered].find((patient) => isSamePatientId(patient.patientId, routeId));
    if (found) return found;
    return {
      patientId: routeId,
      hospitalId: "hosp-colombo-national",
      name: "Patient not found",
      nicOrPassport: "",
      phone: "Not recorded",
      sex: "Not stated",
      age: undefined,
      district: "Pending review",
      bloodGroup: "Not recorded",
      riskCategory: "routine",
      allergies: "Pending clinical review",
      chronicDiseases: "Pending clinical review",
      assignedDoctor: "Unassigned",
      visitReason: "Newly created profile",
      status: "new",
      registeredAt: new Date().toISOString(),
    };
  }
  return allSaved[0] ?? {
    patientId: "NOT-SELECTED",
    hospitalId: "",
    name: "No patient selected",
    nicOrPassport: "",
    phone: "Not recorded",
    sex: "Not stated",
    age: undefined,
    district: "Not recorded",
    bloodGroup: "Not recorded",
    riskCategory: "routine",
    allergies: "No known allergies",
    chronicDiseases: "No chronic diseases",
    assignedDoctor: "Unassigned",
    visitReason: "Select a PostgreSQL patient",
    status: "new",
    registeredAt: new Date().toISOString(),
  };
}

