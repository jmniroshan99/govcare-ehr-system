import { BedDouble, CalendarDays, ClipboardCheck, Droplets, FileSignature, HeartPulse, PackageCheck, QrCode, Scissors, ShieldCheck, Syringe } from "lucide-react";
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

type SurgeryStatus = "scheduled" | "pre-op" | "in-theatre" | "recovery" | "icu-transfer" | "completed";

const surgeries = [
  ["OT-2026-018", "K. Thevarajah", "Appendectomy", "Theatre 01", "09:00", "pre-op"],
  ["OT-2026-019", "R. Kumar", "Emergency laparotomy", "Theatre 02", "Now", "in-theatre"],
  ["OT-2026-020", "Fathima Rizna", "C-section standby", "Theatre 03", "13:30", "scheduled"],
];

const theatreRooms = [
  ["Theatre 01", "Available after 11:00", "General surgery"],
  ["Theatre 02", "Occupied", "Emergency case active"],
  ["Theatre 03", "Ready", "Maternity standby"],
  ["Recovery Bay", "4 beds free", "Post-op monitoring"],
];

function statusTone(status: string) {
  if (status === "in-theatre") return "danger";
  if (status === "recovery" || status === "completed") return "success";
  if (status === "icu-transfer" || status === "pre-op") return "warning";
  return "info";
}

export function OperationTheatre() {
  const { showToast } = useToast();
  const [status, setStatus] = useState<SurgeryStatus>("pre-op");
  const [procedure, setProcedure] = useState("Appendectomy");

  function action(label: string, tone: "success" | "warning" | "danger" | "info" = "success") {
    showToast(`${label} recorded for theatre workflow.`, tone);
  }

  return (
    <PageTransition>
      <div className="space-y-5">
        <div className="page-hero flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">Operation Theatre</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Surgery scheduling, theatre safety, and post-op transfer</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Integrated with emergency, admissions, lab, radiology, blood bank, pharmacy, wards, ICU, reports, and patient profile.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => action("QR patient/theatre verification", "info")}><QrCode className="h-4 w-4" />Verify</Button>
            <Button onClick={() => action("Surgery report", "success")}><FileSignature className="h-4 w-4" />Generate report</Button>
          </div>
        </div>

        <Stagger>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["Today surgeries", 12, Scissors, "info" as const],
              ["Active theatre", 2, HeartPulse, "danger" as const],
              ["Recovery patients", 5, BedDouble, "success" as const],
              ["Blood requests", 3, Droplets, "warning" as const],
            ].map((stat) => {
              const Icon = stat[2] as typeof Scissors;
              return <Reveal key={stat[0] as string}><Card><CardContent className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">{stat[0] as string}</p><p className="mt-2 text-3xl font-bold text-slate-950">{stat[1] as number}</p></div><Badge tone={stat[3] as "info" | "danger" | "success" | "warning"}><Icon className="h-5 w-5" /></Badge></CardContent></Card></Reveal>;
            })}
          </section>
        </Stagger>

        <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" />Surgery schedule</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <thead><tr><Th>ID</Th><Th>Patient</Th><Th>Procedure</Th><Th>Theatre</Th><Th>Time</Th><Th>Status</Th></tr></thead>
                <tbody>{surgeries.map((row) => <tr key={row[0]}>{row.map((cell, index) => <Td key={cell}>{index === 5 ? <Badge tone={statusTone(cell)}>{cell}</Badge> : cell}</Td>)}</tr>)}</tbody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Scissors className="h-5 w-5 text-primary" />Create / update case</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <label className="text-sm font-medium">Procedure<Input value={procedure} onChange={(event) => setProcedure(event.target.value)} /></label>
              <label className="text-sm font-medium">Status<Select value={status} onChange={(event) => setStatus(event.target.value as SurgeryStatus)}><option>scheduled</option><option>pre-op</option><option>in-theatre</option><option>recovery</option><option>icu-transfer</option><option>completed</option></Select></label>
              <div className="grid gap-2 md:grid-cols-2">
                {["Surgeon: Dr. Silva", "Anesthetist: Dr. Nazeer", "Scrub nurse: Nurse Perera", "Circulating nurse: Nurse Silva"].map((item) => <div key={item} className="rounded-md border border-border bg-white p-3 text-sm">{item}</div>)}
              </div>
              <Button onClick={() => { action("Theatre case update", status === "in-theatre" ? "warning" : "success"); refreshAndRedirectToMainMenu(); }}><ClipboardCheck className="h-4 w-4" />Save theatre case</Button>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <WorkflowCard title="Pre-operative readiness" icon={<ClipboardCheck className="h-5 w-5 text-primary" />} items={["Consent form", "Pre-op checklist", "Allergy verification", "Blood availability", "Lab/radiology review"]} onAction={action} />
          <WorkflowCard title="Intra-operative record" icon={<Syringe className="h-5 w-5 text-primary" />} items={["Anesthesia notes", "Surgical safety checklist", "Intra-op notes", "Implant tracking", "Instrument count"]} onAction={action} />
          <WorkflowCard title="Post-operative care" icon={<BedDouble className="h-5 w-5 text-primary" />} items={["Recovery notes", "Complication record", "ICU transfer", "Ward transfer", "Surgery report"]} onAction={action} />
        </section>

        <SectionReveal>
          <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><PackageCheck className="h-5 w-5 text-primary" />Theatre availability</CardTitle></CardHeader>
              <CardContent className="space-y-2">{theatreRooms.map(([room, statusText, note]) => <div key={room} className="rounded-md border border-border bg-white p-3 text-sm"><div className="flex justify-between gap-2"><p className="font-bold text-slate-950">{room}</p><Badge tone={statusText === "Occupied" ? "danger" : "success"}>{statusText}</Badge></div><p className="text-muted-foreground">{note}</p></div>)}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Security and integration</CardTitle></CardHeader>
              <CardContent className="grid gap-3 text-sm md:grid-cols-3">
                <p className="help-strip p-3">backend API jobs validate surgery scheduling, report signing, blood requests, and ICU transfers.</p>
                <p className="help-strip p-3">AES-256 encrypted consent/anesthesia/surgery notes with QR/barcode tracking and immutable audit logs.</p>
                <p className="help-strip p-3">Connected to patient profile, admissions, ED, lab, radiology, blood bank, pharmacy, wards, and reports.</p>
              </CardContent>
            </Card>
          </section>
        </SectionReveal>
      </div>
    </PageTransition>
  );
}

function WorkflowCard({ title, icon, items, onAction }: { title: string; icon: React.ReactNode; items: string[]; onAction: (label: string, tone?: "success" | "warning" | "danger" | "info") => void }) {
  return <Card><CardHeader><CardTitle className="flex items-center gap-2">{icon}{title}</CardTitle></CardHeader><CardContent className="grid gap-2">{items.map((item) => <Button key={item} variant="outline" className="justify-start" onClick={() => onAction(item, "info")}>{item}</Button>)}</CardContent></Card>;
}
