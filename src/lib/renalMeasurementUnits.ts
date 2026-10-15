import type { RenalMeasurementKey } from "../services/renalIntelligenceService";

export type RenalChartMeasurementKey = RenalMeasurementKey | "urr";
const chartUnits: Record<RenalChartMeasurementKey, string> = {
  hb: "g/dL", albumin: "g/L", calcium: "mmol/L", sodium: "mmol/L",
  potassium_pre: "mmol/L", potassium_post: "mmol/L",
  creatinine_pre: "umol/L", creatinine_post: "umol/L",
  urea_pre: "mmol/L", urea_post: "mmol/L", dry_weight: "kg", urr: "%",
};

/** Normalize unit spelling only; missing or unrelated units stay unresolved. */
export const renalUnitName = (unit?: string | null) => (unit ?? "")
  .replaceAll("μ", "u").replaceAll("µ", "u").trim().toLowerCase();
export const renalChartUnit = (metric: RenalChartMeasurementKey) => chartUnits[metric];

/** Chart-only conversions. Original clinical observations must remain intact.
 * Urea means whole urea, never blood urea nitrogen (BUN). A ratio/fraction is
 * never silently converted to URR %. No inferred units or other conversions.
 */
export function normalizeRenalChartMeasurement(metric: RenalChartMeasurementKey, value: unknown, sourceUnit?: string | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const unit = renalChartUnit(metric), source = renalUnitName(sourceUnit);
  if (source === renalUnitName(unit)) return { value, unit, converted: false };
  let normalized: number;
  if (metric === "hb" && source === "g/l") normalized = value / 10;
  else if (metric === "albumin" && source === "g/dl") normalized = value * 10;
  else if ((metric === "creatinine_pre" || metric === "creatinine_post") && source === "mg/dl") normalized = value * 88.4;
  else if ((metric === "urea_pre" || metric === "urea_post") && source === "mg/dl") normalized = value / 6.006;
  else return null;
  return Number.isFinite(normalized) ? { value: normalized, unit, converted: true } : null;
}
