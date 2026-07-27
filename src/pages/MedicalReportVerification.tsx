import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BadgeCheck, Search, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { verifyMedicalDecisionReport } from "../services/medicalDecisionReportService";
import type { VerificationResult } from "../services/medicalDecisionReportService";
import { medicalReportPurposes } from "../types/medicalDecisionReport";

export function MedicalReportVerification() {
  const [params] = useSearchParams();
  const initialReport = params.get("report") ?? "";
  const token = params.get("token") ?? "";
  const [reportNumber, setReportNumber] = useState(initialReport || "MDR-2026-000012");
  const [manualResult, setManualResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const automaticVerification = useQuery({
    queryKey: ["medical-report-verification", initialReport, token],
    queryFn: () => verifyMedicalDecisionReport(initialReport, token || undefined),
    enabled: Boolean(initialReport),
  });
  const result = manualResult ?? automaticVerification.data ?? null;

  async function verify() {
    setLoading(true);
    try {
      setManualResult(await verifyMedicalDecisionReport(reportNumber, token || undefined));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-muted px-4 py-10 text-foreground">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="flex items-center gap-3">
          <img className="h-14 w-14 rounded-md bg-white object-contain p-1 shadow-sm" src="/ministry-health-logo.png" alt="Ministry of Health logo" />
          <div><h1 className="text-2xl font-bold">GovCare Medical Report Verification</h1><p className="text-sm text-muted-foreground">Sri Lanka Government Hospital EHR</p></div>
        </header>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Verify an official report</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Enter the report number printed on the document or scan its QR code. This page displays validity information only and never exposes full medical details.</p>
            <label className="block text-sm font-semibold">Report number<Input value={reportNumber} onChange={(event) => setReportNumber(event.target.value)} placeholder="MDR-2026-000000" /></label>
            <Button className="w-full" disabled={loading || automaticVerification.isFetching || !reportNumber.trim()} onClick={verify}><Search className="h-4 w-4" />{loading || automaticVerification.isFetching ? "Verifying..." : "Verify report"}</Button>
          </CardContent>
        </Card>
        {result && <Card className={result.valid ? "border-emerald-300" : "border-rose-300"}>
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              {result.valid ? <BadgeCheck className="h-10 w-10 shrink-0 text-emerald-600" /> : <XCircle className="h-10 w-10 shrink-0 text-rose-600" />}
              <div className="min-w-0"><h2 className="text-xl font-bold">{result.valid ? "Valid GovCare medical report" : "Report not verified"}</h2><p className="text-sm text-muted-foreground">{result.message}</p></div>
            </div>
            {result.valid && <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["Report number", result.reportNumber], ["Patient name", result.patientName],
                ["Purpose", medicalReportPurposes.find((item) => item.value === result.purpose)?.label ?? result.purpose],
                ["Issue date", result.issueDate], ["Expiry date", result.expiryDate || "Not specified"],
                ["Hospital", result.hospital], ["Doctor", result.doctorName],
              ].map(([label, value]) => <div key={label} className="rounded-md border border-border bg-card p-3"><dt className="text-xs font-semibold uppercase text-muted-foreground">{label}</dt><dd className="mt-1 font-bold">{value}</dd></div>)}
            </dl>}
          </CardContent>
        </Card>}
        <p className="text-center text-xs text-muted-foreground">Verification is audit monitored. Contact the issuing hospital if the displayed information differs from the document.</p>
      </div>
    </main>
  );
}
