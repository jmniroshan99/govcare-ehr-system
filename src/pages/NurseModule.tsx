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
import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageTransition, Reveal, SectionReveal, Stagger } from "../components/motion/PageTransition";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { useToast } from "../components/ui/toast-context";
import { refreshAndRedirectToMainMenu } from "../utils/navigation";

type NurseTaskStatus = "due" | "done" | "overdue" | "critical";

const assignedPatients = [
  { id: "PAT-2026-000001", name: "Nimal Silva", ward: "Ward 12", bed: "W12-08", risk: "Fall risk", allergies: "Penicillin", condition: "Stable" },
  { id: "PAT-2026-000142", name: "Fathima Rizna", ward: "Ward 03", bed: "W03-11", risk: "High-risk pregnancy", allergies: "None", condition: "Observe" },
  { id: "PAT-2026-000233", name: "R. Kumar", ward: "ICU", bed: "ICU-02", risk: "Critical labs", allergies: "Sulfa", condition: "Critical" },
];

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
  const [selectedPatientId, setSelectedPatientId] = useState(assignedPatients[0].id);
  const selected = assignedPatients.find((patient) => patient.id === selectedPatientId) ?? assignedPatients[0];
  const [bp, setBp] = useState("136/86");
  const [temp, setTemp] = useState("37.5");
  const [pulse, setPulse] = useState("90");
  const [spo2, setSpo2] = useState("98");
  const [pain, setPain] = useState("4");
  const bmi = useMemo(() => (78 / (1.72 * 1.72)).toFixed(1), []);
  const summaryStats = [
    { label: "Assigned patients", value: assignedPatients.length, icon: BedDouble, tone: "info" as const },
    { label: "Vitals due", value: 8, icon: HeartPulse, tone: "warning" as const },
    { label: "Critical alerts", value: 2, icon: AlertTriangle, tone: "danger" as const },
    { label: "MAR confirmations", value: 14, icon: Pill, tone: "success" as const },
  ];

  function save(label: string, tone: "success" | "warning" | "danger" | "info" = "success") {
    showToast(`${label} saved for ${selected.name}.`, tone);
  }

  function saveAndReturn(label: string, tone: "success" | "warning" | "danger" | "info" = "success") {
    save(label, tone);
    refreshAndRedirectToMainMenu();
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
            <Button variant="outline" onClick={() => save("QR patient verification", "info")}><QrCode className="h-4 w-4" />Verify patient</Button>
            <Button onClick={() => save("Shift handover report")}><ClipboardCheck className="h-4 w-4" />Handover</Button>
          </div>
        </div>

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
                  <p className="mt-1 text-muted-foreground">{patient.id} | {patient.ward} {patient.bed} | {patient.risk}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><HeartPulse className="h-5 w-5 text-primary" />Record vital signs</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="selection-panel p-3 text-sm">
                <p className="font-bold text-slate-950">{selected.name}</p>
                <p className="text-muted-foreground">{selected.ward} {selected.bed} | Allergy: {selected.allergies} | BMI {bmi}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-sm font-medium">Blood pressure<Input value={bp} onChange={(event) => setBp(event.target.value)} /></label>
                <label className="text-sm font-medium">Temperature<Input value={temp} onChange={(event) => setTemp(event.target.value)} /></label>
                <label className="text-sm font-medium">Pulse<Input value={pulse} onChange={(event) => setPulse(event.target.value)} /></label>
                <label className="text-sm font-medium">SpO2<Input value={spo2} onChange={(event) => setSpo2(event.target.value)} /></label>
                <label className="text-sm font-medium">Pain score<Input value={pain} onChange={(event) => setPain(event.target.value)} /></label>
                <label className="text-sm font-medium">Assessment<Select><option>Stable</option><option>Needs review</option><option>Deteriorating</option></Select></label>
              </div>
              <Button onClick={() => saveAndReturn("Vital signs")}><Thermometer className="h-4 w-4" />Save vitals</Button>
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
            <p className="help-strip p-3">Firebase custom claims should grant only nursing permissions for the nurse role.</p>
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
