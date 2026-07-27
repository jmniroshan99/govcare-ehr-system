import { BellRing, ClipboardCheck, FileSignature, FileText, IdCard, MapPin, QrCode, ShieldCheck, UserCheck, UsersRound } from "lucide-react";
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

type MortuaryStatus = "registered" | "doctor-confirmed" | "post-mortem" | "stored" | "release-approved" | "released";

const mortuaryCases = [
  ["MOR-2026-009", "S. Fernando", "Doctor confirmed", "Bay A-04", "doctor-confirmed"],
  ["MOR-2026-010", "Unknown male", "Police/JMO notified", "Secure Bay B-01", "post-mortem"],
  ["MOR-2026-011", "A. Rahman", "Release approval pending", "Bay A-02", "stored"],
];

const releaseChecks = ["Next-of-kin verified", "Doctor death confirmation", "Cause of death documented", "Police/JMO workflow", "Certificate prepared", "Handover witnesses"];

function statusTone(status: string) {
  if (status === "post-mortem") return "danger";
  if (status === "release-approved" || status === "released") return "success";
  if (status === "stored") return "warning";
  return "info";
}

export function MortuaryManagement() {
  const { showToast } = useToast();
  const [status, setStatus] = useState<MortuaryStatus>("doctor-confirmed");
  const [certificateName, setCertificateName] = useState("Death registration certificate");

  function action(label: string, tone: "success" | "warning" | "danger" | "info" = "success") {
    showToast(`${label} recorded with restricted mortuary audit trail.`, tone);
  }

  return (
    <PageTransition>
      <div className="space-y-5">
        <div className="page-hero flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">Mortuary Management</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Death registration, identity control, release approvals, and certificates</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Restricted workflow for doctor death confirmation, next-of-kin verification, police/JMO notifications, post-mortem requests, storage tracking, handover, and audit logs.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => action("QR/body identification", "info")}><QrCode className="h-4 w-4" />Verify body</Button>
            <Button onClick={() => action("Certificate generation", "success")}><FileSignature className="h-4 w-4" />Generate certificate</Button>
          </div>
        </div>

        <Stagger>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Registered cases", value: 11, icon: FileText, tone: "info" as const },
              { label: "Storage occupied", value: "8/20", icon: MapPin, tone: "warning" as const },
              { label: "Release approvals", value: 3, icon: ClipboardCheck, tone: "success" as const },
              { label: "JMO workflows", value: 2, icon: BellRing, tone: "danger" as const },
            ].map((stat) => (
              <Reveal key={stat.label}>
                <Card><CardContent className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">{stat.label}</p><p className="mt-2 text-3xl font-bold text-slate-950">{stat.value}</p></div><Badge tone={stat.tone}><stat.icon className="h-5 w-5" /></Badge></CardContent></Card>
              </Reveal>
            ))}
          </section>
        </Stagger>

        <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><IdCard className="h-5 w-5 text-primary" />Restricted mortuary register</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <thead><tr><Th>Case ID</Th><Th>Patient/body</Th><Th>Workflow</Th><Th>Storage</Th><Th>Status</Th></tr></thead>
                <tbody>{mortuaryCases.map((row) => <tr key={row[0]}>{row.map((cell, index) => <Td key={cell}>{index === 4 ? <Badge tone={statusTone(cell)}>{cell}</Badge> : cell}</Td>)}</tr>)}</tbody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-primary" />Register / update case</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <label className="text-sm font-medium">Document<Input value={certificateName} onChange={(event) => setCertificateName(event.target.value)} /></label>
              <label className="text-sm font-medium">Status<Select value={status} onChange={(event) => setStatus(event.target.value as MortuaryStatus)}><option>registered</option><option>doctor-confirmed</option><option>post-mortem</option><option>stored</option><option>release-approved</option><option>released</option></Select></label>
              <div className="grid gap-2 md:grid-cols-2">
                {["Cause of death", "Next-of-kin details", "Police notification", "JMO notification", "Post-mortem request", "Storage location"].map((item) => <Button key={item} variant="outline" className="justify-start" onClick={() => action(item, "info")}>{item}</Button>)}
              </div>
              <Button onClick={() => { action(certificateName, status === "post-mortem" ? "warning" : "success"); refreshAndRedirectToMainMenu(); }}><ShieldCheck className="h-4 w-4" />Save restricted case</Button>
            </CardContent>
          </Card>
        </section>

        <SectionReveal>
          <section className="grid gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-primary" />Release checklist</CardTitle></CardHeader>
              <CardContent className="space-y-2">{releaseChecks.map((item) => <div key={item} className="flex items-center justify-between rounded-md border border-border bg-white p-3 text-sm"><span className="font-medium text-slate-950">{item}</span><Badge tone="success">tracked</Badge></div>)}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" />Storage and handover</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {["Cold room Bay A: 6 occupied, 4 free", "Secure Bay B: police/JMO restricted", "Body release desk: two approvals pending", "Handover records require two witnesses"].map((item) => <p key={item} className="rounded-md border border-border bg-white p-3 text-slate-950">{item}</p>)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-primary" />Privacy and integration</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="help-strip p-3">Mortuary records are restricted to authorized doctors, hospital admins, records officers, and mortuary officers.</p>
                <p className="help-strip p-3">Every view, certificate, upload, body transfer, and release approval is written to immutable audit logs.</p>
                <p className="help-strip p-3">Connected with admissions, emergency, wards, patient profile, reports, certificates, and hospital analytics.</p>
              </CardContent>
            </Card>
          </section>
        </SectionReveal>
      </div>
    </PageTransition>
  );
}
