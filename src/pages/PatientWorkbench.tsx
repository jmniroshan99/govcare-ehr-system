import { BedDouble, BrainCircuit, Building2, CalendarPlus, IdCard, Loader2, QrCode, RefreshCcw, ScanBarcode, Search, Stethoscope, UserRoundPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  getPatientIdentificationWards,
  getPatientHospitals,
  searchPatientRecords,
  type PatientIdentificationWard,
  type PatientRecord,
  type PatientHospital,
  type PatientPage,
} from "../services/patientService";
import { useAuthStore } from "../stores/authStore";
import { formatPatientAge } from "../utils/age";
import { authorizationContextKey } from "../lib/accessControl";

const emptyReference: AppointmentReference = { departments: [], doctors: [] };
const queueCreatorRoles = new Set(["super_admin", "hospital_admin", "receptionist", "records_officer", "nurse"]);
const bedBoardRoles = new Set(["super_admin", "hospital_admin", "doctor", "nurse"]);
const admissionCreatorRoles = new Set(["super_admin", "hospital_admin", "doctor", "surgeon", "nurse", "receptionist", "records_officer"]);

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "PT";
}

function formatClinicalList(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(", ") || "None recorded";
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean).join(", ") || "None recorded";
    } catch {
      return value;
    }
  }
  return "None recorded";
}

function wardLabel(ward: PatientIdentificationWard) {
  return `${ward.wardCode} — ${ward.wardName} (${ward.activePatientCount} patient${ward.activePatientCount === 1 ? "" : "s"})`;
}

export function PatientWorkbench() {
  const profile = useAuthStore(state => state.profile);
  return <ScopedPatientWorkbench key={authorizationContextKey(profile)} />;
}
function ScopedPatientWorkbench() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const profile = useAuthStore((state) => state.profile);
  const role = profile?.role;
  const network = role === "super_admin";
  const contextKey = authorizationContextKey(profile);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<PatientRecord[]>([]);
  const [selected, setSelected] = useState<PatientRecord | null>(null);
  const [hospitals, setHospitals] = useState<PatientHospital[]>([]);
  const [hospitalId, setHospitalId] = useState("");
  const [page, setPage] = useState(0);
  const [pageInfo, setPageInfo] = useState<PatientPage<PatientRecord>>({ items: [] });
  const [appliedSearch, setAppliedSearch] = useState("");
  const [refresh, setRefresh] = useState(0);
  const requestId = useRef(0);
  const [loading, setLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState("");
  const [scannerMode, setScannerMode] = useState<"qr" | "barcode" | null>(null);
  const [reference, setReference] = useState<AppointmentReference>(emptyReference);
  const [wards, setWards] = useState<PatientIdentificationWard[]>([]);
  const [wardId, setWardId] = useState("");
  const [wardsLoading, setWardsLoading] = useState(false);
  const [departmentUuid, setDepartmentUuid] = useState("");
  const [doctorUuid, setDoctorUuid] = useState("");
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<"routine" | "urgent" | "critical">("routine");
  const [creatingToken, setCreatingToken] = useState(false);

  const homePatient = !selected || selected.hospital_id === profile?.hospitalId;
  const canCreateToken = Boolean(homePatient && role && queueCreatorRoles.has(role));
  const canOpenBedBoard = Boolean(homePatient && role && bedBoardRoles.has(role));
  const canCreateAdmission = Boolean(homePatient && role && admissionCreatorRoles.has(role));
  const selectedWard = useMemo(() => wards.find((ward) => ward.id === wardId) ?? null, [wardId, wards]);
  const filteredDoctors = useMemo(
    () => reference.doctors.filter((doctor) => !departmentUuid || !doctor.department_id || doctor.department_id === departmentUuid),
    [departmentUuid, reference.doctors],
  );

  useEffect(() => {
    requestId.current += 1;
    setItems([]); setSelected(null); setPage(0); setPageInfo({ items: [] });
    setHospitalId(""); setWardId(""); setSearch(""); setAppliedSearch("");
    setDirectoryError("");
    let active = true;
    if (network) void getPatientHospitals().then(rows => { if (active) setHospitals(rows); }).catch((e: unknown) => { if (active) showToast(e instanceof Error ? e.message : "Unable to load hospitals.", "danger"); });
    else setHospitals([]);
    return () => { active = false; requestId.current += 1; };
  }, [contextKey, network, showToast]);

  useEffect(() => {
    let active = true;
    void getAppointmentReference().then(rows => { if (active) setReference(rows); }).catch(() => { if (active) setReference(emptyReference); });
    return () => { active = false; };
  }, [contextKey]);

  useEffect(() => {
    let active = true;
    if (network && !hospitalId) { setWards([]); setWardsLoading(false); return; }
    setWardsLoading(true);
    getPatientIdentificationWards(network ? hospitalId : undefined)
      .then(rows => { if (active) setWards(rows); })
      .catch((error: unknown) => showToast(error instanceof Error ? error.message : "Unable to load hospital wards.", "warning"))
      .finally(() => { if (active) setWardsLoading(false); });
    return () => { active = false; };
  }, [hospitalId, network, contextKey, showToast]);

  const runSearch = useCallback(async (value: string, selectedWardId: string, requestedPage = 0) => {
    const term = value.trim();
    if (!network && !term && !selectedWardId) {
      showToast("Enter a patient identifier or select a ward.", "warning");
      return;
    }
    setLoading(true);
    setDirectoryError("");
    const id = ++requestId.current;
    try {
      const result = await searchPatientRecords(term, selectedWardId || undefined, { hospitalId: network ? hospitalId || undefined : undefined, page: requestedPage, pageSize: 50 });
      if (id !== requestId.current) return;
      setItems(result.items);
      setPageInfo(result);
      setSelected(result.items.length === 1 ? result.items[0] : null);
      if (!result.items.length) {
        showToast(selectedWardId ? "No active patient in the selected ward matched that identifier." : "No PostgreSQL patient matched that identifier.", "warning");
      }
    } catch (error) {
      if (id !== requestId.current) return;
      setItems([]); setSelected(null); setPageInfo({ items: [] });
      setDirectoryError(error instanceof Error ? error.message : "Data unavailable");
      showToast(error instanceof Error ? error.message : "Unable to search PostgreSQL patients.", "danger");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [network, hospitalId, showToast]);

  useEffect(() => { if (network) void runSearch(appliedSearch, wardId, page); }, [network, appliedSearch, wardId, page, refresh, runSearch]);

  function submitSearch(value = search) {
    if (network) { setAppliedSearch(value.trim()); setPage(0); setRefresh(n => n + 1); }
    else void runSearch(value, wardId);
  }

  async function handleDetected(value: string) {
    const identifier = value.trim();
    setScannerMode(null);
    setSearch(identifier);
    submitSearch(identifier);
  }

  function changeWard(nextWardId: string) {
    setWardId(nextWardId);
    setItems([]);
    setSelected(null);
    setPage(0);
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

      <div className="gov-page-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{network ? "Hospital network patient directory" : "Patient identification with ward selection"}</h1>
          <p className="text-sm text-muted-foreground">{network ? "Browse all hospitals, filter by hospital or ward, and open a patient's details or AI risk assessment." : "Select a ward to identify an admitted patient, or search the whole hospital using a patient number, NIC, passport, phone, QR, or barcode."}</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/patients/register")}><UserRoundPlus className="h-4 w-4" />Register patient</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5 text-accent" />Patient identification</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {network && <label className="block space-y-1 text-sm font-semibold">Hospital<Select aria-label="Patient hospital" value={hospitalId} onChange={e => { setHospitalId(e.target.value); setWardId(""); setSelected(null); setItems([]); setPage(0); }}><option value="">All hospitals</option>{hospitals.map(h => <option key={h.id} value={h.id}>{h.code} — {h.name}</option>)}</Select></label>}
          <div className="grid gap-3 lg:grid-cols-[minmax(280px,0.8fr)_minmax(360px,1.4fr)]">
            <label className="space-y-1 text-sm font-semibold">
              <span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-accent" />Ward selection</span>
              <Select value={wardId} disabled={wardsLoading || (network && !hospitalId)} onChange={(event) => changeWard(event.target.value)}>
                <option value="">All wards and outpatients</option>
                {wards.map((ward) => <option key={ward.id} value={ward.id}>{wardLabel(ward)}</option>)}
              </Select>
            </label>
            <form className="grid items-end gap-3 sm:grid-cols-[1fr_auto_auto_auto]" onSubmit={(event) => { event.preventDefault(); submitSearch(); }}>
              <label className="space-y-1 text-sm font-semibold">
                Patient identifier or name
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Patient number, NIC, passport, phone, or name" />
              </label>
              <Button type="submit" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{wardId && !search.trim() ? "Load ward" : "Identify"}</Button>
              <Button type="button" variant="outline" onClick={() => setScannerMode("qr")}><QrCode className="h-4 w-4" />QR</Button>
              <Button type="button" variant="outline" onClick={() => setScannerMode("barcode")}><ScanBarcode className="h-4 w-4" />Barcode</Button>
            </form>
          </div>

          {selectedWard ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-accent-border bg-accent-surface p-3 text-sm dark:border-accent-border dark:bg-accent-surface">
              <Building2 className="h-5 w-5 text-accent" />
              <strong>{selectedWard.wardCode} — {selectedWard.wardName}</strong>
              <Badge tone="info">{selectedWard.activePatientCount} active patients</Badge>
              <Badge tone={selectedWard.availableBeds > 0 ? "success" : "warning"}>{selectedWard.availableBeds} available beds</Badge>
              {canOpenBedBoard && <Button className="ml-auto" variant="outline" onClick={() => navigate(`/wards/bed-board?wardId=${encodeURIComponent(selectedWard.id)}`)}><BedDouble className="h-4 w-4" />Open bed board</Button>}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{network ? "All hospitals includes the whole network. Choose a hospital to enable its ward filter." : "Leave ward selection as “All wards and outpatients” for hospital-wide identification. Selecting a ward limits results to patients with an active admission in that ward."}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Verified patient results</CardTitle></CardHeader>
        <CardContent>
          {directoryError && <p role="alert" className="mb-3 rounded-lg bg-danger-surface p-3 text-sm text-danger">{directoryError}</p>}
          <div className="overflow-x-auto">
            <Table>
              <thead><tr><Th>Patient</Th>{network && <Th>Hospital</Th>}<Th>Identity and age</Th><Th>Ward / bed</Th><Th>Clinical warnings</Th><Th>Action</Th></tr></thead>
              <tbody>
                {items.map((patient) => (
                  <tr key={patient.id} className={selected?.id === patient.id ? "bg-accent-surface dark:bg-accent-surface" : ""}>
                    <Td>
                      <div className="flex min-w-64 items-center gap-3">
                        <div className="aspect-square h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                          {patient.profile_photo_url ? <img src={patient.profile_photo_url} alt={patient.full_name} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center font-bold text-accent">{initials(patient.full_name)}</div>}
                        </div>
                        <div><strong>{patient.full_name}</strong><div className="text-xs text-muted-foreground">{patient.patient_no}</div><Badge tone="success">PostgreSQL verified</Badge></div>
                      </div>
                    </Td>
                    {network && <Td><strong>{patient.hospital_code}</strong><div className="text-xs text-muted-foreground">{patient.hospital_name}</div></Td>}
                    <Td>
                      <div>NIC: {patient.nic || "Not recorded"}</div>
                      <div className="text-xs text-muted-foreground">{patient.gender || "Gender not recorded"} · {formatPatientAge(patient.date_of_birth, patient.age_years)} · {patient.blood_group || "Blood group not recorded"}</div>
                      <div className="text-xs text-muted-foreground">DOB: {patient.date_of_birth || "Not recorded"}</div>
                    </Td>
                    <Td>
                      {patient.ward_name ? <><strong>{patient.ward_code} — {patient.ward_name}</strong><div className="text-xs text-muted-foreground">{patient.bed_code ? `Bed ${patient.bed_code}` : "Bed not assigned"}{patient.admission_no ? ` · ${patient.admission_no}` : ""}</div></> : <span className="text-muted-foreground">Not currently admitted to a ward</span>}
                    </Td>
                    <Td><div className="max-w-72 text-sm"><strong>Allergies:</strong> {formatClinicalList(patient.allergies)}<br /><strong>Chronic:</strong> {formatClinicalList(patient.chronic_diseases)}</div></Td>
                    <Td><div className="flex flex-wrap gap-2"><Button variant={selected?.id === patient.id ? "primary" : "outline"} onClick={() => setSelected(patient)}><IdCard className="h-4 w-4" />Select</Button><Button variant="outline" onClick={() => navigate(`/patients/${encodeURIComponent(patient.id)}`)}>Profile</Button>{(network || role === "doctor" || role === "surgeon" || role === "anesthetist") && <Button variant="outline" onClick={() => navigate(`/ai-cdss/ckd?patientId=${encodeURIComponent(patient.id)}`)}><BrainCircuit className="h-4 w-4" />AI assessment</Button>}</div></Td>
                  </tr>
                ))}
                {!loading && items.length === 0 && <tr><Td colSpan={network ? 6 : 5} className="text-center text-muted-foreground">{directoryError ? "Data unavailable" : network ? "No matching patients." : "Select a ward or enter a patient identifier to begin."}</Td></tr>}
              </tbody>
            </Table>
          </div>
          {network && pageInfo.total !== undefined && <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm"><span aria-live="polite">{pageInfo.total.toLocaleString()} matching patients · Page {page + 1} of {Math.max(1, Math.ceil(pageInfo.total / 50))}</span><div className="flex gap-2"><Button variant="outline" disabled={loading || page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button><Button variant="outline" disabled={loading || !pageInfo.hasNext} onClick={() => setPage(p => p + 1)}>Next</Button></div></div>}
        </CardContent>
      </Card>

      {selected && (
        <Card className="border-accent-border dark:border-accent-border">
          <CardHeader><CardTitle className="flex items-center gap-2"><Stethoscope className="h-5 w-5 text-accent" />Create the next care step for {selected.full_name} · {formatPatientAge(selected.date_of_birth, selected.age_years)}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {homePatient && <Button variant="outline" onClick={() => navigate(`/appointments?patient=${encodeURIComponent(selected.patient_no)}`)}><CalendarPlus className="h-4 w-4" />Create appointment</Button>}
              <Button variant="outline" onClick={() => navigate(`/patients/${encodeURIComponent(selected.id)}`)}><IdCard className="h-4 w-4" />Open profile</Button>
              {canCreateAdmission && !selected.admission_id && <Button onClick={() => navigate(`/admissions/new?patientId=${encodeURIComponent(selected.id)}`)}><BedDouble className="h-4 w-4" />Admit to ward and assign bed</Button>}
              {selected.admission_id && <Badge tone="success">Currently admitted: {selected.admission_no}</Badge>}
              {canOpenBedBoard && selected.ward_id && <Button variant="outline" onClick={() => { const wardId = selected.ward_id; if (wardId) navigate(`/wards/bed-board?wardId=${encodeURIComponent(wardId)}`); }}><BedDouble className="h-4 w-4" />Ward bed board</Button>}
            </div>

            {canCreateToken ? (
              <div className="grid gap-3 rounded-xl border border-border bg-muted p-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-1 text-sm font-semibold">Department<Select value={departmentUuid} onChange={(event) => { setDepartmentUuid(event.target.value); setDoctorUuid(""); }}><option value="">Select department</option>{reference.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</Select></label>
                <label className="space-y-1 text-sm font-semibold">Doctor<Select value={doctorUuid} onChange={(event) => setDoctorUuid(event.target.value)}><option value="">Department queue</option>{filteredDoctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.full_name}</option>)}</Select></label>
                <label className="space-y-1 text-sm font-semibold">Priority<Select value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}><option value="routine">Routine</option><option value="urgent">Urgent</option><option value="critical">Critical</option></Select></label>
                <label className="space-y-1 text-sm font-semibold">Visit reason<Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Presenting complaint" /></label>
                <div className="md:col-span-2 xl:col-span-4"><Button onClick={() => void createToken()} disabled={creatingToken}>{creatingToken ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}{creatingToken ? "Generating..." : "Generate walk-in token"}</Button></div>
              </div>
            ) : <p className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">Your role can verify the patient and create appointments. Reception, nursing, records, or administration staff must generate the walk-in token.</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
