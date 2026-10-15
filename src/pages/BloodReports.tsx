import {
  CheckCircle2,
  Download,
  FilePlus2,
  FlaskConical,
  Printer,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import {
  completeBloodReport,
  createBloodReport,
  downloadBloodReportPdf,
  getBloodReport,
  getBloodReports,
  getCbcReferenceRanges,
  printBloodReportPdf,
  releaseBloodReport,
  updateBloodReport,
  verifyBloodReport,
  type BloodReportRecord,
  type CbcReferenceRange,
} from "../services/bloodReportService";
import { getLaboratoryOrders, type LaboratoryOrderRecord } from "../services/workflowService";
import { searchPatientRecords, type PatientRecord } from "../services/patientService";
import { useAuthStore } from "../stores/authStore";

const ABS_SOURCES: Record<string, string> = {
  ABS_NEUT: "NEUT_PCT",
  ABS_LYMPH: "LYMPH_PCT",
  ABS_EOS: "EOS_PCT",
  ABS_MONO: "MONO_PCT",
  ABS_BASO: "BASO_PCT",
};

function toIso(value: string) {
  if (!value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toISOString();
}

function toInputDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function isCbcOrder(order: LaboratoryOrderRecord) {
  const haystack = `${order.test_type ?? ""} ${order.test_code ?? ""}`.toLowerCase();
  return haystack.includes("cbc") || haystack.includes("fbc") || haystack.includes("complete blood") || haystack.includes("full blood");
}

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function flagFor(value: number | null, range: CbcReferenceRange) {
  if (value === null) return "";
  if ((range.critical_min != null && value < Number(range.critical_min)) || (range.critical_max != null && value > Number(range.critical_max))) return "C";
  if (range.min_value != null && value < Number(range.min_value)) return "L";
  if (range.max_value != null && value > Number(range.max_value)) return "H";
  return "N";
}

function statusTone(status: BloodReportRecord["status"]): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "RELEASED") return "success";
  if (status === "VERIFIED") return "info";
  if (status === "COMPLETED") return "warning";
  if (status === "CANCELLED") return "danger";
  return "neutral";
}

export function BloodReports() {
  const { showToast } = useToast();
  const role = useAuthStore((state) => state.role);
  const profile = useAuthStore((state) => state.profile);
  const canEnter = ["super_admin", "lab_technician", "lab_manager", "pathologist"].includes(role ?? "");
  const canVerify = ["super_admin", "lab_manager", "pathologist"].includes(role ?? "");
  const canRelease = ["super_admin", "lab_manager", "pathologist"].includes(role ?? "");
  const canPdf = Boolean(role === "super_admin" || profile?.permissions?.includes("*") || profile?.permissions?.includes("REPORT_DOWNLOAD"));

  const [reports, setReports] = useState<BloodReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedReport, setSelectedReport] = useState<BloodReportRecord | null>(null);
  const [newMode, setNewMode] = useState(false);

  const [patientSearch, setPatientSearch] = useState("");
  const [patientOptions, setPatientOptions] = useState<PatientRecord[]>([]);
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [patientSearching, setPatientSearching] = useState(false);
  const [orders, setOrders] = useState<LaboratoryOrderRecord[]>([]);
  const [labRequestId, setLabRequestId] = useState("");
  const [ranges, setRanges] = useState<CbcReferenceRange[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [manualOverrides, setManualOverrides] = useState<Record<string, boolean>>({});
  const [specimenType, setSpecimenType] = useState("EDTA Whole Blood");
  const [sampleNumber, setSampleNumber] = useState("");
  const [collectedAt, setCollectedAt] = useState("");
  const [receivedAt, setReceivedAt] = useState("");
  const [interpretation, setInterpretation] = useState("");
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<"download" | "print" | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getBloodReports({ search, status: statusFilter, from, to });
      setReports(result.items);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to load blood reports.", "danger");
    } finally {
      setLoading(false);
    }
  }, [from, search, showToast, statusFilter, to]);

  useEffect(() => { void loadReports(); }, [loadReports]);

  useEffect(() => {
    const term = patientSearch.trim();
    if (term.length < 2 || patient?.full_name === term) return;
    const timer = window.setTimeout(async () => {
      setPatientSearching(true);
      try {
        const result = await searchPatientRecords(term);
        setPatientOptions(result.items.slice(0, 12));
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Unable to search patients.", "danger");
      } finally {
        setPatientSearching(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [patient?.full_name, patientSearch, showToast]);

  const effectiveValue = useCallback((code: string) => {
    if (ABS_SOURCES[code] && !manualOverrides[code]) {
      const wbc = numberOrNull(values.WBC ?? "");
      const pct = numberOrNull(values[ABS_SOURCES[code]] ?? "");
      if (wbc == null || pct == null) return "";
      return (wbc * pct / 100).toFixed(2);
    }
    return values[code] ?? "";
  }, [manualOverrides, values]);

  const groupedRanges = useMemo(() => {
    const groups = new Map<string, CbcReferenceRange[]>();
    [...ranges].sort((a, b) => a.display_order - b.display_order).forEach((range) => {
      const list = groups.get(range.category) ?? [];
      list.push(range);
      groups.set(range.category, list);
    });
    return [...groups.entries()];
  }, [ranges]);

  async function choosePatient(next: PatientRecord) {
    setPatient(next);
    setPatientSearch(next.full_name);
    setPatientOptions([]);
    setValues({});
    setManualOverrides({});
    try {
      const [rangeResult, orderResult] = await Promise.all([
        getCbcReferenceRanges(next.id),
        getLaboratoryOrders({ patientUuid: next.id }),
      ]);
      setRanges(rangeResult.items);
      const cbcOrders = orderResult.items.filter((order) => isCbcOrder(order) && !["released", "reviewed", "cancelled"].includes(order.workflow_status));
      setOrders(cbcOrders);
      setLabRequestId(cbcOrders[0]?.id ?? "");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to load CBC configuration.", "danger");
    }
  }

  function resetEditor() {
    setSelectedReport(null);
    setNewMode(true);
    setPatient(null);
    setPatientSearch("");
    setPatientOptions([]);
    setOrders([]);
    setLabRequestId("");
    setRanges([]);
    setValues({});
    setManualOverrides({});
    setSpecimenType("EDTA Whole Blood");
    setSampleNumber("");
    setCollectedAt("");
    setReceivedAt("");
    setInterpretation("");
  }

  async function openReport(id: string) {
    setNewMode(false);
    try {
      const result = await getBloodReport(id);
      const report = result.report;
      setSelectedReport(report);
      const reportRanges: CbcReferenceRange[] = (report.results ?? []).map((row) => ({
        id: row.id ?? row.test_code,
        test_code: row.test_code,
        test_name: row.test_name,
        category: row.category,
        min_value: row.min_reference,
        max_value: row.max_reference,
        critical_min: row.critical_min,
        critical_max: row.critical_max,
        unit: row.unit,
        display_order: row.display_order,
      }));
      setRanges(reportRanges);
      setValues(Object.fromEntries((report.results ?? []).map((row) => [row.test_code, row.result_value == null ? "" : String(row.result_value)])));
      setManualOverrides(Object.fromEntries((report.results ?? []).filter((row) => row.manually_overridden).map((row) => [row.test_code, true])));
      setPatient({ id: report.patient_id, hospital_id: "", patient_no: report.patient_no, full_name: report.patient_name, date_of_birth: report.date_of_birth ?? "", age_years: report.age_years, gender: report.gender } as PatientRecord);
      setPatientSearch(report.patient_name);
      setLabRequestId(report.lab_request_id ?? "");
      setOrders([]);
      setSpecimenType(report.specimen_type || "EDTA Whole Blood");
      setSampleNumber(report.sample_number ?? "");
      setCollectedAt(toInputDate(report.collected_at));
      setReceivedAt(toInputDate(report.received_at));
      setInterpretation(report.interpretation ?? "");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to open blood report.", "danger");
    }
  }

  function payloadResults() {
    return ranges.map((range) => ({
      testCode: range.test_code,
      value: numberOrNull(effectiveValue(range.test_code)),
      manuallyOverridden: Boolean(manualOverrides[range.test_code]),
    }));
  }

  async function save() {
    if (!patient) { showToast("Select a patient first.", "warning"); return; }
    if (!ranges.length) { showToast("CBC reference ranges are not loaded.", "warning"); return; }
    setSaving(true);
    try {
      const common = {
        labRequestUuid: labRequestId || null,
        specimenType,
        sampleNumber: sampleNumber || null,
        collectedAt: toIso(collectedAt),
        receivedAt: toIso(receivedAt),
        interpretation: interpretation || null,
        results: payloadResults(),
      };
      const result = selectedReport
        ? await updateBloodReport(selectedReport.id, common)
        : await createBloodReport({ patientUuid: patient.id, ...common });
      setSelectedReport(result.report);
      setNewMode(false);
      setSampleNumber(result.report.sample_number ?? sampleNumber);
      showToast(selectedReport ? "CBC blood report updated." : `CBC report ${result.report.report_number} created.`, "success");
      await loadReports();
      await openReport(result.report.id);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to save CBC report.", "danger");
    } finally {
      setSaving(false);
    }
  }

  async function workflowAction(action: "complete" | "verify" | "release") {
    if (!selectedReport) return;
    try {
      const result = action === "complete" ? await completeBloodReport(selectedReport.id)
        : action === "verify" ? await verifyBloodReport(selectedReport.id)
          : await releaseBloodReport(selectedReport.id);
      setSelectedReport(result.report);
      showToast(action === "complete" ? "CBC report marked completed." : action === "verify" ? "CBC report verified." : "CBC report released to authorized clinical/patient views.", "success");
      await loadReports();
      await openReport(selectedReport.id);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Blood report workflow action failed.", "danger");
    }
  }

  async function pdf(action: "download" | "print") {
    if (!selectedReport || pdfBusy) return;
    setPdfBusy(action);
    try {
      if (action === "download") {
        const filename = await downloadBloodReportPdf(selectedReport.id);
        showToast(`${filename} downloaded.`, "success");
      } else {
        await printBloodReportPdf(selectedReport.id);
        showToast("CBC report opened for printing.", "success");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to generate the CBC report PDF.", "danger");
    } finally {
      setPdfBusy(null);
    }
  }

  const editable = canEnter && (!selectedReport || ["DRAFT", "COMPLETED"].includes(selectedReport.status));

  return (
    <div className="space-y-5">
      <div className="gov-page-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground dark:text-foreground">Blood Reports</h1>
          <p className="text-sm text-muted-foreground">Structured haematology / Complete Blood Count reports with reference ranges, flags, verification and A4 PDF output.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/laboratory"><Button variant="outline"><FlaskConical className="h-4 w-4" />Lab Workflow</Button></Link>
          {canEnter && <Button onClick={resetEditor}><FilePlus2 className="h-4 w-4" />New Blood Report</Button>}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Blood report register</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_180px_170px_170px_auto]">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search report, patient, NIC, phone..." />
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {['DRAFT','COMPLETED','VERIFIED','RELEASED','CANCELLED'].map((item) => <option key={item}>{item}</option>)}
            </Select>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From date" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To date" />
            <Button variant="outline" onClick={() => void loadReports()}><RefreshCcw className="h-4 w-4" />Refresh</Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <thead><tr><Th>Report ID</Th><Th>Patient</Th><Th>Collection</Th><Th>Status</Th><Th>Technician</Th><Th>Verified By</Th><Th>Action</Th></tr></thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <Td className="font-semibold">{report.report_number}</Td>
                    <Td><strong>{report.patient_name}</strong><br /><span className="text-xs text-muted-foreground">{report.patient_no}</span></Td>
                    <Td>{report.collected_at ? new Date(report.collected_at).toLocaleString() : "Not collected"}</Td>
                    <Td><Badge tone={statusTone(report.status)}>{report.status}</Badge></Td>
                    <Td>{report.technician_name ?? "-"}</Td>
                    <Td>{report.verified_by_name ?? "-"}</Td>
                    <Td><Button variant="outline" className="min-h-8 px-2.5 py-1 text-xs" onClick={() => void openReport(report.id)}>Open</Button></Td>
                  </tr>
                ))}
                {!loading && reports.length === 0 && <tr><Td colSpan={7} className="text-center">No blood reports found.</Td></tr>}
                {loading && <tr><Td colSpan={7} className="text-center">Loading blood reports...</Td></tr>}
              </tbody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {(newMode || selectedReport) && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>{selectedReport ? `${selectedReport.report_number} — Complete Blood Count` : "New Complete Blood Count (CBC)"}</CardTitle>
              {selectedReport && <div className="mt-2"><Badge tone={statusTone(selectedReport.status)}>{selectedReport.status}</Badge></div>}
            </div>
            {selectedReport && canPdf && <div className="flex gap-2">
              <Button variant="outline" disabled={pdfBusy !== null} onClick={() => void pdf("download")}><Download className="h-4 w-4" />PDF</Button>
              <Button variant="outline" disabled={pdfBusy !== null} onClick={() => void pdf("print")}><Printer className="h-4 w-4" />Print</Button>
            </div>}
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl border border-border bg-muted p-4">
              <h3 className="mb-3 font-bold">Patient & specimen information</h3>
              {!selectedReport && <div className="relative mb-3">
                <label className="mb-1 block text-sm font-semibold">Patient search</label>
                <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={patientSearch} onChange={(e) => { setPatientSearch(e.target.value); setPatient(null); }} placeholder="Patient ID, NIC, name or phone" /></div>
                {(patientOptions.length > 0 || patientSearching) && <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-background p-1 shadow-xl">
                  {patientSearching && <p className="p-2 text-sm text-muted-foreground">Searching...</p>}
                  {patientOptions.map((item) => <button type="button" key={item.id} onClick={() => void choosePatient(item)} className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"><strong>{item.full_name}</strong><br /><span className="text-xs text-muted-foreground">{item.patient_no} · {item.nic || item.phone || "No identifier"}</span></button>)}
                </div>}
              </div>}

              {patient && <div className="mb-4 grid gap-2 rounded-lg border border-info-border bg-info-surface p-3 text-sm text-info dark:border-info-border dark:bg-info-surface dark:text-info sm:grid-cols-3">
                <div><strong>Patient</strong><br />{patient.full_name}</div><div><strong>Patient ID</strong><br />{patient.patient_no}</div><div><strong>Age / Gender</strong><br />{patient.age_years ?? "-"} / {patient.gender ?? "-"}</div>
              </div>}

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <label className="space-y-1 text-sm font-semibold">CBC Lab Request<Select disabled={!editable || Boolean(selectedReport)} value={labRequestId} onChange={(e) => setLabRequestId(e.target.value)}><option value="">No linked lab request</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.test_type} · {order.workflow_status}</option>)}</Select></label>
                <label className="space-y-1 text-sm font-semibold">Specimen Type<Input disabled={!editable} value={specimenType} onChange={(e) => setSpecimenType(e.target.value)} /></label>
                <label className="space-y-1 text-sm font-semibold">Sample Number<Input disabled={!editable} value={sampleNumber} onChange={(e) => setSampleNumber(e.target.value)} placeholder="Auto-generated if blank" /></label>
                <label className="space-y-1 text-sm font-semibold">Collection Date & Time<Input disabled={!editable} type="datetime-local" value={collectedAt} onChange={(e) => setCollectedAt(e.target.value)} /></label>
                <label className="space-y-1 text-sm font-semibold">Received Date & Time<Input disabled={!editable} type="datetime-local" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} /></label>
                {selectedReport && <div className="text-sm"><strong>Referred By</strong><br />{selectedReport.referred_by ?? "Not recorded"}<br /><span className="text-xs text-muted-foreground">{selectedReport.ward_name ? `${selectedReport.ward_name} / ${selectedReport.bed_code ?? "No bed"}` : "OPD / outpatient"}</span></div>}
              </div>
            </div>

            {patient && ranges.length > 0 && <div className="overflow-x-auto rounded-xl border border-border">
              <div className="bg-surface px-4 py-3 text-center text-foreground"><p className="text-sm font-bold">HAEMATOLOGY</p><p className="text-base font-bold">COMPLETE BLOOD COUNT (CBC)</p></div>
              <Table>
                <thead><tr><Th>Test Description</Th><Th>Result</Th><Th>Ref. Range</Th><Th>Unit</Th><Th>Flag</Th></tr></thead>
                <tbody>
                  {groupedRanges.map(([category, categoryRanges]) => (
                    <FragmentRows key={category} category={category} ranges={categoryRanges} editable={editable} values={values} setValues={setValues} manualOverrides={manualOverrides} setManualOverrides={setManualOverrides} effectiveValue={effectiveValue} />
                  ))}
                </tbody>
              </Table>
            </div>}

            <label className="block space-y-1 text-sm font-semibold">Interpretation / Remarks
              <textarea disabled={!editable} value={interpretation} onChange={(e) => setInterpretation(e.target.value)} rows={4} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-disabled" placeholder="Clinical correlation / laboratory remarks. Do not enter an automated diagnosis." />
            </label>

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              {editable && <Button disabled={saving} onClick={() => void save()}><Save className="h-4 w-4" />{saving ? "Saving..." : "Save Report"}</Button>}
              {selectedReport?.status === "DRAFT" && canEnter && <Button variant="outline" onClick={() => void workflowAction("complete")}><CheckCircle2 className="h-4 w-4" />Complete</Button>}
              {selectedReport?.status === "COMPLETED" && canVerify && <Button onClick={() => void workflowAction("verify")}><ShieldCheck className="h-4 w-4" />Verify</Button>}
              {selectedReport?.status === "VERIFIED" && canRelease && <Button onClick={() => void workflowAction("release")}><ShieldCheck className="h-4 w-4" />Release</Button>}
              {selectedReport?.status === "RELEASED" && <Badge tone="success"><CheckCircle2 className="h-3.5 w-3.5" />Released — read only</Badge>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type FragmentRowsProps = {
  category: string;
  ranges: CbcReferenceRange[];
  editable: boolean;
  values: Record<string, string>;
  setValues: Dispatch<SetStateAction<Record<string, string>>>;
  manualOverrides: Record<string, boolean>;
  setManualOverrides: Dispatch<SetStateAction<Record<string, boolean>>>;
  effectiveValue: (code: string) => string;
};

function FragmentRows({ category, ranges, editable, values, setValues, manualOverrides, setManualOverrides, effectiveValue }: FragmentRowsProps) {
  return <>
    <tr><Td colSpan={5} className="bg-muted font-bold">{category}</Td></tr>
    {ranges.map((range) => {
      const absolute = Boolean(ABS_SOURCES[range.test_code]);
      const valueText = effectiveValue(range.test_code);
      const numeric = numberOrNull(valueText);
      const flag = flagFor(numeric, range);
      const abnormal = flag === "L" || flag === "H" || flag === "C";
      return <tr key={range.test_code}>
        <Td><strong>{range.test_name}</strong>{absolute && <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground"><label className="inline-flex items-center gap-1"><input type="checkbox" disabled={!editable} checked={Boolean(manualOverrides[range.test_code])} onChange={(e) => setManualOverrides((current) => ({ ...current, [range.test_code]: e.target.checked }))} />Manual override</label>{!manualOverrides[range.test_code] && <span>Auto-calculated</span>}</div>}</Td>
        <Td><Input aria-label={`${range.test_name} result`} type="number" step="any" disabled={!editable || (absolute && !manualOverrides[range.test_code])} value={absolute && !manualOverrides[range.test_code] ? valueText : values[range.test_code] ?? ""} onChange={(e) => setValues((current) => ({ ...current, [range.test_code]: e.target.value }))} className={abnormal ? "font-bold" : ""} /></Td>
        <Td>{range.min_value == null && range.max_value == null ? "-" : `${range.min_value ?? ""} - ${range.max_value ?? ""}`}</Td>
        <Td>{range.unit ?? ""}</Td>
        <Td><Badge tone={flag === "C" ? "danger" : abnormal ? "warning" : flag === "N" ? "success" : "neutral"}>{flag === "L" ? "↓ L" : flag === "H" ? "↑ H" : flag === "C" ? "! C" : flag || "-"}</Badge></Td>
      </tr>;
    })}
  </>;
}
