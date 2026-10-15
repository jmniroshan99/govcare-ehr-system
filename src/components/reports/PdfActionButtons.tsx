import { Download, LoaderCircle, Printer } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { useToast } from "../ui/toast-context";
import { downloadPdfReport, printPdfReport, type PdfReportKind } from "../../services/pdfReportService";

type PdfActionButtonsProps = {
  kind: PdfReportKind;
  recordId?: string | null;
  compact?: boolean;
  className?: string;
};

export function PdfActionButtons({ kind, recordId, compact = true, className = "" }: PdfActionButtonsProps) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState<"download" | "print" | null>(null);
  const disabled = !recordId || busy !== null;

  async function run(action: "download" | "print") {
    if (!recordId || busy) return;
    setBusy(action);
    try {
      if (action === "download") {
        const filename = await downloadPdfReport(kind, recordId);
        showToast(`${filename} downloaded.`, "success");
      } else {
        await printPdfReport(kind, recordId);
        showToast("PDF opened for printing.", "success");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to generate the PDF report.", "danger");
    } finally {
      setBusy(null);
    }
  }

  const buttonClass = compact ? "min-h-8 px-2.5 py-1 text-xs" : undefined;
  return (
    <div className={`flex items-center gap-1.5 ${className}`.trim()}>
      <Button
        type="button"
        variant="outline"
        className={buttonClass}
        disabled={disabled}
        onClick={() => void run("download")}
        title="Download PDF"
        aria-label="Download PDF"
      >
        {busy === "download" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        PDF
      </Button>
      <Button
        type="button"
        variant="outline"
        className={compact ? "min-h-8 w-8 px-0 py-1" : undefined}
        disabled={disabled}
        onClick={() => void run("print")}
        title="Print PDF"
        aria-label="Print PDF"
      >
        {busy === "print" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
