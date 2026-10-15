import { apiRequest } from "./apiClient";

export type RenalModelKey = "hb" | "urr" | "hyperkalemia" | "dry-weight";
export type RenalMeasurementKey = "hb" | "albumin" | "calcium" | "sodium" | "potassium_pre" |
  "potassium_post" | "creatinine_pre" | "creatinine_post" | "urea_pre" | "urea_post" | "dry_weight";
export type RenalReviewAction = "ACCEPT" | "MODIFY" | "DEFER" | "DISMISS";
export type RenalObservation = {
  id: string;
  observed_at: string;
  maintenance_hemodialysis_verified: boolean;
  measurements: Partial<Record<RenalMeasurementKey | "urr", number>>;
  units: Partial<Record<RenalMeasurementKey | "urr", string>>;
  source_note: string;
};
export type RenalPredictionOutput = {
  status: string;
  model_key: RenalModelKey;
  model: string;
  model_version: string;
  method: "RESEARCH_MODEL" | "PERSISTENCE_BASELINE";
  algorithm: string;
  prediction: number | null;
  probability: number | null;
  unit: string;
  risk_category: string;
  interval: { low: number; high: number; level: number; method: string } | null;
  validation_status: "INTERNAL_RESEARCH_EVALUATION";
  clinical_validation: "NOT_COMPLETED";
  dataset_permission_status: "UNVERIFIED";
  requires_clinician_review: true;
  forecast_origin_date?: string;
  forecast_date?: string;
  horizon_days?: number;
  horizon_definition?: string;
  data_quality: { flags: string[]; missing_fields: string[] };
  explanation: {
    method: "SHAP" | "BASELINE";
    top_factors: Array<{ feature: string; value: number | string | null; contribution: number | null; direction: string }>;
    trends: string[];
    limitations: string[];
  };
};
export type RenalPrediction = {
  id: string;
  model_key: RenalModelKey;
  status: string;
  outputs: RenalPredictionOutput;
  created_at: string;
  review_state: RenalReviewAction | "AWAITING_REVIEW";
  review_version: number;
  reason?: string | null;
  note?: string | null;
  modified_interpretation?: string | null;
};
export type RenalCompositeComponent = {
  metric: string;
  label: string;
  adverseDirection: "RISING" | "FALLING";
  trendDirection: "RISING" | "FALLING" | "STABLE" | "INSUFFICIENT_DATA";
  current: number | null;
  previous: number | null;
  unit: string;
  evaluable: boolean;
  worsening: boolean;
};
export type RenalDeteriorationComposite = {
  status: "INSUFFICIENT_DATA" | "NO_ADVERSE_DIRECTION_DETECTED" | "MIXED_TRAJECTORY" | "MULTIDOMAIN_WORSENING_SIGNAL";
  scorePercent: number | null;
  evaluatedComponents: number;
  worseningComponents: number;
  method: "HEURISTIC_DIRECTIONAL_COMPOSITE";
  validationStatus: "NOT_CLINICALLY_VALIDATED";
  limitations: string[];
  components: RenalCompositeComponent[];
};
export type RenalIntelligence = {
  patientId: string;
  hospitalId: string;
  currentRenalStatus: { stage: string | null; label: string; basis: string; dialysisStatus?:string|null;dialysisVerifiedAt?:string|null;dialysisEvidence?:string|null;dialysisEvidenceId?:string|null };
  observations: RenalObservation[];
  predictions: RenalPrediction[];
  deteriorationComposite: RenalDeteriorationComposite;
  canReview: boolean;
  historyTruncated?: boolean;
};
export type RenalObservationInput = {
  requestId: string;
  observedAt: string;
  maintenanceHemodialysisVerified: boolean;
  measurements: Partial<Record<RenalMeasurementKey, number>>;
  units: Partial<Record<RenalMeasurementKey, string>>;
  sourceNote: string;
  sourceVerified: true;
};
export type RenalDialysisVerificationInput={requestId:string;status:"MAINTENANCE_HD"|"NOT_ON_MAINTENANCE_HD"|"UNCONFIRMED";verifiedAt:string;sourceNote:string;sourceVerified:true};
export const verifyRenalDialysisStatus=(patientId:string,input:RenalDialysisVerificationInput,signal?:AbortSignal)=>apiRequest<{id:string;saved:boolean}>(`/api/ai-cdss/ckd/patients/${encodeURIComponent(patientId)}/renal-intelligence/dialysis-status`,{method:"POST",signal,body:JSON.stringify(input)});
export type RenalReviewInput = {
  patientId: string;
  requestId: string;
  expectedVersion: number;
  action: RenalReviewAction;
  reason: string;
  note: string;
  modifiedInterpretation: string;
};

const base = "/api/ai-cdss/ckd";
const patientPath = (patientId: string) => `${base}/patients/${encodeURIComponent(patientId)}/renal-intelligence`;

export const getRenalIntelligence = (patientId: string, signal?: AbortSignal) =>
  apiRequest<RenalIntelligence>(patientPath(patientId), { signal });

export const recordRenalObservation = (patientId: string, input: RenalObservationInput, signal?: AbortSignal) =>
  apiRequest<{ id: string; saved: boolean }>(`${patientPath(patientId)}/observations`, {
    method: "POST", signal, body: JSON.stringify(input),
  });

export const predictRenalOutcome = (patientId: string, modelKey: RenalModelKey, requestId: string, signal?: AbortSignal) =>
  apiRequest<RenalPrediction>(`${patientPath(patientId)}/predict`, {
    method: "POST", signal, body: JSON.stringify({ requestId, modelKey }),
  });

export const reviewRenalPrediction = (predictionId: string, input: RenalReviewInput, signal?: AbortSignal) =>
  apiRequest<{ id: string; reviewState: RenalReviewAction; reviewVersion: number; saved: boolean }>(
    `${base}/renal-intelligence/predictions/${encodeURIComponent(predictionId)}/review`, {
      method: "POST", signal, body: JSON.stringify(input),
    });

export const renalModuleOrder = ["renalTrajectory", "kidneyFailureStatus", "hyperkalemia", "anemia", "dialysisAdequacy", "renalDeterioration"] as const;
export type RenalModuleKey = typeof renalModuleOrder[number];
export type RenalModuleStatus = "AVAILABLE" | "PARTIALLY_CALCULATED" | "INSUFFICIENT_DATA" | "NOT_INSTALLED" | "NOT_APPLICABLE" | "BLOCKED_BY_SAFETY_GATE" | "RESEARCH_MODEL" | "NOT_CLINICALLY_VALIDATED" | "ERROR";
export type RenalDataAction = { type: "ADD_CLINICAL_HISTORY" | "ADD_LAB_RESULT" | "VERIFY_DIALYSIS_STATUS" | "VIEW_HISTORY" | "OPEN_CLINICAL_RECORD" | "VIEW_MODEL_STATUS" | "RUN_MODEL" | "RETRY_MODEL" | "REVIEW_MODULE"; label: string; focusKey: string | null };
export type RenalRequirement = {
  key: string; groupKey: string; label: string; required: boolean; minimumCount: number; availableCount: number;
  state: "AVAILABLE" | "MISSING" | "MISSING_HISTORY" | "INVALID" | "STALE" | "NOT_REQUIRED" | "UNVERIFIED";
  satisfied: boolean; additionalCount: number; detail: string; action: RenalDataAction["type"]; focusKey: string | null;
  latestAt: string | null; previousAt: string | null; moduleKey?: RenalModuleKey;
};
export type RenalReadiness = {
  clinicalDataReadiness?: { percent: number; availableCount: number; requiredCount: number; missingCount: number; policy: string };
  status: RenalModuleStatus; ready: boolean; method: string; resultTitle: string; message: string;
  requirements: RenalRequirement[]; missingCount: number; readyCount: number; requirementCount: number;
  requiredCount: number; requiredReadyCount: number; dataPointsUsed: number; lastUpdated: string | null; lastEvaluated: string;
  technicalReference: string | null; nextAction: RenalDataAction; measurementNote?: string; partial?: boolean; minimumDomains?: number;
  evaluableDomains?: number; requirementPolicy?: string;
  trend?: { ready: boolean; minimumCount: number; availableCount: number; message: string };
  forecast?: { ready: boolean; minimumObservations: number; availableObservations: number; message: string };
  measured?: { ready: boolean; value: number | null }; modelFeatureContract?: string[]; requiredMeasurements?: string[];
  servingContract?: Record<string, unknown>; dataUsed: Array<{ id: string; observedAt: string; sourceNote: string }>;
  excludedData: Array<{ sourceId: string; observedAt: string; reason: string }>;
};
export type RenalClinicalModule = {
  researchModel?:{method:string;model:string;modelVersion:string;algorithm:string;population:string;validationStatus:string;clinicalValidationStatus:string};
  clinicalAssessment?: ClinicalMappedAssessment; researchReadiness?: RenalReadiness; researchStatus?: RenalModuleStatus;
  readiness: RenalReadiness; latestEgfr?: number | null; egfrAt?: string | null;
  key: RenalModuleKey; label: string; status: RenalModuleStatus; method: string; signal: string;
  currentValue: number | null; previousValue: number | null; unit?: string; currentAt: string | null; previousAt: string | null;
  absoluteChange?: number | null; trendDirection?: string; usablePoints: number; dataReliability: string;
  trendPoints?: Array<{ observedAt: string; value: number }>;
  domains?: Array<RenalClinicalModule & { metric: string; evaluable: boolean; worsening: boolean; adverseDirection: string }>;
  sources: Array<{ id: string; observedAt: string; sourceNote: string }>;
  modelKey?: RenalModelKey; model?: string; modelVersion?: string; modelStatus?: string; algorithm?: string; population?: string;
  forecast: number | null; researchRiskScore: number | null; directionalPercent?: number | null;
  evaluatedComponents?: number; worseningComponents?: number; horizon: string | null; formula?: string;
  validationStatus: string; clinicalValidationStatus?: string; disclaimer?: string; canRun?: boolean;
  lastUpdated: string | null; lastRun?: string | null; dataQualityFlags: string[]; limitations: string[];
  topFactors: Array<{ feature: string; value: number | null; contribution: number | null; direction: string }>;
  inputMeasurements?: Record<string, number>; inputUnits?: Record<string,string>; postHdPotassium?: number | null; potassiumDifference?: number | null;
  renalStatus?: string; dialysisStatus?: string; evidenceSource?: string; lastVerifiedDate?: string | null; ruleStatus?: string;
  moduleReviewState: RenalReviewAction | "AWAITING_REVIEW"; moduleReviewVersion: number;
  clinicianReview?: { action: string; actor_id: string; created_at: string; reason: string; clinical_note?: string; modified_interpretation?: string } | null;
};
export type ClinicalMappedFeature={key:string;label:string;value:number|null;unit:string;available:boolean;state:string;observedAt:string|null;source:string;sourceId:string;assessmentId:string|null;recordedAt:string|null;qualityFlags:string[];originalUnit?:string};
export type ClinicalMappedAssessment={title:string;method:string;ruleVersion:string;status:"CALCULATED"|"PARTIALLY_CALCULATED"|"INSUFFICIENT_DATA";
  resultTitle:string;message:string;riskLevel:string|null;currentValue:number|null;unit:string|null;currentAt:string|null;
  explanations:string[];recommendations:string[];featuresUsed:ClinicalMappedFeature[];requirements:RenalRequirement[];
  dataReadiness:{percent:number;availableCount:number;requiredCount:number;missingCount:number;policy:string};
  trend?:{ready:boolean;message:string;availableCount:number;currentValue:number|null;previousValue:number|null;currentAt:string|null;previousAt:string|null;
    absoluteChange:number|null;percentChange:number|null;intervalDays:number|null;unit?:string;declineRatePerDay?:number;declineRateUnit?:string;points?:ClinicalMappedFeature[]};
  longitudinalMessage?:string;dialysisMessage?:string;thresholdPolicy?:string;creatinineChangePercent?:number|null;acuteReviewSignal?:boolean;formula?:string};
export type RenalPredictiveIntelligence = RenalIntelligence & Record<RenalModuleKey, RenalClinicalModule> & {
  clinicalFeatureData?:{normalizationVersion:string;mappingVersion:string;latestAssessmentId:string|null;assessmentCount:number;historyTruncated:boolean;
    current:Record<string,ClinicalMappedFeature>;history:Record<string,ClinicalMappedFeature[]>;excludedData:ClinicalMappedFeature[];assessmentSources:Array<{id:string;assessmentId:string;recordedAt:string;observationDate:string|null}>};
  akiRisk?:ClinicalMappedAssessment;
  cardiovascularMonitoring?:ClinicalMappedAssessment & {modelAvailable:boolean;nextAction:RenalDataAction};
  schemaVersion: number;
  readinessSummary: { readyModules: number; totalModules: number; modules: Array<{ key: RenalModuleKey; label: string; ready: boolean; status: RenalModuleStatus; message: string }>;
    missingDataGroups: Array<{ groupKey: string; label: string; requirements: RenalRequirement[] }> };
  snapshotId: string; generatedAt: string; ruleVersion: string; moduleOrder: RenalModuleKey[];
  dataQuality: { usableObservations: number; evaluableDomains: number; reliability: string; flags: string[]; historyTruncated: boolean };
  clinicianReviewStatus: { state: string; pendingModules: number };
};
export const getRenalPredictiveIntelligence = (patientId: string, signal?: AbortSignal) =>
  apiRequest<RenalPredictiveIntelligence>(`${base}/patients/${encodeURIComponent(patientId)}/predictive-intelligence`, { signal });
export const reviewRenalModule = (patientId: string, input: {
  snapshotId: string; requestId: string; moduleKey: RenalModuleKey; expectedVersion: number;
  action: RenalReviewAction; reason: string; note: string; modifiedInterpretation: string;
}, signal?: AbortSignal) => apiRequest<{ saved: boolean; reviewVersion: number }>(
  `${base}/patients/${encodeURIComponent(patientId)}/predictive-intelligence/reviews`, { method: "POST", signal, body: JSON.stringify(input) });
