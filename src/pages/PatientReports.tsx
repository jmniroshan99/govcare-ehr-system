import { Download, FileText, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, Td, Th } from "../components/ui/table";
import { getPatientReportDownloadUrl } from "../services/profileService";
import { downloadBloodReportPdf, getBloodReports, printBloodReportPdf, type BloodReportRecord } from "../services/bloodReportService";
import { useToast } from "../components/ui/toast-context";
import { downloadTextFile, timestampedFilename } from "../utils/download";

const legacyReports = [
  ["rpt-xray-002", "Chest X-ray", "Radiology", "2026-06-08", "approved"],
  ["rpt-discharge-003", "Discharge Summary", "Ward 12", "2026-05-28", "released"],
];

export function PatientReports() {
  const { showToast } = useToast();
  const [bloodReports, setBloodReports] = useState<BloodReportRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const result = await getBloodReports({ status: "RELEASED" });
        setBloodReports(result.items);
      } catch (error) {
        console.warn("Unable to load released CBC reports.", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function downloadLegacyReport(reportId: string, name: string, unit: string, date: string, status: string) {
    try {
      const url = await getPatientReportDownloadUrl(reportId);
      if (url.startsWith("/sample-report-")) {
        downloadTextFile(timestampedFilename(`${reportId}-${name.replaceAll(" ", "-").toLowerCase()}`, "txt"), `GovCare EHR System\nReleased patient report\n\nReport: ${name}\nUnit: ${unit}\nDate: ${date}\nStatus: ${status}\nReport ID: ${reportId}\n\nThis is a secure demo download. Production downloads should use signed Spring Boot file storage URLs.`, "text/plain;charset=utf-8");
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      showToast(`${name} download started.`, "success");
    } catch (error) {
      console.warn("Report download failed; using demo fallback.", error);
      downloadTextFile(timestampedFilename(reportId, "txt"), `GovCare EHR report fallback\nReport ID: ${reportId}\nReport: ${name}`, "text/plain;charset=utf-8");
      showToast("Secure download fallback generated.", "warning");
    }
  }

  async function bloodPdf(report: BloodReportRecord, action: "download" | "print") {
    try {
      if (action === "download") {
        await downloadBloodReportPdf(report.id);
        showToast(`${report.report_number} downloaded.`, "success");
      } else {
        await printBloodReportPdf(report.id);
        showToast("CBC report opened for printing.", "success");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to open CBC report.", "danger");
    }
  }

  return (
    <div className="space-y-5">
      <div className="gov-page-header gov-page-header--text">
        <h1 className="text-2xl font-bold">My reports</h1>
        <p className="text-sm text-muted-foreground">Only verified reports released to your account are visible here. Draft and internal laboratory results remain hidden.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-accent" />Released CBC blood reports</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <thead><tr><Th>Report ID</Th><Th>Test</Th><Th>Collection Date</Th><Th>Status</Th><Th>Action</Th></tr></thead>
            <tbody>
              {bloodReports.map((report) => (
                <tr key={report.id}>
                  <Td className="font-semibold">{report.report_number}</Td>
                  <Td>Complete Blood Count (CBC)</Td>
                  <Td>{report.collected_at ? new Date(report.collected_at).toLocaleString() : "Not recorded"}</Td>
                  <Td>{report.status}</Td>
                  <Td><div className="flex gap-2"><Button variant="outline" onClick={() => void bloodPdf(report, "download")}><Download className="h-4 w-4" />Download</Button><Button variant="outline" onClick={() => void bloodPdf(report, "print")}><Printer className="h-4 w-4" /></Button></div></Td>
                </tr>
              ))}
              {!loading && bloodReports.length === 0 && <tr><Td colSpan={5} className="text-center text-muted-foreground">No released CBC blood reports are available yet.</Td></tr>}
              {loading && <tr><Td colSpan={5} className="text-center text-muted-foreground">Loading released blood reports...</Td></tr>}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-accent" />Other available reports</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <thead><tr><Th>Report</Th><Th>Unit</Th><Th>Date</Th><Th>Status</Th><Th>Action</Th></tr></thead>
            <tbody>
              {legacyReports.map(([id, name, unit, date, status]) => (
                <tr key={id}>
                  <Td className="font-semibold">{name}</Td><Td>{unit}</Td><Td>{date}</Td><Td>{status}</Td>
                  <Td><Button variant="outline" onClick={() => void downloadLegacyReport(id, name, unit, date, status)}><Download className="h-4 w-4" />Download</Button></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
