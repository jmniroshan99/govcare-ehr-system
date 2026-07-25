import { apiRequest } from "./apiClient";
import { getLocalSmartSearchSuggestions, type SmartSearchSuggestion } from "../utils/smartSearch";

export async function fetchSmartSearchSuggestions(query: string, limit = 8): Promise<SmartSearchSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  try {
    return await apiRequest<SmartSearchSuggestion[]>(`/api/search/suggestions?q=${encodeURIComponent(trimmed)}&limit=${limit}`);
  } catch {
    return getLocalSmartSearchSuggestions(trimmed, limit);
  }
}
