import { useEffect, useState } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { getAuthorizedPatient, getPatientHospitals, searchAuthorizedPatientPage, type AuthorizedPatient, type PatientHospital, type PatientPage } from "../../services/patientService";
import { PatientPhoto } from "../patient/PatientPhoto";
import { calculateAgeYears } from "../../utils/age";
import { patientUuidPattern } from "../../utils/patientNavigation";
import { useAuthStore } from "../../stores/authStore";
import { authorizationContextKey } from "../../lib/accessControl";

type Props = { value: string; initialIdentifier?: string; assessmentLabel?: string; refreshKey?: number; showSelectedSummary?: boolean; onChange: (patient: AuthorizedPatient | null) => void };
const name = (p: AuthorizedPatient) => p.full_name ?? "Unnamed patient";
const number = (p: AuthorizedPatient) => p.patient_no ?? "No patient number";

export function AuthorizedPatientSelect(props: Props) {
  const profile = useAuthStore(state => state.profile);
  return <ScopedPatientSelect key={authorizationContextKey(profile)} {...props} network={profile?.role === "super_admin"} />;
}

function ScopedPatientSelect({ value, initialIdentifier, assessmentLabel = "CKD Risk Assessment", refreshKey, showSelectedSummary = true, onChange, network }: Props & { network: boolean }) {
  const [patients, setPatients] = useState<AuthorizedPatient[]>([]);
  const [selected, setSelected] = useState<AuthorizedPatient | null>(null);
  const [search, setSearch] = useState("");
  const [hospitalId, setHospitalId] = useState("");
  const [hospitals, setHospitals] = useState<PatientHospital[]>([]);
  const [page, setPage] = useState(0);
  const [pageInfo, setPageInfo] = useState<PatientPage<AuthorizedPatient>>({ items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [linkError, setLinkError] = useState("");
  const [hospitalError, setHospitalError] = useState("");
  const [retry, setRetry] = useState(0);
  const choose = (patient: AuthorizedPatient | null) => { setSelected(patient); onChange(patient); };

  // This component remounts for a changed authenticated identity, tenant, role or permission set.
  useEffect(() => { onChange(null); }, [onChange]);
  useEffect(() => {
    if (!network) return;
    let active = true;
    void getPatientHospitals().then(items => { if (active) { setHospitals(items); setHospitalError(""); } })
      .catch(e => { if (active) setHospitalError(e instanceof Error ? e.message : "Unable to load hospitals."); });
    return () => { active = false; };
  }, [network, retry]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true); setError("");
    const timer = window.setTimeout(() => {
      void searchAuthorizedPatientPage(search, { hospitalId: hospitalId || undefined, page, pageSize: 50, signal: controller.signal })
        .then(result => { if (active) { setPatients(result.items); setPageInfo(result); } })
        .catch(e => { if (active) { setPatients([]); setPageInfo({ items: [] }); setError(e instanceof Error ? e.message : "Unable to load authorized patients."); } })
        .finally(() => { if (active) setLoading(false); });
    }, search ? 250 : 0);
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [search, hospitalId, page, refreshKey, retry]);

  useEffect(() => {
    if (!initialIdentifier || !patientUuidPattern.test(initialIdentifier)) return;
    let active = true;
    const controller = new AbortController();
    setLinkError("");
    void getAuthorizedPatient(initialIdentifier, controller.signal).then(patient => {
      if (!active) return;
      setSelected(patient); onChange(patient);
      if (network && patient.hospital_id) { setHospitalId(patient.hospital_id); setPage(0); }
    }).catch(e => { if (active) setLinkError(e instanceof Error ? e.message : "This patient link is unavailable for your account."); });
    return () => { active = false; controller.abort(); };
  }, [initialIdentifier, network, onChange]);

  const options = selected && selected.id === value && !patients.some(p => p.id === value) ? [selected, ...patients] : patients;
  const activePatient = selected?.id === value ? selected : options.find(p => p.id === value);
  return <div className="space-y-3">
    {network && <label className="block space-y-1 text-sm font-semibold">Hospital
      <select aria-label="Patient hospital" className="min-h-11 w-full rounded-md border border-border bg-background p-2" value={hospitalId}
        onChange={e => { setHospitalId(e.target.value); setPage(0); setPatients([]); setLinkError(""); choose(null); }}>
        <option value="">All hospitals</option>
        {hospitals.map(h => <option key={h.id} value={h.id}>{h.code} — {h.name}</option>)}
      </select>
    </label>}
    <label htmlFor="authorized-patient-search" className="block text-sm font-semibold">Select authorized patient</label>
    <Input id="authorized-patient-search" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search patient number, name, NIC or UUID" />
    <select aria-label="Select authorized patient" className="min-h-11 w-full rounded-md border border-border bg-background p-2" value={value}
      onChange={e => { setLinkError(""); choose(options.find(p => p.id === e.target.value) ?? null); }} disabled={loading || Boolean(error)}>
      <option value="">{loading ? "Loading authorized patients…" : error ? "Unable to load patients" : patients.length ? "Select a patient" : "No authorized patients found"}</option>
      {options.map(p => <option key={p.id} value={p.id}>{number(p)} — {name(p)}{p.hospital_name ? ` · ${p.hospital_code ?? ""} ${p.hospital_name}` : ""}{p.date_of_birth ? ` · DOB ${p.date_of_birth}` : ""}</option>)}
    </select>
    <p className="text-xs text-muted-foreground">{network ? "Super Admin: patients across the hospital network. Choose a hospital or search to narrow the list." : "Only patients authorized for your account are listed."}</p>
    {network && pageInfo.total !== undefined && <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <span aria-live="polite">{pageInfo.total.toLocaleString()} matching patients · Page {page + 1} of {Math.max(1, Math.ceil(pageInfo.total / 50))}</span>
      <div className="flex gap-2"><Button variant="outline" type="button" disabled={loading || page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button><Button variant="outline" type="button" disabled={loading || !pageInfo.hasNext} onClick={() => setPage(p => p + 1)}>Next</Button></div>
    </div>}
    {activePatient && showSelectedSummary && <div className="rounded-xl border border-info-border bg-info-surface p-3 text-info dark:bg-info-surface dark:text-info">
      <div className="flex items-center gap-4"><PatientPhoto src={activePatient.profile_photo_url} name={name(activePatient)} alt={`Profile photo of ${name(activePatient)}`} className="h-20 w-20 rounded-full border-2 border-info-border bg-info-surface shadow-sm" fallbackClassName="text-xl font-bold text-info dark:text-info" />
        <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-info dark:text-info">Assessment for</p><p className="truncate text-lg font-bold">{name(activePatient)}</p><p className="font-semibold text-info dark:text-info">{number(activePatient)}</p>
          {activePatient.hospital_name && <p className="text-sm font-semibold">{activePatient.hospital_code} · {activePatient.hospital_name}</p>}
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs"><span>DOB: {activePatient.date_of_birth || "Not recorded"}</span><span>Age: {calculateAgeYears(activePatient.date_of_birth) ?? "N/A"}</span><span>Gender: {activePatient.gender?.replaceAll("_", " ") || "Not recorded"}</span>{activePatient.nic && <span>NIC: {activePatient.nic}</span>}</div><p className="mt-1 text-xs font-semibold">{assessmentLabel}</p>
        </div>
      </div>
    </div>}
    {(error || hospitalError) && <div role="alert" className="rounded-lg bg-danger-surface p-3 text-sm text-danger"><p>{error || hospitalError}</p><Button variant="outline" type="button" onClick={() => setRetry(n => n + 1)}>Retry loading</Button></div>}
    {linkError && <p role="alert" className="rounded-lg bg-warning-surface p-3 text-sm text-warning">{linkError} Select another authorized patient from the list.</p>}
  </div>;
}
