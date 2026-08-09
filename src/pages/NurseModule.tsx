import {
  Activity,
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  HeartPulse,
  MessageSquareText,
  Pill,
  QrCode,
  ShieldAlert,
  Stethoscope,
  Syringe,
  Thermometer,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageTransition, Reveal, SectionReveal, Stagger } from "../components/motion/PageTransition";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { MeasurementField } from "../components/forms";
import { Select } from "../components/ui/select";
import { useToast } from "../components/ui/toast-context";
import { refreshAndRedirectToMainMenu } from "../utils/navigation";
import { confirmPatientIdentity, getWardAdmittedPatients, type WardPatient } from "../services/admissionService";
import { getWards } from "../services/wardService";
import type { WardSummary } from "../types/ward";

type NurseTaskStatus = "due" | "done" | "overdue" | "critical";

type NursePatientView = {
  id: string;
  patientUuid: string;
  name: string;
  ward: string;
  wardId: string;
  bed: string;
  bedId: string;
  admissionId: string;
  age?: number | null;
  gender?: string | null;
  risk: string;
  allergies: string;
  condition: "Stable" | "Observe" | "Critical";
  latestVitalStatus: string;
};

function listText(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(", ");
  if (typeof value === "string" && value.trim()) return value;
  return "None";
}

function toNursePatient(patient: WardPatient): NursePatientView {
  const priority = (patient.priority ?? "routine").toLowerCase();
  return {
    id: patient.patientNumber,
    patientUuid: patient.id,
    name: patient.patientName,
    ward: `${patient.wardCode} — ${patient.wardName}`,
    wardId: patient.wardId,
    bed: patient.bedCode || patient.bedNumber,
    bedId: patient.bedId,
    admissionId: patient.admissionId,
    age: patient.ageYears,
    gender: patient.gender,
    risk: listText(patient.riskFlags) !== "None" ? listText(patient.riskFlags) : patient.admissionReason || "Routine ward care",
    allergies: listText(patient.allergies),
    condition: priority === "critical" || priority === "stat" ? "Critical" : priority === "urgent" ? "Observe" : "Stable",
    latestVitalStatus: patient.latestVitalStatus || "No vitals recorded",
  };
}

const vitals = [
  { time: "08:00", bp: 128, pulse: 86, spo2: 98, temp: 37.1 },
  { time: "10:00", bp: 134, pulse: 92, spo2: 97, temp: 37.4 },
  { time: "12:00", bp: 142, pulse: 98, spo2: 96, temp: 38.1 },
  { time: "14:00", bp: 136, pulse: 90, spo2: 98, temp: 37.5 },
];

const tasks: Array<[string, string, NurseTaskStatus]> = [
  ["09:00", "Administer Metformin and confirm MAR", "due"],
  ["10:00", "Repeat blood glucose", "done"],
  ["11:30", "Wound dressing check", "due"],
  ["12:00", "IV fluid balance chart", "overdue"],
  ["Now", "Critical lab alert acknowledgement", "critical"],
];

const permissionsAllowed = [
  "View assigned patients and wards",
  "Record vitals and bedside observations",
  "Nursing notes, assessments, care plans",
  "MAR confirmations and IV fluid management",
  "Risk assessments, handover, reports",
  "View lab/radiology results and receive alerts",
];

const restrictions = [
  "Cannot modify diagnoses",
  "Cannot prescribe medicines",
  "Cannot edit lab or radiology reports",
  "Cannot manage users or settings",
  "Cannot access audit logs",
  "Cannot change doctor notes",
];

function taskTone(status: NurseTaskStatus) {
  if (status === "done") return "success";
  if (status === "critical") return "danger";
  if (status === "overdue") return "warning";
  return "info";
}

export function NurseModule() {
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const [wards, setWards] = useState<WardSummary[]>([]);
  const [wardId, setWardId] = useState(searchParams.get("wardId") ?? "");
  const [assignedPatients, setAssignedPatients] = useState<NursePatientView[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [patientsLoading, setPatientsLoading] = useState(false);
  const selected = assignedPatients.find((patient) => patient.id === selectedPatientId) ?? assignedPatients[0] ?? null;
  const [systolic, setSystolic] = useState("136");
  const [diastolic, setDiastolic] = useState("86");
  const [temp, setTemp] = useState("37.5");
  const [pulse, setPulse] = useState("90");
  const [spo2, setSpo2] = useState("98");
  const [pain, setPain] = useState("4");
  const bmi = useMemo(() => (78 / (1.72 * 1.72)).toFixed(1), []);
  const summaryStats = [
    { label: "Assigned patients", value: assignedPatients.length, icon: BedDouble, tone: "info" as const },
    { label: "Vitals due", value: assignedPatients.filter((patient) => patient.latestVitalStatus === "No vitals recorded").length, icon: HeartPulse, tone: "warning" as const },
    { label: "Critical alerts", value: assignedPatients.filter((patient) => patient.condition === "Critical").length, icon: AlertTriangle, tone: "danger" as const },
    { label: "MAR confirmations", value: assignedPatients.length, icon: Pill, tone: "success" as const },
  ];

  useEffect(() => {
    getWards()
      .then((items) => {
        const active = items.filter((ward) => ward.status === "ACTIVE");
        setWards(active);
        setWardId((current) => current || active[0]?.id || "");
      })
      .catch((error: unknown) => showToast(error instanceof Error ? error.message : "Unable to load wards.", "danger"));
  }, [showToast]);

  useEffect(() => {
    if (!wardId) {
      setAssignedPatients([]);
      setSelectedPatientId("");
      return;
    }
    setPatientsLoading(true);
    getWardAdmittedPatients(wardId)
      .then((items) => {
        const mapped = items.map(toNursePatient);
        setAssignedPatients(mapped);
        setSelectedPatientId((current) => mapped.some((patient) => patient.id === current) ? current : mapped[0]?.id || "");
      })
      .catch((error: unknown) => {
        setAssignedPatients([]);
        setSelectedPatientId("");
        showToast(error instanceof Error ? error.message : "Unable to load admitted patients for this ward.", "danger");
      })
      .finally(() => setPatientsLoading(false));
  }, [showToast, wardId]);

  function save(label: string, tone: "success" | "warning" | "danger" | "info" = "success") {
    if (!selected) {
      showToast("Select an admitted patient first.", "warning");
      return;
    }
    showToast(`${label} saved for ${selected.name}.`, tone);
  }

  async function verifySelectedPatient() {
    if (!selected) {
      showToast("Select an admitted patient first.", "warning");
      return;
    }
    try {
      await confirmPatientIdentity(selected.patientUuid, selected.wardId, selected.bedId);
      showToast(`${selected.name} verified in ${selected.ward}, bed ${selected.bed}.`, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Patient verification failed.", "danger");
    }
  }

  function saveAndReturn(label: string, tone: "success" | "warning" | "danger" | "info" = "success") {
    save(label, tone);
    if (selected) refreshAndRedirectToMainMenu();
  }

  return (
    <PageTransition>
      <div className="space-y-5">
        <div className="page-hero flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">Nurse Module</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Ward and bedside nursing workspace</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Focused nurse access for assigned patients, vitals, MAR, assessments, handover, care plans, alerts, and secure clinical communication.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void verifySelectedPatient()} disabled={!selected}><QrCode className="h-4 w-4" />Verify patient</Button>
            <Button onClick={() => save("Shift handover report")}><ClipboardCheck className="h-4 w-4" />Handover</Button>
          </div>
        </div>

        <Card>
          <CardContent className="grid items-end gap-3 p-4 md:grid-cols-[minmax(260px,0.6fr)_1fr]">
            <label className="space-y-1 text-sm font-semibold">Ward selection
              <Select value={wardId} onChange={(event) => setWardId(event.target.value)}>
                <option value="">Select ward</option>
                {wards.map((ward) => <option key={ward.id} value={ward.id}>{ward.wardCode} — {ward.wardName} ({ward.occupiedBeds} occupied)</option>)}
              </Select>
            </label>
            <div className="rounded-xl border bg-muted/30 p-3 text-sm">
              <strong>Patient identification scope</strong>
              <p className="text-muted-foreground">Only patients with an active admission and active bed allocation in the selected ward are shown. Verification confirms the patient, ward, bed, and admission.</p>
            </div>
          </CardContent>
        </Card>

        <div className="help-strip grid gap-3 p-4 text-sm md:grid-cols-3">
          <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" />Nursing-only scope</div>
          <div className="flex items-center gap-2 font-semibold"><ShieldAlert className="h-4 w-4" />No diagnosis or prescription editing</div>
          <div className="flex items-center gap-2 font-semibold"><MessageSquareText className="h-4 w-4" />Secure doctor/nurse messaging</div>
        </div>

        <Stagger>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryStats.map((stat) => (
              <Reveal key={stat.label}>
                <Card>
                  <CardContent className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="mt-2 text-3xl font-bold text-slate-950">{stat.value}</p>
                    </div>
                    <Badge tone={stat.tone}><stat.icon className="h-5 w-5" /></Badge>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </section>
        </Stagger>

        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BedDouble className="h-5 w-5 text-primary" />Assigned patients</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {assignedPatients.map((patient) => (
                <button key={patient.id} className={`interactive-control w-full rounded-md border px-3 py-3 text-left text-sm ${patient.id === selectedPatientId ? "border-teal-300 bg-teal-50 text-primary shadow-sm" : "border-border bg-white text-slate-800"}`} onClick={() => setSelectedPatientId(patient.id)} type="button">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold">{patient.name}</p>
                    <Badge tone={patient.condition === "Critical" ? "danger" : patient.condition === "Observe" ? "warning" : "success"}>{patient.condition}</Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">{patient.id} | {patient.ward} | Bed {patient.bed}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Age {patient.age ?? "N/A"} · {patient.gender ?? "Gender N/A"} · {patient.risk}</p>
                </button>
              ))}
              {!patientsLoading && !assignedPatients.length && <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No actively admitted patients were found in the selected ward.</div>}
              {patientsLoading && <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">Loading ward patients...</div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><HeartPulse className="h-5 w-5 text-primary" />Record vital signs</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {selected ? <div className="selection-panel p-3 text-sm">
                <p className="font-bold text-slate-950">{selected.name}</p>
                <p className="text-muted-foreground">{selected.ward} · Bed {selected.bed} | Allergy: {selected.allergies} | BMI {bmi}</p>
                <p className="text-xs text-muted-foreground">Admission {selected.admissionId} · {selected.latestVitalStatus}</p>
              </div> : <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">Select a ward patient before recording bedside observations.</div>}
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-sm font-medium">Systolic blood pressure<MeasurementField kind="systolic" value={systolic} onChange={setSystolic} /></label>
                <label className="text-sm font-medium">Diastolic blood pressure<MeasurementField kind="diastolic" value={diastolic} onChange={setDiastolic} /></label>
                <label className="text-sm font-medium">Temperature<MeasurementField kind="temperature" value={temp} onChange={setTemp} /></label>
                <label className="text-sm font-medium">Pulse<MeasurementField kind="pulse" value={pulse} onChange={setPulse} /></label>
                <label className="text-sm font-medium">SpO2<MeasurementField kind="spo2" value={spo2} onChange={setSpo2} /></label>
                <label className="text-sm font-medium">Pain score<MeasurementField kind="pain" value={pain} onChange={setPain} /></label>
                <label className="text-sm font-medium">Assessment<Select defaultValue="Stable"><option>Stable</option><option>Needs review</option><option>Deteriorating</option></Select></label>
              </div>
              <p className="text-xs text-muted-foreground">Current blood pressure entry: {systolic || "—"}/{diastolic || "—"} mmHg. Values outside configured clinical ranges are rejected by the numeric controls.</p>
              <Button onClick={() => saveAndReturn("Vital signs")} disabled={!selected}><Thermometer className="h-4 w-4" />Save vitals</Button>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />Vitals trend</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={vitals}>
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="bp" stroke="#0f766e" strokeWidth={2} />
                  <Line type="monotone" dataKey="pulse" stroke="#155e75" strokeWidth={2} />
                  <Line type="monotone" dataKey="spo2" stroke="#0891b2" strokeWidth={2} />
                  <Line type="monotone" dataKey="temp" stroke="#be123c" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" />Task list and reminders</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {tasks.map(([time, task, status]) => (
                <div key={`${time}-${task}`} className="rounded-md border border-border bg-white px-3 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-slate-950">{task}</p>
                    <Badge tone={taskTone(status)}>{status}</Badge>
                  </div>
                  <p className="text-muted-foreground">{time}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <NursingCard title="Medication and fluids" icon={<Pill className="h-5 w-5 text-primary" />} items={["MAR confirmation", "Medication schedule", "IV fluid chart", "Blood glucose monitoring"]} onSave={save} />
          <NursingCard title="Assessments and care" icon={<Stethoscope className="h-5 w-5 text-primary" />} items={["Nursing assessment", "Care plan", "Fall risk", "Pressure ulcer risk"]} onSave={save} />
          <NursingCard title="Documentation" icon={<ClipboardCheck className="h-5 w-5 text-primary" />} items={["Wound care", "Intake and output", "Admission checklist", "Transfer/discharge checklist"]} onSave={save} />
        </section>

        <SectionReveal>
          <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquareText className="h-5 w-5 text-primary" />Secure nursing communication</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <textarea className="min-h-28 w-full rounded-md border border-border bg-white p-3 text-sm shadow-sm" defaultValue="Shift handover: monitor fever trend, repeat glucose at 18:00, confirm MAR after meal." />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => saveAndReturn("Nursing note")}><ClipboardList className="h-4 w-4" />Save note</Button>
                  <Button variant="outline" onClick={() => save("Doctor message", "info")}><MessageSquareText className="h-4 w-4" />Message doctor</Button>
                  <Button variant="outline" onClick={() => save("Patient education record", "info")}><Syringe className="h-4 w-4" />Education record</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-primary" />Nurse role permissions</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="font-bold text-slate-950">Allowed</p>
                  {permissionsAllowed.map((item) => <Badge key={item} tone="success">{item}</Badge>)}
                </div>
                <div className="space-y-2">
                  <p className="font-bold text-slate-950">Restricted</p>
                  {restrictions.map((item) => <Badge key={item} tone="danger">{item}</Badge>)}
                </div>
              </CardContent>
            </Card>
          </section>
        </SectionReveal>

        <Card>
          <CardHeader><CardTitle>Security and audit model</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-3">
            <p className="help-strip p-3">JWT role claims and PostgreSQL permissions should grant only nursing permissions for the nurse role.</p>
            <p className="help-strip p-3">Nursing notes, vitals, MAR, and assessments should be audited with user ID, role, timestamp, and device metadata.</p>
            <p className="help-strip p-3">Sensitive nursing observations should use AES-256-GCM encryption and offline-safe read/update queues.</p>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}

function NursingCard({ title, icon, items, onSave }: { title: string; icon: React.ReactNode; items: string[]; onSave: (label: string, tone?: "success" | "warning" | "danger" | "info") => void }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2">{icon}{title}</CardTitle></CardHeader>
      <CardContent className="grid gap-2">
        {items.map((item) => <Button key={item} variant="outline" className="justify-start" onClick={() => onSave(item, "success")}>{item}</Button>)}
      </CardContent>
    </Card>
  );
}
