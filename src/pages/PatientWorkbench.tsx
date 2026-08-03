import { CalendarPlus, IdCard, Loader2, QrCode, RefreshCcw, ScanBarcode, Search, Stethoscope, UserRoundPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PatientCodeScanner } from "../components/patient/PatientCodeScanner";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import { createDoctorQueueEntry } from "../services/doctorQueueService";
import { getAppointmentReference, type AppointmentReference } from "../services/workflowService";
import { getPatientRecord, searchPatientRecords, type PatientRecord } from "../services/patientService";
import { useAuthStore } from "../stores/authStore";

const emptyReference: AppointmentReference = { departments: [], doctors: [] };
const queueCreatorRoles = new Set(["super_admin", "hospital_admin", "receptionist", "records_officer", "nurse"]);

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "PT";
}

export function PatientWorkbench() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const role = useAuthStore((state) => state.profile?.role);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<PatientRecord[]>([]);
  const [selected, setSelected] = useState<PatientRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [scannerMode, setScannerMode] = useState<"qr" | "barcode" | null>(null);
  const [reference, setReference] = useState<AppointmentReference>(emptyReference);
  const [departmentUuid, setDepartmentUuid] = useState("");
  const [doctorUuid, setDoctorUuid] = useState("");
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<"routine" | "urgent" | "critical">("routine");
  const [creatingToken, setCreatingToken] = useState(false);

  const canCreateToken = Boolean(role && queueCreatorRoles.has(role));
  const filteredDoctors = useMemo(
    () => reference.doctors.filter((doctor) => !departmentUuid || !doctor.department_id || doctor.department_id === departmentUuid),
    [departmentUuid, reference.doctors],
  );

  useEffect(() => {
    getAppointmentReference().then(setReference).catch(() => setReference(emptyReference));
  }, []);

  const runSearch = useCallback(async (value = search) => {
    const term = value.trim();
    if (!term) {
      setItems([]);
      setSelected(null);
      return;
    }
    setLoading(true);
    try {
      const result = await searchPatientRecords(term);
      setItems(result.items);
      if (result.items.length === 1) setSelected(result.items[0]);
      if (!result.items.length) showToast("No PostgreSQL patient matched that identifier.", "warning");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to search PostgreSQL patients.", "danger");
    } finally {
      setLoading(false);
    }
  }, [search, showToast]);

  async function handleDetected(value: string) {
    const identifier = value.trim();
    setScannerMode(null);
    setSearch(identifier);
    setLoading(true);
    try {
      const result = await getPatientRecord(identifier);
      setItems([result.patient]);
      setSelected(result.patient);
      showToast(`${result.patient.full_name} verified from PostgreSQL.`, "success");
    } catch {
      await runSearch(identifier);
    } finally {
      setLoading(false);
    }
  }

  async function createToken() {
    if (!selected) {
      showToast("Select a verified PostgreSQL patient first.", "warning");
      return;
    }
    if (!departmentUuid || !reason.trim()) {
      showToast("Department and visit reason are required.", "warning");
      return;
    }
    setCreatingToken(true);
    try {
      const department = reference.departments.find((item) => item.id === departmentUuid);
      const result = await createDoctorQueueEntry({
        identifier: selected.id,
        departmentUuid,
        departmentName: department?.name ?? null,
        doctorUuid: doctorUuid || null,
        reason: reason.trim(),
        priority,
        visitType: "walk-in",
      });
      showToast(`Token ${result.queue.token_no} generated for ${selected.full_name}.`, "success");
      navigate("/opd");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to generate the queue token.", "danger");
    } finally {
      setCreatingToken(false);
    }
  }

  return (
    <div className="space-y-5">
      <PatientCodeScanner open={scannerMode !== null} mode={scannerMode ?? "qr"} onClose={() => setScannerMode(null)} onDetected={(value) => void handleDetected(value)} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Patient search and visit workbench</h1>
          <p className="text-sm text-muted-foreground">Verify a real PostgreSQL patient, then open the profile, book an appointment, or generate a walk-in token.</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/patients/register")}><UserRoundPlus className="h-4 w-4" />Register patient</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5 text-primary" />PostgreSQL patient lookup</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <form className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]" onSubmit={(event) => { event.preventDefault(); void runSearch(); }}>
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Patient UUID, patient number, NIC, passport, phone, or name" />
            <Button type="submit" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Search</Button>
            <Button type="button" variant="outline" onClick={() => setScannerMode("qr")}><QrCode className="h-4 w-4" />QR</Button>
            <Button type="button" variant="outline" onClick={() => setScannerMode("barcode")}><ScanBarcode className="h-4 w-4" />Barcode</Button>
          </form>
          <p className="text-xs text-muted-foreground">Human-readable values such as PAT-2026-000001 are resolved safely and are never cast to UUID.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Verified patient results</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <thead><tr><Th>Patient</Th><Th>Identity</Th><Th>Clinical warnings</Th><Th>Action</Th></tr></thead>
              <tbody>
                {items.map((patient) => (
                  <tr key={patient.id} className={selected?.id === patient.id ? "bg-teal-50/70 dark:bg-teal-950/30" : ""}>
                    <Td>
                      <div className="flex min-w-64 items-center gap-3">
                        <div className="aspect-square h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                          {patient.profile_photo_url ? <img src={patient.profile_photo_url} alt={patient.full_name} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center font-bold text-primary">{initials(patient.full_name)}</div>}
                        </div>
                        <div><strong>{patient.full_name}</strong><div className="text-xs text-muted-foreground">{patient.patient_no}</div><Badge tone="success">PostgreSQL verified</Badge></div>
                      </div>
                    </Td>
                    <Td><div>NIC: {patient.nic || "Not recorded"}</div><div className="text-xs text-muted-foreground">{patient.gender || "Gender not recorded"} · {patient.age_years ?? "Age not recorded"} · {patient.blood_group || "Blood group not recorded"}</div></Td>
                    <Td><div className="max-w-72 text-sm"><strong>Allergies:</strong> {patient.allergies?.join(", ") || "None recorded"}<br /><strong>Chronic:</strong> {patient.chronic_diseases?.join(", ") || "None recorded"}</div></Td>
                    <Td><div className="flex flex-wrap gap-2"><Button variant={selected?.id === patient.id ? "primary" : "outline"} onClick={() => setSelected(patient)}><IdCard className="h-4 w-4" />Select</Button><Button variant="outline" onClick={() => navigate(`/patients/${encodeURIComponent(patient.id)}`)}>Profile</Button></div></Td>
                  </tr>
                ))}
                {!loading && items.length === 0 && <tr><Td colSpan={4} className="text-center text-muted-foreground">Search or scan a patient identifier to begin.</Td></tr>}
              </tbody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selected && (
        <Card className="border-teal-300 dark:border-teal-800">
          <CardHeader><CardTitle className="flex items-center gap-2"><Stethoscope className="h-5 w-5 text-primary" />Create the next care step for {selected.full_name}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => navigate(`/appointments?patient=${encodeURIComponent(selected.patient_no)}`)}><CalendarPlus className="h-4 w-4" />Create appointment</Button>
              <Button variant="outline" onClick={() => navigate(`/patients/${encodeURIComponent(selected.id)}`)}><IdCard className="h-4 w-4" />Open profile</Button>
            </div>

            {canCreateToken ? (
              <div className="grid gap-3 rounded-xl border border-border bg-muted/30 p-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-1 text-sm font-semibold">Department<Select value={departmentUuid} onChange={(event) => { setDepartmentUuid(event.target.value); setDoctorUuid(""); }}><option value="">Select department</option>{reference.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</Select></label>
                <label className="space-y-1 text-sm font-semibold">Doctor<Select value={doctorUuid} onChange={(event) => setDoctorUuid(event.target.value)}><option value="">Department queue</option>{filteredDoctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.full_name}</option>)}</Select></label>
                <label className="space-y-1 text-sm font-semibold">Priority<Select value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}><option value="routine">Routine</option><option value="urgent">Urgent</option><option value="critical">Critical</option></Select></label>
                <label className="space-y-1 text-sm font-semibold">Visit reason<Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Presenting complaint" /></label>
                <div className="md:col-span-2 xl:col-span-4"><Button onClick={() => void createToken()} disabled={creatingToken}>{creatingToken ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}{creatingToken ? "Generating..." : "Generate walk-in token"}</Button></div>
              </div>
            ) : <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">Your role can verify the patient and create appointments. Reception, nursing, records, or administration staff must generate the walk-in token.</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
