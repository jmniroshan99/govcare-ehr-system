import { apiRequest } from "./apiClient";

export type DashboardMetric = {
  available: boolean;
  value: number | null;
  reason?: "not_authorized" | "no_source" | "data_error";
};

export type DashboardOverview = {
  hospitalId: string;
  hospitalName: string;
  date: string;
  capturedAt: string;
  metrics: Record<"opdToday" | "activeAdmissions" | "emergencyTriage" | "labPending" | "lowStockMeds" | "criticalAlerts", DashboardMetric>;
  flowAvailable: boolean;
  flowReason: "not_authorized" | "data_error" | null;
  flow: Array<{ hour: number; count: number }>;
  queueAvailable: boolean;
  queueReason: "not_authorized" | "data_error" | null;
  priorityQueue: Array<{
    id: string;
    token: string;
    patient_name?: string;
    unit: string | null;
    status: string;
    priority: string;
    elapsed_minutes: number;
  }>;
};

export type DashboardHospital = { id: string; name: string };

export type IntelligenceDashboardKey =
  | "super_admin"
  | "hospital_admin"
  | "doctor"
  | "nurse"
  | "front_desk"
  | "opd"
  | "ward"
  | "laboratory"
  | "radiology"
  | "pharmacy"
  | "inventory"
  | "finance"
  | "records"
  | "patient"
  | "guardian"
  | "emergency"
  | "quality"
  | "it"
  | "mortuary";

export type IntelligenceMetric = {
  id: string;
  label: string;
  available: boolean;
  value: number | string | null;
  unit: string | null;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
  reason?: string;
  definition: string;
};

export type IntelligenceSeries = { key: string; label: string; color: string };

export type IntelligenceChart = {
  id: string;
  title: string;
  type: "bar" | "line" | "area" | "donut" | "heatmap" | "timeline";
  xKey: string;
  available: boolean;
  reason?: string;
  description: string;
  series: IntelligenceSeries[];
  data: Array<Record<string, unknown>>;
  unavailableSeries: string[];
};

export type IntelligenceWorklist = {
  id: string;
  title: string;
  available: boolean;
  reason?: string;
  description: string;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, unknown>>;
};

export type IntelligenceDashboard = {
  schemaVersion: number;
  dashboardKey: IntelligenceDashboardKey;
  role: string;
  title: string;
  subtitle: string;
  date: string;
  capturedAt: string;
  refreshAfterSeconds: number;
  scope: { level: "network" | "hospital" | "patient"; hospitalId: string | null; hospitalName: string };
  metrics: IntelligenceMetric[];
  charts: IntelligenceChart[];
  worklists: IntelligenceWorklist[];
  alerts: Array<{ id: string; severity: "info" | "warning" | "danger"; message: string; source: string }>;
  unavailableCapabilities: Array<{ id: string; label: string; reason: string }>;
};

export function getDashboardOverview(hospitalId?: string, signal?: AbortSignal) {
  const query = hospitalId ? `?hospitalId=${encodeURIComponent(hospitalId)}` : "";
  return apiRequest<DashboardOverview>(`/api/dashboard/overview${query}`, { signal });
}

export function getIntelligenceDashboard(hospitalId?: string, signal?: AbortSignal) {
  const query = hospitalId ? `?hospitalId=${encodeURIComponent(hospitalId)}` : "";
  return apiRequest<IntelligenceDashboard>(`/api/dashboard/intelligence${query}`, { signal });
}

export async function searchDashboardHospitals(query: string, signal?: AbortSignal) {
  const result = await apiRequest<{ items: DashboardHospital[] }>(
    `/api/hospitals/search?q=${encodeURIComponent(query)}&limit=50`, { signal },
  );
  return result.items;
}
