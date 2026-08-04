/**
 * Normalizes PostgreSQL JSON/JSONB values and legacy browser values into arrays.
 * Handles real arrays, JSON strings, PGobject-shaped objects, PostgreSQL array text,
 * and comma/semicolon/newline-delimited legacy strings.
 */
export function normalizeJsonArray<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value == null) return [];

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("value" in record) return normalizeJsonArray<T>(record.value);
    return [];
  }

  if (typeof value !== "string") return [];
  const text = value.trim();
  if (!text || text === "null" || text === "undefined") return [];

  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed !== text) return normalizeJsonArray<T>(parsed);
  } catch {
    // Continue with legacy text formats.
  }

  if (text.startsWith("{") && text.endsWith("}")) {
    return text
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim().replace(/^"|"$/g, ""))
      .filter(Boolean) as T[];
  }

  return [];
}

export function normalizeStringList(value: unknown): string[] {
  const normalized = normalizeJsonArray<unknown>(value)
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
  if (normalized.length) return normalized;

  if (typeof value === "object" && value !== null && "value" in (value as Record<string, unknown>)) {
    return normalizeStringList((value as Record<string, unknown>).value);
  }

  if (typeof value !== "string") return [];
  const text = value.trim();
  if (!text || text === "null" || text === "undefined" || text === "[]") return [];

  return text
    .replace(/^\[|\]$/g, "")
    .split(/[,;\n]+/)
    .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

export function formatStringList(value: unknown, fallback = "None recorded"): string {
  const items = normalizeStringList(value);
  return items.length ? items.join(", ") : fallback;
}
