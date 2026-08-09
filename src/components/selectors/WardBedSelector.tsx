import { useEffect, useState } from "react";
import type { SelectOption } from "../../data/referenceOptions";
import { getAvailableBeds, getDepartmentWards } from "../../services/referenceDataService";
import { SearchableSelect } from "../forms/SearchableSelect";

export function WardBedSelector({ departmentId, wardId, bedId, onChange, requiredWard, requiredBed, availableOnly = true }: { departmentId?: string; wardId?: string; bedId?: string; onChange: (value: { wardId: string; bedId: string }) => void; requiredWard?: boolean; requiredBed?: boolean; availableOnly?: boolean }) {
  const [wards, setWards] = useState<SelectOption[]>([]);
  const [beds, setBeds] = useState<SelectOption[]>([]);
  const [loadingWards, setLoadingWards] = useState(false);
  const [loadingBeds, setLoadingBeds] = useState(false);
  useEffect(() => {
    if (!departmentId) { setWards([]); return; }
    let cancelled = false; setLoadingWards(true);
    void getDepartmentWards(departmentId).then((items) => { if (!cancelled) setWards(items); }).catch(() => { if (!cancelled) setWards([]); }).finally(() => { if (!cancelled) setLoadingWards(false); });
    return () => { cancelled = true; };
  }, [departmentId]);
  useEffect(() => {
    if (!wardId) { setBeds([]); return; }
    let cancelled = false; setLoadingBeds(true);
    void getAvailableBeds(wardId).then((items) => { if (!cancelled) setBeds(items); }).catch(() => { if (!cancelled) setBeds([]); }).finally(() => { if (!cancelled) setLoadingBeds(false); });
    return () => { cancelled = true; };
  }, [availableOnly, wardId]);
  return <>
    <label className="block text-sm font-medium">Ward{requiredWard && <span className="text-rose-500"> *</span>}<SearchableSelect value={wardId ?? ""} options={wards} onChange={(nextWardId) => onChange({ wardId: nextWardId, bedId: "" })} placeholder={loadingWards ? "Loading wards…" : departmentId ? "Select ward" : "Select department first"} disabled={!departmentId || loadingWards} required={requiredWard} emptyMessage="No active wards are configured for this department." /></label>
    <label className="block text-sm font-medium">Bed{requiredBed && <span className="text-rose-500"> *</span>}<SearchableSelect value={bedId ?? ""} options={beds} onChange={(nextBedId) => onChange({ wardId: wardId ?? "", bedId: nextBedId })} placeholder={loadingBeds ? "Loading beds…" : wardId ? "Select available bed" : "Select ward first"} disabled={!wardId || loadingBeds} required={requiredBed} emptyMessage="No available beds match this ward." /></label>
  </>;
}
