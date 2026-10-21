import type { RenalClinicalModule, RenalModuleKey, RenalPredictiveIntelligence } from "../services/renalIntelligenceService";

/** Presentation only: the existing server remains the authority for clinical rules and model gates. */
export const primaryClinicalRiskOrder: RenalModuleKey[] = ["anemia", "hyperkalemia", "dialysisAdequacy", "renalDeterioration"];
export const supplementaryRenalOrder: RenalModuleKey[] = ["renalTrajectory", "kidneyFailureStatus"];
export const clinicalRiskLabels: Record<RenalModuleKey, { title: string; description: string; measure: string; action: string }> = {
  anemia: { title: "Hemoglobin Assessment", description: "Recorded hemoglobin and context-specific reference comparison", measure: "Recorded hemoglobin", action: "Review blood parameters" },
  hyperkalemia: { title: "Potassium Assessment", description: "Review recorded low or high potassium separately from future prediction", measure: "Recorded potassium", action: "Verify electrolyte results" },
  dialysisAdequacy: { title: "Dialysis Effectiveness Monitoring", description: "Evaluates dialysis waste removal effectiveness", measure: "Measured URR", action: "Add dialysis session" },
  renalDeterioration: { title: "Renal Function Progression", description: "Combines longitudinal renal markers to identify deterioration patterns", measure: "Creatinine change", action: "View renal timeline" },
  renalTrajectory: { title: "CKD Progression / Renal Trajectory", description: "Review eGFR, ACR and recorded renal trends", measure: "Clinical trajectory", action: "Add historical laboratory data" },
  kidneyFailureStatus: { title: "Kidney Failure / Dialysis Status", description: "Review recorded renal stage and verified dialysis context", measure: "Recorded renal status", action: "Review renal clinical evidence" },
};

export function clinicalCompleteness(module: RenalClinicalModule) {
  const coverage=module.clinicalAssessment?.coverage;
  if(coverage)return{percent:coverage.requiredCount?coverage.percent:null,available:coverage.recordedCount,total:coverage.requiredCount,missing:coverage.requiredCount-coverage.recordedCount};
  const declared = module.clinicalAssessment?.dataReadiness ?? module.readiness.clinicalDataReadiness;
  const requirements = module.readiness.requirements.filter(r => r.required);
  const total = declared?.requiredCount ?? requirements.length;
  const available = declared?.availableCount ?? requirements.filter(r => r.satisfied).length;
  // No requirements is unknown coverage, never a fabricated 100%.
  const percent = total > 0 ? Math.round(Math.max(0, Math.min(total, available)) * 100 / total) : null;
  return { percent, available, total, missing: Math.max(0, total - available) };
}

export function clinicalMonitoringPresentation(module: RenalClinicalModule) {
  const c = module.clinicalAssessment, r = module.readiness;
  if(c?.clinicalSignal){const signal=c.clinicalSignal;return{status:signal.label,risk:signal.severity,tone:signal.abnormal?"danger":c.evidenceQuality?.warnings.length?"warning":"info"};}
  if((module.key==="renalDeterioration"||module.key==="renalTrajectory")&&c&&!c.trend?.ready)return{status:"Trend not established",risk:"Not assessed",tone:"warning"};
  const historical = Boolean(r.measurementNote) || c?.featuresUsed.some(f => f.state === "STALE" || (f.key !== "age" && !f.observedAt));
  const review = c?.acuteReviewSignal || c?.riskLevel === "High" ||
    (!c && /MULTIDOMAIN|REVIEW|DECLIN/.test(module.signal));
  if (review) return { status: historical ? "Source review recommended" : "Clinical review recommended", risk: "Review signal", tone: "danger" };
  if (historical) return { status: "Verify measurement date", risk: "Current status unverified", tone: "warning" };
  if (module.status === "ERROR") return { status: "Service unavailable", risk: "Not assessed", tone: "warning" };
  if (module.status === "BLOCKED_BY_SAFETY_GATE") return { status: "Clinical source review", risk: "Assessment withheld", tone: "warning" };
  if (module.status === "NOT_INSTALLED") return { status: "Model unavailable", risk: "Not assessed", tone: "neutral" };
  if (module.status === "NOT_APPLICABLE") return { status: "Verify dialysis context", risk: "Not assessed", tone: "neutral" };
  if (!r.ready) return { status: "Data required", risk: c?.riskLevel ?? "Not assessed", tone: "warning" };
  if (c?.riskLevel === "Monitor" || c?.riskLevel === "Moderate") return { status: "Continued monitoring", risk: "Monitor", tone: "warning" };
  const t = c?.trend;
  const hasStablePair = t?.ready && t.previousValue != null && t.currentValue != null &&
    Math.abs(t.currentValue - t.previousValue) <= Math.abs(t.previousValue) * .01;
  if (hasStablePair || (!c && module.trendDirection === "STABLE" && module.usablePoints >= 2))
    return { status: "Stable", risk: "No adverse trend signal", tone: "success" };
  return { status: "Monitoring", risk: "Clinical context required", tone: "info" };
}

export function clinicalTrendPoints(module: RenalClinicalModule) {
  const t = module.clinicalAssessment?.trend;
  if (module.clinicalAssessment && !t?.ready) return [];
  const raw = t?.points?.map(p => ({ observedAt: p.observedAt ?? "", value: p.value ?? NaN })) ?? module.trendPoints ?? [];
  return raw.filter(p => Number.isFinite(p.value) && Number.isFinite(Date.parse(p.observedAt)))
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt)).slice(-8);
}

/** Generic CKD biomarkers retain their sample context; BUN is never substituted for dialysis urea. */
export function renalProgressionDomains(data: RenalPredictiveIntelligence) {
  const stored = data.renalDeterioration.domains ?? [];
  return ["creatinine_pre", "urea_pre", "potassium_pre", "hb", "albumin", "urr"].map(metric => {
    const domain = stored.find(d => d.metric === metric);
    const key = { creatinine_pre: "creatinine", potassium_pre: "potassium", hb: "hemoglobin" }[metric];
    const current = key ? data.clinicalFeatureData?.current[key] : undefined;
    const dated = key ? (data.clinicalFeatureData?.history[key] ?? []).filter(p=>p.available&&p.value!=null&&p.observedAt).sort((a,b)=>Date.parse(a.observedAt!)-Date.parse(b.observedAt!)) : [];
    const anchor = current?.observedAt ? current : current?.state!=="INVALID"?dated.at(-1):undefined;
    const previous = key && anchor?.observedAt ? (data.clinicalFeatureData?.history[key] ?? [])
      .filter(p => p.available && p.value != null && p.observedAt && Date.parse(p.observedAt) < Date.parse(anchor.observedAt!))
      .sort((a, b) => Date.parse(a.observedAt!) - Date.parse(b.observedAt!)).at(-1) : undefined;
    if (anchor?.available && anchor.value != null && previous?.value != null) {
      const delta = anchor.value - previous.value, neutral = Math.abs(previous.value) * .01;
      return { metric, label: anchor.label, evaluable: true, currentValue: anchor.value, previousValue: previous.value,
        unit: anchor.unit, trendDirection: Math.abs(delta) <= neutral ? "STABLE" : delta > 0 ? "RISING" : "FALLING" };
    }
    return { metric, label: domain?.label ?? { creatinine_pre: "Creatinine", urea_pre: "Urea", potassium_pre: "Potassium", hb: "Hemoglobin", albumin: "Albumin", urr: "URR" }[metric],
      evaluable: Boolean(domain?.evaluable), currentValue: domain?.currentValue ?? null, previousValue: domain?.previousValue ?? null,
      unit: domain?.unit ?? "", trendDirection: domain?.trendDirection ?? "INSUFFICIENT_DATA" };
  });
}
