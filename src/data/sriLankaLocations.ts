export const SRI_LANKA_DISTRICTS_BY_PROVINCE = {
  "Western Province": ["Colombo", "Gampaha", "Kalutara"],
  "Central Province": ["Kandy", "Matale", "Nuwara Eliya"],
  "Southern Province": ["Galle", "Matara", "Hambantota"],
  "Northern Province": ["Jaffna", "Kilinochchi", "Mannar", "Mullaitivu", "Vavuniya"],
  "Eastern Province": ["Ampara", "Batticaloa", "Trincomalee"],
  "North Western Province": ["Kurunegala", "Puttalam"],
  "North Central Province": ["Anuradhapura", "Polonnaruwa"],
  "Uva Province": ["Badulla", "Monaragala"],
  "Sabaragamuwa Province": ["Kegalle", "Ratnapura"],
} as const;

export type SriLankaProvince = keyof typeof SRI_LANKA_DISTRICTS_BY_PROVINCE;

export const SRI_LANKA_PROVINCES = Object.keys(SRI_LANKA_DISTRICTS_BY_PROVINCE) as SriLankaProvince[];

export const SRI_LANKA_DISTRICTS: string[] = Object.values(SRI_LANKA_DISTRICTS_BY_PROVINCE).flatMap((districts) => [...districts]);

export function normaliseSriLankaProvince(value?: string | null): SriLankaProvince | "" {
  const cleaned = (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  if (!cleaned) return "";
  return SRI_LANKA_PROVINCES.find((province) => {
    const canonical = province.toLowerCase();
    return cleaned === canonical || cleaned === canonical.replace(/ province$/, "");
  }) ?? "";
}

export function normaliseSriLankaDistrict(value?: string | null): string {
  const cleaned = (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  if (!cleaned) return "";
  return SRI_LANKA_DISTRICTS.find((district) => district.toLowerCase() === cleaned) ?? "";
}

export function isSriLankaProvince(value?: string | null): value is SriLankaProvince {
  return Boolean(value && Object.prototype.hasOwnProperty.call(SRI_LANKA_DISTRICTS_BY_PROVINCE, value));
}

export function isSriLankaDistrict(value?: string | null): boolean {
  return Boolean(value && SRI_LANKA_DISTRICTS.includes(value));
}

export function districtsForProvince(province?: string | null): readonly string[] {
  const canonicalProvince = normaliseSriLankaProvince(province);
  return canonicalProvince ? SRI_LANKA_DISTRICTS_BY_PROVINCE[canonicalProvince] : SRI_LANKA_DISTRICTS;
}

export function provinceForDistrict(district?: string | null): SriLankaProvince | "" {
  const canonicalDistrict = normaliseSriLankaDistrict(district);
  if (!canonicalDistrict) return "";
  return SRI_LANKA_PROVINCES.find((province) => (SRI_LANKA_DISTRICTS_BY_PROVINCE[province] as readonly string[]).includes(canonicalDistrict)) ?? "";
}

export function isDistrictInProvince(district?: string | null, province?: string | null): boolean {
  const canonicalProvince = normaliseSriLankaProvince(province);
  const canonicalDistrict = normaliseSriLankaDistrict(district);
  if (!canonicalDistrict || !canonicalProvince) return false;
  return (SRI_LANKA_DISTRICTS_BY_PROVINCE[canonicalProvince] as readonly string[]).includes(canonicalDistrict);
}
