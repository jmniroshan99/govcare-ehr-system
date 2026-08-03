import { CheckCircle2, Image, RefreshCcw, Send, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, StatusBadge } from "../components/ui/badge";
import { PdfActionButtons } from "../components/reports/PdfActionButtons";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import { useAuthStore } from "../stores/authStore";
import { enterRadiologyReport, getRadiologyOrders, updateRadiologyOrderStatus, verifyRadiologyReport, type RadiologyOrderRecord } from "../services/workflowService";

const textareaClass = "min-h-28 w-full rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-teal-600/20";

export function RadiologyManagement() {
  const { showToast } = useToast();
  const role = useAuthStore((state) => state.role);
  const canVerify = role === "super_admin" || role === "hospital_admin" || role === "radiologist";
  const [orders, setOrders] = useState<RadiologyOrderRecord[]>([]);
  const [selected, setSelected] = useState<RadiologyOrderRecord | null>(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [findings, setFindings] = useState("");
  const [impression, setImpression] = useState("");
  const [classification, setClassification] = useState<"normal" | "abnormal" | "critical">("normal");
  const [newReportId, setNewReportId] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getRadiologyOrders({ status: status || undefined });
      setOrders(result.items);
      setSelected((current) => result.items.find((item) => item.id === current?.id) ?? result.items[0] ?? null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to load radiology orders.", "danger");
    } finally {
      setLoading(false);
    }
  }, [showToast, status]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 12000);
    return () => window.clearInterval(timer);
  }, [load]);

  const displayed = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? orders.filter((item) => `${item.patient_name} ${item.patient_no} ${item.imaging_type} ${item.body_area ?? ""}`.toLowerCase().includes(term)) : orders;
  }, [orders, search]);

  async function perform(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      showToast(message, "success");
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Radiology action failed.", "danger");
    }
  }

  async function saveReport() {
    if (!selected || !findings.trim() || !impression.trim()) {
      showToast("Findings and impression are required.", "warning");
      return;
    }
    try {
      const result = await enterRadiologyReport(selected.id, { findings: findings.trim(), impression: impression.trim(), classification });
      setNewReportId(result.report.id);
      showToast("Radiology report saved to PostgreSQL.", "success");
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to save radiology report.", "danger");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-950">Radiology Workflow</h1><p className="text-sm text-muted-foreground">Scheduling, imaging, report drafting, verification, release, and doctor review.</p></div><Button variant="outline" onClick={() => void load()}><RefreshCcw className="h-4 w-4" />Refresh</Button></div>
      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Image className="h-5 w-5 text-primary" />Radiology order queue</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid gap-3 md:grid-cols-[1fr_220px]"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patient, study, body area..." /><Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{["ordered", "scheduled", "patient_arrived", "imaging_in_progress", "completed", "report_drafted", "report_verified", "released", "reviewed", "cancelled"].map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</Select></div><div className="overflow-x-auto"><Table><thead><tr><Th>Patient</Th><Th>Study</Th><Th>Priority</Th><Th>Status</Th><Th>Action</Th></tr></thead><tbody>{displayed.map((item) => <tr key={item.id}><Td><strong>{item.patient_name}</strong><br /><span className="text-xs text-muted-foreground">{item.patient_no}</span></Td><Td>{item.imaging_type}<br /><span className="text-xs text-muted-foreground">{item.body_area || "Body area not set"}</span></Td><Td><Badge tone={item.priority === "critical" || item.priority === "stat" ? "danger" : item.priority === "urgent" ? "warning" : "info"}>{item.priority}</Badge></Td><Td><StatusBadge status={item.workflow_status} /></Td><Td><div className="flex items-center gap-1.5"><Button variant="outline" className="min-h-8 px-2.5 py-1 text-xs" onClick={() => { setSelected(item); setFindings(item.findings ?? ""); setImpression(item.impression ?? ""); setNewReportId(item.report_id ?? ""); }}>Open</Button><PdfActionButtons kind="radiology" recordId={item.id} /></div></Td></tr>)}{!loading && displayed.length === 0 && <tr><Td colSpan={5} className="text-center">No radiology orders found.</Td></tr>}{loading && <tr><Td colSpan={5} className="text-center">Loading radiology queue...</Td></tr>}</tbody></Table></div></CardContent></Card>

        <Card><CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle>Process selected study</CardTitle><PdfActionButtons kind="radiology" recordId={selected?.id} /></CardHeader><CardContent className="space-y-4">{!selected ? <p className="text-sm text-muted-foreground">Select an imaging order.</p> : <><div className="grid gap-2 text-sm sm:grid-cols-2"><div><strong>Patient</strong><br />{selected.patient_name}</div><div><strong>Patient ID</strong><br />{selected.patient_no}</div><div><strong>Study</strong><br />{selected.imaging_type} · {selected.body_area || "N/A"}</div><div><strong>Status</strong><br /><StatusBadge status={selected.workflow_status} /></div><div><strong>Clinical indication</strong><br />{selected.clinical_reason || "Not recorded"}</div><div><strong>Warnings</strong><br />{selected.pregnancy_warning ? "Pregnancy warning" : "None"}{selected.contrast_required ? " · Contrast required" : ""}</div></div>
          <div className="flex flex-wrap gap-2">{selected.workflow_status === "ordered" && <Button onClick={() => void perform(() => updateRadiologyOrderStatus(selected.id, "scheduled", { scheduledAt: new Date().toISOString() }), "Imaging scheduled.")}>Schedule</Button>}{selected.workflow_status === "scheduled" && <Button onClick={() => void perform(() => updateRadiologyOrderStatus(selected.id, "patient_arrived"), "Patient arrival recorded.")}>Patient arrived</Button>}{selected.workflow_status === "patient_arrived" && <Button onClick={() => void perform(() => updateRadiologyOrderStatus(selected.id, "imaging_in_progress"), "Imaging started.")}>Start imaging</Button>}{selected.workflow_status === "imaging_in_progress" && <Button onClick={() => void perform(() => updateRadiologyOrderStatus(selected.id, "completed"), "Imaging completed.")}>Complete imaging</Button>}</div>
          <label className="block space-y-1 text-sm font-semibold text-slate-700">Findings<textarea className={textareaClass} value={findings} onChange={(event) => setFindings(event.target.value)} /></label><label className="block space-y-1 text-sm font-semibold text-slate-700">Impression<textarea className={textareaClass} value={impression} onChange={(event) => setImpression(event.target.value)} /></label><label className="block space-y-1 text-sm font-semibold text-slate-700">Classification<Select value={classification} onChange={(event) => setClassification(event.target.value as typeof classification)}><option value="normal">Normal</option><option value="abnormal">Abnormal</option><option value="critical">Critical</option></Select></label>
          <div className="flex flex-wrap gap-2"><Button disabled={!(["completed", "report_drafted"].includes(selected.workflow_status))} onClick={() => void saveReport()}><Send className="h-4 w-4" />Save report</Button>{canVerify && (newReportId || selected.report_id) && <Button onClick={() => void perform(() => verifyRadiologyReport(newReportId || selected.report_id as string, true), "Report verified and released to Doctor Command Center.")}><ShieldCheck className="h-4 w-4" />Verify and release</Button>}</div>
          {classification === "critical" && <Badge tone="danger"><CheckCircle2 className="h-3.5 w-3.5" />Critical report alert will be sent to the doctor</Badge>}
        </>}</CardContent></Card>
      </div>
    </div>
  );
}
