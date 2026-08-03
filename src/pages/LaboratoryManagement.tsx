import { CheckCircle2, FlaskConical, RefreshCcw, Send, ShieldCheck } from "lucide-react";
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
import { enterLaboratoryResult, getLaboratoryOrders, updateLaboratoryOrderStatus, verifyLaboratoryResult, type LaboratoryOrderRecord } from "../services/workflowService";

export function LaboratoryManagement() {
  const { showToast } = useToast();
  const role = useAuthStore((state) => state.role);
  const canVerify = role === "super_admin" || role === "hospital_admin" || role === "pathologist" || role === "lab_manager";
  const [orders, setOrders] = useState<LaboratoryOrderRecord[]>([]);
  const [selected, setSelected] = useState<LaboratoryOrderRecord | null>(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [numericResult, setNumericResult] = useState("");
  const [textResult, setTextResult] = useState("");
  const [unit, setUnit] = useState("");
  const [referenceRange, setReferenceRange] = useState("");
  const [classification, setClassification] = useState<"normal" | "abnormal" | "critical">("normal");
  const [newResultId, setNewResultId] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getLaboratoryOrders({ status: status || undefined });
      setOrders(result.items);
      setSelected((current) => result.items.find((item) => item.id === current?.id) ?? result.items[0] ?? null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to load laboratory orders.", "danger");
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
    return term ? orders.filter((item) => `${item.patient_name} ${item.patient_no} ${item.test_type} ${item.workflow_status}`.toLowerCase().includes(term)) : orders;
  }, [orders, search]);

  async function perform(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      showToast(message, "success");
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Laboratory action failed.", "danger");
    }
  }

  async function saveResult() {
    if (!selected) return;
    if (!numericResult.trim() && !textResult.trim()) {
      showToast("Enter a numeric or text result.", "warning");
      return;
    }
    try {
      const result = await enterLaboratoryResult(selected.id, {
        numericResult: numericResult.trim() ? Number(numericResult) : null,
        textResult: textResult.trim() || null,
        unit: unit.trim() || null,
        referenceRange: referenceRange.trim() || null,
        classification,
      });
      setNewResultId(result.result.id);
      showToast("Laboratory result saved to PostgreSQL.", "success");
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to save result.", "danger");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-950">Laboratory Workflow</h1><p className="text-sm text-muted-foreground">Order receipt, sample processing, results, verification, and doctor release.</p></div><Button variant="outline" onClick={() => void load()}><RefreshCcw className="h-4 w-4" />Refresh</Button></div>
      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><FlaskConical className="h-5 w-5 text-primary" />Laboratory order queue</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid gap-3 md:grid-cols-[1fr_220px]"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patient, test, status..." /><Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{["ordered", "received", "sample_collected", "processing", "result_entered", "verified", "released", "reviewed", "cancelled"].map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</Select></div><div className="overflow-x-auto"><Table><thead><tr><Th>Patient</Th><Th>Test</Th><Th>Priority</Th><Th>Status</Th><Th>Action</Th></tr></thead><tbody>{displayed.map((item) => <tr key={item.id}><Td><strong>{item.patient_name}</strong><br /><span className="text-xs text-muted-foreground">{item.patient_no}</span></Td><Td>{item.test_type}<br /><span className="text-xs text-muted-foreground">{item.specimen || "Specimen not set"}</span></Td><Td><Badge tone={item.priority === "critical" || item.priority === "stat" ? "danger" : item.priority === "urgent" ? "warning" : "info"}>{item.priority}</Badge></Td><Td><StatusBadge status={item.workflow_status} /></Td><Td><div className="flex items-center gap-1.5"><Button variant="outline" className="min-h-8 px-2.5 py-1 text-xs" onClick={() => { setSelected(item); setNewResultId(item.result_id ?? ""); }}>Open</Button><PdfActionButtons kind="laboratory" recordId={item.id} /></div></Td></tr>)}{!loading && displayed.length === 0 && <tr><Td colSpan={5} className="text-center">No laboratory orders found.</Td></tr>}{loading && <tr><Td colSpan={5} className="text-center">Loading laboratory queue...</Td></tr>}</tbody></Table></div></CardContent></Card>

        <Card><CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle>Process selected order</CardTitle><PdfActionButtons kind="laboratory" recordId={selected?.id} /></CardHeader><CardContent className="space-y-4">{!selected ? <p className="text-sm text-muted-foreground">Select an order.</p> : <><div className="grid gap-2 text-sm sm:grid-cols-2"><div><strong>Patient</strong><br />{selected.patient_name}</div><div><strong>Patient ID</strong><br />{selected.patient_no}</div><div><strong>Test</strong><br />{selected.test_type}</div><div><strong>Specimen</strong><br />{selected.specimen || "Not set"}</div><div><strong>Indication</strong><br />{selected.clinical_reason || "Not recorded"}</div><div><strong>Status</strong><br /><StatusBadge status={selected.workflow_status} /></div></div>
          <div className="flex flex-wrap gap-2">{selected.workflow_status === "ordered" && <Button onClick={() => void perform(() => updateLaboratoryOrderStatus(selected.id, "received"), "Order received.")}>Receive</Button>}{selected.workflow_status === "received" && <Button onClick={() => void perform(() => updateLaboratoryOrderStatus(selected.id, "sample_collected"), "Sample collection recorded.")}>Sample collected</Button>}{selected.workflow_status === "sample_collected" && <Button onClick={() => void perform(() => updateLaboratoryOrderStatus(selected.id, "processing"), "Test processing started.")}>Start processing</Button>}</div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm font-semibold text-slate-700">Numeric result<Input type="number" value={numericResult} onChange={(event) => setNumericResult(event.target.value)} /></label><label className="space-y-1 text-sm font-semibold text-slate-700">Unit<Input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="mg/dL" /></label><label className="space-y-1 text-sm font-semibold text-slate-700 sm:col-span-2">Text result<Input value={textResult} onChange={(event) => setTextResult(event.target.value)} /></label><label className="space-y-1 text-sm font-semibold text-slate-700">Reference range<Input value={referenceRange} onChange={(event) => setReferenceRange(event.target.value)} /></label><label className="space-y-1 text-sm font-semibold text-slate-700">Classification<Select value={classification} onChange={(event) => setClassification(event.target.value as typeof classification)}><option value="normal">Normal</option><option value="abnormal">Abnormal</option><option value="critical">Critical</option></Select></label></div>
          <div className="flex flex-wrap gap-2"><Button disabled={!(["sample_collected", "processing", "result_entered"].includes(selected.workflow_status))} onClick={() => void saveResult()}><Send className="h-4 w-4" />Save result</Button>{canVerify && (newResultId || selected.result_id) && <Button onClick={() => void perform(() => verifyLaboratoryResult(newResultId || selected.result_id as string, true), "Result verified and released to Doctor Command Center.")}><ShieldCheck className="h-4 w-4" />Verify and release</Button>}</div>
          {(selected.critical_flag || classification === "critical") && <Badge tone="danger"><CheckCircle2 className="h-3.5 w-3.5" />Critical result alert will be sent to the doctor</Badge>}
        </>}</CardContent></Card>
      </div>
    </div>
  );
}
