import { Download, FileText } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, Td, Th } from "../components/ui/table";
import { getPatientReportDownloadUrl } from "../services/profileService";
import { useToast } from "../components/ui/toast-context";
import { downloadTextFile, timestampedFilename } from "../utils/download";

const reports = [
  ["rpt-fbc-001", "Full Blood Count", "Laboratory", "2026-06-10", "released"],
  ["rpt-xray-002", "Chest X-ray", "Radiology", "2026-06-08", "approved"],
  ["rpt-discharge-003", "Discharge Summary", "Ward 12", "2026-05-28", "released"],
];

export function PatientReports() {
  const { showToast } = useToast();

  async function downloadReport(reportId: string, name: string, unit: string, date: string, status: string) {
    try {
      const url = await getPatientReportDownloadUrl(reportId);
      if (url.startsWith("/sample-report-")) {
        downloadTextFile(timestampedFilename(`${reportId}-${name.replaceAll(" ", "-").toLowerCase()}`, "txt"), `GovCare EHR System\nReleased patient report\n\nReport: ${name}\nUnit: ${unit}\nDate: ${date}\nStatus: ${status}\nReport ID: ${reportId}\n\nThis is a secure demo download. Production downloads should use signed Firebase Storage URLs.`, "text/plain;charset=utf-8");
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">My reports</h1>
        <p className="text-sm text-muted-foreground">Only doctor/lab-approved reports released to your account are visible here. Internal notes and unapproved results are hidden.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Available reports</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <thead><tr><Th>Report</Th><Th>Unit</Th><Th>Date</Th><Th>Status</Th><Th>Action</Th></tr></thead>
            <tbody>
              {reports.map(([id, name, unit, date, status]) => (
                <tr key={id}>
                  <Td className="font-semibold">{name}</Td>
                  <Td>{unit}</Td>
                  <Td>{date}</Td>
                  <Td>{status}</Td>
                  <Td><Button variant="outline" onClick={() => downloadReport(id, name, unit, date, status)}><Download className="h-4 w-4" />Download</Button></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
