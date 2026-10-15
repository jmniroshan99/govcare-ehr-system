import { useRef } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, BrainCircuit, Check, Circle, Clock3, Droplets, HeartPulse, Info, Stethoscope, Waves } from "lucide-react";
import { Button } from "../ui/button";
import type { RenalDataAction, RenalModuleKey, RenalPredictiveIntelligence, ClinicalMappedFeature } from "../../services/renalIntelligenceService";
import "./ckd-related-clinical-dashboard.css";

type DashboardCardKey = "anemia" | "hyperkalemia" | "dialysisAdequacy" | "renalDeterioration" | "cardiovascular";
type EvidenceItem = { key: string; label: string; available: boolean; value?: string; detail?: string; state?: string };
type TrendPoint = { observedAt: string; value: number };
type DashboardCard = {
  key: DashboardCardKey; title: string; icon: typeof Droplets; status: string; tone: string; availableCount: number; totalCount: number;
  currentLabel: string; currentValue: string; message: string; explanation: string[]; evidence: EvidenceItem[]; missing: string[];
  trend?: TrendPoint[]; trendMessage?: string; formula?: string; moduleKey?: RenalModuleKey; actionLabel: string;
};

const format = (value: number | null | undefined, digits = 2) => typeof value === "number" && Number.isFinite(value)
  ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : "Not recorded";
const feature = (data: RenalPredictiveIntelligence, key: string): ClinicalMappedFeature | undefined => data.clinicalFeatureData?.current[key];
const featureItem = (data: RenalPredictiveIntelligence, key: string, label: string): EvidenceItem => {
  const item = feature(data, key);
  const available = Boolean(item?.available && item.value != null);
  const state = item?.state;
  return { key, label, available, value: available ? `${format(item!.value)} ${item!.unit}` : undefined,
    detail: item?.observedAt ? `Measured ${new Date(item.observedAt).toLocaleDateString()}` : available ? "Date not recorded" : undefined, state };
};
const observationsFor = (data: RenalPredictiveIntelligence, key: string) => [...data.observations]
  .filter(row => Number.isFinite(row.measurements?.[key as keyof typeof row.measurements]) && Number.isFinite(Date.parse(row.observed_at)))
  .sort((a, b) => Date.parse(b.observed_at) - Date.parse(a.observed_at));
const observationItem = (data: RenalPredictiveIntelligence, key: string, label: string): EvidenceItem => {
  const row = observationsFor(data, key)[0], value = row?.measurements[key as keyof typeof row.measurements];
  const unit = row?.units[key as keyof typeof row.units];
  return { key, label, available: typeof value === "number" && Number.isFinite(value),
    value: typeof value === "number" ? `${format(value)} ${unit ?? ""}`.trim() : undefined,
    detail: row ? `Measured ${new Date(row.observed_at).toLocaleDateString()}` : undefined };
};
const observationTrend = (data: RenalPredictiveIntelligence, key: string): TrendPoint[] => observationsFor(data, key).reverse()
  .map(row => ({ observedAt: row.observed_at, value: row.measurements[key as keyof typeof row.measurements]! }))
  .filter(point => typeof point.value === "number");
const featureTrend = (data: RenalPredictiveIntelligence, key: string): TrendPoint[] => (data.clinicalFeatureData?.history[key] ?? [])
  .filter(item => item.available && item.value != null && item.observedAt && Number.isFinite(Date.parse(item.observedAt)))
  .map(item => ({ observedAt: item.observedAt!, value: item.value! }));
const readiness = (items: EvidenceItem[]) => ({ available: items.filter(item => item.available).length, total: items.length });
const moduleExplanations = (data: RenalPredictiveIntelligence, key: RenalModuleKey) =>
  data[key].clinicalAssessment?.explanations ?? [];
const moduleStatus = (data: RenalPredictiveIntelligence, key: RenalModuleKey) => {
  const module = data[key], assessment = module.clinicalAssessment;
  if (!assessment || assessment.status === "INSUFFICIENT_DATA" || assessment.status === "PARTIALLY_CALCULATED") return "Data required";
  if (assessment.acuteReviewSignal || assessment.riskLevel === "High" || assessment.riskLevel === "Clinical Review Signal") return "Clinical review recommended";
  if (assessment.riskLevel === "Monitor") return "Monitoring";
  return "Stable";
};
const makeCards = (data: RenalPredictiveIntelligence): DashboardCard[] => {
  const anemia = data.anemia, potassium = data.hyperkalemia, urr = data.dialysisAdequacy;
  const anemiaEvidence = [featureItem(data, "hemoglobin", "Hemoglobin (Hb)"),
    { key: "pcv", label: "Packed cell volume (PCV)", available: false }, { key: "rbc", label: "RBC count", available: false },
    { key: "ferritin", label: "Ferritin", available: false }, { key: "iron-profile", label: "Iron profile", available: false }];
  const potassiumHistory = featureTrend(data, "potassium");
  const potassiumEvidence = [featureItem(data, "potassium", "Serum potassium"), observationItem(data, "potassium_pre", "Pre-HD potassium"),
    observationItem(data, "potassium_post", "Post-HD potassium"), { key: "potassium-history", label: "Previous potassium history",
      available: potassiumHistory.length > 1, value: potassiumHistory.length > 1 ? `${potassiumHistory.length} dated results` : undefined }];
  const session = [...data.observations].filter(row => Number.isFinite(row.measurements?.urea_pre) || Number.isFinite(row.measurements?.urea_post))
    .sort((a, b) => Date.parse(b.observed_at) - Date.parse(a.observed_at))[0];
  const sessionHasDate = Boolean(session && Number.isFinite(Date.parse(session.observed_at)));
  const dialysisEvidence: EvidenceItem[] = [
    { key: "urea_pre", label: "Pre-HD urea", available: typeof session?.measurements.urea_pre === "number",
      value: typeof session?.measurements.urea_pre === "number" ? `${format(session.measurements.urea_pre)} ${session.units.urea_pre ?? ""}`.trim() : undefined },
    { key: "urea_post", label: "Post-HD urea", available: typeof session?.measurements.urea_post === "number",
      value: typeof session?.measurements.urea_post === "number" ? `${format(session.measurements.urea_post)} ${session.units.urea_post ?? ""}`.trim() : undefined },
    { key: "session-date", label: "Dialysis session date", available: sessionHasDate,
      value: sessionHasDate ? new Date(session!.observed_at).toLocaleDateString() : undefined },
  ];
  const progressionEvidence = [featureItem(data, "creatinine", "Creatinine"), featureItem(data, "bun", "Urea / BUN"),
    featureItem(data, "potassium", "Potassium"), featureItem(data, "hemoglobin", "Hemoglobin"),
    observationItem(data, "albumin", "Albumin"), observationItem(data, "urr", "Measured URR")];
  const cardiovascularEvidence = [featureItem(data, "age", "Age"), featureItem(data, "systolic", "Blood pressure (systolic)"),
    featureItem(data, "potassium", "Potassium"), featureItem(data, "creatinine", "Creatinine"),
    { key: "diabetes-status", label: "Diabetes status", available: false, detail: "No explicit diabetes-status field is mapped." }];
  const anemiaReadiness = readiness(anemiaEvidence), potassiumReadiness = readiness(potassiumEvidence), dialysisReadiness = readiness(dialysisEvidence);
  const progressionReadiness = readiness(progressionEvidence), cvReadiness = readiness(cardiovascularEvidence);
  const potassiumCurrent = featureItem(data, "potassium", "Serum potassium");
  const preHdPotassium = observationItem(data, "potassium_pre", "Pre-HD potassium");
  const potassiumValue = potassiumCurrent.available ? potassiumCurrent.value : preHdPotassium.value;
  const potassiumLabel = potassiumCurrent.available ? "Current potassium" : "Latest pre-HD potassium";
  const urrValue = typeof urr.clinicalAssessment?.currentValue === "number" ? `${format(urr.clinicalAssessment.currentValue)} %` : "Not calculated";
  const composite = data.deteriorationComposite;
  const worsening = composite.components.filter(component => component.evaluable && component.worsening);
  return [
    { key: "anemia", title: "Anemia Monitoring", icon: Droplets, status: moduleStatus(data, "anemia"), tone: "anemia",
      availableCount: anemiaReadiness.available, totalCount: anemiaReadiness.total, currentLabel: "Current Hb",
      currentValue: anemia.clinicalAssessment?.currentValue != null ? `${format(anemia.clinicalAssessment.currentValue)} g/dL` : "Not recorded",
      message: "Monitoring anemia progression associated with CKD.", explanation: moduleExplanations(data, "anemia"), evidence: anemiaEvidence,
      missing: anemiaEvidence.filter(item => !item.available).map(item => item.label), trend: featureTrend(data, "hemoglobin"),
      trendMessage: anemia.clinicalAssessment?.trend?.ready ? `${format(anemia.clinicalAssessment.trend.previousValue)} → ${format(anemia.clinicalAssessment.trend.currentValue)} g/dL` : "Add a second dated Hb result to show a trend.",
      moduleKey: "anemia", actionLabel: "Add blood parameters" },
    { key: "hyperkalemia", title: "Hyperkalemia Risk Monitoring", icon: Activity, status: moduleStatus(data, "hyperkalemia"), tone: "hyperkalemia",
      availableCount: potassiumReadiness.available, totalCount: potassiumReadiness.total, currentLabel: potassiumLabel,
      currentValue: potassiumValue ?? "Not recorded", message: "Detects potassium elevation patterns that may require clinical attention.",
      explanation: moduleExplanations(data, "hyperkalemia"), evidence: potassiumEvidence, missing: potassiumEvidence.filter(item => !item.available).map(item => item.label),
      trend: potassiumHistory, trendMessage: potassium.clinicalAssessment?.trend?.ready ? `${format(potassium.clinicalAssessment.trend.previousValue)} → ${format(potassium.clinicalAssessment.trend.currentValue)} mmol/L` : "Add dated potassium results to show movement.",
      moduleKey: "hyperkalemia", actionLabel: "Add electrolyte results" },
    { key: "dialysisAdequacy", title: "Dialysis Effectiveness Monitoring", icon: Waves,
      status: urr.clinicalAssessment?.status === "CALCULATED" ? "Measured result available" : "Data required", tone: "dialysis",
      availableCount: dialysisReadiness.available, totalCount: dialysisReadiness.total, currentLabel: "Measured URR", currentValue: urrValue,
      message: "Evaluates dialysis waste removal using paired urea from one dated session.", explanation: moduleExplanations(data, "dialysisAdequacy"),
      evidence: dialysisEvidence, missing: dialysisEvidence.filter(item => !item.available).map(item => item.label), trend: observationTrend(data, "urr"),
      trendMessage: "URR is derived by the server from a valid same-session urea pair.", formula: "URR = ((Pre-HD Urea − Post-HD Urea) / Pre-HD Urea) × 100",
      moduleKey: "dialysisAdequacy", actionLabel: "Add dialysis session" },
    { key: "renalDeterioration", title: "Renal Function Progression", icon: Activity,
      status: moduleStatus(data, "renalTrajectory"), tone: "renal", availableCount: progressionReadiness.available, totalCount: progressionReadiness.total,
      currentLabel: "Clinical trajectory", currentValue: data.renalTrajectory.clinicalAssessment?.resultTitle ?? "Monitoring",
      message: "Combines longitudinal renal markers to identify changing clinical patterns.",
      explanation: [...moduleExplanations(data, "renalTrajectory"), ...moduleExplanations(data, "renalDeterioration")], evidence: progressionEvidence,
      missing: progressionEvidence.filter(item => !item.available).map(item => item.label),
      trend: featureTrend(data, "creatinine"), trendMessage: worsening.length ? `${worsening.length} of ${composite.evaluatedComponents} evaluable markers moving in an adverse direction.` : "Two dated results are needed to assess marker direction.",
      moduleKey: "renalDeterioration", actionLabel: "View renal timeline" },
    { key: "cardiovascular", title: "Cardiovascular Risk Surveillance", icon: HeartPulse, status: "Surveillance only", tone: "cardiovascular",
      availableCount: cvReadiness.available, totalCount: cvReadiness.total, currentLabel: "Risk estimate", currentValue: "Not available",
      message: "CKD patients need cardiovascular risk surveillance. No reviewed cardiovascular equation is installed, so no probability is calculated.",
      explanation: ["The project has no reviewed, licensed and population-appropriate cardiovascular equation adapter.", "Available clinical factors are shown for clinician review; data completeness is not disease risk."],
      evidence: cardiovascularEvidence, missing: cardiovascularEvidence.filter(item => !item.available).map(item => item.label), actionLabel: "Review cardiovascular factors" },
  ];
};

function TrendChart({ points, label, emptyMessage }: { points?: TrendPoint[]; label: string; emptyMessage: string }) {
  const valid = (points ?? []).filter(point => Number.isFinite(point.value) && Number.isFinite(Date.parse(point.observedAt))).slice(-8);
  if (valid.length < 2) return <div className="ckd-risk-trend-empty"><Clock3 size={14} />{emptyMessage}</div>;
  const values = valid.map(point => point.value), low = Math.min(...values), high = Math.max(...values), spread = Math.max(high - low, 1e-9);
  const coords = valid.map((point, index) => `${8 + index * (204 / (valid.length - 1))},${47 - ((point.value - low) / spread) * 38}`);
  return <svg className="ckd-risk-trend" viewBox="0 0 220 56" role="img" aria-label={`${label} measured trend, ${valid.length} dated results`}>
    <path d="M7 50 H213" className="ckd-risk-trend-axis"/><polyline points={coords.join(" ")} className="ckd-risk-trend-line" />
    {coords.map((point, index) => <circle key={valid[index].observedAt} cx={point.split(",")[0]} cy={point.split(",")[1]} r="2.8" className="ckd-risk-trend-point" />)}
  </svg>;
}

function EvidenceList({ items }: { items: EvidenceItem[] }) {
  return <ul className="ckd-risk-evidence">{items.map(item => <li key={item.key} data-available={item.available}>
    {item.available ? <Check size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
    <span><strong>{item.label}</strong>{item.value && <b>{item.value}</b>}{item.detail && <small>{item.detail}</small>}
      {item.state === "STALE" && <small>Historical measurement; verify current status.</small>}</span>
  </li>)}</ul>;
}

export function CkdRelatedClinicalDashboard({ data, canWrite, busyModel, onAction, onRun, onShowTimeline, onGenerateReport }: {
  data: RenalPredictiveIntelligence; canWrite: boolean; busyModel: string | null;
  onAction: (action: RenalDataAction, module?: RenalModuleKey) => void; onRun: (moduleKey: RenalModuleKey) => void;
  onShowTimeline: () => void; onGenerateReport?: () => void;
}) {
  const cards = makeCards(data), evidenceRefs = useRef<Array<HTMLDetailsElement | null>>([]);
  const actions: Record<DashboardCardKey, { type: RenalDataAction["type"]; focusKey: string | null }> = {
    anemia: { type: "ADD_CLINICAL_HISTORY", focusKey: "hemoglobin" }, hyperkalemia: { type: "ADD_LAB_RESULT", focusKey: "potassium_pre" },
    dialysisAdequacy: { type: "ADD_LAB_RESULT", focusKey: "urea_pre" }, renalDeterioration: { type: "VIEW_HISTORY", focusKey: null },
    cardiovascular: { type: "OPEN_CLINICAL_RECORD", focusKey: null },
  };
  const whyFactors = data.deteriorationComposite.components.filter(component => component.evaluable);
  return <section className="ckd-related-dashboard" aria-labelledby="ckd-related-title">
    <header className="ckd-related-header"><div><span className="ckd-related-kicker">Patient-scoped clinical intelligence</span>
      <h3 id="ckd-related-title">CKD Related Clinical Risks</h3>
      <p>Review complications, available evidence, missing measurements and the next clinical action.</p></div>
      <div className="ckd-related-header-actions"><span><BrainCircuit size={15} /> Clinician review required</span>
        {onGenerateReport && <Button variant="outline" onClick={onGenerateReport}>Generate report</Button>}</div>
    </header>
    <p className="ckd-related-disclaimer"><Info size={15} />Data coverage describes recorded input completeness. It is not a disease probability or a treatment recommendation.</p>
    <div className="ckd-related-grid">{cards.map((card, index) => {
      const Icon = card.icon, percent = card.totalCount ? Math.round(card.availableCount * 100 / card.totalCount) : 0;
      const module = card.moduleKey ? data[card.moduleKey] : undefined;
      const research = module?.researchReadiness ?? module?.readiness;
      const canRun = Boolean(module?.modelKey && module.canRun && research?.ready && canWrite && !busyModel);
      const missingCount = card.missing.length;
      const primaryClick = () => {
        if (card.key === "renalDeterioration") { onShowTimeline(); return; }
        if (card.key === "cardiovascular") { const details = evidenceRefs.current[index]; if (details) { details.open = true; details.scrollIntoView({ behavior: "smooth", block: "center" }); details.querySelector("summary")?.focus(); } return; }
        const action = actions[card.key]; onAction({ ...action, label: card.actionLabel }, card.moduleKey);
      };
      const predictionStatus = module?.modelKey ? (research?.ready ? "Research prediction eligible" : research?.resultTitle ?? "Requirements pending")
        : card.key === "cardiovascular" ? "No reviewed prediction model installed" : "Clinical monitoring rules; no forecast model";
      return <article key={card.key} className="ckd-risk-card" data-disease={card.tone} title={card.message}>
        <header className="ckd-risk-card-header"><span className="ckd-risk-icon"><Icon size={19} aria-hidden="true" /></span>
          <span className="ckd-risk-status" data-status={card.status === "Clinical review recommended" ? "review" : card.status === "Stable" ? "stable" : "required"}>{card.status}</span></header>
        <h4>{card.title}</h4>
        <div className="ckd-risk-current"><span>{card.currentLabel}</span><strong>{card.currentValue}</strong></div>
        <TrendChart points={card.trend} label={card.title} emptyMessage={card.trendMessage ?? "No dated trend is available yet."} />
        <div className="ckd-risk-readiness"><div><span>Available clinical data</span><strong>{percent}% <small>{card.availableCount}/{card.totalCount}</small></strong></div>
          <div className="ckd-risk-progress" role="progressbar" aria-label={`${card.title} data completeness`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
            <span style={{ width: `${percent}%` }} /></div>
        </div>
        <p className="ckd-risk-prediction-readiness"><BrainCircuit size={13} /><span>Prediction readiness: <b>{predictionStatus}</b></span></p>
        <p className="ckd-risk-message">{card.message}</p>
        {card.key === "dialysisAdequacy" && <p className="ckd-risk-formula">{card.formula}</p>}
        <div className="ckd-risk-missing"><strong>{missingCount ? "Missing information" : "Required information available"}</strong>
          <p>{missingCount ? card.missing.slice(0, 3).join(" · ") + (missingCount > 3 ? ` · +${missingCount - 3} more` : "") : "Review source quality and dates."}</p>
        </div>
        <Button className="ckd-risk-action" variant="outline" disabled={!canWrite && ["anemia", "hyperkalemia", "dialysisAdequacy"].includes(card.key)} onClick={primaryClick}>{card.actionLabel}</Button>
        <details className="ckd-risk-details" ref={node => { evidenceRefs.current[index] = node; }}>
          <summary>View clinical evidence</summary>
          <div className="ckd-risk-details-body"><h5>Input parameters</h5><EvidenceList items={card.evidence} />
            {card.missing.length > 0 && <><h5>Missing parameters</h5><p>{card.missing.join(" · ")}</p></>}
            <h5>Why this result?</h5><p>{card.explanation[0] ?? card.message}</p>
            {card.explanation.length > 1 && <ul>{card.explanation.slice(1).map((item, i) => <li key={`${i}-${item}`}>{item}</li>)}</ul>}
            {card.key === "anemia" && <><p className="ckd-risk-note">The connected renal form records Hb. PCV, RBC count, ferritin and iron profile are not mapped in this entry flow; review source laboratory records.</p>
              <Button variant="outline" onClick={() => onAction({ type: "OPEN_CLINICAL_RECORD", label: "Review source clinical record", focusKey: null }, "anemia")}>Review source clinical record</Button></>}
            {card.key === "renalDeterioration" && whyFactors.length > 0 && <div className="ckd-risk-factor-list"><h5>Measured directions</h5>{whyFactors.map(item => <span key={item.metric} data-worsening={item.worsening}>
              {item.trendDirection === "RISING" ? <ArrowUpRight size={14} /> : item.trendDirection === "FALLING" ? <ArrowDownRight size={14} /> : <Activity size={14} />}
              {item.label}: {item.previous == null ? "—" : format(item.previous)} → {item.current == null ? "—" : format(item.current)} {item.unit}</span>)}</div>}
            {module && <><h5>Model information</h5><p>{module.model ?? "Clinical monitoring rules"} · {module.modelVersion ?? data.ruleVersion} · {module.validationStatus.replaceAll("_", " ")}</p>
              {module.modelKey && <p>Research forecast readiness: {research?.ready ? "Eligible" : "Not ready"}. Eligibility is separate from clinical data completeness.</p>}
              {canRun && <Button variant="outline" onClick={() => onRun(card.moduleKey!)}>{busyModel === module.modelKey ? "Running…" : "Run research prediction"}</Button>}
              {module.clinicianReview?.clinical_note && <><h5>Clinician notes</h5><p>{module.clinicianReview.clinical_note}</p></>}
            </>}
            {card.key === "cardiovascular" && <><h5>Model information</h5><p>No reviewed cardiovascular equation is installed. No cardiovascular probability or AI estimate is generated.</p><p>Required model context extends beyond these fields and includes sex, cholesterol, smoking status and treatment context.</p></>}
          </div>
        </details>
      </article>;
    })}</div>
    <section className="ckd-related-why" aria-labelledby="ckd-related-why-title"><div><span><Stethoscope size={16} /> Explainable clinical review</span><h4 id="ckd-related-why-title">Why this result?</h4>
      <p>{data.renalTrajectory.clinicalAssessment?.message ?? "Available renal measurements are shown for clinician review."}</p></div>
      <ul>{whyFactors.length ? whyFactors.slice(0, 5).map(item => <li key={item.metric} data-worsening={item.worsening}>
        {item.trendDirection === "RISING" ? <ArrowUpRight size={15} /> : item.trendDirection === "FALLING" ? <ArrowDownRight size={15} /> : <Activity size={15} />}
        <span>{item.label}<small>{item.previous == null ? "No previous value" : `${format(item.previous)} → ${format(item.current)} ${item.unit}`}</small></span>
      </li>) : <li><Info size={15} /><span>No paired dated marker history is available yet.<small>Record source measurements with their actual measurement dates.</small></span></li>}</ul>
      <p className="ckd-related-why-footnote">Direction summaries use measured source values. They are not causal explanations, validated prognosis scores or disease probabilities.</p>
    </section>
  </section>;
}
