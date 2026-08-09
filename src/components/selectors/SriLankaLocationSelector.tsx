import { useId } from "react";
import { districtsForProvince, isDistrictInProvince, normaliseSriLankaProvince, provinceForDistrict, SRI_LANKA_DISTRICTS, SRI_LANKA_PROVINCES } from "../../data/sriLankaLocations";
import { SearchableSelect } from "../forms/SearchableSelect";

export function SriLankaLocationSelector({ province, district, onChange, disabled, requiredProvince, requiredDistrict, provinceLabel = "Province", districtLabel = "District" }: { province?: string; district?: string; onChange: (location: { province: string; district: string }) => void; disabled?: boolean; requiredProvince?: boolean; requiredDistrict?: boolean; provinceLabel?: string; districtLabel?: string }) {
  const id = useId();
  const canonicalProvince = normaliseSriLankaProvince(province);
  const districtOptions = (canonicalProvince ? districtsForProvince(canonicalProvince) : SRI_LANKA_DISTRICTS).map((item) => ({ value: item, label: item, description: provinceForDistrict(item) }));
  return <>
    <label htmlFor={`${id}-province`} className="block text-sm font-medium"><span>{provinceLabel}{requiredProvince && <span className="text-rose-500"> *</span>}</span><SearchableSelect id={`${id}-province`} value={canonicalProvince} options={SRI_LANKA_PROVINCES.map((item) => ({ value: item, label: item }))} onChange={(nextProvince) => onChange({ province: nextProvince, district: district && isDistrictInProvince(district, nextProvince) ? district : "" })} placeholder="Select province" disabled={disabled} required={requiredProvince} /></label>
    <label htmlFor={`${id}-district`} className="block text-sm font-medium"><span>{districtLabel}{requiredDistrict && <span className="text-rose-500"> *</span>}</span><SearchableSelect id={`${id}-district`} value={district ?? ""} options={districtOptions} onChange={(nextDistrict) => onChange({ province: nextDistrict ? provinceForDistrict(nextDistrict) : canonicalProvince, district: nextDistrict })} placeholder={canonicalProvince ? "Select district" : "Select any district"} disabled={disabled} required={requiredDistrict} /></label>
  </>;
}
