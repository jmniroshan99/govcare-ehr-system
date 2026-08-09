import type { SelectOption } from "../data/referenceOptions";
import { apiRequest } from "./apiClient";

export type ReferenceRecord = {
  id: string;
  code?: string;
  name?: string;
  label?: string;
  description?: string;
  hospital_id?: string;
  hospital_name?: string;
  department_id?: string;
  department_name?: string;
  role?: string;
  status?: string;
  available_beds?: number;
  ward_id?: string;
  ward_name?: string;
  bed_no?: string;
  bed_type?: string;
  room_no?: string;
  stock?: number;
  generic_name?: string;
  dosage_form?: string;
  strength?: string;
  specimen_type?: string;
  turnaround_minutes?: number;
  modality?: string;
  body_region?: string;
};

type ItemsResponse<T = ReferenceRecord> = { items: T[] };

function option(record: ReferenceRecord, fallbackDescription?: string): SelectOption {
  const label = record.label ?? record.name ?? [record.code, record.id].filter(Boolean).join(" · ");
  const description = [...new Set([record.code, record.description ?? fallbackDescription].filter(Boolean) as string[])].join(" · ");
  return {
    value: record.id,
    label,
    description: description || undefined,
    disabled: record.status ? !["active", "available"].includes(record.status.toLowerCase()) : false,
    keywords: [record.code, record.hospital_name, record.department_name, record.role, record.generic_name, record.strength, record.dosage_form].filter(Boolean) as string[],
    meta: record as Record<string, unknown>,
  };
}

export async function getReferenceList(type: "provinces" | "blood-groups" | "languages" | "titles" | "genders" | "marital-statuses" | "countries" | "specimen-types" | "radiology-modalities") {
  const result = await apiRequest<ItemsResponse<{ value: string; label: string; description?: string }>>(`/api/reference/${type}`);
  return result.items.map((item) => ({ value: item.value, label: item.label, description: item.description }));
}

export async function searchCountries(query: string) {
  const result = await apiRequest<ItemsResponse<{ value: string; label: string; code?: string }>>(`/api/reference/countries?q=${encodeURIComponent(query)}&limit=80`);
  return result.items.map((item) => ({ value: item.value, label: item.label, description: item.code }));
}

export async function getDistricts(province?: string) {
  const path = province ? `/api/reference/provinces/${encodeURIComponent(province)}/districts` : "/api/reference/districts";
  const result = await apiRequest<ItemsResponse<{ value: string; label: string; province: string }>>(path);
  return result.items.map((item) => ({ value: item.value, label: item.label, description: item.province }));
}

export async function searchHospitals(query = "") {
  const result = await apiRequest<ItemsResponse>(`/api/hospitals/search?q=${encodeURIComponent(query)}&limit=30`);
  return result.items.map((item) => option(item, [item.code, item.description].filter(Boolean).join(" · ")));
}

export async function getHospitalDepartments(hospitalId: string) {
  const result = await apiRequest<ItemsResponse>(`/api/hospitals/${encodeURIComponent(hospitalId)}/departments`);
  return result.items.map((item) => option(item, item.code));
}

export async function getDepartmentWards(departmentId: string) {
  const result = await apiRequest<ItemsResponse>(`/api/departments/${encodeURIComponent(departmentId)}/wards`);
  return result.items.map((item) => option(item, `${item.code ?? "Ward"} · ${item.available_beds ?? 0} beds available`));
}

export async function getAvailableBeds(wardId: string) {
  const result = await apiRequest<ItemsResponse>(`/api/wards/${encodeURIComponent(wardId)}/available-beds`);
  return result.items.map((item) => option({ ...item, name: item.bed_no ?? item.name }, [item.room_no && `Room ${item.room_no}`, item.bed_type, item.status].filter(Boolean).join(" · ")));
}

export async function searchStaff(query: string, filters: { hospitalId?: string; departmentId?: string; role?: string; permission?: string } = {}) {
  const params = new URLSearchParams({ q: query, limit: "30" });
  Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
  const result = await apiRequest<ItemsResponse>(`/api/staff/search?${params}`);
  return result.items.map((item) => option(item, [item.role?.replaceAll("_", " "), item.department_name, item.hospital_name].filter(Boolean).join(" · ")));
}

export async function searchPatients(query: string) {
  const result = await apiRequest<ItemsResponse>(`/api/patients/search?q=${encodeURIComponent(query)}&limit=30`);
  return result.items.map((item) => option(item, item.description));
}

export async function searchAdmissions(query: string) {
  const result = await apiRequest<ItemsResponse>(`/api/admissions/search?q=${encodeURIComponent(query)}&limit=30`);
  return result.items.map((item) => option(item, item.description));
}

export async function searchMedicines(query: string) {
  const result = await apiRequest<ItemsResponse>(`/api/medicines/search?q=${encodeURIComponent(query)}&limit=30`);
  return result.items.map((item) => option(item, [item.generic_name, item.strength, item.dosage_form, `${item.stock ?? 0} in stock`].filter(Boolean).join(" · ")));
}

export async function searchDiagnoses(query: string) {
  const result = await apiRequest<ItemsResponse>(`/api/diagnoses/search?q=${encodeURIComponent(query)}&limit=30`);
  return result.items.map((item) => option(item, item.description));
}

export async function searchLaboratoryTests(query: string) {
  const result = await apiRequest<ItemsResponse>(`/api/laboratory-tests/search?q=${encodeURIComponent(query)}&limit=30`);
  return result.items.map((item) => option(item, [item.code, item.specimen_type, item.turnaround_minutes ? `${item.turnaround_minutes} min` : ""].filter(Boolean).join(" · ")));
}

export async function searchRadiologyStudies(query: string) {
  const result = await apiRequest<ItemsResponse>(`/api/radiology-studies/search?q=${encodeURIComponent(query)}&limit=30`);
  return result.items.map((item) => option(item, [item.code, item.modality, item.body_region].filter(Boolean).join(" · ")));
}
