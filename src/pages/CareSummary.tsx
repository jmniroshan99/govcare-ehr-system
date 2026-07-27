import {
  Activity,
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  Download,
  FileHeart,
  FileText,
  FileUp,
  HeartPulse,
  MessageSquareText,
  Pill,
  Save,
  ShieldAlert,
  Stethoscope,
  Syringe,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageTransition, Reveal, SectionReveal, Stagger } from "../components/motion/PageTransition";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { useToast } from "../components/ui/toast-context";
import { uploadPatientReport, updateCareSummary } from "../services/profileService";
import { useAuthStore } from "../stores/authStore";
import { refreshAndRedirectToMainMenu } from "../utils/navigation";
import { downloadTextFile, timestampedFilename } from "../utils/download";
import { getSavedPatientsForDoctors } from "../utils/patientRegistry";

const vitals = [
  { time: "Day 1 06:00", bp: 132, pulse: 86, spo2: 98, sugar: 142 },
  { time: "Day 1 12:00", bp: 136, pulse: 90, spo2: 97, sugar: 164 },
  { time: "Day 1 18:00", bp: 142, pulse: 96, spo2: 97, sugar: 188 },
  { time: "Day 1 22:00", bp: 138, pulse: 92, spo2: 98, sugar: 176 },
  { time: "Day 2 06:00", bp: 134, pulse: 88, spo2: 99, sugar: 158 },
  { time: "Day 2 12:00", bp: 136, pulse: 88, spo2: 98, sugar: 148 },
  { time: "Day 2 18:00", bp: 140, pulse: 94, spo2: 96, sugar: 176 },
  { time: "Day 2 22:00", bp: 128, pulse: 82, spo2: 99, sugar: 132 },
];

const riskScores = [
  { name: "Sepsis", value: 18 },
  { name: "Falls", value: 72 },
  { name: "Readmit", value: 41 },
  { name: "Interaction", value: 64 },
];

const timeline = [
  ["Today 14:20", "Lab", "HbA1c elevated. Doctor review pending."],
  ["Today 11:10", "Radiology", "Chest X-ray released. No acute lesion."],
  ["Yesterday", "Medication", "Metformin and Atorvastatin continued."],
  ["2026-06-08", "OPD", "Diabetes review. Follow-up in 2 weeks."],
  ["2026-05-28", "Admission", "Short admission for dehydration, discharged stable."],
  ["2026-05-10", "Immunization", "Influenza vaccine completed."],
];

const careTeam = [
  ["Consultant", "Dr. Anjali Perera", "Medical OPD"],
  ["Nurse", "Nurse Silva", "Ward 12"],
  ["Pharmacist", "Pharmacist Kumar", "Medication safety"],
  ["Dietician", "M. Fernando", "Diabetes plan"],
];

const activeItems = {
  diagnoses: ["Type 2 diabetes mellitus", "Hypertension", "Acute viral URTI"],
  medications: ["Metformin 500mg BD", "Losartan 50mg daily", "Atorvastatin 20mg nocte"],
  prescriptions: ["Paracetamol 1g TDS 3 days", "Saline nasal spray PRN"],
  labs: ["HbA1c 7.8% high", "Creatinine 1.1 mg/dL", "FBC WBC 15.2 high"],
  radiology: ["Chest X-ray: no acute lesion", "ECG: sinus rhythm", "Previous US: fatty liver changes"],
  carePlans: ["Diabetes control plan", "Dietician referral", "Repeat FBC in 48 hours"],
  pending: ["Urine culture", "Cardiology clinic booking", "Medication interaction review"],
};

export function CareSummary() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const profile = useAuthStore((state) => state.profile);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("external");
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [currentSituation, setCurrentSituation] = useState("Stable but requires diabetic control, fall prevention, and repeat lab review.");
  const [futureTreatments, setFutureTreatments] = useState("Follow-up in diabetes clinic, repeat HbA1c in 3 months, review medication interactions.");
  const isClinicalStaff = profile?.role === "doctor" || profile?.role === "nurse";
  const latestSavedPatient = useMemo(() => getSavedPatientsForDoctors()[0], []);
  const summaryPatient = {
    name: profile?.role === "patient" ? profile.displayName : latestSavedPatient?.name ?? "Nimal Silva",
    patientId: profile?.patientId ?? latestSavedPatient?.patientId ?? "PAT-2026-000001",
    age: latestSavedPatient?.age ?? 44,
    gender: latestSavedPatient?.sex ?? "Male",
    bloodGroup: latestSavedPatient?.bloodGroup ?? "B+",
    nic: latestSavedPatient?.nicOrPassport ?? "812345678V",
    allergies: latestSavedPatient?.allergies ?? "Penicillin",
    chronicDiseases: latestSavedPatient?.chronicDiseases ?? "Diabetes, hypertension",
  };
  const bmi = useMemo(() => (78 / (1.72 * 1.72)).toFixed(1), []);

  async function uploadReport() {
    if (!profile || !file || !title) {
      showToast("Select a file and enter a report title.", "warning");
      return;
    }
    await uploadPatientReport({
      file,
      title,
      category,
      reportDate,
      hospitalId: profile.hospitalId,
      patientUid: profile.role === "patient" ? profile.uid : "patient-demo-1",
      patientId: profile.patientId ?? "PAT-2026-000001",
    });
    setTitle("");
    setFile(null);
    showToast("Report uploaded and saved to the patient record.", "success");
  }

  function saveCareSummary() {
    if (!profile) return;
    void updateCareSummary({
      patientUid: profile.role === "patient" ? profile.uid : "patient-demo-1",
      currentSituation,
      futureTreatments,
    }).catch((error) => console.warn("Care summary background save failed.", error));
    showToast("Smart patient snapshot updated.", "success");
    refreshAndRedirectToMainMenu(800, {
      title: "Care summary saved",
      summary: `${currentSituation.slice(0, 80)}${currentSituation.length > 80 ? "..." : ""}`,
      module: "Smart Patient Snapshot",
    });
  }

  function exportSummary() {
    downloadTextFile(timestampedFilename(`${summaryPatient.patientId.toLowerCase()}-smart-patient-snapshot`, "txt"), `GovCare EHR System\nSmart Patient Snapshot\n\nPatient: ${summaryPatient.name}\nPatient ID: ${summaryPatient.patientId}\nGender/Age: ${summaryPatient.gender} / ${summaryPatient.age}\nBlood group: ${summaryPatient.bloodGroup}\nNIC/Identifier: ${summaryPatient.nic}\nAllergies: ${summaryPatient.allergies}\nChronic diseases: ${summaryPatient.chronicDiseases}\nCurrent situation: ${currentSituation}\nFuture treatments: ${futureTreatments}\nActive diagnoses: ${activeItems.diagnoses.join(", ")}\nCurrent medications: ${activeItems.medications.join(", ")}\nLaboratory highlights: ${activeItems.labs.join(", ")}\nRadiology findings: ${activeItems.radiology.join(", ")}`, "text/plain;charset=utf-8");
    showToast("Care summary exported.", "success");
  }

  return (
    <PageTransition>
      <div className="space-y-5">
        <div className="page-hero flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-teal-100 text-primary">
              <UserRound className="h-10 w-10" />
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">Smart Patient Snapshot</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">{summaryPatient.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{summaryPatient.age} years | {summaryPatient.gender} | {summaryPatient.bloodGroup} | {summaryPatient.patientId} | NIC {summaryPatient.nic}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="danger">Penicillin allergy</Badge>
                <Badge tone="warning">Diabetes</Badge>
                <Badge tone="warning">Fall risk high</Badge>
                <Badge tone="info">DNR: not recorded</Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate("/doctor/workspace")}><Stethoscope className="h-4 w-4" />Start review</Button>
            <Button variant="outline" onClick={() => navigate("/portal/appointments")}><CalendarDays className="h-4 w-4" />Book follow-up</Button>
            <Button variant="outline" onClick={exportSummary}><Download className="h-4 w-4" />Export summary</Button>
          </div>
        </div>

        <div className="help-strip grid gap-3 p-4 text-sm md:grid-cols-4">
          {["Live clinical summary", "Color-coded risk alerts", "Released results only for patients", "Audit log on every view"].map((item) => (
            <div key={item} className="flex items-center gap-2 font-semibold"><ShieldAlert className="h-4 w-4" />{item}</div>
          ))}
        </div>

        <Stagger>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["Latest BP", "134/84", HeartPulse, "success" as const],
              ["BMI", bmi, Activity, "warning" as const],
              ["Pain score", "4 / 10", AlertTriangle, "warning" as const],
              ["Risk score", "High", ShieldAlert, "danger" as const],
            ].map(([label, value, Icon, tone]) => (
              <Reveal key={label as string}>
                <Card>
                  <CardContent className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{label as string}</p>
                      <p className="mt-2 text-3xl font-bold text-slate-950">{value as string}</p>
                    </div>
                    <Badge tone={tone as "success" | "warning" | "danger"}><Icon className="h-5 w-5" /></Badge>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </section>
        </Stagger>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileHeart className="h-5 w-5 text-primary" />AI clinical summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="selection-panel p-4 text-sm leading-6">
                44-year-old male with type 2 diabetes, hypertension, penicillin allergy, and recent viral respiratory symptoms. Current safety priorities are glucose control, medication interaction review, fall prevention, and repeat inflammatory markers. No acute chest X-ray finding. HbA1c and WBC remain elevated.
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {["Allergy alert: avoid penicillin-class medicines", "Medication interaction review pending", "Fall risk score high", "Infection alert: WBC trend elevated"].map((alert, index) => (
                  <div key={alert} className={`rounded-md border px-3 py-2 text-sm font-medium ${index === 0 ? "border-rose-200 bg-rose-50 text-rose-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>{alert}</div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />Risk indicators</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={riskScores}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="value" stroke="#0f766e" fill="#99f6e4" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><HeartPulse className="h-5 w-5 text-primary" />Vitals trend</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={vitals}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="bp" stroke="#0f766e" strokeWidth={2} />
                  <Line type="monotone" dataKey="pulse" stroke="#155e75" strokeWidth={2} />
                  <Line type="monotone" dataKey="sugar" stroke="#be123c" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Pill className="h-5 w-5 text-primary" />Active problems and medicines</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <SnapshotList title="Diagnoses" items={activeItems.diagnoses} tone="warning" />
              <SnapshotList title="Current medications" items={activeItems.medications} tone="info" />
              <SnapshotList title="Recent prescriptions" items={activeItems.prescriptions} tone="success" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" />Investigations</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <SnapshotList title="Laboratory highlights" items={activeItems.labs} tone="warning" />
              <SnapshotList title="Radiology findings" items={activeItems.radiology} tone="info" />
              <SnapshotList title="Pending investigations" items={activeItems.pending} tone="neutral" />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-primary" />Care team and contacts</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {careTeam.map(([role, name, detail]) => (
                <div key={`${role}-${name}`} className="rounded-md border border-border bg-white px-3 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-slate-950">{name}</p>
                    <Badge tone="info">{role}</Badge>
                  </div>
                  <p className="text-muted-foreground">{detail}</p>
                </div>
              ))}
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-950">
                <p className="font-bold">Emergency contact</p>
                <p>Kamala Silva | Spouse | 0771234567</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Chronological medical timeline</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {timeline.map(([date, type, note]) => (
                <div key={`${date}-${type}`} className="grid gap-2 rounded-md border border-border bg-white p-3 text-sm md:grid-cols-[120px_120px_1fr]">
                  <span className="font-bold text-slate-950">{date}</span>
                  <Badge tone={type === "Lab" ? "warning" : type === "Radiology" ? "info" : type === "Admission" ? "danger" : "neutral"}>{type}</Badge>
                  <span className="text-slate-700">{note}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <InfoCard title="Medical background" icon={<Syringe className="h-5 w-5 text-primary" />} items={["Immunization: influenza completed", "Family history: diabetes and ischemic heart disease", "Past surgery: appendectomy 2010", "Pregnancy status: not applicable"]} />
          <InfoCard title="Care plans" icon={<ClipboardList className="h-5 w-5 text-primary" />} items={activeItems.carePlans} />
          <InfoCard title="Devices and referrals" icon={<MessageSquareText className="h-5 w-5 text-primary" />} items={["No implanted devices", "Dietician referral pending", "Cardiology referral requested", "Follow-up reminder: 2026-06-28"]} />
        </section>

        <SectionReveal>
          <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><FileUp className="h-5 w-5 text-primary" />Upload report</CardTitle></CardHeader>
              <CardContent className="grid gap-4">
                <label className="block text-sm font-medium">Report title<Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Blood report, X-ray, discharge note" /></label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium">Category<Select value={category} onChange={(event) => setCategory(event.target.value)}><option value="external">External report</option><option value="laboratory">Laboratory</option><option value="radiology">Radiology</option><option value="discharge">Discharge</option><option value="other">Other</option></Select></label>
                  <label className="block text-sm font-medium">Report date<Input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} /></label>
                </div>
                <label className="block text-sm font-medium">File<Input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
                <Button onClick={uploadReport}><FileUp className="h-4 w-4" />Upload report</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Current situation and future treatments</CardTitle></CardHeader>
              <CardContent className="grid gap-4">
                <label className="block text-sm font-medium">Current situation<textarea className="min-h-32 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm" value={currentSituation} onChange={(event) => setCurrentSituation(event.target.value)} /></label>
                <label className="block text-sm font-medium">Future treatments<textarea className="min-h-32 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm" value={futureTreatments} onChange={(event) => setFutureTreatments(event.target.value)} placeholder={isClinicalStaff ? "Planned investigations, referrals, medication changes, review dates" : "Patient concerns or treatment requests for doctor review"} /></label>
                <Button onClick={saveCareSummary}><Save className="h-4 w-4" />Save summary</Button>
              </CardContent>
            </Card>
          </section>
        </SectionReveal>
      </div>
    </PageTransition>
  );
}

function SnapshotList({ title, items, tone }: { title: string; items: string[]; tone: "neutral" | "success" | "warning" | "danger" | "info" }) {
  return (
    <div>
      <p className="mb-2 text-sm font-bold text-slate-950">{title}</p>
      <div className="flex flex-wrap gap-2">{items.map((item) => <Badge key={item} tone={tone}>{item}</Badge>)}</div>
    </div>
  );
}

function InfoCard({ title, icon, items }: { title: string; icon: React.ReactNode; items: string[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2">{icon}{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => <div key={item} className="rounded-md border border-border bg-white px-3 py-2 text-sm">{item}</div>)}
      </CardContent>
    </Card>
  );
}
