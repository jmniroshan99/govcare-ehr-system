import { BellRing, CheckCircle2, Clock3, QrCode, RefreshCcw, RotateCcw, ScanBarcode, Search, Stethoscope, UserRoundX } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PatientCodeScanner } from "../components/patient/PatientCodeScanner";
import { PatientPhoto } from "../components/patient/PatientPhoto";
import { Badge, StatusBadge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import { useAuthStore } from "../stores/authStore";
import { createDoctorQueueEntry, getDoctorQueue, type DoctorQueueRecord } from "../services/doctorQueueService";
import {
  assignQueueDoctor,
  callQueuePatient,
  getAppointmentReference,
  markQueueNoShow,
  recallQueuePatient,
  returnQueueToWaiting,
  type AppointmentReference,
} from "../services/workflowService";

const statusTabs = ["", "waiting", "called", "checking", "completed", "no_show"] as const;


export function OPDQueueManagement() {
  const { showToast } = useToast();
  const role = useAuthStore((state) => state.profile?.role);
  const canManageQueue = role !== "doctor";
  const [queue, setQueue] = useState<DoctorQueueRecord[]>([]);
  const [reference, setReference] = useState<AppointmentReference>({ departments: [], doctors: [] });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<(typeof statusTabs)[number]>("");
  const [search, setSearch] = useState("");
  const [patientIdentifier, setPatientIdentifier] = useState("");
  const [departmentUuid, setDepartmentUuid] = useState("");
  const [doctorUuid, setDoctorUuid] = useState("");
  const [reason, setReason] = useState("OPD consultation");
  const [priority, setPriority] = useState<"routine" | "urgent" | "critical">("routine");
  const [scannerMode, setScannerMode] = useState<"qr" | "barcode" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [queueResult, referenceResult] = await Promise.all([getDoctorQueue(), getAppointmentReference()]);
      setQueue(queueResult.items);
      setReference(referenceResult);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to load the live OPD queue.", "danger");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(timer);
  }, [load]);

  const displayedQueue = useMemo(() => {
    const term = search.trim().toLowerCase();
    return queue.filter((item) => {
      const matchesStatus = !status || item.queue_status === status;
      const matchesSearch = !term || `${item.token_no} ${item.full_name} ${item.patient_no} ${item.nic ?? ""} ${item.department_name ?? ""}`.toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [queue, search, status]);

  const counts = useMemo(() => queue.reduce<Record<string, number>>((result, item) => {
    result[item.queue_status] = (result[item.queue_status] ?? 0) + 1;
    return result;
  }, {}), [queue]);

  async function createToken(identifierOverride?: string) {
    const identifier = (identifierOverride ?? patientIdentifier).trim();
    if (!identifier) throw new Error("Enter or scan a PostgreSQL patient UUID, patient number, NIC, passport, or phone.");
    if (!departmentUuid) throw new Error("Select a department before generating the token.");
    const department = reference.departments.find((item) => item.id === departmentUuid);
    const result = await createDoctorQueueEntry({
      identifier,
      departmentUuid,
      departmentName: department?.name,
      doctorUuid: doctorUuid || null,
      reason: reason.trim() || "OPD consultation",
      priority,
      visitType: "walk-in",
    });
    if (!result.queue.verified || !result.queue.patient_id) throw new Error("Patient identity could not be verified against PostgreSQL.");
    setPatientIdentifier(result.queue.patient_no);
    showToast(`Token ${result.queue.token_no} generated for ${result.queue.full_name}.`, "success");
    await load();
  }

  async function perform(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      showToast(message, "success");
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Queue action failed.", "danger");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-slate-950">OPD Queue Management</h1><p className="text-sm text-muted-foreground">Registration-to-token workflow and PostgreSQL live queue.</p></div>
        <Button variant="outline" onClick={() => void load()}><RefreshCcw className="h-4 w-4" />Refresh live queue</Button>
      </div>

      {canManageQueue && (
      <Card>
        <CardHeader><CardTitle>Generate walk-in token</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-1 text-sm font-semibold text-slate-700 xl:col-span-2">Patient identifier<Input value={patientIdentifier} onChange={(event) => setPatientIdentifier(event.target.value)} placeholder="UUID, patient no., NIC, passport or phone" /></label>
            <label className="space-y-1 text-sm font-semibold text-slate-700">Department<Select value={departmentUuid} onChange={(event) => setDepartmentUuid(event.target.value)}><option value="">Select department</option>{reference.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label>
            <label className="space-y-1 text-sm font-semibold text-slate-700">Doctor<Select value={doctorUuid} onChange={(event) => setDoctorUuid(event.target.value)}><option value="">Department queue</option>{reference.doctors.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</Select></label>
            <label className="space-y-1 text-sm font-semibold text-slate-700">Priority<Select value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}><option value="routine">Routine</option><option value="urgent">Urgent</option><option value="critical">Critical</option></Select></label>
            <label className="space-y-1 text-sm font-semibold text-slate-700 md:col-span-2 xl:col-span-3">Visit reason<Input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
            <div className="flex flex-wrap items-end gap-2 md:col-span-2">
              <Button onClick={() => void createToken().catch((error: unknown) => showToast(error instanceof Error ? error.message : "Token generation failed.", "danger"))}><CheckCircle2 className="h-4 w-4" />Generate token</Button>
              <Button variant="outline" onClick={() => setScannerMode("qr")}><QrCode className="h-4 w-4" />Scan QR</Button>
              <Button variant="outline" onClick={() => setScannerMode("barcode")}><ScanBarcode className="h-4 w-4" />Scan barcode</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {statusTabs.map((item) => {
          const label = item ? item.replaceAll("_", " ") : "all active";
          const count = item ? counts[item] ?? 0 : queue.length;
          return <button key={item || "all"} type="button" onClick={() => setStatus(item)} className={`rounded-lg border p-4 text-left transition ${status === item ? "border-primary bg-teal-50" : "border-border bg-card"}`}><div className="text-xs font-bold uppercase text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-bold text-slate-950">{count}</div></button>;
        })}
      </section>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5 text-primary" />Live patient queue</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-xl"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search token, patient, NIC, department..." /></div>
          <div className="overflow-x-auto">
            <Table>
              <thead><tr><Th>Token</Th><Th>Verified patient</Th><Th>Visit</Th><Th>Doctor</Th><Th>Status</Th><Th>Actions</Th></tr></thead>
              <tbody>
                {displayedQueue.map((item) => (
                  <tr key={item.queue_id}>
                    <Td><div className="text-lg font-bold text-primary">{item.token_no}</div><Badge tone={item.priority === "critical" ? "danger" : item.priority === "urgent" || item.priority === "stat" ? "warning" : "info"}>{item.priority}</Badge></Td>
                    <Td><div className="flex min-w-[290px] gap-3"><PatientPhoto src={item.profile_photo_url} name={item.full_name} className="h-12 w-12 rounded-lg bg-teal-100" fallbackClassName="font-bold text-teal-900" /><div><div className="flex flex-wrap items-center gap-2"><strong>{item.full_name}</strong><Badge tone={item.verified ? "success" : "danger"}>{item.verified ? "PostgreSQL verified" : "Not verified"}</Badge></div><div className="text-xs text-muted-foreground">{item.patient_no} · NIC {item.nic || "not recorded"}</div><div className="text-xs text-muted-foreground">{item.age_years ?? "N/A"} years · {item.gender || "not recorded"} · {item.blood_group || "blood group N/A"}</div>{item.allergies?.length ? <div className="text-xs font-semibold text-rose-700">Allergy: {item.allergies.join(", ")}</div> : null}</div></div></Td>
                    <Td>{item.department_name || "General OPD"}<br /><span className="text-xs text-muted-foreground">{item.reason || "No reason recorded"}</span><br /><span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{new Date(item.created_at).toLocaleTimeString()}</span></Td>
                    <Td>{canManageQueue ? <Select value={item.doctor_id ?? ""} onChange={(event) => void perform(() => assignQueueDoctor(item.queue_id, event.target.value || null), "Doctor assignment updated.")}><option value="">Unassigned</option>{reference.doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.full_name}</option>)}</Select> : <span>{item.doctor_name || "Department queue"}</span>}</Td>
                    <Td><StatusBadge status={item.queue_status} /></Td>
                    <Td><div className="flex min-w-[260px] flex-wrap gap-2">{item.queue_status === "waiting" && <Button disabled={!item.verified} onClick={() => void perform(() => callQueuePatient(item.queue_id), `${item.token_no} called.`)}><BellRing className="h-4 w-4" />Call</Button>}{item.queue_status === "called" && <Button onClick={() => void perform(() => recallQueuePatient(item.queue_id), `${item.token_no} recalled.`)}><RotateCcw className="h-4 w-4" />Recall</Button>}{["called", "no_show", "paused"].includes(item.queue_status) && <Button variant="outline" onClick={() => void perform(() => returnQueueToWaiting(item.queue_id), `${item.token_no} returned to waiting.`)}>Waiting</Button>}{["waiting", "called"].includes(item.queue_status) && <Button variant="destructive" onClick={() => void perform(() => markQueueNoShow(item.queue_id), `${item.token_no} marked no-show.`)}><UserRoundX className="h-4 w-4" />No-show</Button>}{item.queue_status === "checking" && <Badge tone="warning"><Stethoscope className="h-3.5 w-3.5" />Doctor checking</Badge>}</div></Td>
                  </tr>
                ))}
                {!loading && displayedQueue.length === 0 && <tr><Td colSpan={6} className="text-center">No queue records found.</Td></tr>}
                {loading && <tr><Td colSpan={6} className="text-center">Loading live queue...</Td></tr>}
              </tbody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {canManageQueue && <PatientCodeScanner open={scannerMode !== null} mode={scannerMode ?? "qr"} onClose={() => setScannerMode(null)} onDetected={async (value) => { setPatientIdentifier(value); await createToken(value); }} />}
    </div>
  );
}
