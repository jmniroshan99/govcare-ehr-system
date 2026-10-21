import { apiRequest } from "./apiClient";
import type { AuthorizedPatient } from "./patientService";

export type ForecastMethod = "TREND_PROJECTION" | "VALIDATED_EQUATION" | "RULE_BASED" | "RESEARCH_MODEL";
export type PredictionStatus = "AVAILABLE" | "NOT_LOCALLY_VALIDATED" | "INSUFFICIENT_DATA" | "NOT_INSTALLED" | "BLOCKED_BY_SAFETY_GATE";
export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH" | "CRITICAL";
export type Metric = "egfr" | "creatinine" | "acr" | "systolic" | "diastolic" | "hba1c" | "glucose" |
  "potassium" | "hemoglobin" | "bun" | "bmi" | "weight" | "total_cholesterol" | "hdl" | "ldl" | "triglycerides";
export type ClinicalObservation = {
  id: string; metric: Metric; value: number; unit: string; observedAt: string;
  source: string; sourceId: string | null; referenceLow: number | null; referenceHigh: number | null;
  code: string | null; originalValue: number; originalUnit: string; originalMetric: string | null;
  originalReferenceLow: number | null; originalReferenceHigh: number | null;
};
export type ClinicalTrend = {
  metric: Metric; label: string; unit: string; latest: ClinicalObservation | null;
  previous: ClinicalObservation | null; baseline: ClinicalObservation | null;
  absoluteChange: number | null; percentChange: number | null; slopePerYear: number | null;
  windows: Array<{ days: number; baseline: ClinicalObservation | null; absoluteChange: number | null; percentChange: number | null; count: number }>;
  observations: ClinicalObservation[]; observationCount: number; firstObservationDate: string | null;
  lastObservationDate: string | null; dataFreshness: "FRESH" | "STALE" | "MISSING" | "UNRESOLVED" | "UNKNOWN";
  daysSinceLatest: number | null; trendDirection: string;
};
export type ClinicalFinding = {
  key: string; title: string; reason: string; priority: "URGENT" | "PRIORITY" | "ROUTINE";
  category: "REVIEW" | "CARE_GAP"; source: string; suggestedAction: string;
  evidenceIds: string[]; evidenceFingerprint: string;
};
export type ReviewedFinding = {
  id: string; finding: ClinicalFinding; reviewState: ReviewAction | "AWAITING_REVIEW"; version: number;
  reason: string | null; reasonCode: ReviewReasonCode | null; clinicalNote: string | null;
  modifiedRecommendation: string | null; reviewedAt: string | null;
};
export type ReviewAction = "ACCEPT" | "MODIFY" | "DISMISS" | "DEFER";
export type ReviewReasonCode = "CLINICAL_JUDGMENT" | "INCORRECT_DATA" | "ALREADY_MANAGED" | "CONTRAINDICATED" |
  "PATIENT_PREFERENCE" | "NOT_RELEVANT" | "OTHER";
export type MonitoringSignal = {
  status: string; category: string | null; reason: string; currentValue: number | null; previousValue: number | null;
  unit: string; trendDirection: string; freshness: string; reasoning: string[]; recommendation: string; evidenceIds: string[];
};
export type PredictiveRiskCapability = {
  key: string; label: string; status: PredictionStatus | "REVIEW_REQUIRED" | "NO_CURRENT_TRIGGER";
  reason: string; probability: number | null; modelVersion: string; purpose: string; method: ForecastMethod;
  validationStatus: string; horizon: string; category: RiskLevel | "NORMAL" | "MONITOR" | "MODERATE_CONCERN" |
    "HIGH_CONCERN" | "POSSIBLE_AKI" | "RAPID_RENAL_CHANGE" | "REVIEW_CONTEXT" | "INSUFFICIENT_DATA" |
    "RAPID_DECLINE_SIGNAL" | "DECLINING" | "STABLE" | "IMPROVING" | "UNAVAILABLE" | null;
  confidence: "LOW" | "MODERATE" | "HIGH" | null; modelName: string; localValidationStatus: string;
  runtimeStatus: string; requiredInputs: string[]; missingInputs: string[]; applicableCkdStages: string[];
  reference: string | null; lastCalculated: string; signal: MonitoringSignal | null;
};
export type ClinicalOverview = {
  patient: AuthorizedPatient;
  analysis: {
    generatedAt: string; ruleVersion: string; trends: ClinicalTrend[];
    quality: {
      includedCount: number; excludedCount: number; freshMetricCount: number; expectedMetricCount: number;
      completenessPercent: number | null; policy: string; missingMetrics: Metric[];
      flags: Array<{ code: string; message: string; observationId: string | null; metric: Metric | null }>;
      qualityLevel: "HIGH" | "MODERATE" | "LIMITED" | "UNUSABLE";
    };
    classification: { gCategory: string | null; aCategory: string | null; chronicity: string; explanation: string };
    safety: { status: string; forecastSuppressed: boolean; reasons: string[]; source: string };
    findings: ClinicalFinding[];
  };
  recommendations: ReviewedFinding[];
  risks: PredictiveRiskCapability[];
  timeline: Array<{ id: string; type: string; title: string; detail: string | null; occurredAt: string | null; source: string }>;
  canReview: boolean; historyTruncated: boolean; medicationContext: string;
  medications: { classes: string[]; prescriptions: Array<{ id: string; name: string; recordedAt: string; classes: string[] }>;
    recorded: boolean; reconciled: boolean; limitation: string };
};
export type ForecastOutput = {
  status: string; horizonMonths: number; currentEgfr: number | null; projectedEgfr: number | null;
  projectedEgfrLow: number | null; projectedEgfrHigh: number | null; slopePerYear: number | null;
  trendDirection: string; trendSeverity: string; reliability: string; observationCount: number;
  observationWindowDays: number; method: "TREND_PROJECTION"; modelVersion: string;
  validationStatus: string; localValidationStatus: string; forecastOriginDate: string; forecastDate: string;
  intervalMethod: string; explanation: string;
};
export type ForecastResult = { id: string; horizon_months: number; status: PredictionStatus; explanation: string; outputs: ForecastOutput | []; created_at: string };
export type MeasurementMetric = Metric | "urea" | "albumin" | "sodium" | "calcium";
export type MeasurementInput = { metric: MeasurementMetric; value: number; unit: string; observedAt: string; referenceLow: number | null;
  referenceHigh: number | null; sourceNote: string; sourceVerified: boolean };
const base = "/api/ai-cdss/ckd";
// ClinicalOverview and the six-module renal snapshot have different response contracts.
export const getPredictiveOverview = (patientId: string, signal?: AbortSignal) =>
  apiRequest<ClinicalOverview>(`${base}/patients/${encodeURIComponent(patientId)}/intelligence`, { signal });
export const getClinicalIntelligence = getPredictiveOverview;
export const getClinicalTrends = (patientId: string, signal?: AbortSignal) =>
  apiRequest<ClinicalTrend[]>(`${base}/patients/${encodeURIComponent(patientId)}/trends`, { signal });
export const getPredictiveDataQuality = (patientId: string, signal?: AbortSignal) =>
  apiRequest<ClinicalOverview["analysis"]["quality"]>(`${base}/patients/${encodeURIComponent(patientId)}/data-quality`, { signal });
export const getPredictiveTimeline = (patientId: string, signal?: AbortSignal) =>
  apiRequest<ClinicalOverview["timeline"]>(`${base}/patients/${encodeURIComponent(patientId)}/timeline`, { signal });
export const getPredictiveRisk = (patientId: string, riskKey: string, signal?: AbortSignal) =>
  apiRequest<ClinicalOverview["risks"][number]>(`${base}/patients/${encodeURIComponent(patientId)}/risk/${encodeURIComponent(riskKey)}`, { signal });
export const checkForecastCapability = (patientId: string, horizonMonths: number, signal?: AbortSignal) =>
  apiRequest<ForecastResult>(`${base}/patients/${encodeURIComponent(patientId)}/forecast`, {
    method: "POST", signal, body: JSON.stringify({ requestId: crypto.randomUUID(), horizonMonths }),
  });
export const getCkdProgressionForecast = (patientId: string, horizonMonths = 12, signal?: AbortSignal) =>
  apiRequest<ForecastOutput | { status: "NOT_INSTALLED"; method: "TREND_PROJECTION"; projected: false; reason: string }>(
    `${base}/patients/${encodeURIComponent(patientId)}/forecast/ckd-progression?horizonMonths=${horizonMonths}`, { signal });
export const getKidneyFailureRisk = (patientId: string, signal?: AbortSignal) => getPredictiveRisk(patientId, "kidney-failure", signal);
export const getHyperkalemiaRisk = (patientId: string, signal?: AbortSignal) => getPredictiveRisk(patientId, "hyperkalemia", signal);
export const getAnemiaRisk = (patientId: string, signal?: AbortSignal) => getPredictiveRisk(patientId, "anemia", signal);
export const getCardiovascularRisk = (patientId: string, signal?: AbortSignal) => getPredictiveRisk(patientId, "cardiovascular", signal);

export type ReviewPayload = { action: ReviewAction; reason: string; modifiedRecommendation: string;
  reasonCode: ReviewReasonCode; clinicalNote: string; requestId: string };
export const reviewClinicalFinding = (patientId: string, finding: ReviewedFinding, payload: ReviewPayload,
  signal?: AbortSignal) =>
  apiRequest<{ id: string; reviewState: ReviewAction; version: number; saved: boolean }>(`${base}/recommendations/${encodeURIComponent(finding.id)}/review`, {
    method: "POST", signal, body: JSON.stringify({ patientId, expectedVersion: finding.version,
      evidenceFingerprint: finding.finding.evidenceFingerprint, ...payload }),
  });
export const reviewRecommendation = reviewClinicalFinding;
export const recordVerifiedMeasurement = (patientId: string, input: MeasurementInput, requestId: string, signal?: AbortSignal) =>
  apiRequest<{ id: string; saved: boolean }>(`${base}/patients/${encodeURIComponent(patientId)}/observations`, {
    method: "POST", signal, body: JSON.stringify({ ...input, requestId }),
  });
