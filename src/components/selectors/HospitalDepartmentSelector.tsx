import { useEffect, useMemo, useState } from "react";
import type { SelectOption } from "../../data/referenceOptions";
import { getHospitalDepartments, searchHospitals } from "../../services/referenceDataService";
import { AsyncSearchableSelect } from "../forms/AsyncSearchableSelect";
import { SearchableSelect } from "../forms/SearchableSelect";

export function HospitalDepartmentSelector({ hospitalId, departmentId, onChange, defaultHospital, disabledHospital, requiredHospital, requiredDepartment }: { hospitalId?: string; departmentId?: string; onChange: (value: { hospitalId: string; departmentId: string }) => void; defaultHospital?: SelectOption | null; disabledHospital?: boolean; requiredHospital?: boolean; requiredDepartment?: boolean }) {
  const [departments, setDepartments] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!hospitalId) { setDepartments([]); return; }
    let cancelled = false;
    setLoading(true);
    void getHospitalDepartments(hospitalId).then((items) => { if (!cancelled) setDepartments(items); }).catch(() => { if (!cancelled) setDepartments([]); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [hospitalId]);
  const selectedHospital = useMemo(() => hospitalId && defaultHospital?.value === hospitalId ? defaultHospital : null, [defaultHospital, hospitalId]);
  return <>
    <label className="block text-sm font-medium">Hospital{requiredHospital && <span className="text-rose-500"> *</span>}<AsyncSearchableSelect value={hospitalId} selectedOption={selectedHospital} loadOptions={searchHospitals} onChange={(nextHospitalId) => onChange({ hospitalId: nextHospitalId, departmentId: "" })} placeholder="Search hospital name or code" disabled={disabledHospital} required={requiredHospital} minQueryLength={0} /></label>
    <label className="block text-sm font-medium">Department{requiredDepartment && <span className="text-rose-500"> *</span>}<SearchableSelect value={departmentId ?? ""} options={departments} onChange={(nextDepartmentId) => onChange({ hospitalId: hospitalId ?? "", departmentId: nextDepartmentId })} placeholder={loading ? "Loading departments…" : hospitalId ? "Select department" : "Select a hospital first"} disabled={!hospitalId || loading} required={requiredDepartment} /></label>
  </>;
}
