import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileSignature, FlaskConical, HeartPulse, MessageSquareText, Pill, Radio, Save, ShieldAlert, Stethoscope } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { useToast } from "../components/ui/toast-context";
import { listMedicalDecisionRequests, saveMedicalDecisionReview } from "../services/medicalDecisionReportService";
import { ehrEvidenceOptions, medicalReportPurposes } from "../types/medicalDecisionReport";
import type { MedicalDecisionRequest } from "../types/medicalDecisionReport";
import { useAuthStore } from "../stores/authStore";

const evidenceSummary: Array<[string, string, LucideIcon]> = [
  ["OPD and consultations", "3 recent visits · last review 20 Jun 2026", Stethoscope],
  ["Diagnoses and allergies", "Type 2 diabetes · Penicillin allergy", ShieldAlert],
  ["Laboratory", "HbA1c 7.2% · CBC within reference range", FlaskConical],
  ["Radiology", "Chest X-ray reviewed · no acute finding", Radio],
  ["Prescriptions", "Metformin 500mg · adherence documented", Pill],
  ["Vitals", "BP 128/78 · SpO2 98% · BMI 24.1", HeartPulse],
  ["Care messages", "Follow-up instructions acknowledged", MessageSquareText],
];

export function MedicalDecisionReview() {
  const profile = useAuthStore((state) => state.profile);
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const requestsQuery = useQuery({ queryKey: ["medical-decision-requests"], queryFn: listMedicalDecisionRequests });
  const pending = (requestsQuery.data ?? []).filter((request) => request.status !== "released" && request.status !== "rejected");
  const [selectedId, setSelectedId] = useState("");
  const selected = pending.find((request) => request.id === selectedId) ?? pending[0];
  const [form, setForm] = useState({
    clinicalSummary: "", medicalRemarks: "", recommendations: "", restrictions: "",
    fitnessStatus: "fit" as MedicalDecisionRequest["fitnessStatus"], followUpRequirements: "",
    issueDate: new Date().toISOString().slice(0, 10), expiryDate: "",
  });

  function selectRequest(request: MedicalDecisionRequest) {
    setSelectedId(request.id);
    setForm({
      clinicalSummary: request.clinicalSummary ?? "Verified EHR records were reviewed for the requested institutional purpose.",
      medicalRemarks: request.medicalRemarks ?? "",
      recommendations: request.recommendations ?? "",
      restrictions: request.restrictions ?? "None.",
      fitnessStatus: request.fitnessStatus ?? "fit",
      followUpRequirements: request.followUpRequirements ?? "",
      issueDate: request.issueDate ?? new Date().toISOString().slice(0, 10),
      expiryDate: request.expiryDate ?? "",
    });
  }

  async function perform(action: "save-draft" | "approve" | "release" | "reject") {
    if (!selected) return;
    if (action !== "reject" && (!form.clinicalSummary.trim() || !form.medicalRemarks.trim())) {
      showToast("Clinical summary and medical remarks are required.", "warning");
      return;
    }
    await saveMedicalDecisionReview(selected.id, {
      ...form,
      digitalSignature: action === "approve" || action === "release" ? `${profile?.displayName ?? "Authorized Medical Officer"} / ${profile?.uid ?? "demo"}` : selected.digitalSignature,
    }, action);
    await queryClient.invalidateQueries({ queryKey: ["medical-decision-requests"] });
    showToast(action === "release" ? "Report digitally signed and released to the patient." : `Report ${action.replace("-", " ")} completed.`, "success");
  }

  if (!selected) return <div className="empty-state"><CheckCircle2 className="h-10 w-10 text-primary" /><h1 className="mt-3 text-xl font-bold">No pending medical report requests</h1><p className="text-sm text-muted-foreground">New patient requests will appear here for clinical review.</p></div>;

  const verifyUrl = `${window.location.origin}/verify-medical-report?report=${encodeURIComponent(selected.reportNumber ?? selected.id)}&token=${encodeURIComponent(selected.verificationToken ?? selected.id)}`;

  return (
    <div className="space-y-5">
      <header className="page-hero flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm font-semibold text-primary">Medical officer workspace</p><h1 className="mt-1 text-2xl font-bold text-slate-950">Medical decision report review</h1><p className="mt-2 text-sm text-muted-foreground">Review verified EHR evidence, prepare structured remarks, approve, sign, and release official reports.</p></div>
        <Badge tone="warning">{pending.length} pending</Badge>
      </header>

      <section className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <Card>
          <CardHeader><CardTitle>Request queue</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {pending.map((request) => <button key={request.id} onClick={() => selectRequest(request)} className={`w-full rounded-md border p-3 text-left ${selected.id === request.id ? "border-teal-400 bg-teal-50 dark:bg-teal-950" : "border-border bg-card"}`}>
              <div className="flex justify-between gap-2"><p className="font-bold">{request.patientName}</p><Badge tone="warning">{request.status}</Badge></div>
              <p className="mt-1 text-sm text-muted-foreground">{medicalReportPurposes.find((item) => item.value === request.purpose)?.label}</p>
              <p className="text-xs text-muted-foreground">{request.institutionName} · {request.id}</p>
            </button>)}
            <div className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-3 text-xs text-teal-950 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-50"><strong>Consent verified:</strong> {selected.consent.recipient} may receive only {selected.consent.dataCategories.join(", ")} for {selected.consent.purpose}.</div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>{selected.patientName} · {selected.patientId}</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {evidenceSummary.filter(([label]) => selected.requestedInformation.some((item) => label.toLowerCase().includes(item.split(" ")[0].toLowerCase())) || label === "Diagnoses and allergies").map(([label, detail, Icon]) => <div key={String(label)} className="rounded-md border border-border bg-card p-3"><Icon className="h-5 w-5 text-primary" /><p className="mt-2 font-bold text-foreground">{String(label)}</p><p className="text-sm text-muted-foreground">{String(detail)}</p></div>)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Structured medical report</CardTitle></CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-[1fr_260px]">
              <div className="space-y-3">
                <TextArea label="Verified clinical summary" value={form.clinicalSummary} onChange={(value) => setForm((current) => ({ ...current, clinicalSummary: value }))} />
                <TextArea label="Professional medical remarks" value={form.medicalRemarks} onChange={(value) => setForm((current) => ({ ...current, medicalRemarks: value }))} />
                <div className="grid gap-3 sm:grid-cols-2"><TextArea label="Recommendations" value={form.recommendations} onChange={(value) => setForm((current) => ({ ...current, recommendations: value }))} /><TextArea label="Restrictions" value={form.restrictions} onChange={(value) => setForm((current) => ({ ...current, restrictions: value }))} /></div>
                <label className="block text-sm font-semibold">Fitness decision<Select value={form.fitnessStatus} onChange={(event) => setForm((current) => ({ ...current, fitnessStatus: event.target.value as MedicalDecisionRequest["fitnessStatus"] }))}><option value="fit">Fit</option><option value="fit-with-restrictions">Fit with restrictions</option><option value="temporarily-unfit">Temporarily unfit</option><option value="unfit">Unfit</option><option value="not-applicable">Not applicable</option></Select></label>
                <TextArea label="Follow-up requirements" value={form.followUpRequirements} onChange={(value) => setForm((current) => ({ ...current, followUpRequirements: value }))} />
                <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Issue date<Input type="date" value={form.issueDate} onChange={(event) => setForm((current) => ({ ...current, issueDate: event.target.value }))} /></label><label className="text-sm font-semibold">Expiry date<Input type="date" value={form.expiryDate} onChange={(event) => setForm((current) => ({ ...current, expiryDate: event.target.value }))} /></label></div>
              </div>
              <aside className="rounded-md border border-border bg-muted p-4 text-center">
                <p className="text-xs font-bold uppercase text-muted-foreground">Secure verification</p>
                <div className="mx-auto mt-3 w-fit bg-white p-3"><QRCodeSVG size={150} value={verifyUrl} /></div>
                <p className="mt-3 text-sm font-bold">{selected.reportNumber ?? "Assigned on approval"}</p>
                <p className="mt-1 text-xs text-muted-foreground">QR verification reveals validity, patient name, purpose, issue date, hospital, and doctor only.</p>
                <div className="mt-4 text-left text-xs text-muted-foreground">{ehrEvidenceOptions.filter((item) => selected.requestedInformation.includes(item)).map((item) => <p key={item}>✓ {item}</p>)}</div>
              </aside>
            </CardContent>
          </Card>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => perform("reject")}>Reject</Button>
            <Button variant="outline" onClick={() => perform("save-draft")}><Save className="h-4 w-4" />Save draft</Button>
            <Button variant="secondary" onClick={() => perform("approve")}><FileSignature className="h-4 w-4" />Approve and sign</Button>
            <Button onClick={() => perform("release")}><CheckCircle2 className="h-4 w-4" />Release to patient</Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-semibold">{label}<textarea className="mt-1 min-h-24 w-full rounded-md border border-border bg-white p-3 text-sm text-slate-900 dark:bg-slate-900 dark:text-slate-50" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
