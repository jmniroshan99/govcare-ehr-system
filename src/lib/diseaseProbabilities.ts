import type { DiseaseProbability, DiseaseProbabilitySnapshot } from "../types/diseaseProbability";

const related = [
  ["ckd_progression", "CKD progression"], ["kfre", "Kidney failure"], ["aki", "Acute kidney injury"],
  ["cardiovascular", "Cardiovascular disease"], ["hyperkalemia", "Hyperkalemia"], ["anemia", "Anemia"],
] as const;
const keys = new Set<string>(["ckd", ...related.map(([key]) => key)]);
const statuses = new Set(["AVAILABLE", "NOT_AVAILABLE", "NOT_CAPTURED", "INSUFFICIENT_DATA", "SUPPRESSED"]);

export function isProbability(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function probabilityText(value: unknown) {
  return isProbability(value) ? `${(value * 100).toFixed(1)}%` : "Data unavailable";
}

/** Never turn null, a percentage-scaled value or model confidence into a disease probability. */
export function hasProbability(entry: DiseaseProbability) {
  return entry.status === "AVAILABLE" && isProbability(entry.probability)
    && Boolean(entry.modelVersion.trim()) && entry.modelVersion !== "not-installed"
    && Boolean(entry.horizon.trim())
    && (entry.key === "ckd" ? entry.validationStatus === "EXISTING_MODEL" : entry.validationStatus === "VALIDATED");
}

function legacy(probability: unknown, modelVersion: string): DiseaseProbabilitySnapshot {
  const current: DiseaseProbability = {
    key: "ckd", label: "Current CKD model", status: isProbability(probability) ? "AVAILABLE" : "NOT_AVAILABLE",
    probability: isProbability(probability) ? probability : null, modelVersion, horizon: "Current assessment",
    validationStatus: "EXISTING_MODEL", reason: "Existing CKD classifier output; separate from confidence and future disease risk.",
    purpose: "Current CKD classification decision support",
  };
  return { schemaVersion: 1, capturedAt: null, entries: [current, ...related.map(([key, label]): DiseaseProbability => ({
    key, label, status: "NOT_CAPTURED", probability: null, modelVersion: "not-recorded", horizon: "Not recorded",
    validationStatus: "NOT_RECORDED", purpose: "Related disease risk model",
    reason: "Related-risk model availability was not captured for this assessment. Run a new assessment to capture it.",
  }))] };
}

function isEntry(value: unknown): value is DiseaseProbability {
  if (!value || typeof value !== "object") return false;
  const e = value as Record<string, unknown>;
  if (!["key", "label", "status", "modelVersion", "horizon", "validationStatus", "reason", "purpose"]
    .every(key => typeof e[key] === "string") || !keys.has(e.key as string) || !statuses.has(e.status as string)
    || !(e.label as string).trim() || !(e.horizon as string).trim() || !(e.reason as string).trim()) return false;
  return e.status === "AVAILABLE" ? hasProbability(e as DiseaseProbability) : e.probability === null;
}

/** A malformed or unrelated snapshot fails closed, including when an old API has no new property. */
export function diseaseProbabilitySnapshot(result: { probability: unknown; modelVersion: string; diseaseProbabilities?: unknown }): DiseaseProbabilitySnapshot {
  const fallback = () => legacy(result.probability, result.modelVersion);
  const raw = result.diseaseProbabilities;
  if (!raw || typeof raw !== "object") return fallback();
  const snapshot = raw as Record<string, unknown>;
  if (snapshot.schemaVersion !== 1 || typeof snapshot.capturedAt !== "string" || !Number.isFinite(Date.parse(snapshot.capturedAt))
    || !Array.isArray(snapshot.entries) || snapshot.entries.length !== keys.size || !snapshot.entries.every(isEntry)
    || new Set(snapshot.entries.map(e => e.key)).size !== keys.size) return fallback();
  const current = snapshot.entries.find(e => e.key === "ckd");
  if (!current || !hasProbability(current) || current.modelVersion !== result.modelVersion
    || !isProbability(result.probability) || Math.abs(current.probability! - result.probability) > .000001) return fallback();
  return snapshot as DiseaseProbabilitySnapshot;
}

export const diseaseAvailabilityLabel = (entry: DiseaseProbability) => ({
  AVAILABLE: "Model output available", NOT_AVAILABLE: "Model unavailable", NOT_CAPTURED: "Not captured",
  INSUFFICIENT_DATA: "More data required", SUPPRESSED: "Clinical review required",
})[entry.status];
