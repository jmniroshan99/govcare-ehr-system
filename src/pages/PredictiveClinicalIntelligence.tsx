import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { Activity, ArrowDown, ArrowRight, ArrowUp, BrainCircuit, Check, CheckCircle2,
  Clock3, Database, FileCheck2, HeartPulse, Info, ListChecks, Plus, RefreshCw, ShieldCheck, Sparkles, Stethoscope, TriangleAlert, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { ClinicalMeasurementDialog as MeasurementDialog } from "../components/ai/ClinicalMeasurementDialog";
import { SriLankanRenalPanel } from "../components/ai/SriLankanRenalPanel";
import { authorizationContextKey } from "../lib/accessControl";
import { canUsePredictiveWorkspace, integratedCkdHref } from "../lib/ckdWorkspace";
import { canAccessPath } from "../lib/roleAccess";
import { useAuthStore } from "../stores/authStore";
import type { AuthorizedPatient } from "../services/patientService";
import { checkForecastCapability, getPredictiveOverview, recordVerifiedMeasurement, reviewClinicalFinding,
  type ClinicalOverview, type ClinicalTrend, type ForecastResult, type MeasurementInput, type Metric,
  type ReviewedFinding, type ReviewAction, type ReviewReasonCode } from "../services/predictiveIntelligenceService";
import "../components/ai/predictive-intelligence.css";

const TrendChart = lazy(async () => ({ default: (await import("../components/ai/KidneyTrendChart")).KidneyTrendChart }));
const metricLabels: Record<Metric, string> = { egfr: "eGFR", creatinine: "Creatinine", acr: "Urine ACR", systolic: "Systolic BP",
  diastolic: "Diastolic BP", hba1c: "HbA1c", glucose: "Glucose", potassium: "Potassium", hemoglobin: "Hemoglobin",
  bun: "Blood urea nitrogen", bmi: "BMI", weight: "Weight", total_cholesterol: "Total cholesterol", hdl: "HDL cholesterol",
  ldl: "LDL cholesterol", triglycerides: "Triglycerides" };
const tabs = ["Overview", "Trends", "Care gaps", "Timeline"] as const;
type Tab = typeof tabs[number];
const readable = (s: string) => s.toLowerCase().replaceAll("_", " ");
const number = (v: number | null | undefined) => v == null ? "Data unavailable" : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
const date = (s: string | null | undefined) => s ? new Date(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "Date unavailable";

/** Legacy deep links open the integrated CKD view behind the existing route guard. */
export function PredictiveClinicalIntelligence() {
  const [params] = useSearchParams();
  return <Navigate to={integratedCkdHref(params.toString())} replace />;
}

export function PredictiveIntelligencePanel({ patient,initialTab="Overview" }: { patient: AuthorizedPatient;initialTab?:Tab }) {
  const profile = useAuthStore(state => state.profile);
  if (!canUsePredictiveWorkspace(profile)) return <div role="alert" className="gov-empty-state">Clinical intelligence access is unavailable for this account.</div>;
  return <ClinicalWorkspace key={`${authorizationContextKey(profile)}:${patient.id}`} patient={patient} initialTab={initialTab} />;
}

function ClinicalWorkspace({ patient,initialTab }: { patient: AuthorizedPatient;initialTab:Tab }) {
  const profile = useAuthStore(state => state.profile);
  const [overview, setOverview] = useState<ClinicalOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [metric, setMetric] = useState<Metric>("egfr");
  const [days, setDays] = useState<number | null>(365);
  const [horizon, setHorizon] = useState(6);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [forecastBusy, setForecastBusy] = useState(false);
  const [forecastError, setForecastError] = useState("");
  const [review, setReview] = useState<ReviewedFinding | null>(null);
  const [risk, setRisk] = useState<ClinicalOverview["risks"][number] | null>(null);
  const [measurementOpen, setMeasurementOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const operation = useRef<AbortController | null>(null);
  const forecastOperation = useRef<AbortController | null>(null);
  const patientId = useRef(patient.id);

  useEffect(() => {
    if (!patient?.id) return;
    const controller = new AbortController(); let active = true;
    setLoading(true); setOverview(null); setError("");
    void getPredictiveOverview(patient.id, controller.signal).then(result => {
      if (!active) return;
      if (result.patient.id !== patient.id) throw new Error("Patient association could not be verified. Reload this workspace.");
      setOverview(result);
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Unable to load clinical intelligence."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [patient?.id, refresh]);
  useEffect(() => () => { operation.current?.abort(); forecastOperation.current?.abort(); }, []);

  const data = overview?.patient.id === patient?.id ? overview : null;
  const analysis = data?.analysis;
  const trend = analysis?.trends.find(t => t.metric === metric);
  const renal = analysis?.trends.find(t => t.metric === "egfr");
  const creatinine = analysis?.trends.find(t => t.metric === "creatinine");
  const acr = analysis?.trends.find(t => t.metric === "acr");
  const pending = data?.recommendations.filter(r => r.reviewState === "AWAITING_REVIEW") ?? [];
  const gaps = data?.recommendations.filter(r => r.finding.category === "CARE_GAP") ?? [];
  const urgent = analysis?.safety.status === "POSSIBLE_AKI" || analysis?.safety.status === "RAPID_RENAL_CHANGE";
  const safetyBlocked = Boolean(analysis?.safety.forecastSuppressed);
  const hasMeasurements = Boolean(analysis?.quality.includedCount);
  const forecastOutput = forecast && !Array.isArray(forecast.outputs) ? forecast.outputs : null;

  const runForecast = async () => {
    if (!patient || forecastBusy) return;
    const id = patient.id; forecastOperation.current?.abort(); const controller = new AbortController(); forecastOperation.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    setForecastBusy(true); setForecastError(""); setForecast(null);
    try { const result = await checkForecastCapability(id, horizon, controller.signal); if (patientId.current === id && !controller.signal.aborted) setForecast(result); }
    catch (e) { if (patientId.current === id) setForecastError(controller.signal.aborted ? "The capability check timed out. Refresh or retry." : e instanceof Error ? e.message : "Forecast capability could not be checked."); }
    finally { window.clearTimeout(timeout); if (patientId.current === id) setForecastBusy(false); }
  };

  const saveReview = async (finding: ReviewedFinding, action: ReviewAction, reasonCode: ReviewReasonCode,
    reason: string, clinicalNote: string, modified: string, requestId: string) => {
    if (!patient || !data?.canReview) throw new Error("Clinical write permission is required.");
    const id = patient.id; operation.current?.abort(); const controller = new AbortController(); operation.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    try { await reviewClinicalFinding(id, finding, { action, reasonCode, reason, clinicalNote,
      modifiedRecommendation: modified, requestId }, controller.signal); }
    finally { window.clearTimeout(timeout); }
    if (patientId.current !== id || controller.signal.aborted) return;
    setReview(null); setNotice("Review saved with its reason, source evidence and FHIR provenance. No orders were created.");
    setRefresh(n => n + 1);
  };

  const saveMeasurement = async (input: MeasurementInput, requestId: string) => {
    if (!patient || !data?.canReview) throw new Error("Clinical write permission is required.");
    const id=patient.id; operation.current?.abort(); const controller=new AbortController();operation.current=controller;
    const timeout=window.setTimeout(()=>controller.abort(),30000);
    try { await recordVerifiedMeasurement(id,input,requestId,controller.signal); } finally { window.clearTimeout(timeout); }
    if(patientId.current!==id||controller.signal.aborted)return;
    setMeasurementOpen(false);if(Object.hasOwn(metricLabels,input.metric))setMetric(input.metric as Metric);setForecast(null);setTab("Trends");
    setNotice("Verified result saved with its measurement date, source and FHIR provenance.");setRefresh(n=>n+1);
  };

  return <div className="pci-workspace">
    <header className="pci-embedded-toolbar">
      <div><span className="gov-kicker">Predictive clinical intelligence</span><h2>Kidney health over time</h2><p className="pci-muted">Recorded measurements, evidence quality and clinician-reviewed findings for the selected patient.{analysis ? ` Updated ${date(analysis.generatedAt)}.` : ""}</p></div>
      <div className="pci-patient-controls">{data?.canReview && <Button onClick={() => setMeasurementOpen(true)}><Plus size={15} /> Record result</Button>}
        <Button variant="outline" aria-label="Refresh clinical intelligence" disabled={loading || forecastBusy} onClick={() => { setNotice(""); setForecast(null); setRefresh(n => n + 1); }}><RefreshCw size={16} className={loading ? "pci-spin" : ""} /> Refresh</Button>
      </div>
    </header>

    {notice && <div role="status" className="pci-banner pci-banner-success"><CheckCircle2 size={18} /><p>{notice}</p><button aria-label="Dismiss confirmation" onClick={() => setNotice("")}><X size={16} /></button></div>}
    {error && <div role="alert" className="pci-banner pci-banner-danger"><TriangleAlert size={20} /><div><strong>Clinical data could not be loaded</strong><p>{error}</p></div><Button variant="outline" onClick={() => setRefresh(n => n + 1)}>Retry</Button></div>}
    {loading && <div className="pci-loading" role="status" aria-live="polite"><div className="pci-skeleton-grid">{[1,2,3,4].map(n => <div className="pci-skeleton" key={n} />)}</div><p>Loading authorized history, trends and review findings…</p></div>}
    {data && analysis && <>
      {safetyBlocked && <div role="alert" className={`pci-banner ${urgent ? "pci-banner-danger" : "pci-banner-warning"}`}><TriangleAlert size={22} /><div><strong>{urgent ? "Renal safety review required" : "Forecast readiness limited"}</strong><p>{analysis.safety.reasons[0] ?? "Required renal evidence is incomplete. Chronic forecasting remains blocked until the source data are reviewed."}</p></div><button className="pci-text-button" onClick={() => { setTab("Trends"); setMetric(urgent ? "creatinine" : "egfr"); }}>Review evidence <ArrowRight size={15} /></button></div>}
      {data.historyTruncated && <div role="status" className="pci-banner pci-banner-warning"><Info size={18} /><p>History exceeds this workspace's retrieval limit. The displayed trends are partial and forecasting is suppressed.</p></div>}
      <div className="pci-summary-grid">
        <SummaryCard label="Recorded CKD categories" icon={<Stethoscope size={18} />} value={`${analysis.classification.gCategory ?? "G—"} / ${analysis.classification.aCategory ?? "A—"}`}
          detail={analysis.classification.chronicity === "NOT_ESTABLISHED" ? "Chronicity not established" : "Persistence supported; confirm clinically"} />
        <SummaryCard label="Latest eGFR" icon={<Activity size={18} />} value={number(renal?.latest?.value)} unit={renal?.latest ? renal.unit : undefined}
          detail={renal?.latest ? `Measured ${date(renal.latest.observedAt)} · ${readable(renal.dataFreshness)}` : "A dated eGFR result is required"} />
        <SummaryCard label="Albuminuria / ACR" icon={<Database size={18} />} value={number(acr?.latest?.value)} unit={acr?.latest ? acr.unit : undefined}
          badge={analysis.classification.aCategory ?? undefined} detail={acr?.latest ? `Measured ${date(acr.latest.observedAt)} · ${readable(acr.dataFreshness)}` : "A dated urine ACR result is required"} />
        <SummaryCard label="Creatinine" icon={<HeartPulse size={18} />} value={number(creatinine?.latest?.value)} unit={creatinine?.latest ? creatinine.unit : undefined}
          detail={creatinine?.latest ? `Measured ${date(creatinine.latest.observedAt)} · ${readable(creatinine.dataFreshness)}` : "A dated creatinine result is required"} />
        <SummaryCard label="Renal safety" icon={<ShieldCheck size={18} />} value={urgent ? "Review required" : safetyBlocked ? "Forecast blocked" : "No current trigger"}
          tone={urgent ? "danger" : "warning"} detail={urgent ? "Possible acute renal change" : safetyBlocked ? "Evidence reconciliation required" : "Not automatic clinical clearance"} />
        <SummaryCard label="Data completeness" icon={<FileCheck2 size={18} />} value={hasMeasurements ? `${analysis.quality.completenessPercent ?? "—"}%` : "Insufficient data"}
          badge={readable(analysis.quality.qualityLevel)} detail={hasMeasurements ? `${analysis.quality.freshMetricCount} of ${analysis.quality.expectedMetricCount} review metrics are recent` : "No usable dated measurements"}>
          {hasMeasurements && <progress max={100} value={analysis.quality.completenessPercent ?? 0} aria-label="Recent metric completeness" />}
        </SummaryCard>
      </div>
      <nav className="pci-tabs" aria-label="Clinical workspace views">{tabs.map(t => <button key={t} type="button" aria-current={tab === t ? "page" : undefined}
        className={tab === t ? "is-active" : ""} onClick={() => setTab(t)}>{t}{t === "Care gaps" && gaps.length > 0 && <span>{gaps.length}</span>}</button>)}</nav>

      {(tab === "Overview" || tab === "Trends") && <div className="pci-main-grid">
        <section className="pci-card pci-trend-card"><div className="pci-section-header"><div><div className="pci-kicker">Measured history</div><h2>Kidney health over time</h2></div><span className="pci-chip"><span className="pci-dot" /> Actual measurements</span></div>
          <div className="pci-chart-controls"><label className="pci-select-label"><span className="sr-only">Measurement</span><select aria-label="Chart measurement" value={metric} onChange={e => setMetric(e.target.value as Metric)}>{Object.entries(metricLabels).map(([key,label]) => <option value={key} key={key}>{label}</option>)}</select></label>
            <div className="pci-segmented" aria-label="History period">{([[90,"3M"],[180,"6M"],[365,"12M"],[null,"All"]] as const).map(([value,label]) => <button key={label} aria-pressed={days === value} className={days === value ? "is-active" : ""} onClick={() => setDays(value)}>{label}</button>)}</div></div>
          {trend && <><div className="pci-trend-values"><div><span>Latest {trend.label}</span><strong>{number(trend.latest?.value)} {trend.latest && <small>{trend.unit}</small>}</strong></div>
            <div><span>Change from previous</span><strong className="pci-change">{trend.absoluteChange == null ? "Unavailable" : <>{trend.absoluteChange < 0 ? <ArrowDown size={16} /> : <ArrowUp size={16} />}{number(Math.abs(trend.absoluteChange))}<small>{trend.percentChange == null ? "" : ` (${Math.abs(trend.percentChange)}%)`}</small></>}</strong></div></div>
            {trend.observations.length ? <ChartBoundary key={metric}><Suspense fallback={<div className="pci-chart-empty" role="status">Loading trend chart…</div>}><TrendChart trend={trend} days={days} asOf={analysis.generatedAt} forecast={metric === "egfr" ? forecastOutput : null} /></Suspense></ChartBoundary>
              : <div className="pci-chart-empty"><strong>No dated {trend.label} measurements available</strong><span>Review the source report. Upload time does not establish a measurement date.</span></div>}
            <div className="pci-chart-caption"><Info size={14} /><p>Solid points are measured clinical data. {metric === "egfr" && forecastOutput ? "The dashed extension is a statistical projection and shaded area is its approximate interval; neither is a laboratory result." : metric === "egfr" ? "The dashed horizontal guide marks eGFR 60; a single value does not establish CKD." : "Units and dates come from the recorded source."}</p></div>
            {tab === "Trends" && <TrendDetails trend={trend} />}
          </>}
          <div className="pci-forecast-strip"><span className="pci-soft-icon"><Sparkles size={18} /></span><div><strong>Future eGFR trajectory</strong><p>{forecast ? forecast.explanation : "Run a patient-specific 3, 6 or 12 month statistical eGFR projection. This is not a future CKD diagnosis."}</p></div>
            <div className="pci-forecast-controls"><label><span className="sr-only">Forecast horizon</span><select aria-label="Forecast horizon" value={horizon} disabled={forecastBusy} onChange={e => { setHorizon(Number(e.target.value)); setForecast(null); }}>{[3,6,12].map(h => <option value={h} key={h}>{h} months</option>)}</select></label>
              <Button variant="outline" disabled={forecastBusy} onClick={() => void runForecast()}>{forecastBusy ? "Projecting…" : "Run projection"}</Button></div></div>
          {forecastOutput && <div className="pci-forecast-result" role="status"><div><span>Projected eGFR</span><strong>{number(forecastOutput.projectedEgfr)} <small>mL/min/1.73m²</small></strong></div><div><span>Projection interval</span><strong>{forecastOutput.projectedEgfrLow == null || forecastOutput.projectedEgfrHigh == null ? "Not available" : `${number(forecastOutput.projectedEgfrLow)} – ${number(forecastOutput.projectedEgfrHigh)}`}</strong></div><div><span>Reliability</span><strong>{readable(forecastOutput.reliability)}</strong></div><div><span>Method</span><strong>Trend projection</strong></div></div>}
          {forecast && <p className="pci-inline-status" role="status"><Info size={14} /> {readable(forecast.status)} · {forecast.horizon_months}-month projection recorded · {forecastOutput?.modelVersion ?? "No active model"}</p>}
          {forecastError && <p role="alert" className="pci-inline-error">{forecastError}</p>}
        </section>
        <aside className="pci-card pci-review-card"><div className="pci-section-header"><div><div className="pci-kicker">Clinical review</div><h2>What needs attention</h2></div><ListChecks size={21} /></div>
          <p className="pci-muted">Evidence-linked findings for clinician review. No automatic treatment decisions.</p>
          {pending.length ? <div className="pci-review-list">{pending.slice(0,3).map(r => <FindingCard key={r.id} item={r} canReview={data.canReview} onReview={setReview} compact />)}</div>
            : <div className="pci-small-empty"><CheckCircle2 size={24} /><strong>{data.recommendations.length ? "Current findings have been reviewed" : "No rule-based findings available"}</strong><p>Clinical judgment and source verification remain necessary.</p></div>}
          <button className="pci-text-button" onClick={() => setTab("Care gaps")}>Open review queue <ArrowRight size={15} /></button>
          <div className="pci-chronicity"><Info size={16} /><div><strong>Chronicity {analysis.classification.chronicity === "NOT_ESTABLISHED" ? "not established" : "requires confirmation"}</strong><p>{analysis.classification.explanation}</p></div></div>
        </aside>
      </div>}

      {tab === "Overview" && <>
        <SriLankanRenalPanel patient={patient} />
        <div className="pci-bottom-grid"><DataQuality data={data} /><ClassificationMatrix data={data} /></div>
      </>}

      {tab === "Trends" && <DataQuality data={data} />}
      {tab === "Care gaps" && <section className="pci-card"><div className="pci-section-header"><div><div className="pci-kicker">Evidence → review → action</div><h2>Clinical review queue</h2><p className="pci-muted">Reviews persist against their evidence. New or changed evidence opens a new finding.</p></div><ListChecks size={24} /></div>
        {!data.canReview && <p className="pci-permission-note"><ShieldCheck size={16} /> Read-only access. Clinical write permission is required to save a review.</p>}
        <div className="pci-findings-grid">{data.recommendations.map(r => <FindingCard key={r.id} item={r} canReview={data.canReview} onReview={setReview} />)}</div>
        {!data.recommendations.length && <p className="pci-muted">No current rule findings are available. This does not confirm that all care needs are met.</p>}
        <div className="pci-medication-note"><Stethoscope size={19} /><div><strong>Medication reconciliation</strong><p>{data.medicationContext}</p></div>
          {patient && canAccessPath(profile, `/doctor/workspace/${patient.id}`) && <Link to={`/doctor/workspace/${patient.id}`} className="pci-text-button">Open clinical workspace <ArrowRight size={15} /></Link>}</div>
      </section>}

      {tab === "Timeline" && <section className="pci-card"><div className="pci-section-header"><div><div className="pci-kicker">Connected patient history</div><h2>Clinical timeline</h2><p className="pci-muted">Latest 50 recorded encounters, prescriptions, admissions and intelligence reviews. Measurement dates appear under Trends.</p></div><Clock3 size={23} /></div>
        {data.timeline.length ? <ol className="pci-timeline">{data.timeline.map(event => <li key={`${event.type}-${event.id}`}><span className="pci-timeline-dot"><Check size={12} /></span><div><div className="pci-timeline-heading"><h3>{event.title}</h3><time dateTime={event.occurredAt ?? undefined}>{date(event.occurredAt)}</time></div><p>{event.detail || "Details unavailable"}</p><span>{event.source}</span></div></li>)}</ol> : <div className="pci-small-empty"><Clock3 size={26} /><strong>Clinical activity unavailable</strong><p>No supported activity records were returned for this patient.</p></div>}
      </section>}
      <footer className="pci-disclaimer"><ShieldCheck size={15} /><p>Clinical decision support · {analysis.ruleVersion} · Measurements and deterministic review rules support a clinician's assessment. Forecasts distinguish patient-specific statistical projections, rule-based review signals and unavailable outcome models; no autonomous diagnosis is produced.</p></footer>
    </>}
    {review && <ReviewDialog key={review.id} item={review} onClose={() => setReview(null)} onSave={saveReview} />}
    {risk && <RiskDialog risk={risk} onClose={() => setRisk(null)} />}
    {measurementOpen && patient && <MeasurementDialog patient={patient} onClose={() => setMeasurementOpen(false)} onSave={saveMeasurement} />}
  </div>;
}


function SummaryCard({ label, icon, value, unit, detail, badge, tone = "accent", children }: {
  label: string; icon: ReactNode; value: string; unit?: string; detail: string; badge?: string; tone?: string; children?: ReactNode;
}) {
  return <article className={`pci-summary pci-tone-${tone}`}><div className="pci-summary-label"><span>{label}</span><span className="pci-soft-icon">{icon}</span></div>
    <div className="pci-summary-value"><strong>{value}</strong>{badge && <span className="pci-category-badge">{badge}</span>}</div>
    {unit && <span className="pci-summary-unit">{unit}</span>}<p>{detail}</p>{children}</article>;
}

function FindingCard({ item, canReview, onReview, compact = false }: { item: ReviewedFinding; canReview: boolean; onReview: (item: ReviewedFinding) => void; compact?: boolean }) {
  const f = item.finding, reviewed = item.reviewState !== "AWAITING_REVIEW";
  return <article className={`pci-finding ${f.priority === "URGENT" ? "pci-finding-urgent" : ""} ${reviewed ? "pci-finding-reviewed" : ""}`}>
    <div className="pci-finding-status"><span className={`pci-priority pci-priority-${f.priority.toLowerCase()}`}>{f.priority === "URGENT" ? <TriangleAlert size={12} /> : <span className="pci-dot" />}{readable(f.priority)}</span>
      {reviewed && <span className="pci-reviewed-tag"><Check size={12} /> {readable(item.reviewState)}</span>}</div>
    <h3>{f.title}</h3><p>{compact ? f.suggestedAction : f.reason}</p>
    {!compact && <><p className="pci-finding-action">{item.modifiedRecommendation || f.suggestedAction}</p><div className="pci-evidence-source"><FileCheck2 size={13} /><span>{f.source}</span></div>{item.reason && <p className="pci-review-reason">Clinician reason{item.reasonCode ? ` · ${readable(item.reasonCode)}` : ""}: {item.reason}</p>}{item.clinicalNote && <p className="pci-review-reason">Clinical note: {item.clinicalNote}</p>}</>}
    <button className="pci-text-button" disabled={!canReview} onClick={() => onReview(item)}>{reviewed ? "Update review" : "Review finding"}<ArrowRight size={14} /></button>
  </article>;
}

function DataQuality({ data }: { data: ClinicalOverview }) {
  const q = data.analysis.quality;
  return <section className="pci-card"><div className="pci-section-header"><div><div className="pci-kicker">Evidence quality</div><h2>Data quality & provenance</h2></div><Database size={21} /></div>
    <p className="pci-muted">{q.policy}</p><div className="pci-quality-stats"><div><strong>{readable(q.qualityLevel)}</strong><span>Quality level</span></div><div><strong>{q.includedCount || "None"}</strong><span>Usable measurements</span></div><div><strong>{q.excludedCount || "None"}</strong><span>Excluded observations</span></div><div><strong>{q.includedCount ? `${q.freshMetricCount}/${q.expectedMetricCount}` : "Unavailable"}</strong><span>Recent review metrics</span></div></div>
    <div className="pci-metric-checks">{(["egfr","creatinine","acr","systolic","hba1c","potassium","hemoglobin"] as Metric[]).map(key => <span key={key} className={q.missingMetrics.includes(key) ? "is-missing" : "is-present"}>{q.missingMetrics.includes(key) ? <Clock3 size={13} /> : <CheckCircle2 size={13} />}{metricLabels[key]}</span>)}</div>
    {q.flags.length > 0 && <details className="pci-quality-flags"><summary><TriangleAlert size={14} /> Review {q.flags.length} data-quality notice{q.flags.length === 1 ? "" : "s"}</summary><ul>{q.flags.map((flag,i) => <li key={`${flag.observationId}-${flag.code}-${i}`}><strong>{readable(flag.code)}</strong><span>{flag.message}</span>{flag.observationId && <code>{flag.observationId}</code>}</li>)}</ul></details>}
    {data.analysis.safety.reasons.length > 0 && <details className="pci-quality-flags"><summary><ShieldCheck size={14} /> Renal safety & forecast readiness</summary><ul>{data.analysis.safety.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul><p className="pci-footnote">{data.analysis.safety.source}. This laboratory screen does not evaluate the complete urine-output criterion or provide clinical clearance.</p></details>}
    <p className="pci-footnote">Unrecognized units, implausible values and missing or future clinical dates are excluded. Completeness is not prediction confidence.</p>
  </section>;
}

function ClassificationMatrix({ data }: { data: ClinicalOverview }) {
  const c = data.analysis.classification;
  return <section className="pci-card"><div className="pci-section-header"><div><div className="pci-kicker">Measurement context</div><h2>Kidney category map</h2></div><Activity size={22} /></div><p className="pci-muted">Current G/A categories from recorded results. This map does not diagnose CKD.</p>
    <div className="pci-table-wrap"><table className="pci-category-table"><caption className="sr-only">Kidney categories. The cell matching this patient's recorded eGFR and ACR is marked.</caption><thead><tr><th scope="col">eGFR</th>{["A1","A2","A3"].map(a => <th scope="col" key={a}>{a}</th>)}</tr></thead><tbody>{["G1","G2","G3a","G3b","G4","G5"].map(g => <tr key={g}><th scope="row">{g}</th>{["A1","A2","A3"].map(a => <td className={c.gCategory === g && c.aCategory === a ? "is-current" : ""} key={a}>{c.gCategory === g && c.aCategory === a ? <><span className="pci-matrix-marker"><Check size={13} /></span><span className="sr-only">Current recorded categories</span></> : <span aria-hidden="true">·</span>}</td>)}</tr>)}</tbody></table></div>
    <p className="pci-footnote">{c.gCategory && c.aCategory ? `Recorded categories: ${c.gCategory} / ${c.aCategory}.` : "Both dated eGFR and urine ACR are needed to locate the patient."} {c.chronicity === "NOT_ESTABLISHED" ? "Chronicity is not established." : "Persistence is supported by dated measurements; clinician confirmation is required."}</p></section>;
}

function TrendDetails({ trend }: { trend: ClinicalTrend }) {
  return <div className="pci-trend-details"><div className="pci-window-grid">{trend.windows.map(w => <div key={w.days}><span>{w.days === 180 ? "6 months" : w.days === 365 ? "12 months" : `${w.days} days`}</span><strong>{w.absoluteChange == null ? "Unavailable" : `${w.absoluteChange > 0 ? "+" : ""}${number(w.absoluteChange)}`}</strong><small>{w.baseline ? `Baseline ${date(w.baseline.observedAt)}` : "Two dated results needed"}</small></div>)}</div>
    <p className="pci-footnote">Historical slope: {trend.slopePerYear == null ? "unavailable; at least three measurements spanning 90 days are required" : `${number(trend.slopePerYear)} ${trend.unit} per year (observed linear regression, not a forecast)`}.</p>
    <details className="pci-measurement-details"><summary>View measurements & original sources</summary><div className="pci-table-wrap"><table className="pci-measurement-table"><caption className="sr-only">{trend.label} source measurements</caption><thead><tr><th>Date</th><th>Value</th><th>Original</th><th>Source</th></tr></thead><tbody>{[...trend.observations].reverse().map(o => <tr key={o.id}><td>{date(o.observedAt)}</td><td>{number(o.value)} {o.unit}</td><td>{number(o.originalValue)} {o.originalUnit}</td><td>{readable(o.source)}{o.code && <small>LOINC {o.code}</small>}<small>{o.sourceId ?? o.id}</small></td></tr>)}</tbody></table>{!trend.observations.length && <p className="pci-muted">Data unavailable</p>}</div></details></div>;
}

function ReviewDialog({ item, onClose, onSave }: { item: ReviewedFinding; onClose: () => void;
  onSave: (item: ReviewedFinding, action: ReviewAction, reasonCode: ReviewReasonCode, reason: string,
    clinicalNote: string, modified: string, requestId: string) => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null), reasonInput = useRef<HTMLTextAreaElement>(null);
  const [action, setAction] = useState<ReviewAction>("ACCEPT"), [reasonCode, setReasonCode] = useState<ReviewReasonCode>("CLINICAL_JUDGMENT");
  const [reason, setReason] = useState(""), [clinicalNote, setClinicalNote] = useState(""), [modified, setModified] = useState(item.finding.suggestedAction);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const request = useRef({ content: "", id: "" });
  useEffect(() => { dialog.current?.showModal(); }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return;
    if (!reason.trim() || action === "MODIFY" && !modified.trim()) { setError("Document a reason and, for Modify, the revised recommendation."); reasonInput.current?.focus(); return; }
    const content = JSON.stringify({ action, reasonCode, reason: reason.trim(), clinicalNote: clinicalNote.trim(), modified: action === "MODIFY" ? modified.trim() : "" });
    if (request.current.content !== content) request.current = { content, id: crypto.randomUUID() };
    setBusy(true); setError("");
    try { await onSave(item, action, reasonCode, reason.trim(), clinicalNote.trim(), action === "MODIFY" ? modified.trim() : "", request.current.id); }
    catch (e) { setError(e instanceof Error ? e.message : "Review could not be saved."); setBusy(false); }
  };
  return <dialog ref={dialog} className="pci-dialog" aria-labelledby="pci-review-title" onClose={onClose} onCancel={event => { if (busy) event.preventDefault(); }}>
    <div className="pci-dialog-header"><span className="pci-soft-icon"><ListChecks size={22} /></span><button aria-label="Close review" disabled={busy} onClick={() => dialog.current?.close()}><X size={20} /></button></div>
    <div className="pci-kicker">Clinician review · version {item.version}</div><h2 id="pci-review-title">{item.finding.title}</h2><p className="pci-muted">{item.finding.reason}</p>
    <div className="pci-dialog-evidence"><strong>Suggested review</strong><p>{item.finding.suggestedAction}</p><small>{item.finding.source}</small></div>
    <form onSubmit={event => void submit(event)}><fieldset disabled={busy}><label>Review decision<select value={action} onChange={e => setAction(e.target.value as ReviewAction)}>{(["ACCEPT","MODIFY","DISMISS","DEFER"] as ReviewAction[]).map(a => <option key={a} value={a}>{readable(a)}</option>)}</select></label>
      <label>Reason category <span className="pci-required">Required</span><select value={reasonCode} onChange={e => setReasonCode(e.target.value as ReviewReasonCode)}>{(["CLINICAL_JUDGMENT","INCORRECT_DATA","ALREADY_MANAGED","CONTRAINDICATED","PATIENT_PREFERENCE","NOT_RELEVANT","OTHER"] as ReviewReasonCode[]).map(code => <option key={code} value={code}>{readable(code)}</option>)}</select></label>
      {action === "MODIFY" && <label>Revised recommendation <span className="pci-required">Required</span><textarea value={modified} onChange={e => setModified(e.target.value)} required aria-required="true" maxLength={4000} rows={3} /></label>}
      <label>Clinical reason <span className="pci-required">Required</span><textarea ref={reasonInput} autoFocus value={reason} onChange={e => setReason(e.target.value)} required aria-required="true" aria-describedby="pci-review-guidance" maxLength={2000} rows={3} placeholder="Document your review and clinical reasoning" /></label>
      <label>Clinical note (optional)<textarea value={clinicalNote} onChange={e => setClinicalNote(e.target.value)} maxLength={4000} rows={3} placeholder="Relevant context, follow-up or limitation" /></label>
      <p id="pci-review-guidance" className="pci-footnote">Your action and reason are saved with the evidence version and FHIR provenance. Accept records your review; any clinical orders must be entered separately.</p>
      {error && <p className="pci-inline-error" role="alert"><TriangleAlert size={15} />{error}</p>}</fieldset><div className="pci-dialog-actions"><Button variant="outline" disabled={busy} onClick={() => dialog.current?.close()}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving review…" : "Save clinical review"}</Button></div></form>
  </dialog>;
}

function RiskDialog({ risk, onClose }: { risk: ClinicalOverview["risks"][number]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null); useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="pci-dialog" aria-labelledby="pci-risk-title" onClose={onClose}><div className="pci-dialog-header"><span className="pci-soft-icon"><BrainCircuit size={24} /></span><button autoFocus aria-label="Close risk details" onClick={() => dialog.current?.close()}><X size={20} /></button></div>
    <div className="pci-kicker">Why this result?</div><h2 id="pci-risk-title">{risk.label}</h2><p className="pci-muted">{risk.purpose}</p><div className="pci-dialog-evidence"><strong>{risk.category ? readable(risk.category) : readable(risk.status)}</strong><p>{risk.reason}</p></div>
    {risk.signal?.reasoning.length ? <div className="pci-explanation-list"><strong>Main contributing data</strong><ul>{risk.signal.reasoning.map(item => <li key={item}>{item}</li>)}</ul><p>{risk.signal.recommendation}</p></div> : null}
    <dl className="pci-model-details"><div><dt>Model / rule</dt><dd>{risk.modelName}</dd></div><div><dt>Model version</dt><dd>{risk.modelVersion}</dd></div><div><dt>Time horizon</dt><dd>{risk.horizon}</dd></div><div><dt>Method</dt><dd>{readable(risk.method)}</dd></div><div><dt>Reliability</dt><dd>{risk.confidence ? readable(risk.confidence) : "Not applicable / unavailable"}</dd></div><div><dt>Future probability</dt><dd>{risk.probability == null ? "Not calculated" : `${number(risk.probability * 100)}%`}</dd></div><div><dt>Validation status</dt><dd>{readable(risk.validationStatus)}</dd></div><div><dt>Sri Lankan validation</dt><dd>{readable(risk.localValidationStatus)}</dd></div><div><dt>Runtime</dt><dd>{readable(risk.runtimeStatus)}</dd></div><div><dt>Missing inputs</dt><dd>{risk.missingInputs.length ? risk.missingInputs.join(", ") : "None identified"}</dd></div></dl>
    {risk.reference && <p className="pci-footnote">Reference: {risk.reference}</p>}<p className="pci-footnote">Unavailable modules do not produce placeholder percentages. Activation requires model-specific eligibility, external evaluation, calibration, governance approval and a reviewed runtime adapter.</p><div className="pci-dialog-actions"><Button onClick={() => dialog.current?.close()}>Done</Button></div></dialog>;
}

class ChartBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="pci-chart-empty"><strong>Chart unavailable</strong><span>Use Trends → View measurements & original sources to read the data.</span></div> : this.props.children; }
}
