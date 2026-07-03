import { BellRing, CalendarClock, ClipboardList, FileText, HeartPulse, Pill, Repeat2, ShieldCheck, Stethoscope, Syringe, UsersRound } from "lucide-react";
import { useState } from "react";
import { PageTransition, Reveal, SectionReveal, Stagger } from "../components/motion/PageTransition";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import { refreshAndRedirectToMainMenu } from "../utils/navigation";

type CarePriority = "routine" | "high" | "urgent";

const futurePlans = [
  ["FC-2026-041", "Nimal Silva", "Diabetes clinic follow-up", "2026-06-28", "high"],
  ["FC-2026-042", "Fathima Rizna", "Antenatal scan and vaccination", "2026-07-03", "routine"],
  ["FC-2026-043", "K. Thevarajah", "Post-op rehabilitation review", "2026-06-20", "urgent"],
];

const reminderStreams = [
  ["Repeat investigations", "HbA1c, creatinine, lipid profile due in 14 days", "Laboratory"],
  ["Medication review", "Warfarin safety check and refill plan", "Pharmacy"],
  ["Rehabilitation", "Physiotherapy gait training, 6 sessions pending", "Ward"],
  ["Referral plan", "Cardiology review after abnormal ECG", "Clinic"],
];

function priorityTone(priority: string) {
  if (priority === "urgent") return "danger";
  if (priority === "high") return "warning";
  return "success";
}

export function FutureCareWorkflow() {
  const { showToast } = useToast();
  const [priority, setPriority] = useState<CarePriority>("high");
  const [planName, setPlanName] = useState("Chronic disease monitoring");

  function action(label: string, tone: "success" | "warning" | "danger" | "info" = "success") {
    showToast(`${label} added to future care workflow.`, tone);
  }

  return (
    <PageTransition>
      <div className="space-y-5">
        <div className="page-hero flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">Future Care Workflow</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Long-term care planning, reminders, referrals, and follow-up safety</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Connects discharge advice, clinics, rehabilitation, repeat investigations, chronic disease reviews, vaccines, pharmacy reviews, and automated patient reminders.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => action("Patient reminder", "info")}><BellRing className="h-4 w-4" />Send reminder</Button>
            <Button onClick={() => action("Care plan", "success")}><FileText className="h-4 w-4" />Generate plan</Button>
          </div>
        </div>

        <Stagger>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Active plans", value: 84, icon: ClipboardList, tone: "info" as const },
              { label: "Follow-ups due", value: 19, icon: CalendarClock, tone: "warning" as const },
              { label: "Rehab plans", value: 11, icon: HeartPulse, tone: "success" as const },
              { label: "Med reviews", value: 7, icon: Pill, tone: "danger" as const },
            ].map((stat) => (
              <Reveal key={stat.label}>
                <Card><CardContent className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">{stat.label}</p><p className="mt-2 text-3xl font-bold text-slate-950">{stat.value}</p></div><Badge tone={stat.tone}><stat.icon className="h-5 w-5" /></Badge></CardContent></Card>
              </Reveal>
            ))}
          </section>
        </Stagger>

        <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" />Future care board</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <thead><tr><Th>Plan ID</Th><Th>Patient</Th><Th>Care plan</Th><Th>Next date</Th><Th>Priority</Th></tr></thead>
                <tbody>{futurePlans.map((row) => <tr key={row[0]}>{row.map((cell, index) => <Td key={cell}>{index === 4 ? <Badge tone={priorityTone(cell)}>{cell}</Badge> : cell}</Td>)}</tr>)}</tbody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Repeat2 className="h-5 w-5 text-primary" />Build care workflow</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <label className="text-sm font-medium">Plan title<Input value={planName} onChange={(event) => setPlanName(event.target.value)} /></label>
              <label className="text-sm font-medium">Priority<Select value={priority} onChange={(event) => setPriority(event.target.value as CarePriority)}><option>routine</option><option>high</option><option>urgent</option></Select></label>
              <div className="grid gap-2 md:grid-cols-2">
                {["Follow-up schedule", "Rehabilitation plan", "Repeat investigations", "Referral pathway", "Vaccination reminder", "Long-term medication review"].map((item) => <Button key={item} variant="outline" className="justify-start" onClick={() => action(item, "info")}>{item}</Button>)}
              </div>
              <Button onClick={() => { action(planName, priority === "urgent" ? "warning" : "success"); refreshAndRedirectToMainMenu(); }}><ShieldCheck className="h-4 w-4" />Save workflow</Button>
            </CardContent>
          </Card>
        </section>

        <SectionReveal>
          <section className="grid gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Stethoscope className="h-5 w-5 text-primary" />Monitoring programs</CardTitle></CardHeader>
              <CardContent className="space-y-2">{["Diabetes HbA1c pathway", "Hypertension BP pathway", "CKD renal review", "High-risk pregnancy checks", "Post-stroke rehabilitation"].map((item) => <div key={item} className="rounded-md border border-border bg-white p-3 text-sm font-medium text-slate-950">{item}</div>)}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Syringe className="h-5 w-5 text-primary" />Reminder streams</CardTitle></CardHeader>
              <CardContent className="space-y-2">{reminderStreams.map(([title, detail, owner]) => <div key={title} className="rounded-md border border-border bg-white p-3 text-sm"><div className="flex justify-between gap-2"><p className="font-bold text-slate-950">{title}</p><Badge tone="info">{owner}</Badge></div><p className="text-muted-foreground">{detail}</p></div>)}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-primary" />Security and integration</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="help-strip p-3">Doctors and nurses manage released care plans; patients only see approved reminders and instructions.</p>
                <p className="help-strip p-3">Cloud Functions audit reminders, referrals, medication reviews, and follow-up status changes.</p>
                <p className="help-strip p-3">Linked with patient profile, discharge summaries, OPD, wards, lab, radiology, pharmacy, and analytics.</p>
              </CardContent>
            </Card>
          </section>
        </SectionReveal>
      </div>
    </PageTransition>
  );
}
