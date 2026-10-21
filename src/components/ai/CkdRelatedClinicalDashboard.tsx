import {modelScorePercent} from "../../lib/clinicalScore";
import { useRef } from "react";
import { Activity, BrainCircuit, Check, Circle, Clock3, Droplets, HeartPulse, Info, Stethoscope, Waves } from "lucide-react";
import { Button } from "../ui/button";
import type { RenalDataAction, RenalModuleKey, RenalPredictiveIntelligence, ClinicalMappedAssessment } from "../../services/renalIntelligenceService";
import "./ckd-related-clinical-dashboard.css";

type DashboardCardKey = "anemia" | "hyperkalemia" | "dialysisAdequacy" | "renalDeterioration" | "cardiovascular";
type EvidenceItem = { key: string; label: string; available: boolean; value?: string; detail?: string; state?: string };
type TrendPoint = { observedAt: string; value: number };
type DashboardCard = {
  key: DashboardCardKey; title: string; icon: typeof Droplets; status: string; tone: string; availableCount: number; totalCount: number;
  currentLabel: string; currentValue: string; message: string; explanation: string[]; evidence: EvidenceItem[]; missing: string[];
  assessment?: ClinicalMappedAssessment; trend?: TrendPoint[]; trendMessage?: string; formula?: string; moduleKey?: RenalModuleKey; actionLabel: string;
};

const format = (value: number | null | undefined, digits = 2) => typeof value === "number" && Number.isFinite(value)
  ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : "Not recorded";
const makeCards = (data: RenalPredictiveIntelligence): DashboardCard[] => {
  const definitions: Array<{key:DashboardCardKey;source:RenalModuleKey|"cardiovascularMonitoring";title:string;icon:typeof Droplets;tone:string;label:string;action:string}> = [
    {key:"anemia",source:"anemia",title:"Hemoglobin Assessment",icon:Droplets,tone:"anemia",label:"Recorded hemoglobin",action:"Review hemoglobin evidence"},
    {key:"hyperkalemia",source:"hyperkalemia",title:"Potassium Assessment",icon:Activity,tone:"hyperkalemia",label:"Recorded potassium",action:"Verify potassium evidence"},
    {key:"dialysisAdequacy",source:"dialysisAdequacy",title:"Dialysis Adequacy",icon:Waves,tone:"dialysis",label:"Measured URR",action:"Complete session evidence"},
    {key:"renalDeterioration",source:"renalTrajectory",title:"Renal Function and Progression",icon:Activity,tone:"renal",label:"Observed creatinine change",action:"View dated renal timeline"},
    {key:"cardiovascular",source:"cardiovascularMonitoring",title:"Cardiovascular Surveillance",icon:HeartPulse,tone:"cardiovascular",label:"Cardiovascular event risk",action:"Review cardiovascular factors"},
  ];
  return definitions.map(item=>{
    const module=item.source==="cardiovascularMonitoring"?undefined:data[item.source];
    const assessment=item.source==="cardiovascularMonitoring"?data.cardiovascularMonitoring:module?.clinicalAssessment;
    const coverage=assessment?.coverage;
    const evidence:EvidenceItem[]=(coverage?.requiredInputs??assessment?.requirements??[]).filter(r=>r.required).map(r=>({key:r.key,label:r.label,available:r.recorded??r.satisfied,detail:r.detail,state:r.state}));
    const signal=assessment?.clinicalSignal;
    const trend=assessment?.trend;
    const currentValue=item.key==="cardiovascular"?"Not estimated":assessment?.currentValue!=null?`${format(assessment.currentValue)} ${assessment.unit??""}`:item.key==="renalDeterioration"&&trend?.ready?`${format(trend.absoluteChange)} ${trend.unit??""} (${format(trend.percentChange)}% change)`:item.key==="renalDeterioration"?"Trend not established":"Not calculated";
    return {key:item.key,title:item.title,icon:item.icon,tone:item.tone,currentLabel:item.label,currentValue,
      status:signal?.label??assessment?.resultTitle??"Not assessed",availableCount:coverage?.recordedCount??evidence.filter(r=>r.available).length,totalCount:coverage?.requiredCount??evidence.length,
      message:assessment?.message??"Refresh the authorized assessment to review recorded evidence.",explanation:assessment?.explanation?.statements??assessment?.explanations??[],evidence,
      missing:evidence.filter(r=>!r.available).map(r=>r.label),trend:trend?.ready?trend.points?.filter(p=>p.available&&p.value!=null&&p.observedAt).map(p=>({observedAt:p.observedAt!,value:p.value!})):undefined,
      trendMessage:trend?.message??"No supported dated trend is available",formula:assessment?.formula,moduleKey:item.source==="cardiovascularMonitoring"?undefined:item.source,actionLabel:item.action,assessment};
  });
};

function TrendChart({ points, label, emptyMessage }: { points?: TrendPoint[]; label: string; emptyMessage: string }) {
  const valid = (points ?? []).filter(point => Number.isFinite(point.value) && Number.isFinite(Date.parse(point.observedAt))).sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt)).slice(-8);
  if (valid.length < 2) return <div className="ckd-risk-trend-empty"><Clock3 size={14} />{emptyMessage}</div>;
  const values = valid.map(point => point.value), low = Math.min(...values), high = Math.max(...values), spread = Math.max(high - low, 1e-9);
  const firstAt=Date.parse(valid[0].observedAt), elapsed=Math.max(Date.parse(valid[valid.length-1].observedAt)-firstAt,1);
  const coords = valid.map(point => `${8 + (Date.parse(point.observedAt)-firstAt) * 204 / elapsed},${47 - ((point.value - low) / spread) * 38}`);
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
  onShowTimeline: () => void; onGenerateReport?: (clinicalSnapshotId?:string) => void;
}) {
  const cards = makeCards(data), evidenceRefs = useRef<Array<HTMLDetailsElement | null>>([]);
  const actions: Record<DashboardCardKey, { type: RenalDataAction["type"]; focusKey: string | null }> = {
    anemia: { type: "ADD_CLINICAL_HISTORY", focusKey: "hemoglobin" }, hyperkalemia: { type: "ADD_LAB_RESULT", focusKey: "potassium_pre" },
    dialysisAdequacy: { type: "ADD_LAB_RESULT", focusKey: "urea_pre" }, renalDeterioration: { type: "VIEW_HISTORY", focusKey: null },
    cardiovascular: { type: "OPEN_CLINICAL_RECORD", focusKey: null },
  };
  const findings = data.patientReviewSummary ?? [];
  return <section className="ckd-related-dashboard" aria-labelledby="ckd-related-title">
    <header className="ckd-related-header"><div><span className="ckd-related-kicker">Patient-scoped clinical intelligence</span>
      <h3 id="ckd-related-title">CKD Related Clinical Risks</h3>
      <p>Review complications, available evidence, missing measurements and the next clinical action.</p></div>
      <div className="ckd-related-header-actions"><span><BrainCircuit size={15} /> Clinician review required</span>
        {onGenerateReport && <Button variant="outline" onClick={()=>onGenerateReport(data.snapshotId)}>Generate report</Button>}</div>
    </header>
    <p className="ckd-related-disclaimer"><Info size={15} />Data coverage describes recorded input completeness. It is not a disease probability or a treatment recommendation.</p>
    {findings.length>0&&<section className="ckd-review-priorities" aria-label="Patient review priorities"><h4>Unresolved findings and source review</h4><ul>{findings.map((finding,index)=><li key={`${finding.module}-${index}`} data-urgent={finding.priority==="PROMPT_VERIFICATION_AND_REVIEW"}><Info size={16}/><span><strong>{finding.finding}</strong><small>{finding.priority.replaceAll("_"," ").toLowerCase()} | {finding.evidenceQuality.replaceAll("_"," ").toLowerCase()}</small></span></li>)}</ul></section>}
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
      const predictionStatus = (research&&!research.ready?"Prediction not available yet":card.assessment?.prediction?.reason) ?? (module?.modelKey ? (research?.ready ? "Research result - clinical validation incomplete" : research?.resultTitle ?? "Requirements pending")
        : card.key === "cardiovascular" ? "No reviewed prediction model installed" : "Clinical monitoring rules; no forecast model");
      return <article key={card.key} className="ckd-risk-card" data-disease={card.tone} title={card.message}>
        <header className="ckd-risk-card-header"><span className="ckd-risk-icon"><Icon size={19} aria-hidden="true" /></span>
          <span className="ckd-risk-status" data-status={card.assessment?.clinicalSignal?.abnormal ? "review" : card.assessment?.currentAt ? "stable" : "required"}>{card.status}</span></header>
        <h4>{card.title}</h4>
        <div className="ckd-risk-current"><span>{card.currentLabel}</span><strong>{card.currentValue}</strong><small>{card.assessment?.currentAt?`Collected ${new Date(card.assessment.currentAt).toLocaleString()}`:card.assessment?.currentValue!=null?"Measurement date unverified; current relevance unknown":""}</small></div>
        {card.assessment?.clinicalSignal?.reviewPriority==="PROMPT_VERIFICATION_AND_REVIEW"&&<p className="ckd-risk-urgent" role="alert"><Info size={17}/>Prompt verification and clinical review required. This recorded abnormality remains relevant to source review even when prediction is withheld.</p>}
        <TrendChart points={card.trend} label={card.title} emptyMessage={card.trendMessage ?? "No dated trend is available yet."} />
        <p className="ckd-risk-prediction-readiness"><BrainCircuit size={13} /><span>Prediction: <b>{predictionStatus}</b>{research&&!research.ready&&<small>Required next: {research.requirements.filter(item=>item.required&&!item.satisfied).slice(0,2).map(item=>item.label).join("; ")||"Review the source history and model availability."}</small>}</span></p>

        {card.assessment?.prediction&&(card.assessment.prediction.value!=null||card.assessment.prediction.researchScore!=null)&&<div className="ckd-saved-prediction"><strong>{card.assessment.prediction.researchScore!=null?`Research model score: ${modelScorePercent(card.assessment.prediction.researchScore)} - not a calibrated clinical probability`:`Predicted value: ${format(card.assessment.prediction.value)} ${card.assessment.prediction.unit}`}</strong><p>{card.assessment.prediction.outcome} · {card.assessment.prediction.horizon}</p><small>Research result - clinical validation incomplete. {card.assessment.prediction.baselineExplanation}</small></div>}
        <p className="ckd-risk-message">{card.message}</p>
        {card.key === "dialysisAdequacy" && <p className="ckd-risk-formula">{card.formula}</p>}
        <Button className="ckd-risk-action" variant="outline" disabled={!canWrite && ["anemia", "hyperkalemia", "dialysisAdequacy"].includes(card.key)} onClick={primaryClick}>{card.actionLabel}</Button>
        <details className="ckd-risk-details" ref={node => { evidenceRefs.current[index] = node; }}>
          <summary>How was this result calculated?</summary>
          <div className="ckd-risk-details-body">        <div className="ckd-risk-readiness"><div><span>Recorded-input coverage</span><strong>{card.totalCount?`${percent}% (${card.availableCount} of ${card.totalCount})`:"Not established"} <small>listed inputs recorded</small></strong></div>
          <div className="ckd-risk-progress" role="progressbar" aria-label={`${card.title} recorded-input coverage`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
            <span style={{ width: `${percent}%` }} /></div>
        </div>
        <div className="ckd-risk-quality"><strong>Evidence quality</strong><span>{card.assessment?.evidenceQuality?.status.replaceAll("_"," ").toLowerCase()??"Not assessed"}</span>{[...new Set(card.assessment?.evidenceQuality?.warnings??[])].slice(0,2).map((warning,i)=><p key={i}>{warning}</p>)}</div>        <div className="ckd-risk-missing"><strong>{missingCount ? "Missing listed inputs" : "Listed inputs recorded"}</strong>
          <p>{missingCount ? card.missing.slice(0, 3).join(" · ") + (missingCount > 3 ? ` · +${missingCount - 3} more` : "") : "Review source quality and dates."}</p>
        </div>
<h5>Input parameters</h5><EvidenceList items={card.evidence} />
            {card.missing.length > 0 && <><h5>Missing parameters</h5><p>{card.missing.join(" · ")}</p></>}
            <h5>Why this result?</h5><p>{card.explanation[0] ?? card.message}</p>
            {card.explanation.length > 1 && <ul>{card.explanation.slice(1).map((item, i) => <li key={`${i}-${item}`}>{item}</li>)}</ul>}
            <h5>Source evidence and quality</h5><ul>{card.assessment?.explanation?.evidence.map((item,i)=><li key={`${item.sourceId}-${item.key}-${i}`}>{item.label}: {format(item.value)} {item.unit} · {item.observedAt?new Date(item.observedAt).toLocaleString():"Measurement date unverified"}<small>Source {item.source} / {item.sourceId}</small></li>)}</ul>
            {card.assessment?.evidenceQuality?.warnings.map((warning,i)=><p className="ckd-risk-note" key={i}>{warning}</p>)}
            {card.assessment?.bloodPressurePair&&!card.assessment.bloodPressurePair.verified&&<p className="ckd-risk-note">{card.assessment.bloodPressurePair.reason}. No paired blood-pressure value is calculated.</p>}
            {card.assessment?.prognosticClassification&&<><h5>Separate GFR/albuminuria classification</h5><p>{card.assessment.prognosticClassification.category?`${card.assessment.prognosticClassification.gCategory} / ${card.assessment.prognosticClassification.aCategory}: ${card.assessment.prognosticClassification.category}`:"GFR/albuminuria classification unavailable"}</p><p>{card.assessment.prognosticClassification.limitation}</p></>}
            {card.key === "anemia" && <><h5>Supporting investigations (outside Hb coverage)</h5><ul>{card.assessment?.supportingInvestigations?.map(item=><li key={item.key}>{item.measurement?.label??item.key}: {item.available?`${format(item.measurement?.value)} ${item.measurement?.unit??""}`:"Not linked / required source review"}</li>)}</ul><p className="ckd-risk-note">Hemoglobin alone does not establish iron deficiency. Verify the population pathway, investigations and documented treatment context with the nephrologist.</p>
              <Button variant="outline" onClick={() => onAction({ type: "OPEN_CLINICAL_RECORD", label: "Review source clinical record", focusKey: null }, "anemia")}>Review source clinical record</Button></>}
            {module && <><h5>Model information</h5><p>{module.model ?? "Clinical monitoring rules"} · {module.modelVersion ?? data.ruleVersion} · {module.validationStatus.replaceAll("_", " ")}</p>
              {module.modelKey && <p>Research forecast readiness: {research?.ready ? "Eligible" : "Not ready"}. Eligibility is separate from clinical data completeness.</p>}
              {canRun && <Button variant="outline" onClick={() => onRun(card.moduleKey!)}>{busyModel === module.modelKey ? "Running…" : "Run research prediction"}</Button>}
              {module.clinicianReview?.clinical_note && <><h5>Clinician notes</h5><p>{module.clinicianReview.clinical_note}</p></>}
              <p>Review status: {module.moduleReviewState.replaceAll("_"," ").toLowerCase()} · version {module.moduleReviewVersion}</p>
              <Button variant="outline" disabled={!canWrite} onClick={()=>onAction({type:"REVIEW_MODULE",label:"Review assessment and record plan",focusKey:null},card.moduleKey)}>Review assessment and record plan</Button>
            </>}
            <h5>Rule identity and reference</h5><p>{card.assessment?.rule?.id??card.assessment?.method} · {card.assessment?.rule?.version??card.assessment?.ruleVersion}</p><p>{card.assessment?.rule?.thresholdPolicy}</p>{card.assessment?.rule?.sources.map(source=><a href={source} target="_blank" rel="noreferrer" key={source}>Clinical reference</a>)}<p>{card.assessment?.rule?.localApproval}</p>
            {card.assessment?.prediction&&<><h5>Future output and attribution</h5><p>{card.assessment.prediction.outcome} · {card.assessment.prediction.horizon}</p><p>{card.assessment.prediction.baselineExplanation}</p><p>Explanation: {card.assessment.prediction.explanationMethod}. Contribution units: {card.assessment.prediction.attribution?.contribution_unit??"Not applicable / not established"}.</p>{card.assessment.prediction.attribution?.top_factors?.length? <ul>{card.assessment.prediction.attribution.top_factors.map((factor,i)=><li key={`${factor.feature}-${i}`}>{factor.feature}: recorded value {format(factor.value)}; contribution {factor.contribution==null?"Not attributed (baseline)":format(factor.contribution,4)} {card.assessment?.prediction?.attribution?.contribution_unit??""}{factor.imputed?"; training-only imputation used":""}. Association, not causation.</li>)}</ul>:<p>No model attribution is available for this result.</p>}<p>Imputed predictors: {card.assessment.prediction.dataQuality?.imputed_features?.join(", ")||"None recorded"}</p><p>{card.assessment.prediction.uncertainty?`Internal research interval: ${format(card.assessment.prediction.uncertainty.low)} to ${format(card.assessment.prediction.uncertainty.high)} ${card.assessment.prediction.unit}; ${card.assessment.prediction.uncertainty.method}. Clinical coverage is not established.`:"A supported prediction interval is not available."}</p><p>Artifact revision: {card.assessment.prediction.artifactRevision??"Not recorded"}</p></>}
            {card.key === "cardiovascular" && <><h5>Model information</h5><p>No reviewed cardiovascular equation is installed. No cardiovascular probability or AI estimate is generated.</p><p>Required model context extends beyond these fields and includes sex, cholesterol, smoking status and treatment context.</p></>}
          </div>
        </details>
      </article>;
    })}</div>
    <details className="ckd-explanation-summary"><summary>Clinical explanation summary</summary><section className="ckd-related-why" aria-labelledby="ckd-related-why-title"><div><span><Stethoscope size={16}/> Explainable clinical review</span><h4 id="ckd-related-why-title">Why this result?</h4><p>Each explanation comes from the saved rule, equation or model. Review unresolved abnormalities and source limitations before interpreting predictions.</p></div>
      <ul>{cards.map(card=><li key={card.key} data-worsening={card.assessment?.clinicalSignal?.abnormal}><Info size={15}/><span>{card.title}<small>{card.explanation[0]??card.message}</small><small>{card.assessment?.explanation?.ruleId??"Rule not recorded"} | {card.assessment?.explanation?.version??"Version not recorded"}</small></span></li>)}</ul>
      <p className="ckd-related-why-footnote">Observed severity, dated change, predicted measurements, research scores, review priority and input coverage are separate outputs. No overall disease probability is synthesized.</p>
    </section></details>
  </section>;
}
