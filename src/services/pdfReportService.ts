import { apiDownload } from "./apiClient";

export type PdfReportKind = "pharmacy" | "laboratory" | "radiology" | "consultations" | "patients";

function reportPath(kind: PdfReportKind, id: string): string {
  return `/api/pdf/${kind}/${encodeURIComponent(id)}`;
}

export async function downloadPdfReport(kind: PdfReportKind, id: string): Promise<string> {
  const { blob, filename } = await apiDownload(reportPath(kind, id));
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return filename;
}

export async function printPdfReport(kind: PdfReportKind, id: string): Promise<void> {
  const { blob } = await apiDownload(reportPath(kind, id));
  const url = URL.createObjectURL(blob);
  const printFrame = document.createElement("iframe");
  printFrame.style.position = "fixed";
  printFrame.style.right = "0";
  printFrame.style.bottom = "0";
  printFrame.style.width = "1px";
  printFrame.style.height = "1px";
  printFrame.style.border = "0";
  printFrame.setAttribute("aria-hidden", "true");
  printFrame.src = url;
  document.body.appendChild(printFrame);
  printFrame.onload = () => {
    window.setTimeout(() => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      window.setTimeout(() => {
        printFrame.remove();
        URL.revokeObjectURL(url);
      }, 60_000);
    }, 300);
  };
}
