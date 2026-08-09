import { CalendarCheck2, CheckCircle2, Clock3, RefreshCcw, Search, UserCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge, StatusBadge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { DateTimePicker, SearchableSelect } from "../components/forms";
import { PatientSearchSelector } from "../components/selectors";
import { PRIORITY_OPTIONS, type SelectOption } from "../data/referenceOptions";
import { Select } from "../components/ui/select";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import {
  checkInAppointment,
  createAppointment,
  getAppointmentReference,
  getAppointments,
  updateAppointmentStatus,
  type AppointmentRecord,
  type AppointmentReference,
} from "../services/workflowService";

const emptyReference: AppointmentReference = { departments: [], doctors: [] };

export function AppointmentManagement() {
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const [reference, setReference] = useState<AppointmentReference>(emptyReference);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [patientIdentifier, setPatientIdentifier] = useState(() => searchParams.get("patient") ?? "");
  const [selectedPatientOption, setSelectedPatientOption] = useState<SelectOption | null>(null);
  const [departmentUuid, setDepartmentUuid] = useState("");
  const [doctorUuid, setDoctorUuid] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<"routine" | "urgent" | "critical">("routine");
  const [mode, setMode] = useState<"physical" | "video" | "telephone">("physical");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [referenceResult, appointmentResult] = await Promise.all([
        getAppointmentReference(),
        getAppointments({ status: status || undefined, search: search || undefined }),
      ]);
      setReference(referenceResult);
      setAppointments(appointmentResult.items);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to load appointments.", "danger");
    } finally {
      setLoading(false);
    }
  }, [search, showToast, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredDoctors = useMemo(
    () => reference.doctors.filter((doctor) => !departmentUuid || !doctor.department_id || doctor.department_id === departmentUuid),
    [departmentUuid, reference.doctors],
  );

  async function submitAppointment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!patientIdentifier.trim() || !scheduledAt || !reason.trim()) {
      showToast("Patient, appointment time, and reason are required.", "warning");
      return;
    }
    setSaving(true);
    try {
      const department = reference.departments.find((item) => item.id === departmentUuid);
      await createAppointment({
        patientIdentifier: patientIdentifier.trim(),
        departmentUuid: departmentUuid || null,
        departmentName: department?.name ?? null,
        doctorUuid: doctorUuid || null,
        scheduledAt: new Date(scheduledAt).toISOString(),
        reason: reason.trim(),
        appointmentType: "clinic",
        priority,
        mode,
      });
      showToast("Appointment saved to PostgreSQL.", "success");
      setPatientIdentifier("");
      setSelectedPatientOption(null);
      setReason("");
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to create appointment.", "danger");
    } finally {
      setSaving(false);
    }
  }

  async function performAction(action: () => Promise<unknown>, successMessage: string) {
    try {
      await action();
      showToast(successMessage, "success");
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Appointment action failed.", "danger");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Appointments</h1>
          <p className="text-sm text-muted-foreground">PostgreSQL-backed clinic scheduling, check-in, and token generation.</p>
        </div>
        <Button variant="outline" onClick={() => void load()}><RefreshCcw className="h-4 w-4" />Refresh</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CalendarCheck2 className="h-5 w-5 text-primary" />Create appointment</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" onSubmit={submitAppointment}>
            <label className="space-y-1 text-sm font-semibold text-slate-700">Patient
              <PatientSearchSelector value={patientIdentifier} selectedOption={selectedPatientOption} onChange={(value, option) => { setPatientIdentifier(value); setSelectedPatientOption(option ?? null); }} required />
            </label>
            <label className="space-y-1 text-sm font-semibold text-slate-700">Department<Select value={departmentUuid} onChange={(event) => { setDepartmentUuid(event.target.value); setDoctorUuid(""); }}><option value="">Select department</option>{reference.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label>
            <label className="space-y-1 text-sm font-semibold text-slate-700">Doctor<Select value={doctorUuid} onChange={(event) => setDoctorUuid(event.target.value)}><option value="">Department queue</option>{filteredDoctors.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</Select></label>
            <label className="space-y-1 text-sm font-semibold text-slate-700">Date and time<DateTimePicker min={new Date().toISOString().slice(0, 16)} value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label>
            <label className="space-y-1 text-sm font-semibold text-slate-700 md:col-span-2">Reason<Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Clinic review or presenting complaint" /></label>
            <label className="space-y-1 text-sm font-semibold text-slate-700">Priority<SearchableSelect value={priority} options={PRIORITY_OPTIONS} onChange={(value) => setPriority(value as typeof priority)} clearable={false} /></label>
            <label className="space-y-1 text-sm font-semibold text-slate-700">Mode<SearchableSelect value={mode} options={[{ value: "physical", label: "Physical" }, { value: "video", label: "Video" }, { value: "telephone", label: "Telephone" }]} onChange={(value) => setMode(value as typeof mode)} clearable={false} /></label>
            <div className="md:col-span-2 xl:col-span-4"><Button type="submit" disabled={saving}><CheckCircle2 className="h-4 w-4" />{saving ? "Saving..." : "Save appointment"}</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Appointment register</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patient, appointment, NIC..." /></div>
            <Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{["scheduled", "confirmed", "checked_in", "waiting", "called", "in_consultation", "completed", "cancelled", "no_show"].map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</Select>
            <Button variant="outline" onClick={() => void load()}>Apply</Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <thead><tr><Th>Appointment</Th><Th>Patient</Th><Th>Schedule</Th><Th>Department / doctor</Th><Th>Status</Th><Th>Action</Th></tr></thead>
              <tbody>
                {appointments.map((item) => (
                  <tr key={item.id}>
                    <Td className="font-semibold">{item.appointment_no || item.id.slice(0, 8)}<br /><Badge tone={item.priority === "critical" ? "danger" : item.priority === "urgent" ? "warning" : "info"}>{item.priority}</Badge></Td>
                    <Td><strong>{item.patient_name}</strong><br /><span className="text-xs text-muted-foreground">{item.patient_no} · {item.nic || "NIC not recorded"}</span></Td>
                    <Td><span className="inline-flex items-center gap-1"><Clock3 className="h-4 w-4" />{new Date(item.scheduled_at).toLocaleString()}</span><br /><span className="text-xs text-muted-foreground">{item.mode || "physical"}</span></Td>
                    <Td>{item.department_name || "General OPD"}<br /><span className="text-xs text-muted-foreground">{item.doctor_name || "Department queue"}</span></Td>
                    <Td><StatusBadge status={item.workflow_status} />{item.token_no && <div className="mt-1 font-semibold text-primary">Token {item.token_no}</div>}</Td>
                    <Td><div className="flex flex-wrap gap-2">{!["checked_in", "waiting", "called", "in_consultation", "completed", "cancelled", "no_show"].includes(item.workflow_status) && <Button onClick={() => void performAction(() => checkInAppointment(item.id), "Appointment checked in and token generated.")}><UserCheck className="h-4 w-4" />Check in</Button>}{item.workflow_status === "scheduled" && <Button variant="outline" onClick={() => void performAction(() => updateAppointmentStatus(item.id, "confirmed"), "Appointment confirmed.")}>Confirm</Button>}{!["completed", "cancelled", "no_show"].includes(item.workflow_status) && <Button variant="destructive" onClick={() => void performAction(() => updateAppointmentStatus(item.id, "cancelled", "Cancelled by staff"), "Appointment cancelled.")}>Cancel</Button>}</div></Td>
                  </tr>
                ))}
                {!loading && appointments.length === 0 && <tr><Td colSpan={6} className="text-center">No appointments found.</Td></tr>}
                {loading && <tr><Td colSpan={6} className="text-center">Loading appointments...</Td></tr>}
              </tbody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
