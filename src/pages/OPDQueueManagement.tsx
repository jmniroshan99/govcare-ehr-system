import { Activity, AlertTriangle, ArrowRightLeft, BedDouble, BellRing, CheckCircle2, ClipboardList, Clock3, FileText, Hospital, Printer, QrCode, RefreshCcw, ScanLine, Search, Send, ShieldCheck, Smartphone, Stethoscope, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageTransition, Reveal, SectionReveal, Stagger } from "../components/motion/PageTransition";
import { GenderBadge } from "../components/patient/GenderBadge";
import { PatientCodeScanner } from "../components/patient/PatientCodeScanner";
import { Badge, StatusBadge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { SmartSearch } from "../components/search/SmartSearch";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import { createIntegratedOpdVisit, type OrderPriority } from "../services/clinicalIntegrationService";
import { ADMISSION_WORKFLOW_UPDATED_EVENT, addAdmissionCounterRequest, getAdmissionCounterRequests, type AdmissionCounterRequest, type AdmissionPriority } from "../utils/admissionWorkflow";
import { DOCTOR_WORKFLOW_UPDATED_EVENT, enqueueDoctorVisit, getDoctorWorkflowState } from "../utils/doctorWorkflow";

type QueueStatus = "waiting" | "called" | "in-consultation" | "completed" | "skipped" | "transferred" | "cancelled" | "emergency-priority";
type SortMode = "arrival" | "appointment" | "priority" | "age" | "disability" | "pregnancy" | "emergency" | "doctor";

interface QueueRow {
  token: string;
  patient: string;
  gender: string;
  searchKey: string;
  department: string;
  doctor: string;
  arrival: string;
  appointment: string;
  priority: number;
  age: number;
  wait: number;
  status: QueueStatus;
  flags: string[];
}

const queueRows: QueueRow[] = [
  { token: "MED-018", patient: "Nimal Silva", gender: "Male", searchKey: "NIC 801234567V / PAT-2026-0001", department: "Medical OPD", doctor: "Dr. Perera", arrival: "08:10", appointment: "08:30", priority: 2, age: 67, wait: 24, status: "waiting", flags: ["elderly", "diabetes"] },
  { token: "PED-006", patient: "Fathima Rizna", gender: "Female", searchKey: "BC 2021-8892 / PAT-2026-0019", department: "Paediatrics", doctor: "Dr. Fernando", arrival: "08:16", appointment: "08:45", priority: 3, age: 5, wait: 18, status: "called", flags: ["child"] },
  { token: "SUR-011", patient: "K. Thevarajah", gender: "Male", searchKey: "NIC 723998114V / PAT-2026-0044", department: "Surgical Clinic", doctor: "Dr. Silva", arrival: "08:20", appointment: "09:00", priority: 1, age: 54, wait: 12, status: "in-consultation", flags: ["post-op"] },
  { token: "OBS-003", patient: "A. Wijesinghe", gender: "Female", searchKey: "NIC 955441128V / PAT-2026-0032", department: "Antenatal", doctor: "Dr. Jayasinghe", arrival: "08:25", appointment: "08:50", priority: 5, age: 31, wait: 9, status: "emergency-priority", flags: ["pregnancy", "high BP"] },
  { token: "ENT-014", patient: "R. Kumar", gender: "Male", searchKey: "Passport N9128843 / PAT-2026-0081", department: "ENT", doctor: "Dr. Nazeer", arrival: "08:02", appointment: "09:15", priority: 2, age: 43, wait: 31, status: "skipped", flags: ["no-show"] },
  { token: "MED-019", patient: "P. Nisansala", gender: "Female", searchKey: "NIC 902221772V / PAT-2026-0062", department: "Medical OPD", doctor: "Dr. Perera", arrival: "08:36", appointment: "09:20", priority: 4, age: 39, wait: 6, status: "transferred", flags: ["disability access"] },
];

const displayBoard = [
  ["Medical OPD", "MED-018", "Room 04", "24 min"],
  ["Paediatrics", "PED-006", "Room 02", "18 min"],
  ["Surgical Clinic", "SUR-011", "Room 08", "12 min"],
  ["Antenatal", "OBS-003", "Urgent bay", "Now"],
];

const integrations = ["Patient profile", "Doctor consultation", "E-prescription", "Lab requests", "Radiology requests", "Pharmacy", "Appointments", "Billing/service records", "Reports"];

const wardSuggestions: Record<string, { wardType: string; bedType: string; department: string }> = {
  "Medical OPD": { wardType: "Medical", bedType: "Medical bed", department: "General Medicine" },
  Paediatrics: { wardType: "Pediatric", bedType: "Pediatric bed", department: "Paediatrics" },
  "Surgical Clinic": { wardType: "Surgical", bedType: "Surgical bed", department: "Surgery" },
  Antenatal: { wardType: "Obstetrics", bedType: "Female ward bed", department: "Obstetrics" },
  ENT: { wardType: "Medical", bedType: "ENT observation bed", department: "ENT" },
  "Emergency fast-track": { wardType: "ICU", bedType: "Monitored bed", department: "Emergency Medicine" },
};

function sortQueue(rows: QueueRow[], mode: SortMode) {
  const sorted = [...rows];
  if (mode === "priority" || mode === "emergency") return sorted.sort((a, b) => b.priority - a.priority || a.wait - b.wait);
  if (mode === "age") return sorted.sort((a, b) => b.age - a.age);
  if (mode === "appointment") return sorted.sort((a, b) => a.appointment.localeCompare(b.appointment));
  if (mode === "doctor") return sorted.sort((a, b) => a.doctor.localeCompare(b.doctor));
  if (mode === "disability") return sorted.sort((a, b) => Number(b.flags.includes("disability access")) - Number(a.flags.includes("disability access")));
  if (mode === "pregnancy") return sorted.sort((a, b) => Number(b.flags.includes("pregnancy")) - Number(a.flags.includes("pregnancy")));
  return sorted.sort((a, b) => a.arrival.localeCompare(b.arrival));
}

export function OPDQueueManagement() {
  const { showToast } = useToast();
  const [queue, setQueue] = useState<QueueRow[]>(queueRows);
  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const [department, setDepartment] = useState("Medical OPD");
  const [doctor, setDoctor] = useState("Dr. Perera");
  const [search, setSearch] = useState("NIC / Patient ID / QR");
  const [scannerMode, setScannerMode] = useState<"qr" | "barcode" | null>(null);
  const [lastTicket, setLastTicket] = useState<QueueRow | null>(null);
  const [doctorWorkflow, setDoctorWorkflow] = useState(() => getDoctorWorkflowState());
  const [admissionCounter, setAdmissionCounter] = useState<AdmissionCounterRequest[]>(() => getAdmissionCounterRequests());
  const [admissionReason, setAdmissionReason] = useState("Needs inpatient observation and ward care");
  const [admissionPriority, setAdmissionPriority] = useState<AdmissionPriority>("urgent");
  const sortedQueue = useMemo(() => sortQueue(queue, sortMode), [queue, sortMode]);
  const activeAdmissionCounter = useMemo(() => admissionCounter.filter((item) => !["discharged", "cancelled"].includes(item.status)).slice(0, 6), [admissionCounter]);
  const activeDisplayBoard = useMemo(() => {
    const newTickets = queue.filter((row) => row.flags.includes("qr check-in")).slice(0, 2).map((row) => [row.department, row.token, "Reception issued", `${row.wait} min`]);
    return [...newTickets, ...displayBoard].slice(0, 5);
  }, [queue]);

  useEffect(() => {
    function refreshDoctorWorkflow() {
      setDoctorWorkflow(getDoctorWorkflowState());
    }
    function refreshAdmissionWorkflow() {
      setAdmissionCounter(getAdmissionCounterRequests());
    }
    window.addEventListener(DOCTOR_WORKFLOW_UPDATED_EVENT, refreshDoctorWorkflow);
    window.addEventListener(ADMISSION_WORKFLOW_UPDATED_EVENT, refreshAdmissionWorkflow);
    window.addEventListener("storage", refreshDoctorWorkflow);
    window.addEventListener("storage", refreshAdmissionWorkflow);
    return () => {
      window.removeEventListener(DOCTOR_WORKFLOW_UPDATED_EVENT, refreshDoctorWorkflow);
      window.removeEventListener(ADMISSION_WORKFLOW_UPDATED_EVENT, refreshAdmissionWorkflow);
      window.removeEventListener("storage", refreshDoctorWorkflow);
      window.removeEventListener("storage", refreshAdmissionWorkflow);
    };
  }, []);

  function action(label: string, tone: "success" | "warning" | "danger" | "info" = "success") {
    showToast(`${label} queued with audit log and notification event.`, tone);
  }

  function tokenPrefix(unit: string) {
    if (unit.includes("Paediatrics")) return "PED";
    if (unit.includes("Surgical")) return "SUR";
    if (unit.includes("Antenatal")) return "OBS";
    if (unit.includes("ENT")) return "ENT";
    if (unit.includes("Emergency")) return "ETU";
    return "MED";
  }

  function patientIdFromCode(code: string) {
    return code.match(/PAT-\d{4}-\d+/)?.[0] ?? code.match(/PHR-\d+/)?.[0] ?? `TEMP-${Date.now().toString().slice(-6)}`;
  }

  async function createTicketFromCode(code: string) {
    const cleanCode = code.trim();
    if (!cleanCode) {
      showToast("Scan or enter a patient QR/barcode value first.", "warning");
      return;
    }
    const prefix = tokenPrefix(department);
    const token = `${prefix}-${String(queue.length + 20).padStart(3, "0")}`;
    const ticket: QueueRow = {
      token,
      patient: cleanCode.includes("PAT-") ? "Scanned patient" : "QR checked patient",
      gender: "Not recorded",
      searchKey: `${cleanCode} / QR check-in`,
      department,
      doctor,
      arrival: "Now",
      appointment: "Walk-in",
      priority: department.includes("Emergency") ? 5 : 2,
      age: 0,
      wait: Math.max(5, queue.filter((row) => row.department === department && row.status === "waiting").length * 6 + 5),
      status: department.includes("Emergency") ? "emergency-priority" : "waiting",
      flags: department.includes("Emergency") ? ["qr check-in", "emergency"] : ["qr check-in"],
    };
    const patientId = patientIdFromCode(cleanCode);
    const priority: OrderPriority = ticket.status === "emergency-priority" ? "critical" : ticket.priority >= 4 ? "urgent" : "routine";
    const { visit } = await createIntegratedOpdVisit({
      patient: {
        patientId,
        patientName: ticket.patient,
        qrReference: cleanCode,
        age: ticket.age,
        gender: ticket.gender,
        hospitalId: "hosp-colombo-national",
      },
      department,
      doctorId: doctor.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      doctorName: doctor,
      tokenNo: token,
      reason: department.includes("Emergency") ? "Emergency fast-track visit" : "OPD visit from reception counter",
      priority,
      createdBy: "opd-reception",
      actorRole: "receptionist",
    });
    enqueueDoctorVisit({
      visitId: visit.visitId,
      tokenNo: token,
      patientId,
      patientName: ticket.patient,
      patientGender: ticket.gender,
      patientAge: ticket.age,
      reason: visit.reason,
      department,
      assignedDoctorId: visit.assignedDoctorId ?? "assigned-doctor",
      assignedDoctorName: doctor,
      hospitalId: visit.hospitalId,
      priority: priority === "critical" ? "critical" : priority === "urgent" ? "urgent" : "routine",
      status: "Waiting",
      arrivalTime: visit.createdAt,
      updatedAt: visit.updatedAt,
    });
    setQueue((current) => [ticket, ...current]);
    setSearch(cleanCode);
    setLastTicket(ticket);
    showToast(`OPD ticket ${token} created, billed, and sent to Doctor Center.`, "success");
  }

  function createAdmissionFromVisit(row?: QueueRow) {
    const source = row ?? lastTicket;
    const cleanPatientId = source?.searchKey.match(/PAT-\d{4}-\d+/)?.[0] ?? search.match(/PAT-\d{4}-\d+/)?.[0] ?? `TEMP-${Date.now().toString().slice(-6)}`;
    const selectedDepartment = source?.department ?? department;
    const ward = wardSuggestions[selectedDepartment] ?? wardSuggestions["Medical OPD"];
    const priority = source?.status === "emergency-priority" || selectedDepartment.includes("Emergency") ? "emergency" : admissionPriority;
    const now = new Date().toISOString();
    const request: AdmissionCounterRequest = {
      id: `REQ-${Math.floor(1000 + Math.random() * 9000)}`,
      patientId: cleanPatientId,
      patientName: source?.patient && !source.patient.includes("QR checked") ? source.patient : "New admitted patient",
      referralSource: selectedDepartment.includes("Emergency") ? "Emergency" : "OPD",
      reason: admissionReason,
      provisionalDiagnosis: selectedDepartment.includes("Emergency") ? "Emergency admission pending consultant review" : "OPD admission pending consultant review",
      priority,
      department: ward.department,
      wardType: ward.wardType,
      consultant: source?.doctor ?? doctor,
      bedType: ward.bedType,
      allergies: source?.flags.includes("diabetes") ? ["Verify medication allergy"] : [],
      chronicDiseases: source?.flags.includes("diabetes") ? ["Diabetes"] : [],
      emergencyStatus: priority === "emergency" || priority === "critical",
      notes: `${source?.token ?? "Counter"} admission counter request. Verify patient identity, guardian/next-of-kin, consent, and bed availability.`,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      sourceToken: source?.token,
      counterStatus: "new",
    };
    const requestId = addAdmissionCounterRequest(request);
    setAdmissionCounter(getAdmissionCounterRequests());
    showToast(`Admission request ${requestId} sent to Admissions from visiting counter.`, "success");
  }

  return (
    <PageTransition>
      <div className="space-y-5">
        <PatientCodeScanner open={scannerMode !== null} mode={scannerMode ?? "qr"} onClose={() => setScannerMode(null)} onDetected={createTicketFromCode} />
        <div className="page-hero flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">OPD Queue Management</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Registration, token generation, live queue, and doctor calling</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Reception, doctors, nurses, and patients share one active queue with real-time status, QR tickets, priority sorting, no-show handling, transfers, and follow-up booking.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setScannerMode("qr")}><QrCode className="h-4 w-4" />QR check-in</Button>
            <Button onClick={() => lastTicket ? action(`Print ticket ${lastTicket.token}`, "success") : action("Token generation", "success")}><Printer className="h-4 w-4" />Print ticket</Button>
          </div>
        </div>

        {lastTicket && (
          <Card className="border-teal-200 bg-teal-50">
            <CardContent className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <div>
                <p className="font-bold text-teal-950">OPD ticket created: {lastTicket.token}</p>
                <p className="text-sm text-teal-900">{lastTicket.searchKey} | {lastTicket.department} | {lastTicket.doctor} | estimated wait {lastTicket.wait} min</p>
              </div>
              <StatusBadge status={lastTicket.status} />
              <Button variant="outline" onClick={() => action(`QR ticket sent for ${lastTicket.token}`, "info")}><Send className="h-4 w-4" />Send QR ticket</Button>
            </CardContent>
          </Card>
        )}

        <Stagger>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Waiting", value: 42, icon: Clock3, tone: "info" as const },
              { label: "Called now", value: 6, icon: BellRing, tone: "warning" as const },
              { label: "In consultation", value: 11, icon: Stethoscope, tone: "success" as const },
              { label: "Priority cases", value: 4, icon: AlertTriangle, tone: "danger" as const },
            ].map((stat) => (
              <Reveal key={stat.label}>
                <Card><CardContent className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">{stat.label}</p><p className="mt-2 text-3xl font-bold text-slate-950">{stat.value}</p></div><Badge tone={stat.tone}><stat.icon className="h-5 w-5" /></Badge></CardContent></Card>
              </Reveal>
            ))}
          </section>
        </Stagger>

        <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" />Register / create OPD visit</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <label className="text-sm font-medium">Patient lookup<Input value={search} onChange={(event) => setSearch(event.target.value)} /></label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm font-medium">Department<Select value={department} onChange={(event) => setDepartment(event.target.value)}><option>Medical OPD</option><option>Paediatrics</option><option>Surgical Clinic</option><option>Antenatal</option><option>ENT</option><option>Emergency fast-track</option></Select></label>
                <label className="text-sm font-medium">Doctor<Select value={doctor} onChange={(event) => setDoctor(event.target.value)}><option>Dr. Perera</option><option>Dr. Fernando</option><option>Dr. Silva</option><option>Dr. Jayasinghe</option><option>Dr. Nazeer</option></Select></label>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <Button variant="outline" className="justify-start" onClick={() => setScannerMode("qr")}><QrCode className="h-4 w-4" />Scan QR</Button>
                <Button variant="outline" className="justify-start" onClick={() => setScannerMode("barcode")}><ScanLine className="h-4 w-4" />Scan barcode</Button>
                {["Create OPD visit", "Generate token number", "Send QR ticket", "Digital check-in", "Follow-up booking"].map((item) => <Button key={item} variant="outline" className="justify-start" onClick={() => action(item, "info")}>{item}</Button>)}
              </div>
              <Button onClick={() => createTicketFromCode(search)}><ClipboardList className="h-4 w-4" />Create queue token</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5 text-primary" /><Search className="h-5 w-5 text-primary" />Smart search and sorting</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <SmartSearch value={search} onChange={setSearch} placeholder="Search NIC, patient ID, token, QR, phone number..." />
              <label className="text-sm font-medium">Queue sort priority<Select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}><option value="priority">Priority level</option><option value="arrival">Arrival time</option><option value="appointment">Appointment time</option><option value="age">Age</option><option value="disability">Disability access</option><option value="pregnancy">Pregnancy</option><option value="emergency">Emergency severity</option><option value="doctor">Doctor availability</option></Select></label>
              <div className="grid gap-2 md:grid-cols-2">
                <p className="help-strip p-3 text-sm">Spring Boot services should generate tokens, recalculate queue position, and apply emergency/elderly/disability/pregnancy priority rules.</p>
                <p className="help-strip p-3 text-sm">PostgreSQL real-time listeners should be limited to active department queues, doctor call events, and patient ticket updates.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <Card className="border-cyan-200 bg-cyan-50/60">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex items-center gap-2"><Hospital className="h-5 w-5 text-primary" />Admission visiting counter</span>
              <Badge tone="info">{activeAdmissionCounter.length} active inpatient requests</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-[360px_1fr]">
            <div className="space-y-3 rounded-md border border-cyan-200 bg-white p-4">
              <p className="text-sm font-bold text-slate-950">Send new admitted patient to Admissions</p>
              <label className="text-sm font-medium">Admission reason<Input value={admissionReason} onChange={(event) => setAdmissionReason(event.target.value)} /></label>
              <label className="text-sm font-medium">Priority<Select value={admissionPriority} onChange={(event) => setAdmissionPriority(event.target.value as AdmissionPriority)}><option value="routine">Routine</option><option value="urgent">Urgent</option><option value="emergency">Emergency</option><option value="critical">Critical</option></Select></label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="outline" onClick={() => createAdmissionFromVisit(lastTicket ?? undefined)}><BedDouble className="h-4 w-4" />Admit scanned</Button>
                <Button onClick={() => createAdmissionFromVisit(sortedQueue[0])}><ArrowRightLeft className="h-4 w-4" />Admit next queue</Button>
              </div>
              <p className="text-xs text-muted-foreground">The request is saved to the admission workflow and appears in the Admissions page for bed allocation, nurse notification, and audit logging.</p>
            </div>
            <div className="overflow-x-auto rounded-md border border-cyan-200 bg-white">
              <Table>
                <thead><tr><Th>Patient</Th><Th>Source</Th><Th>Ward request</Th><Th>Status</Th><Th>Counter actions</Th></tr></thead>
                <tbody>
                  {activeAdmissionCounter.map((request) => (
                    <tr key={request.id}>
                      <Td><span className="font-semibold text-slate-950">{request.patientName}</span><p className="text-xs text-muted-foreground">{request.patientId} {request.sourceToken ? `| ${request.sourceToken}` : ""}</p></Td>
                      <Td>{request.referralSource}<br /><span className="text-xs text-muted-foreground">{request.reason}</span></Td>
                      <Td>{request.wardType}<br /><span className="text-xs text-muted-foreground">{request.bedType} | {request.consultant}</span></Td>
                      <Td><StatusBadge status={request.emergencyStatus ? "emergency-priority" : request.status} /></Td>
                      <Td>
                        <div className="flex min-w-64 flex-wrap gap-2">
                          <Button className="h-9 px-3 text-xs" variant="outline" onClick={() => action(`Identity verified for ${request.patientName}`, "success")}><ShieldCheck className="h-3.5 w-3.5" />Verify</Button>
                          <Button className="h-9 px-3 text-xs" variant="outline" onClick={() => action(`Ward notified for ${request.patientName}`, "info")}><BellRing className="h-3.5 w-3.5" />Notify ward</Button>
                          <Button className="h-9 px-3 text-xs" variant="outline" onClick={() => window.location.assign("/admissions")}><Hospital className="h-3.5 w-3.5" />Open</Button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                  {!activeAdmissionCounter.length && (
                    <tr><Td colSpan={5}><p className="rounded-md border border-dashed border-border bg-muted p-3 text-sm text-muted-foreground">No new admitted patients yet. Scan a QR/barcode or select a queue patient, then send the admission request from this counter.</p></Td></tr>
                  )}
                </tbody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />Live active queue</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <thead><tr><Th>Token</Th><Th>Patient</Th><Th>Gender</Th><Th>Department</Th><Th>Doctor</Th><Th>Wait</Th><Th>Status</Th><Th>Actions</Th></tr></thead>
              <tbody>
                {sortedQueue.map((row) => (
                  <tr key={row.token}>
                    <Td><span className="font-bold text-primary">{row.token}</span><p className="text-xs text-muted-foreground">{row.searchKey}</p></Td>
                    <Td><span className="font-semibold text-slate-950">{row.patient}</span><div className="mt-1 flex flex-wrap gap-1">{row.flags.map((flag) => <Badge key={flag} tone={flag === "pregnancy" || flag === "high BP" ? "danger" : "info"}>{flag}</Badge>)}</div></Td>
                    <Td><GenderBadge value={row.gender} compact /></Td>
                    <Td>{row.department}</Td>
                    <Td>{row.doctor}</Td>
                    <Td>{row.wait} min</Td>
                    <Td><StatusBadge status={row.status} /></Td>
                    <Td>
                      <div className="flex min-w-72 flex-wrap gap-2">
                        <Button className="h-9 px-3 text-xs" variant="outline" onClick={() => action(`Called ${row.token}`, "warning")}><BellRing className="h-3.5 w-3.5" />Call</Button>
                        <Button className="h-9 px-3 text-xs" variant="outline" onClick={() => action(`Recalled ${row.token}`, "info")}><RefreshCcw className="h-3.5 w-3.5" />Re-call</Button>
                        <Button className="h-9 px-3 text-xs" variant="outline" onClick={() => action(`Transferred ${row.token}`, "warning")}><ArrowRightLeft className="h-3.5 w-3.5" />Transfer</Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex items-center gap-2"><Stethoscope className="h-5 w-5 text-primary" />Doctor check synchronization</span>
              <Badge tone="success">PostgreSQL API refresh ready</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-2">
            <div className="overflow-x-auto">
              <p className="mb-2 text-sm font-bold text-slate-950">Active OPD visits visible to doctors</p>
              <Table>
                <thead><tr><Th>Token</Th><Th>Patient</Th><Th>Status</Th><Th>Doctor</Th></tr></thead>
                <tbody>
                  {doctorWorkflow.activeQueue.map((visit) => (
                    <tr key={visit.visitId}>
                      <Td className="font-bold text-primary">{visit.tokenNo}</Td>
                      <Td>{visit.patientName}<br /><span className="text-xs text-muted-foreground">{visit.patientId}</span></Td>
                      <Td><Badge tone={visit.status === "Currently Checking" ? "warning" : "info"}>{visit.status}</Badge></Td>
                      <Td>{visit.assignedDoctorName}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <div className="overflow-x-auto">
              <p className="mb-2 text-sm font-bold text-slate-950">Checked Patients / Completed Consultations</p>
              <Table>
                <thead><tr><Th>Token</Th><Th>Patient</Th><Th>Status</Th><Th>Follow-up</Th></tr></thead>
                <tbody>
                  {doctorWorkflow.completedConsultations.map((visit) => (
                    <tr key={visit.id}>
                      <Td className="font-bold text-primary">{visit.tokenNo}</Td>
                      <Td>{visit.patientName}<br /><span className="text-xs text-muted-foreground">{visit.diagnosis}</span></Td>
                      <Td><Badge tone="success">{visit.status}</Badge></Td>
                      <Td>{visit.followUpDate || "Not set"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {!doctorWorkflow.completedConsultations.length && <p className="rounded-md border border-dashed border-border bg-muted p-3 text-sm text-muted-foreground">No completed consultations yet.</p>}
            </div>
          </CardContent>
        </Card>

        <SectionReveal>
          <section className="grid gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5 text-primary" />Patient display board</CardTitle></CardHeader>
              <CardContent className="space-y-2">{activeDisplayBoard.map(([dept, token, room, wait]) => <div key={token} className="rounded-md border border-border bg-white p-3 text-sm"><div className="flex items-center justify-between gap-2"><p className="font-bold text-slate-950">{dept}</p><Badge tone={wait === "Now" ? "danger" : "info"}>{token}</Badge></div><p className="text-muted-foreground">{room} | estimated wait {wait}</p></div>)}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-primary" />Notifications and no-show</CardTitle></CardHeader>
              <CardContent className="grid gap-2">
                {["SMS/push queue position", "Doctor call button", "No-show mark", "Skip and recall", "Cancelled ticket", "Emergency priority broadcast"].map((item) => <Button key={item} variant="outline" className="justify-start" onClick={() => action(item, item.includes("Emergency") ? "danger" : "info")}>{item}</Button>)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Security and integrations</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="help-strip p-3">Reception creates visits; doctors and nurses can call/update clinical queue states; patients only see their own released ticket status.</p>
                <p className="help-strip p-3">Every create, call, skip, transfer, cancellation, notification, and ticket print is audit logged.</p>
                <div className="grid grid-cols-2 gap-2">{integrations.map((item) => <Badge key={item} tone="success"><CheckCircle2 className="h-3.5 w-3.5" />{item}</Badge>)}</div>
              </CardContent>
            </Card>
          </section>
        </SectionReveal>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Production data model</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-3">
            <p className="rounded-md border border-border bg-white p-3">`opdQueues`: token, patientId, visitId, departmentId, doctorId, status, priority, queuePosition, estimatedWait, releaseStatus.</p>
            <p className="rounded-md border border-border bg-white p-3">`visits`: OPD visit reason, appointment link, consultation status, prescriptions, lab/radiology requests, billing/service record IDs.</p>
            <p className="rounded-md border border-border bg-white p-3">`notifications`: patient/device targets for ticket, call, delay, transfer, completion, follow-up, and cancellation events.</p>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}

