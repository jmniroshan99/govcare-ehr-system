import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import jsPDF from "jspdf";
import { Clock3, Download, FileCheck2, FilePlus2, Printer, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import { ehrEvidenceOptions, medicalReportPurposes } from "../types/medicalDecisionReport";
import type { MedicalDecisionRequest, MedicalReportPurpose } from "../types/medicalDecisionReport";
import { listMedicalDecisionRequests, submitMedicalDecisionRequest } from "../services/medicalDecisionReportService";
import { useAuthStore } from "../stores/authStore";
import { timestampedFilename } from "../utils/download";

const requestSchema = z.object({
  purpose: z.string().min(1, "Select a report purpose."),
  institutionName: z.string().min(2, "Institution name is required.").max(160),
  institutionType: z.string().min(2, "Institution type is required."),
  assignedDoctorName: z.string().min(2, "Select an assigned doctor."),
  additionalDetails: z.string().max(600),
  requestedInformation: z.array(z.string()).min(1, "Select at least one record category."),
  consentAccepted: z.literal(true, { error: "Digital consent is required." }),
});

type RequestForm = z.infer<typeof requestSchema>;

export function MedicalDecisionRequests() {
  const profile = useAuthStore((state) => state.profile);
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const requestsQuery = useQuery({ queryKey: ["medical-decision-requests"], queryFn: listMedicalDecisionRequests });
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<RequestForm>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      purpose: "university-clearance",
      institutionName: "",
      institutionType: "University",
      assignedDoctorName: "Dr. Anjali Perera",
      additionalDetails: "",
      requestedInformation: ["Diagnoses", "Laboratory results", "Vital signs"],
      consentAccepted: false as true,
    },
  });

  const ownRequests = (requestsQuery.data ?? []).filter((request) =>
    request.patientUid === profile?.uid || request.patientId === profile?.patientId || import.meta.env.DEV,
  );

  async function submit(values: RequestForm) {
    const purposeLabel = medicalReportPurposes.find((item) => item.value === values.purpose)?.label ?? values.purpose;
    await submitMedicalDecisionRequest({
      patientUid: profile?.uid ?? "demo-patient",
      patientId: profile?.patientId ?? "PHR-000142",
      patientName: profile?.displayName ?? "Patient User",
      hospitalId: profile?.hospitalId ?? "hosp-colombo-national",
      purpose: values.purpose as MedicalReportPurpose,
      institutionName: values.institutionName,
      institutionType: values.institutionType,
      requestedInformation: values.requestedInformation,
      additionalDetails: values.additionalDetails,
      assignedDoctorId: "demo-doctor",
      assignedDoctorName: values.assignedDoctorName,
      consent: {
        accepted: true,
        recipient: values.institutionName,
        purpose: purposeLabel,
        dataCategories: values.requestedInformation,
        acceptedAt: new Date().toISOString(),
      },
    });
    await queryClient.invalidateQueries({ queryKey: ["medical-decision-requests"] });
    reset();
    showToast("Medical report request submitted securely.", "success");
  }

  function downloadReport(report: MedicalDecisionRequest) {
    if (report.status !== "released") return;
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text("GovCare EHR - Official Medical Decision Report", 14, 18);
    doc.setFontSize(10);
    doc.text(`Report number: ${report.reportNumber}`, 14, 30);
    doc.setFont("helvetica", "normal");
    [
      `Patient: ${report.patientName} (${report.patientId})`,
      `Hospital: ${report.hospitalId}`,
      `Purpose: ${medicalReportPurposes.find((item) => item.value === report.purpose)?.label}`,
      `Institution: ${report.institutionName}`,
      `Doctor: ${report.assignedDoctorName}`,
      `Issue date: ${report.issueDate ?? "-"}`,
      `Expiry date: ${report.expiryDate ?? "Not specified"}`,
      `Fitness decision: ${report.fitnessStatus ?? "Not applicable"}`,
    ].forEach((line, index) => doc.text(line, 14, 40 + index * 8));
    doc.setFont("helvetica", "bold");
    doc.text("Clinical summary", 14, 112);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(report.clinicalSummary ?? "", 180), 14, 120);
    doc.setFont("helvetica", "bold");
    doc.text("Medical remarks and recommendations", 14, 150);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(`${report.medicalRemarks ?? ""}\n${report.recommendations ?? ""}\nRestrictions: ${report.restrictions ?? "None"}`, 180), 14, 158);
    doc.setFont("helvetica", "bold");
    doc.text(`Digitally signed: ${report.digitalSignature ?? report.assignedDoctorName}`, 14, 205);
    doc.setFont("helvetica", "normal");
    doc.text(`Verify: ${window.location.origin}/verify-medical-report?report=${encodeURIComponent(report.reportNumber ?? "")}&token=${encodeURIComponent(report.verificationToken ?? "")}`, 14, 218, { maxWidth: 180 });
    doc.save(timestampedFilename(report.reportNumber ?? "medical-decision-report", "pdf"));
    showToast("Verified medical report PDF downloaded.", "success");
  }

  return (
    <div className="space-y-5">
      <header className="page-hero">
        <p className="text-sm font-semibold text-primary">Official institutional reports</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">Medical decision report requests</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Request a verified medical report for an authorized university, workplace, insurer, government office, service organization, or legal institution.</p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FilePlus2 className="h-5 w-5 text-primary" />New report request</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit(submit)}>
              <label className="block text-sm font-semibold">Report purpose<Select {...register("purpose")}>{medicalReportPurposes.map((purpose) => <option key={purpose.value} value={purpose.value}>{purpose.label}</option>)}</Select></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold">Institution name<Input {...register("institutionName")} placeholder="Organization receiving the report" />{errors.institutionName && <span className="text-xs text-destructive">{errors.institutionName.message}</span>}</label>
                <label className="block text-sm font-semibold">Institution type<Select {...register("institutionType")}><option>University</option><option>Workplace</option><option>Insurance</option><option>Government Department</option><option>Legal / Court</option><option>Service Institution</option><option>Other</option></Select></label>
              </div>
              <label className="block text-sm font-semibold">Assigned doctor<Select {...register("assignedDoctorName")}><option>Dr. Anjali Perera</option><option>Dr. K. Fernando</option><option>Authorized Medical Officer</option></Select></label>
              <fieldset>
                <legend className="text-sm font-semibold">Records you authorize for review and sharing</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {ehrEvidenceOptions.map((item) => <label key={item} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"><input type="checkbox" value={item} {...register("requestedInformation")} />{item}</label>)}
                </div>
                {errors.requestedInformation && <span className="text-xs text-destructive">{errors.requestedInformation.message}</span>}
              </fieldset>
              <label className="block text-sm font-semibold">Additional details<textarea className="mt-1 min-h-24 w-full rounded-md border border-border bg-white p-3 text-sm text-slate-900 dark:bg-slate-900 dark:text-slate-50" {...register("additionalDetails")} /></label>
              <label className="flex items-start gap-3 rounded-md border border-teal-300 bg-teal-50 p-3 text-sm text-teal-950 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-50">
                <input className="mt-1" type="checkbox" {...register("consentAccepted")} />
                <span><strong>Digital consent:</strong> I authorize the selected EHR information to be reviewed by the assigned clinical team and included only as needed for the named institution and purpose. I understand that all access is audited.</span>
              </label>
              {errors.consentAccepted && <p className="text-xs text-destructive">{errors.consentAccepted.message}</p>}
              <Button className="w-full" disabled={isSubmitting} type="submit"><ShieldCheck className="h-4 w-4" />{isSubmitting ? "Submitting..." : "Submit secure request"}</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-primary" />Request status</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {ownRequests.map((request) => <div key={request.id} className="rounded-md border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-bold text-foreground">{medicalReportPurposes.find((item) => item.value === request.purpose)?.label}</p><p className="text-sm text-muted-foreground">{request.institutionName} · {request.id}</p></div>
                <Badge tone={request.status === "released" ? "success" : request.status === "rejected" ? "danger" : "warning"}>{request.status}</Badge>
              </div>
              <div className="mt-3 space-y-2 border-l-2 border-teal-300 pl-3">
                {request.timeline.slice(0, 4).map((event) => <div key={`${event.action}-${event.timestamp}`} className="text-xs"><p className="font-semibold text-foreground">{event.action}</p><p className="text-muted-foreground">{event.actor} · {new Date(event.timestamp).toLocaleString()}</p></div>)}
              </div>
              {request.status === "released" && <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => downloadReport(request)}><Download className="h-4 w-4" />Download PDF</Button>
                <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</Button>
                <Button variant="outline" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/verify-medical-report?report=${request.reportNumber}&token=${request.verificationToken}`).then(() => showToast("Secure verification link copied.", "success"))}>Share verification</Button>
              </div>}
            </div>)}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-primary" />Privacy and release controls</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table><thead><tr><Th>Stage</Th><Th>Who can act</Th><Th>Patient access</Th></tr></thead><tbody>
            <tr><Td>Request and consent</Td><Td>Patient or guardian</Td><Td>Can edit before submission</Td></tr>
            <tr><Td>Clinical review and draft</Td><Td>Assigned doctor / medical officer</Td><Td>Status only; no draft content</Td></tr>
            <tr><Td>Approval and digital signature</Td><Td>Authorized medical officer / admin reviewer</Td><Td>Status only</Td></tr>
            <tr><Td>Released report</Td><Td>System-controlled release</Td><Td>View, download, print, share verification only</Td></tr>
          </tbody></Table>
        </CardContent>
      </Card>
    </div>
  );
}
