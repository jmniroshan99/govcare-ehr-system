import type { SelectHTMLAttributes } from "react";
import {
  districtsForProvince,
  SRI_LANKA_PROVINCES,
} from "../../data/sriLankaLocations";
import { Select } from "../ui/select";

export function SriLankaProvinceSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Select {...props}>
      <option value="">Select province</option>
      {SRI_LANKA_PROVINCES.map((province) => (
        <option key={province} value={province}>{province}</option>
      ))}
    </Select>
  );
}

export function SriLankaDistrictSelect({
  province,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { province?: string | null }) {
  const districts = districtsForProvince(province);
  return (
    <Select {...props}>
      <option value="">Select district</option>
      {districts.map((district) => (
        <option key={district} value={district}>{district}</option>
      ))}
    </Select>
  );
}
