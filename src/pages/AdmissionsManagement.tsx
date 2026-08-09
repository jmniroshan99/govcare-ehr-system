import { Activity, Ambulance, BedDouble, BellRing, ClipboardCheck, ClipboardList, DoorOpen, FileCheck2, Filter, HeartPulse, Hospital, Layers3, MoveRight, Pill, Search, ShieldAlert, Stethoscope, TestTube2, UserRoundCheck, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageTransition, Reveal, SectionReveal, Stagger } from "../components/motion/PageTransition";
import { GenderBadge } from "../components/patient/GenderBadge";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { SmartSearch } from "../components/search/SmartSearch";
import { Select } from "../components/ui/select";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import { ADMISSION_WORKFLOW_UPDATED_EVENT, getAdmissionCounterRequests, updateAdmissionCounterRequest, type AdmissionCounterRequest } from "../utils/admissionWorkflow";
import { addNotification } from "../utils/notifications";
import { getPatientClinicalClassification } from "../utils/patientRegistry";
import { wardAssignmentAllowed, type PatientGenderForWard, type WardCategory } from "../utils/wardPolicy";

type AdmissionStatus = "pending" | "approved" | "admitted" | "transfer-requested" | "discharge-ready" | "discharged" | "cancelled";
type AdmissionPriority = "routine" | "urgent" | "emergency" | "critical";
type BedStatus = "available" | "occupied" | "reserved" | "cleaning" | "isolation";

interface AdmissionRequest {
  id: string;
  admissionNo?: string;
  patientId: string;
  patientName: string;
  patientAge: number;
  patientGender: PatientGenderForWard;
  referralSource: "OPD" | "Emergency" | "Clinic" | "Doctor Center";
  reason: string;
  provisionalDiagnosis: string;
  priority: AdmissionPriority;
  department: string;
  wardType: string;
  consultant: string;
  bedType: string;
  allergies: string[];
  chronicDiseases: string[];
  emergencyStatus: boolean;
  notes: string;
  status: AdmissionStatus;
  wardId?: string;
  bedId?: string;
  createdAt: string;
  updatedAt: string;
}

interface WardRecord {
  id: string;
  name: string;
  type: string;
  category: WardCategory;
  department: string;
  nurseLead: string;
  totalBeds: number;
}

interface BedRecord {
  id: string;
  wardId: string;
  bedNo: string;
  status: BedStatus;
  bedType: string;
  patientId?: string;
  patientName?: string;
}

const wards: WardRecord[] = [
  { id: "male-medical-ward", name: "Male Medical Ward", type: "Medical", category: "male", department: "General Medicine", nurseLead: "Nurse Silva", totalBeds: 25 },
  { id: "male-surgical-ward", name: "Male Surgical Ward", type: "Surgical", category: "male", department: "Surgery", nurseLead: "Nurse Fernando", totalBeds: 25 },
  { id: "female-medical-ward", name: "Female Medical Ward", type: "Medical", category: "female", department: "General Medicine", nurseLead: "Nurse Rizna", totalBeds: 25 },
  { id: "female-surgical-ward", name: "Female Surgical Ward", type: "Surgical", category: "female", department: "Surgery", nurseLead: "Nurse Wijesinghe", totalBeds: 25 },
  { id: "female-obstetrics-ward", name: "Female Obstetrics Ward", type: "Obstetrics", category: "female", department: "Obstetrics", nurseLead: "Nurse Jayasuriya", totalBeds: 25 },
  { id: "children-medical-ward", name: "Children Medical Ward", type: "Pediatric", category: "children", department: "Paediatrics", nurseLead: "Nurse Perera", totalBeds: 25 },
  { id: "children-surgical-ward", name: "Children Surgical Ward", type: "Pediatric Surgery", category: "children", department: "Paediatric Surgery", nurseLead: "Nurse Thevan", totalBeds: 25 },
  { id: "children-isolation-ward", name: "Children Isolation Ward", type: "Isolation", category: "children", department: "Paediatric Isolation", nurseLead: "Nurse Joseph", totalBeds: 20 },
];

const seedAdmissions: AdmissionRequest[] = [
  { id: "REQ-1001", patientId: "PAT-2026-000233", patientName: "R. Kumar", patientAge: 54, patientGender: "male", referralSource: "Emergency", reason: "Chest pain with elevated troponin", provisionalDiagnosis: "Acute coronary syndrome", priority: "critical", department: "Cardiology", wardType: "Male Ward", consultant: "Dr. Anjali Perera", bedType: "Monitored bed", allergies: ["Penicillin"], chronicDiseases: ["Diabetes", "Hypertension"], emergencyStatus: true, notes: "ETU requests monitored admission. Cardiology review completed.", status: "admitted", admissionNo: "ADM-2026-00341", wardId: "male-medical-ward", bedId: "male-medical-ward-B03", createdAt: "2026-06-15T08:15:00+05:30", updatedAt: "2026-06-15T09:10:00+05:30" },
  { id: "REQ-1002", patientId: "PAT-2026-000142", patientName: "Fathima Rizna", patientAge: 31, patientGender: "female", referralSource: "Clinic", reason: "High-risk antenatal monitoring", provisionalDiagnosis: "High-risk pregnancy", priority: "urgent", department: "Obstetrics", wardType: "Female Ward", consultant: "Dr. Fernando", bedType: "Female ward bed", allergies: [], chronicDiseases: ["Gestational diabetes"], emergencyStatus: false, notes: "Needs daily BP and fetal monitoring.", status: "approved", admissionNo: "ADM-2026-00342", wardId: "female-obstetrics-ward", bedId: "female-obstetrics-ward-B05", createdAt: "2026-06-15T09:20:00+05:30", updatedAt: "2026-06-15T09:35:00+05:30" },
  { id: "REQ-1003", patientId: "PAT-2026-000525", patientName: "M. Ahamed", patientAge: 63, patientGender: "male", referralSource: "OPD", reason: "Worsening renal function", provisionalDiagnosis: "Acute kidney injury", priority: "urgent", department: "Renal", wardType: "Male Ward", consultant: "Dr. Jayasinghe", bedType: "Medical bed", allergies: ["NSAIDs"], chronicDiseases: ["CKD"], emergencyStatus: false, notes: "Awaiting creatinine repeat and ultrasound KUB.", status: "pending", createdAt: "2026-06-15T10:05:00+05:30", updatedAt: "2026-06-15T10:05:00+05:30" },
  { id: "REQ-1004", patientId: "PAT-2026-000301", patientName: "K. Thevarajah", patientAge: 42, patientGender: "male", referralSource: "Doctor Center", reason: "Post-operative observation", provisionalDiagnosis: "Post appendicectomy recovery", priority: "routine", department: "Surgery", wardType: "Male Ward", consultant: "Dr. S. Kumar", bedType: "Surgical bed", allergies: [], chronicDiseases: [], emergencyStatus: false, notes: "Discharge likely tomorrow if afebrile.", status: "discharge-ready", admissionNo: "ADM-2026-00338", wardId: "male-surgical-ward", bedId: "male-surgical-ward-B04", createdAt: "2026-06-14T16:25:00+05:30", updatedAt: "2026-06-15T11:00:00+05:30" },
];

function normalizeAdmissionRequest(request: AdmissionCounterRequest | AdmissionRequest): AdmissionRequest {
  return {
    ...request,
    patientAge: "patientAge" in request ? request.patientAge : 35,
    patientGender: "patientGender" in request ? request.patientGender : "male",
    wardType: request.wardType || "Male Ward",
  };
}

function mergeAdmissionRequests(requests: AdmissionCounterRequest[]): AdmissionRequest[] {
  const merged = [...requests.map(normalizeAdmissionRequest), ...seedAdmissions];
  return merged.filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);
}

function createBeds(): BedRecord[] {
  return wards.flatMap((ward) =>
    Array.from({ length: ward.totalBeds }, (_, index) => {
      const bedNo = `${ward.id}-B${String(index + 1).padStart(2, "0")}`;
      const admission = seedAdmissions.find((item) => item.bedId === bedNo);
      const status: BedStatus = admission ? "occupied" : index % 13 === 0 ? "cleaning" : index % 11 === 0 ? "reserved" : ward.id === "isolation-ward" && index % 7 === 0 ? "isolation" : "available";
      return {
        id: bedNo,
        wardId: ward.id,
        bedNo: `${ward.name.replace(" Ward", "").replace("Medical", "MED").replace("Surgical", "SUR").replace("Pediatric", "PED").replace("Obstetrics", "OBS").replace("Isolation", "ISO")}-${String(index + 1).padStart(2, "0")}`,
        status,
        bedType: ward.id === "icu" ? "Monitored bed" : ward.id === "hdu" ? "HDU bed" : ward.id === "isolation-ward" ? "Isolation bed" : "Standard bed",
        patientId: admission?.patientId,
        patientName: admission?.patientName,
      };
    }),
  );
}

function priorityTone(priority: AdmissionPriority) {
  if (priority === "critical" || priority === "emergency") return "danger" as const;
  if (priority === "urgent") return "warning" as const;
  return "info" as const;
}

function statusTone(status: AdmissionStatus | BedStatus) {
  if (["admitted", "available"].includes(status)) return "success" as const;
  if (["critical", "emergency", "occupied", "discharge-ready"].includes(status)) return "danger" as const;
  if (["pending", "approved", "transfer-requested", "reserved", "cleaning", "isolation"].includes(status)) return "warning" as const;
  return "neutral" as const;
}


function bedClass(bed: BedRecord, selectedBedId: string) {
  if (bed.id === selectedBedId) return "border-teal-400 bg-teal-50 ring-2 ring-teal-200";
  if (bed.status === "occupied") return "border-red-400 bg-red-50 text-red-950 shadow-sm";
  if (bed.status === "isolation") return "border-amber-400 bg-amber-50 text-amber-950";
  if (bed.status === "cleaning" || bed.status === "reserved") return "border-amber-300 bg-amber-50";
  return "border-border bg-white";
}

export function AdmissionsManagement() {
  const { showToast } = useToast();
  const [admissions, setAdmissions] = useState<AdmissionRequest[]>(() => mergeAdmissionRequests(getAdmissionCounterRequests()));
  const [beds, setBeds] = useState(createBeds);
  const [selectedAdmissionId, setSelectedAdmissionId] = useState(seedAdmissions[0].id);
  const [selectedWardId, setSelectedWardId] = useState(wards[0].id);
  const [selectedBedId, setSelectedBedId] = useState("");
  const [overrideApproved, setOverrideApproved] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AdmissionStatus | "all">("all");
  const [query, setQuery] = useState("");

  const selectedAdmission = admissions.find((item) => item.id === selectedAdmissionId) ?? admissions[0];
  const wardBeds = beds.filter((bed) => bed.wardId === selectedWardId);
  const selectedWard = wards.find((ward) => ward.id === selectedWardId) ?? wards[0];
  const selectedClassification = getPatientClinicalClassification(selectedAdmission.patientId, { age: selectedAdmission.patientAge, gender: selectedAdmission.patientGender });
  const selectedPolicy = wardAssignmentAllowed({ age: selectedClassification.age ?? selectedAdmission.patientAge, gender: selectedClassification.gender }, selectedWard.category, overrideApproved);

  const visibleAdmissions = useMemo(() => {
    const q = query.toLowerCase();
    return admissions
      .filter((item) => statusFilter === "all" || item.status === statusFilter)
      .filter((item) => !q || [item.patientId, item.patientName, item.reason, item.provisionalDiagnosis, item.department, item.consultant].some((value) => value.toLowerCase().includes(q)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [admissions, query, statusFilter]);

  const stats = useMemo(() => {
    const totalBeds = beds.length;
    const occupied = beds.filter((bed) => bed.status === "occupied").length;
    return [
      { label: "Pending admissions", value: admissions.filter((item) => item.status === "pending").length, Icon: ClipboardList, tone: "warning" as const },
      { label: "Admitted patients", value: admissions.filter((item) => item.status === "admitted").length, Icon: UserRoundCheck, tone: "success" as const },
      { label: "Available beds", value: beds.filter((bed) => bed.status === "available").length, Icon: DoorOpen, tone: "success" as const },
      { label: "Ward occupancy", value: `${Math.round((occupied / totalBeds) * 100)}%`, Icon: BedDouble, tone: occupied / totalBeds > 0.85 ? "danger" as const : "info" as const },
      { label: "Emergency admissions", value: admissions.filter((item) => item.emergencyStatus).length, Icon: Ambulance, tone: "danger" as const },
      { label: "Discharge ready", value: admissions.filter((item) => item.status === "discharge-ready").length, Icon: FileCheck2, tone: "info" as const },
    ];
  }, [admissions, beds]);

  useEffect(() => {
    function refreshAdmissionWorkflow() {
      setAdmissions(mergeAdmissionRequests(getAdmissionCounterRequests()));
    }
    window.addEventListener(ADMISSION_WORKFLOW_UPDATED_EVENT, refreshAdmissionWorkflow);
    window.addEventListener("storage", refreshAdmissionWorkflow);
    return () => {
      window.removeEventListener(ADMISSION_WORKFLOW_UPDATED_EVENT, refreshAdmissionWorkflow);
      window.removeEventListener("storage", refreshAdmissionWorkflow);
    };
  }, []);


  function approveAdmission() {
    if (!selectedAdmission || !selectedBedId) {
      showToast("Select an admission request and available bed first.", "warning");
      return;
    }
    const bed = beds.find((item) => item.id === selectedBedId);
    if (!bed || bed.status !== "available") {
      showToast("Choose an available bed before approval.", "warning");
      return;
    }
    const policy = wardAssignmentAllowed({ age: selectedClassification.age ?? selectedAdmission.patientAge, gender: selectedClassification.gender }, selectedWard.category, overrideApproved);
    if (!policy.allowed) {
      showToast(`${policy.recommendation.label} recommended. Authorized clinical override is required before approval.`, "warning");
      return;
    }
    const now = new Date().toISOString();
    const admissionNo = selectedAdmission.admissionNo ?? `ADM-2026-${String(admissions.length + 341).padStart(5, "0")}`;
    setAdmissions((current) => current.map((item) => item.id === selectedAdmission.id ? { ...item, admissionNo, wardId: selectedWardId, bedId: selectedBedId, status: "admitted", updatedAt: now } : item));
    updateAdmissionCounterRequest(selectedAdmission.id, { admissionNo, wardId: selectedWardId, bedId: selectedBedId, status: "admitted", counterStatus: "bed-assigned" });
    setBeds((current) => current.map((item) => item.id === selectedBedId ? { ...item, status: "occupied", patientId: selectedAdmission.patientId, patientName: selectedAdmission.patientName } : item));
    showToast(`${admissionNo} admitted to ${selectedWard.name}. Nurses notified.`, "success");
    addNotification({ title: "Patient admitted", message: `${selectedAdmission.patientName} allocated to ${bed.bedNo} in ${selectedWard.name}.`, module: "Admissions", priority: selectedAdmission.emergencyStatus ? "critical" : "information", roles: ["doctor", "nurse", "hospital_admin"], channels: ["in-app", "push"], group: "Admissions", actionHref: "/admissions" });
  }

  function updateAdmissionStatus(status: AdmissionStatus) {
    if (!selectedAdmission) return;
    const now = new Date().toISOString();
    setAdmissions((current) => current.map((item) => item.id === selectedAdmission.id ? { ...item, status, updatedAt: now } : item));
    updateAdmissionCounterRequest(selectedAdmission.id, { status });
    if (status === "discharged" || status === "cancelled") {
      setBeds((current) => current.map((bed) => bed.id === selectedAdmission.bedId ? { ...bed, status: "cleaning", patientId: undefined, patientName: undefined } : bed));
    }
    showToast(`Admission marked as ${status}.`, status === "cancelled" ? "warning" : "success");
  }

  return (
    <PageTransition>
      <div className="space-y-5">
        <div className="page-hero flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">Inpatient admissions</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Admission management center</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Create admission requests from OPD, ETU, clinics, or doctor referrals; approve beds with male/female/children ward policy validation, transfers, discharges, notifications, and audit history.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="interactive-control inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90" to="/admissions/new"><BedDouble className="mr-2 h-4 w-4" />New atomic admission</Link>
            <Button variant="outline" onClick={() => {
              addNotification({
                title: "Ward admission update",
                message: `${selectedAdmission.patientName} admission status: ${selectedAdmission.status}.`,
                module: "Admissions",
                priority: selectedAdmission.priority === "critical" ? "critical" : "urgent",
                roles: ["nurse", "doctor", "hospital_admin"],
                channels: ["in-app", "push"],
                group: "Admissions",
                actionHref: "/admissions",
              });
              showToast("Ward staff notification sent.", "success");
            }}><BellRing className="h-4 w-4" />Notify ward staff</Button>
            <Button onClick={approveAdmission}><ClipboardCheck className="h-4 w-4" />Approve and admit</Button>
          </div>
        </div>

        <Stagger>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            {stats.map(({ label, value, Icon, tone }) => (
              <Reveal key={label}>
                <Card>
                  <CardContent className="flex min-h-28 items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
                    </div>
                    <Badge tone={tone}><Icon className="h-5 w-5" /></Badge>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </section>
        </Stagger>

        <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Hospital className="h-5 w-5 text-primary" />Create a safe inpatient admission</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-teal-300 bg-teal-50 p-4 text-sm text-teal-950 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-50">
                <p className="font-bold">The legacy free-text admission form has been retired.</p>
                <p className="mt-1">Use the atomic workflow so patient identity, age, hospital, department, ward, available bed, admitting staff, isolation rules, permissions, audit history, and concurrent bed locking are validated by the Spring Boot API.</p>
              </div>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li><strong className="text-foreground">1.</strong> Search and confirm the patient.</li>
                <li><strong className="text-foreground">2.</strong> Enter narrative admission reason and choose controlled clinical values.</li>
                <li><strong className="text-foreground">3.</strong> Select hospital → department → compatible ward → available bed.</li>
                <li><strong className="text-foreground">4.</strong> Review and commit the admission in one transaction.</li>
              </ol>
              <Link className="interactive-control inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90" to="/admissions/new"><BedDouble className="mr-2 h-4 w-4" />Open smart admission workflow</Link>
              <p className="help-strip p-3 text-sm">Existing admission records remain visible in this management dashboard. New records are created only through the validated workflow.</p>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5 text-primary" />Admission queue</CardTitle></CardHeader>
              <CardContent className="grid gap-3 lg:grid-cols-[1fr_220px]">
                <SmartSearch value={query} onChange={setQuery} placeholder="Search patient, diagnosis, consultant, department..." scope="admissions" />
                <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AdmissionStatus | "all")}>
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="admitted">Admitted</option>
                  <option value="transfer-requested">Transfer requested</option>
                  <option value="discharge-ready">Discharge ready</option>
                  <option value="discharged">Discharged</option>
                  <option value="cancelled">Cancelled</option>
                </Select>
              </CardContent>
            </Card>

            <div className="grid gap-3 lg:grid-cols-2">
              {visibleAdmissions.map((item) => (
                <button key={item.id} className={`interactive-control rounded-md border p-4 text-left shadow-sm ${item.id === selectedAdmission.id ? "border-teal-400 bg-teal-50 ring-2 ring-teal-100" : "border-border bg-white"}`} type="button" onClick={() => setSelectedAdmissionId(item.id)}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-950">{item.patientName}</p>
                        <GenderBadge value={item.patientGender} compact />
                      </div>
                      <p className="text-xs text-muted-foreground">{item.patientId} | age {item.patientAge} | {item.admissionNo ?? item.id}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={priorityTone(item.priority)}>{item.priority}</Badge>
                      <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">{item.provisionalDiagnosis}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{item.referralSource} to {item.department} | {item.consultant}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        <SectionReveal>
          <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2"><BedDouble className="h-5 w-5 text-primary" />Bed allocation</span>
                  <Badge tone="info">{selectedWard.name}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid gap-3 md:grid-cols-[280px_1fr]">
                  <label className="text-sm font-medium">Ward<Select value={selectedWardId} onChange={(event) => setSelectedWardId(event.target.value)}>{wards.map((ward) => <option key={ward.id} value={ward.id}>{ward.name} - {ward.department}</option>)}</Select></label>
                  <div className="selection-panel flex flex-wrap items-center gap-2 p-3 text-sm">
                    <Badge tone="success">available</Badge>
                    <Badge tone="danger">occupied</Badge>
                    <Badge tone="warning">reserved / cleaning / isolation</Badge>
                    <Badge tone={selectedWard.category === "children" ? "info" : selectedWard.category === "female" ? "warning" : "success"}>{selectedWard.category} ward</Badge>
                    <span className="text-muted-foreground">Real-time listener target: `beds` filtered by hospitalId + wardId.</span>
                  </div>
                </div>
                <div className={`mb-4 rounded-md border p-3 text-sm font-semibold ${selectedPolicy.allowed ? "border-teal-200 bg-teal-50 text-teal-950" : "border-rose-300 bg-rose-50 text-rose-950"}`}>
                  Patient classification: {selectedClassification.dependentCategory.replaceAll("_", " ")}. Recommended placement: {selectedClassification.recommendedWardLabel}. Selected ward: {selectedWard.name}. {selectedClassification.reason}
                  <label className="mt-2 flex items-start gap-2">
                    <input type="checkbox" checked={overrideApproved} onChange={(event) => setOverrideApproved(event.target.checked)} />
                    Authorized clinical override for emergency, infection control, or consultant-approved cross-assignment.
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                  {wardBeds.map((bed) => (
                    <button key={bed.id} className={`interactive-control min-h-28 rounded-md border p-3 text-left text-sm ${bedClass(bed, selectedBedId)}`} type="button" onClick={() => setSelectedBedId(bed.id)}>
                      <span className="flex items-center justify-between gap-2"><span className="font-bold">{bed.bedNo}</span><Badge tone={statusTone(bed.status)}>{bed.status}</Badge></span>
                      <span className="mt-2 block text-xs font-medium">{bed.patientName ?? bed.bedType}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{bed.patientId ?? "Ready for allocation"}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><HeartPulse className="h-5 w-5 text-primary" />Inpatient profile</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border border-border bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-bold text-slate-950">{selectedAdmission.patientName}</p>
                        <GenderBadge value={selectedAdmission.patientGender} />
                      </div>
                      <p className="text-sm text-muted-foreground">{selectedAdmission.patientId} | age {selectedAdmission.patientAge} | {selectedAdmission.admissionNo ?? "Admission pending"}</p>
                    </div>
                    <Badge tone={statusTone(selectedAdmission.status)}>{selectedAdmission.status}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm">
                    <p><span className="font-semibold">Diagnosis:</span> {selectedAdmission.provisionalDiagnosis}</p>
                    <p><span className="font-semibold">Reason:</span> {selectedAdmission.reason}</p>
                    <p><span className="font-semibold">Allergies:</span> {selectedAdmission.allergies.join(", ") || "None recorded"}</p>
                    <p><span className="font-semibold">Chronic diseases:</span> {selectedAdmission.chronicDiseases.join(", ") || "None recorded"}</p>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    ["Vitals", "BP 128/82, HR 88, SpO2 98%", Activity],
                    ["Nursing notes", "Shift handover and care tasks ready", ClipboardCheck],
                    ["Medication chart", "MAR linked to pharmacy", Pill],
                    ["Lab requests", "FBC, CRP, UFR pending", TestTube2],
                    ["Radiology", "Imaging requests linked", Search],
                    ["Doctor rounds", "SOAP review at 16:00", Stethoscope],
                    ["Diet plan", "Diabetic renal diet", Layers3],
                    ["Discharge plan", "Follow-up clinic + summary", FileCheck2],
                  ].map(([title, detail, Icon]) => (
                    <div key={title as string} className="rounded-md border border-border bg-white p-3 text-sm">
                      <p className="flex items-center gap-2 font-bold text-slate-950"><Icon className="h-4 w-4 text-primary" />{title as string}</p>
                      <p className="mt-1 text-muted-foreground">{detail as string}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => updateAdmissionStatus("transfer-requested")}><MoveRight className="h-4 w-4" />Request transfer</Button>
                  <Button variant="outline" onClick={() => updateAdmissionStatus("discharge-ready")}><FileCheck2 className="h-4 w-4" />Discharge ready</Button>
                  <Button variant="destructive" onClick={() => updateAdmissionStatus("cancelled")}><XCircle className="h-4 w-4" />Cancel</Button>
                  {selectedAdmission.patientId && <Link className="interactive-control inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-muted" to={`/patients/${selectedAdmission.patientId}`}>Open patient profile</Link>}
                </div>
              </CardContent>
            </Card>
          </section>
        </SectionReveal>

        <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <Card>
            <CardHeader><CardTitle>Recent admission history</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <thead><tr><Th>Admission</Th><Th>Patient</Th><Th>Gender</Th><Th>Source</Th><Th>Ward/Bed</Th><Th>Status</Th><Th>Updated</Th></tr></thead>
                <tbody>
                  {admissions.map((item) => (
                    <tr key={item.id}>
                      <Td className="font-semibold">{item.admissionNo ?? item.id}</Td>
                      <Td>{item.patientName}<br /><span className="text-xs text-muted-foreground">{item.patientId}</span></Td>
                      <Td><GenderBadge value={item.patientGender} compact /></Td>
                      <Td>{item.referralSource}</Td>
                      <Td>{wards.find((ward) => ward.id === item.wardId)?.name ?? "Not assigned"}<br /><span className="text-xs text-muted-foreground">{beds.find((bed) => bed.id === item.bedId)?.bedNo ?? "Bed pending"}</span></Td>
                      <Td><Badge tone={statusTone(item.status)}>{item.status}</Badge></Td>
                      <Td>{new Date(item.updatedAt).toLocaleString()}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-primary" />PostgreSQL API workflow model</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                "`admissionRequests` stores patientAge, patientGender, guardianId, dependentCategory, recommendedWardCategory, referral source, diagnosis, priority, hospitalId, and status.",
                "`approveAdmissionAndAssignBed` PostgreSQL API transaction validates under-10 children ward placement, male/female ward segregation, override authority, bed lock, admissionNo, notifications, and audit logs.",
                "`wardTransfers` tracks from/to ward, bed, reason, requestedBy, approvedBy, timestamps, and status.",
                "`dischargeSummaries` stores diagnosis, treatment summary, final prescription, follow-up, and release-to-patient flag.",
                "Real-time listeners should be limited to emergency admissions, selected ward beds, and ward dashboards.",
              ].map((item) => <p key={item} className="help-strip p-3">{item}</p>)}
            </CardContent>
          </Card>
        </section>
      </div>
    </PageTransition>
  );
}
