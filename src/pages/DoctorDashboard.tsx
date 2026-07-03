import {
  Activity,
  AlertTriangle,
  Ambulance,
  BedDouble,
  Bell,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Clock,
  FileClock,
  FileText,
  FlaskConical,
  MessageSquareText,
  Paperclip,
  Radio,
  Search,
  Stethoscope,
  Timer,
  UserCheck,
  UsersRound,
  Video,
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GenderBadge } from "../components/patient/GenderBadge";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { PageTransition, Reveal, Stagger, SwitchPanel } from "../components/motion/PageTransition";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import { createTelemedicineSession, sendSecureChatMessage, startDoctorConsultation } from "../services/doctorService";
import { DOCTOR_WORKFLOW_UPDATED_EVENT, getDoctorVisitBuckets, startCheckingVisit } from "../utils/doctorWorkflow";
import { getSavedPatientsForDoctors, PATIENTS_UPDATED_EVENT } from "../utils/patientRegistry";
import { useAuthStore } from "../stores/authStore";

const workload = [
  { label: "OPD queue", value: "34", icon: ClipboardList, tone: "info" as const },
  { label: "Appointments", value: "18", icon: CalendarClock, tone: "success" as const },
  { label: "Emergency alerts", value: "5", icon: Ambulance, tone: "danger" as const },
  { label: "Admitted patients", value: "22", icon: BedDouble, tone: "neutral" as const },
  { label: "Critical cases", value: "7", icon: AlertTriangle, tone: "danger" as const },
  { label: "Pending results", value: "41", icon: FlaskConical, tone: "warning" as const },
];

const throughput = [
  { hour: "08", opd: 12, reviews: 4, emergency: 1 },
  { hour: "10", opd: 24, reviews: 8, emergency: 3 },
  { hour: "12", opd: 31, reviews: 12, emergency: 5 },
  { hour: "14", opd: 20, reviews: 16, emergency: 2 },
  { hour: "16", opd: 16, reviews: 11, emergency: 4 },
];

const queue = [
  ["OPD-126", "Nimal Silva", "Fever, cough", "10 min", "urgent"],
  ["OPD-127", "Fathima Rizna", "Antenatal review", "14 min", "high-risk"],
  ["ED-034", "K. Thevarajah", "Chest pain", "now", "critical"],
];

const diagnostics = [
  ["LAB-9001", "HbA1c", "Nimal Silva", "ready"],
  ["RAD-3004", "CT Brain", "K. Thevarajah", "pending review"],
  ["LAB-9008", "Troponin I", "R. Kumar", "critical"],
];

const assignedPatients = [
  ["PAT-2026-000001", "Nimal Silva", "OPD review", "Allergy alert"],
  ["PAT-2026-000142", "Fathima Rizna", "Antenatal clinic", "High-risk"],
  ["PAT-2026-000233", "R. Kumar", "Ward review", "Critical labs"],
];

const schedule = [
  ["08:00", "Medical OPD", "18 patients"],
  ["11:30", "Ward round", "Ward 12"],
  ["14:00", "Telemedicine", "5 online slots"],
  ["16:00", "Follow-ups", "Diabetes clinic"],
];

type Facility = "consultation" | "telemedicine" | "chat";
type DoctorQueueTab = "waiting" | "checking" | "checked" | "followUps";

function riskTone(risk: string) {
  if (risk === "critical") return "danger" as const;
  if (risk === "high" || risk === "moderate") return "warning" as const;
  return "info" as const;
}

function displayDateTime(value: string) {
  return new Intl.DateTimeFormat("en-LK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function genderForKnownPatient(name: string) {
  if (name.toLowerCase().includes("fathima")) return "Female";
  return "Male";
}

export function DoctorDashboard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const profile = useAuthStore((state) => state.profile);
  const [newPatients, setNewPatients] = useState(() => getSavedPatientsForDoctors());
  const [visitBuckets, setVisitBuckets] = useState(() => getDoctorVisitBuckets());
  const [queueTab, setQueueTab] = useState<DoctorQueueTab>("waiting");
  const [queueSearch, setQueueSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [facility, setFacility] = useState<Facility>("consultation");
  const [facilityMessage, setFacilityMessage] = useState("");
  const [chatMessage, setChatMessage] = useState("Please upload your latest home blood sugar readings before the review.");
  const [telemedicineChannel, setTelemedicineChannel] = useState("GovCare Video");
  const [chatRecipient, setChatRecipient] = useState("Patient");
  const [urgentChat, setUrgentChat] = useState(false);
  const [telemedicineTimer, setTelemedicineTimer] = useState("00:00");

  useEffect(() => {
    function refreshSavedPatients() {
      setNewPatients(getSavedPatientsForDoctors());
    }
    function refreshWorkflow() {
      setVisitBuckets(getDoctorVisitBuckets());
    }

    window.addEventListener(PATIENTS_UPDATED_EVENT, refreshSavedPatients);
    window.addEventListener(DOCTOR_WORKFLOW_UPDATED_EVENT, refreshWorkflow);
    window.addEventListener("storage", refreshSavedPatients);
    window.addEventListener("storage", refreshWorkflow);
    return () => {
      window.removeEventListener(PATIENTS_UPDATED_EVENT, refreshSavedPatients);
      window.removeEventListener(DOCTOR_WORKFLOW_UPDATED_EVENT, refreshWorkflow);
      window.removeEventListener("storage", refreshSavedPatients);
      window.removeEventListener("storage", refreshWorkflow);
    };
  }, []);

  const visibleDoctorVisits = useMemo(() => {
    const source = visitBuckets[queueTab];
    const query = queueSearch.toLowerCase();
    return source.filter((visit) => {
      const reasonOrDiagnosis = "reason" in visit ? visit.reason : visit.diagnosis;
      const text = `${visit.tokenNo} ${visit.patientName} ${visit.patientId} ${reasonOrDiagnosis} ${visit.department}`.toLowerCase();
      const matchesSearch = !query || text.includes(query);
      const matchesPriority = priorityFilter === "all" || ("priority" in visit && visit.priority === priorityFilter) || ("status" in visit && visit.status === priorityFilter);
      return matchesSearch && matchesPriority;
    });
  }, [priorityFilter, queueSearch, queueTab, visitBuckets]);

  async function startVisitCheck(visitId: string) {
    try {
      const visit = startCheckingVisit(visitId, profile?.uid ?? "demo-doctor", profile?.displayName ?? "Dr. Anjali Perera");
      setVisitBuckets(getDoctorVisitBuckets());
      showToast(`${visit.tokenNo} moved to Currently Checking.`, "success");
      navigate("/doctor/workspace");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not start consultation.", "danger");
    }
  }

  async function handleStartConsultation() {
    const firstWaiting = visitBuckets.waiting[0] ?? visitBuckets.followUps[0];
    if (!firstWaiting) {
      showToast("No waiting patients are available for consultation.", "warning");
      return;
    }
    const response = await startDoctorConsultation({ patientId: firstWaiting.patientId, tokenNo: firstWaiting.tokenNo, reason: firstWaiting.reason });
    startCheckingVisit(firstWaiting.visitId, profile?.uid ?? "demo-doctor", profile?.displayName ?? "Dr. Anjali Perera");
    setVisitBuckets(getDoctorVisitBuckets());
    setFacility("consultation");
    setFacilityMessage(`Consultation started: ${response.consultationId}`);
    showToast(`Consultation started: ${response.consultationId}`, "success");
    navigate("/doctor/workspace");
  }

  async function handleCreateTelemedicine() {
    const response = await createTelemedicineSession({
      patientId: "PAT-2026-000001",
      appointmentId: "CLN-220",
      channel: telemedicineChannel,
    });
    setFacility("telemedicine");
    setFacilityMessage(`Telemedicine session ready: ${response.joinUrl}`);
    setTelemedicineTimer("00:01");
    showToast("Telemedicine session created.", "success");
  }

  async function handleSendChat() {
    const response = await sendSecureChatMessage({
      patientId: "PAT-2026-000001",
      message: chatMessage,
    });
    setFacility("chat");
    setFacilityMessage(`Secure message sent in thread ${response.threadId}`);
    showToast(`Secure message sent to ${chatRecipient}.`, urgentChat ? "warning" : "success");
  }

  return (
    <PageTransition>
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Doctor command center</h1>
          <p className="text-sm text-muted-foreground">Personalized clinical workload, safety alerts, diagnostics, follow-ups, and analytics.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleStartConsultation}><Stethoscope className="h-4 w-4" />Start consultation</Button>
          <Button variant="outline" onClick={() => setFacility("telemedicine")}><Video className="h-4 w-4" />Telemedicine</Button>
          <Button variant="outline" onClick={() => setFacility("chat")}><MessageSquareText className="h-4 w-4" />Secure chat</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {facility === "consultation" && <Stethoscope className="h-5 w-5 text-primary" />}
            {facility === "telemedicine" && <Video className="h-5 w-5 text-primary" />}
            {facility === "chat" && <MessageSquareText className="h-5 w-5 text-primary" />}
            Doctor modern facilities
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[260px_1fr]">
          <div className="grid gap-2">
            <Button variant={facility === "consultation" ? "primary" : "outline"} onClick={() => setFacility("consultation")}><Stethoscope className="h-4 w-4" />Consultation</Button>
            <Button variant={facility === "telemedicine" ? "primary" : "outline"} onClick={() => setFacility("telemedicine")}><Video className="h-4 w-4" />Telemedicine</Button>
            <Button variant={facility === "chat" ? "primary" : "outline"} onClick={() => setFacility("chat")}><MessageSquareText className="h-4 w-4" />Secure chat</Button>
          </div>

          <AnimatePresence mode="wait">
          {facility === "consultation" && (
            <SwitchPanel key="consultation">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
              <div className="grid gap-3 md:grid-cols-3">
                <Input value="OPD-126" readOnly aria-label="Token number" />
                <Input value="PAT-2026-000001 - Nimal Silva" readOnly aria-label="Patient" />
                <Input value="Fever, cough" readOnly aria-label="Reason" />
              </div>
              <Button onClick={handleStartConsultation}><Stethoscope className="h-4 w-4" />Open workspace</Button>
              <div className="flex flex-wrap gap-2 lg:col-span-2">
                <Button variant="outline" onClick={() => navigate("/patients/PAT-2026-0001")}><UsersRound className="h-4 w-4" />Open patient profile</Button>
                <Badge tone="danger">Allergy warning</Badge>
                <Badge tone="warning">Chronic disease alert</Badge>
                <Badge tone="info">Previous visits ready</Badge>
              </div>
              <div className="rounded-md border border-border bg-muted p-3 text-sm lg:col-span-2">
                Starts an auditable consultation, locks the active queue token, and opens the structured SOAP workspace with auto-save.
              </div>
            </div>
            </SwitchPanel>
          )}

          {facility === "telemedicine" && (
            <SwitchPanel key="telemedicine">
            <div className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
                <Input value="CLN-220 - Diabetes clinic review" readOnly aria-label="Appointment" />
                <Select value={telemedicineChannel} onChange={(event) => setTelemedicineChannel(event.target.value)}>
                  <option>GovCare Video</option>
                  <option>Audio only</option>
                  <option>Low bandwidth mode</option>
                </Select>
                <Button onClick={handleCreateTelemedicine}><Video className="h-4 w-4" />Create session</Button>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <Badge tone="success">End-to-end access token ready</Badge>
                <Badge tone="info">Patient notification prepared</Badge>
                <Badge tone="neutral">Consent check required</Badge>
                <Badge tone="warning"><Timer className="h-3 w-3" />Call timer {telemedicineTimer}</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
                <Input value="Waiting room: 2 patients online" readOnly aria-label="Waiting room" />
                <Input placeholder="Live notes during call" defaultValue="Patient reports improved fever." />
                <Button variant="outline" onClick={() => showToast("Doctor joined the secure telemedicine room.", "success")}>Doctor join</Button>
                <Button variant="outline" onClick={() => showToast("Patient join link sent to portal notifications.", "info")}>Patient join</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => showToast("Post-call summary drafted and linked to consultation.", "success")}><FileText className="h-4 w-4" />Post-call summary</Button>
                <Button variant="outline" onClick={() => navigate("/appointments")}><CalendarDays className="h-4 w-4" />Schedule follow-up</Button>
              </div>
            </div>
            </SwitchPanel>
          )}

          {facility === "chat" && (
            <SwitchPanel key="chat">
            <div className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-[180px_1fr_auto]">
                <Select value={chatRecipient} onChange={(event) => setChatRecipient(event.target.value)}>
                  <option>Patient</option>
                  <option>Nurse</option>
                  <option>Laboratory</option>
                </Select>
                <Input value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} aria-label="Secure chat message" />
                <Button onClick={handleSendChat}><MessageSquareText className="h-4 w-4" />Send secure message</Button>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
                <Input placeholder="Search message history" />
                <Button variant="outline" onClick={() => showToast("Message search opened for this thread.", "info")}><Search className="h-4 w-4" />Search</Button>
                <Button variant="outline" onClick={() => navigate("/media")}><Paperclip className="h-4 w-4" />Attach file</Button>
                <Button variant={urgentChat ? "destructive" : "outline"} onClick={() => setUrgentChat((value) => !value)}>Urgent flag</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="success">Typing indicator active</Badge>
                <Badge tone="info">Read receipts enabled</Badge>
                <Badge tone="neutral">AES-GCM message encryption ready</Badge>
                <Badge tone="warning">Audit log on every message</Badge>
              </div>
              <div className="rounded-md border border-border bg-white p-3 text-sm">
                Chat target: {chatRecipient}. Messages support doctor-patient, doctor-nurse, and doctor-lab workflows, with prescription, lab result, and file sharing through Firebase.
              </div>
            </div>
            </SwitchPanel>
          )}
          </AnimatePresence>

          {facilityMessage && <p className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-900 xl:col-span-2">{facilityMessage}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" />Doctor patient check workflow</span>
            <Badge tone="info">real-time queue state</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {([
                ["waiting", "Waiting Patients", visitBuckets.waiting.length],
                ["checking", "Currently Checking", visitBuckets.checking.length],
                ["checked", "Checked Patients", visitBuckets.checked.length],
                ["followUps", "Follow-up Patients", visitBuckets.followUps.length],
              ] as const).map(([key, label, count]) => (
                <Button key={key} variant={queueTab === key ? "primary" : "outline"} onClick={() => setQueueTab(key)}>
                  {label}<Badge tone={queueTab === key ? "neutral" : "info"}>{count}</Badge>
                </Button>
              ))}
            </div>
            <div className="grid min-w-72 gap-2 md:grid-cols-[1fr_150px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" value={queueSearch} onChange={(event) => setQueueSearch(event.target.value)} placeholder="Search token, patient, reason..." />
              </div>
              <Select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
                <option value="all">All status</option>
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="critical">Critical</option>
                <option value="follow-up">Follow-up</option>
                <option value="Completed">Completed</option>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <thead><tr><Th>Token</Th><Th>Patient</Th><Th>Gender</Th><Th>Reason / diagnosis</Th><Th>Department</Th><Th>Status</Th><Th>Timestamp</Th><Th>Action</Th></tr></thead>
              <tbody>
                {visibleDoctorVisits.map((visit) => {
                  const isCompleted = "diagnosis" in visit;
                  const status = isCompleted ? visit.status : visit.status;
                  return (
                    <tr key={visit.visitId}>
                      <Td className="font-bold text-primary">{visit.tokenNo}</Td>
                      <Td>{visit.patientName}<br /><span className="text-xs text-muted-foreground">{visit.patientId}{visit.patientAge ? ` | ${visit.patientAge} years` : ""}</span></Td>
                      <Td><GenderBadge value={visit.patientGender ?? genderForKnownPatient(visit.patientName)} /></Td>
                      <Td>{isCompleted ? visit.diagnosis : visit.reason}</Td>
                      <Td>{visit.department}</Td>
                      <Td><Badge tone={status === "Completed" || status === "Checked" || status === "Consulted" ? "success" : status === "Currently Checking" ? "warning" : "info"}>{status}</Badge></Td>
                      <Td>{displayDateTime(isCompleted ? visit.timestamp : visit.updatedAt)}</Td>
                      <Td>
                        {!isCompleted && visit.status === "Waiting" && <Button className="min-h-9 px-3 py-1.5" onClick={() => void startVisitCheck(visit.visitId)}><Stethoscope className="h-4 w-4" />Start check</Button>}
                        {!isCompleted && visit.status === "Currently Checking" && <Button className="min-h-9 px-3 py-1.5" variant="outline" onClick={() => navigate("/doctor/workspace")}>Continue</Button>}
                        {isCompleted && <Button className="min-h-9 px-3 py-1.5" variant="outline" onClick={() => navigate(`/patients/${visit.patientId}`)}>Open record</Button>}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
          {!visibleDoctorVisits.length && <div className="rounded-md border border-dashed border-border bg-muted p-4 text-sm text-muted-foreground">No patients match this tab or filter.</div>}
        </CardContent>
      </Card>

      <Stagger>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {workload.map((item) => (
          <Reveal key={item.label}>
            <Card>
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-3xl font-bold">{item.value}</p>
                </div>
                <Badge tone={item.tone}><item.icon className="h-5 w-5" /></Badge>
              </CardContent>
            </Card>
          </Reveal>
        ))}
      </section>
      </Stagger>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-primary" />Newly saved patients for doctors</span>
            <Badge tone={newPatients.length ? "success" : "neutral"}>{newPatients.length} visible</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {newPatients.length ? (
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {newPatients.map((patient) => (
                <div key={patient.patientId} className="rounded-md border border-border bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-950">{patient.name}</p>
                      <p className="text-xs text-muted-foreground">{patient.patientId} | {patient.nicOrPassport || "No NIC"} | {patient.phone || "No phone"}</p>
                    </div>
                    <Badge tone={riskTone(patient.riskCategory)}>{patient.riskCategory}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-700">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{patient.age !== undefined ? `${patient.age} years` : "Age not calculated"}</span>
                      <GenderBadge value={patient.sex} />
                      <span>{patient.bloodGroup || "Blood group pending"}</span>
                    </div>
                    <p className="text-muted-foreground">{patient.district || "District pending"} | {patient.visitReason} | {patient.assignedDoctor}</p>
                    <p className="text-xs text-muted-foreground">Registered {displayDateTime(patient.registeredAt)}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button className="min-h-9 px-3 py-1.5" variant="outline" onClick={() => navigate(`/patients/${patient.patientId}`)}><UsersRound className="h-4 w-4" />Open profile</Button>
                    <Button className="min-h-9 px-3 py-1.5" onClick={() => { showToast(`Consultation ready for ${patient.name}.`, "success"); navigate("/doctor/workspace"); }}><Stethoscope className="h-4 w-4" />Consult</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-muted p-4 text-sm text-muted-foreground">
              No newly registered patients yet. When reception saves a patient registration, doctors will see it here immediately.
            </div>
          )}
          <Button variant="outline" onClick={() => navigate("/patients/search")}><Search className="h-4 w-4" />Open patient search</Button>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-primary" />Assigned patients</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {assignedPatients.map(([id, name, context, risk]) => (
              <div key={id} className="rounded-md border border-border bg-white p-3 text-sm">
                <p className="font-semibold">{name}</p>
                <p className="text-muted-foreground">{id} - {context}</p>
                <Badge tone={risk.includes("Critical") || risk.includes("Allergy") ? "danger" : "warning"}>{risk}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><BedDouble className="h-5 w-5 text-primary" />Inpatient list</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {["Ward 12 Bed 08 - review vitals", "Ward 03 Bed 11 - discharge approval", "ICU Bed 02 - critical lab review"].map((item) => (
              <div key={item} className="rounded-md border border-border bg-white px-3 py-2 text-sm">{item}</div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" />Doctor schedule</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {schedule.map(([time, title, detail]) => (
              <div key={`${time}-${title}`} className="grid grid-cols-[64px_1fr] gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm">
                <span className="font-semibold">{time}</span>
                <span>{title}<br /><span className="text-muted-foreground">{detail}</span></span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader><CardTitle>Clinical flow analytics</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={throughput}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="opd" stroke="#0f766e" fill="#99f6e4" />
                <Area type="monotone" dataKey="reviews" stroke="#155e75" fill="#a5f3fc" />
                <Area type="monotone" dataKey="emergency" stroke="#be123c" fill="#fecdd3" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-destructive" />Critical notifications</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {["Troponin critical result needs approval", "Penicillin allergy warning before prescribing", "Missed follow-up: diabetes clinic", "Pregnancy renal-dose alert"].map((alert, index) => (
              <div key={alert} className={index === 0 ? "clinical-alert-pulse rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-950" : "rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950"}>{alert}</div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-primary" />Live OPD and emergency queue</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <thead><tr><Th>Token</Th><Th>Patient</Th><Th>Gender</Th><Th>Reason</Th><Th>Wait</Th><Th>Priority</Th></tr></thead>
              <tbody>
                {queue.map((row) => (
                  <tr key={row[0]}>
                    <Td>{row[0]}</Td>
                    <Td>{row[1]}</Td>
                    <Td><GenderBadge value={genderForKnownPatient(row[1])} compact /></Td>
                    <Td>{row[2]}</Td>
                    <Td>{row[3]}</Td>
                    <Td><Badge tone={row[4] === "critical" ? "danger" : row[4] === "urgent" || row[4] === "high-risk" ? "warning" : "neutral"}>{row[4]}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileClock className="h-5 w-5 text-primary" />Pending lab and imaging reports</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <thead><tr><Th>ID</Th><Th>Request</Th><Th>Patient</Th><Th>Status</Th></tr></thead>
              <tbody>
                {diagnostics.map((row) => (
                  <tr key={row[0]}>
                    <Td className="font-semibold">{row[0]}</Td>
                    <Td className="flex items-center gap-2">{row[0].startsWith("RAD") ? <Radio className="h-4 w-4" /> : <FlaskConical className="h-4 w-4" />}{row[1]}</Td>
                    <Td>{row[2]}</Td>
                    <Td><Badge tone={row[3] === "critical" ? "danger" : row[3] === "ready" ? "success" : "warning"}>{row[3]}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />Follow-up and risk analytics</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[{ name: "Diabetes", risk: 42 }, { name: "Cardiac", risk: 18 }, { name: "Pregnancy", risk: 9 }, { name: "Renal", risk: 11 }, { name: "Respiratory", risk: 24 }]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="risk" fill="#0f766e" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
    </PageTransition>
  );
}
