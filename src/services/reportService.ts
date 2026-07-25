import type { ReportCategory } from "../data/adminReports";
import { queueOfflineCallable } from "./offlineQueue";

export interface ReportFilters {
  category: ReportCategory;
  from: string;
  to: string;
  hospitalId: string;
  department: string;
  staff: string;
  patientId: string;
  nic: string;
  gender: string;
  ageGroup: string;
  diagnosis: string;
  status: string;
  ward: string;
  medicine: string;
  testType: string;
  priority: string;
}

export async function createAdminReportJob(filters: ReportFilters, format: "pdf" | "csv" | "print" | "view") {
  const clientRequestId = crypto.randomUUID();
  const payload = { filters, format, clientRequestId };
  if (!navigator.onLine) {
    if (format !== "view") {
      await queueOfflineCallable({ callableName: "generateAdminReport", payload, label: `${format.toUpperCase()} report`, dedupeKey: `admin-report:${clientRequestId}` });
    }
    return { reportId: `offline-${clientRequestId}`, status: format === "view" ? "cached" : "queued" };
  }
  return { reportId: `api-${clientRequestId}`, status: format === "view" ? "ready" : "queued" };
}
