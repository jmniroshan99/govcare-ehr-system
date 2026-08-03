import { Activity, BellRing, CalendarCheck2, CheckCircle2, ClipboardList, FlaskConical, Pill, RefreshCcw, ScanLine, Stethoscope } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PatientIdentityCard } from "../components/patient/PatientIdentityCard";
import { Badge, StatusBadge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import { queueRecordToSelectedPatient, startDoctorQueueCheck, type DoctorQueueRecord } from "../services/doctorQueueService";
import { callQueuePatient, getDoctorCommandCenter, recallQueuePatient, reviewLaboratoryResult, reviewRadiologyReport, type DoctorCommandCenterData } from "../services/workflowService";
import { useAuthStore } from "../stores/authStore";
import { useSelectedPatientStore } from "../stores/selectedPatientStore";

const emptyData: DoctorCommandCenterData = {
  stats: {},
  queue: [],
  appointments: [],
  pendingLabResults: [],
  pendingRadiologyReports: [],
  pharmacyPrescriptions: [],
};

export function DoctorDashboard() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const profile = useAuthStore((state) => state.profile);
  const selectedPatient = useSelectedPatientStore((state) => state.selectedPatient);
  const setSelectedPatient = useSelectedPatientStore((state) => state.setSelectedPatient);
  const [data, setData] = useState<DoctorCommandCenterData>(emptyData);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getDoctorCommandCenter());
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to load the doctor command center.", "danger");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(timer);
  }, [load]);

  const currentQueue = useMemo(() => data.queue.filter((item) => item.queue_status === "checking"), [data.queue]);
  const waitingQueue = useMemo(() => data.queue.filter((item) => ["waiting", "called"].includes(item.queue_status)), [data.queue]);

  async function startCheck(queue: DoctorQueueRecord) {
    if (!queue.verified || !queue.patient_id) {
      showToast("A verified PostgreSQL patient is required before consultation.", "danger");
      return;
    }
    try {
      const result = await startDoctorQueueCheck(queue.queue_id);
      const patient = queueRecordToSelectedPatient({ ...result.queue, consultation_id: result.consultationId });
      setSelectedPatient(patient);
      navigate(`/doctor/workspace/${encodeURIComponent(patient.patientUuid)}?queueId=${encodeURIComponent(patient.queueUuid ?? "")}&visitId=${encodeURIComponent(patient.visitUuid ?? "")}&consultationId=${encodeURIComponent(result.consultationId)}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to start consultation.", "danger");
    }
  }

  async function perform(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      showToast(message, "success");
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Doctor workflow action failed.", "danger");
    }
  }

  const statCards = [
    ["Waiting", data.stats.waiting ?? 0, BellRing],
    ["Called", data.stats.called ?? 0, ScanLine],
    ["Checking", data.stats.checking ?? 0, Stethoscope],
    ["Completed today", data.stats.completed_today ?? 0, CheckCircle2],
    ["Lab review", data.stats.pending_lab_review ?? 0, FlaskConical],
    ["Radiology review", data.stats.pending_radiology_review ?? 0, Activity],
    ["Pharmacy pending", data.stats.pharmacy_pending ?? 0, Pill],
    ["Appointments", data.stats.appointments_today ?? 0, CalendarCheck2],
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-slate-950">Doctor Command Center</h1><p className="text-sm text-muted-foreground">Welcome, {profile?.displayName || "Doctor"}. Live queue, appointments, orders, and result review.</p></div>
        <Button variant="outline" onClick={() => void load()}><RefreshCcw className="h-4 w-4" />Refresh</Button>
      </div>

      {selectedPatient && <div className="sticky top-16 z-20"><PatientIdentityCard patient={selectedPatient} compact onOpen={() => navigate(`/doctor/workspace/${encodeURIComponent(selectedPatient.patientUuid)}`)} /></div>}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(([label, value, Icon]) => <Card key={label}><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs font-bold uppercase text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-bold text-slate-950">{value}</p></div><div className="grid h-11 w-11 place-items-center rounded-lg bg-teal-50"><Icon className="h-5 w-5 text-primary" /></div></CardContent></Card>)}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Doctor patient check workflow</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <thead><tr><Th>Token</Th><Th>Patient</Th><Th>Reason</Th><Th>Status</Th><Th>Action</Th></tr></thead>
              <tbody>
                {[...currentQueue, ...waitingQueue].map((item) => <tr key={item.queue_id}><Td className="font-bold text-primary">{item.token_no}</Td><Td><strong>{item.full_name}</strong><br /><span className="text-xs text-muted-foreground">{item.patient_no} · {item.age_years ?? "N/A"} years · {item.gender || "N/A"}</span><br /><Badge tone={item.verified ? "success" : "danger"}>{item.verified ? "Verified" : "Not verified"}</Badge></Td><Td>{item.reason || "Consultation"}<br /><span className="text-xs text-muted-foreground">{item.department_name || "OPD"}</span></Td><Td><StatusBadge status={item.queue_status} /></Td><Td><div className="flex flex-wrap gap-2">{item.queue_status === "waiting" && <Button onClick={() => void perform(() => callQueuePatient(item.queue_id), `${item.token_no} called.`)}><BellRing className="h-4 w-4" />Call</Button>}{item.queue_status === "called" && <Button variant="outline" onClick={() => void perform(() => recallQueuePatient(item.queue_id), `${item.token_no} recalled.`)}>Recall</Button>}{["waiting", "called", "checking"].includes(item.queue_status) && <Button disabled={!item.verified} onClick={() => void startCheck(item)}><Stethoscope className="h-4 w-4" />Start check</Button>}</div></Td></tr>)}
                {!loading && data.queue.length === 0 && <tr><Td colSpan={5} className="text-center">No assigned patients in the live queue.</Td></tr>}
                {loading && <tr><Td colSpan={5} className="text-center">Loading doctor queue...</Td></tr>}
              </tbody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarCheck2 className="h-5 w-5 text-primary" />Today&apos;s appointments</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.appointments.slice(0, 8).map((item) => <div key={item.id} className="rounded-lg border border-border p-3"><div className="flex items-start justify-between gap-2"><div><strong>{item.patient_name}</strong><div className="text-xs text-muted-foreground">{item.patient_no} · {new Date(item.scheduled_at).toLocaleTimeString()}</div></div><StatusBadge status={item.workflow_status} /></div><div className="mt-2 text-sm">{item.department_name || "OPD"} · {item.reason || "Appointment"}</div></div>)}
            {!data.appointments.length && <p className="text-sm text-muted-foreground">No appointments found for today.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card><CardHeader><CardTitle>Laboratory results to review</CardTitle></CardHeader><CardContent className="space-y-3">{data.pendingLabResults.map((item) => <div key={item.id} className="rounded-lg border border-border p-3"><div className="flex justify-between gap-2"><strong>{item.patient_name}</strong><Badge tone={item.critical_flag ? "danger" : item.abnormal_flag ? "warning" : "info"}>{item.classification || item.workflow_status}</Badge></div><p className="text-sm">{item.test_type}: {item.numeric_result ?? item.text_result ?? "Result entered"} {item.unit || ""}</p>{item.result_id && <Button className="mt-2" variant="outline" onClick={() => void perform(() => reviewLaboratoryResult(item.result_id as string), "Laboratory result marked reviewed.")}>Review</Button>}</div>)}{!data.pendingLabResults.length && <p className="text-sm text-muted-foreground">No laboratory results await review.</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Radiology reports to review</CardTitle></CardHeader><CardContent className="space-y-3">{data.pendingRadiologyReports.map((item) => <div key={item.id} className="rounded-lg border border-border p-3"><div className="flex justify-between gap-2"><strong>{item.patient_name}</strong><Badge tone={item.classification === "critical" ? "danger" : item.classification === "abnormal" ? "warning" : "info"}>{item.classification || item.workflow_status}</Badge></div><p className="text-sm">{item.imaging_type} · {item.impression || "Report available"}</p>{item.report_id && <Button className="mt-2" variant="outline" onClick={() => void perform(() => reviewRadiologyReport(item.report_id as string), "Radiology report marked reviewed.")}>Review</Button>}</div>)}{!data.pendingRadiologyReports.length && <p className="text-sm text-muted-foreground">No radiology reports await review.</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Prescription and pharmacy status</CardTitle></CardHeader><CardContent className="space-y-3">{data.pharmacyPrescriptions.map((item) => <div key={item.id} className="rounded-lg border border-border p-3"><div className="flex justify-between gap-2"><strong>{item.patient_name}</strong><StatusBadge status={item.pharmacy_status} /></div><p className="text-sm">{item.prescription_no} · {item.lines.length} medicine(s)</p></div>)}{!data.pharmacyPrescriptions.length && <p className="text-sm text-muted-foreground">No prescriptions await pharmacy action.</p>}</CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" />Workflow safety</CardTitle></CardHeader><CardContent><p className="text-sm text-slate-700">Only a PostgreSQL-verified patient with a queue UUID and visit UUID can enter the structured consultation. All prescription, laboratory, and radiology actions remain linked to the same patient and consultation.</p></CardContent></Card>
    </div>
  );
}
