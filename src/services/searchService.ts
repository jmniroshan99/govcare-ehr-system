import { apiRequest } from "./apiClient";
import type { SmartSearchSuggestion } from "../types/search";

export type SearchScope =
  | "all"
  | "patients"
  | "guardians"
  | "users"
  | "clinical"
  | "appointments"
  | "pharmacy"
  | "laboratory"
  | "radiology"
  | "admissions"
  | "wards"
  | "notifications"
  | "reports";

export async function fetchSmartSearchSuggestions(query: string, limit = 8, scope: SearchScope = "all"): Promise<SmartSearchSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  return apiRequest<SmartSearchSuggestion[]>(
    `/api/search/suggestions?q=${encodeURIComponent(trimmed)}&limit=${limit}&scope=${encodeURIComponent(scope)}`,
  );
}
