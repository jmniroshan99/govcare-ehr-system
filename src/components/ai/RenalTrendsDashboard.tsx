import { useMemo, useRef, useState } from "react";
import { Activity, Database, History, Info, Plus, RefreshCw } from "lucide-react";
import { Brush, CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Button } from "../ui/button";
import { ChartTooltip } from "../../theme/ChartTooltip";
import type { RenalDataAction, RenalPredictiveIntelligence, RenalTimelineSource } from "../../services/renalIntelligenceService";
import "./renal-trends-dashboard.css";

const measurements = [
  ["hemoglobin", "Hemoglobin", "g/dL"], ["creatinine", "Serum Creatinine", "mg/dL"],
  ["egfr", "eGFR", "mL/min/1.73m²"], ["potassium", "Serum potassium", "mmol/L"],
  ["potassium_pre", "Potassium · pre-HD", "mmol/L"], ["potassium_post", "Potassium · post-HD", "mmol/L"],
  ["urea", "Blood urea", "mmol/L"], ["urea_pre", "Urea · pre-HD", "mmol/L"], ["urea_post", "Urea · post-HD", "mmol/L"],
  ["urr", "Urea reduction ratio (URR)", "%"], ["albumin", "Serum albumin", "g/L"],
  ["sodium", "Sodium", "mmol/L"], ["calcium", "Calcium", "mmol/L"],
  ["creatinine_pre", "Creatinine · pre-HD", "umol/L"], ["creatinine_post", "Creatinine · post-HD", "umol/L"],
  ["bun", "Blood urea nitrogen (BUN)", "mg/dL"], ["acr", "Urine ACR", "mg/g"],
] as const;
const number = (v: number | null | undefined) => v != null && Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "Result required";
const date = (v: string | null | undefined) => v && Number.isFinite(Date.parse(v)) ? new Date(v).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "Collection date unverified";
const words = (v?: string) => (v || "Unavailable").replaceAll("_", " ").toLowerCase();
const valid = (r: RenalTimelineSource) => r.included && r.sourceVerified && r.value != null && Number.isFinite(r.value) && Number.isFinite(Date.parse(r.observedAt || ""));
const time = (r: RenalTimelineSource) => Date.parse(r.observedAt!);

export function RenalTrendsDashboard({ data, patientDisplay, canWrite, onAction, onRefresh, refreshing }: {
  data: RenalPredictiveIntelligence; patientDisplay: string; canWrite: boolean; refreshing: boolean;
  onAction: (action: RenalDataAction) => void; onRefresh: () => void;
}) {
  const [metric, setMetric] = useState("hemoglobin");
  const [range, setRange] = useState("all");
  const [sampleContext, setSampleContext] = useState("SERUM");
  const [loadedAt] = useState(() => new Date().toLocaleString());
  const sourcesRef = useRef<HTMLDetailsElement>(null);
  const timeline = data.renalTimeline;
  const sources = timeline?.sources || [];
  const allSeries = timeline?.series || {};
  const selected = measurements.find(m => m[0] === metric) || measurements[0];
  const contexts = [...new Set((allSeries[metric] || []).filter(valid).map(r => r.sampleContext || "SERUM"))];
  const context = contexts.includes(sampleContext) ? sampleContext : contexts[0] || "SERUM";
  const series = useMemo(() => (allSeries[metric] || []).filter(r => valid(r) && (r.sampleContext || "SERUM") === context).sort((a, b) => time(a) - time(b)), [allSeries, metric, context]);
  const filtered = useMemo(() => {
    if (range === "all") return series;
    const cutoff = new Date();
    if (range === "30") cutoff.setDate(cutoff.getDate() - 30); else cutoff.setMonth(cutoff.getMonth() - Number(range));
    return series.filter(r => time(r) >= cutoff.getTime());
  }, [series, range]);
  const modelKey = metric === "hemoglobin" ? "hb" : metric === "urr" ? "urr" : null;
  const module = modelKey === "hb" ? data.anemia : modelKey === "urr" ? data.dialysisAdequacy : null;
  const prediction = modelKey ? data.predictions.filter(p => p.model_key === modelKey && p.outputs.model_key === modelKey).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] : undefined;
  const output = prediction?.outputs;
  const origin = Date.parse(output?.forecast_origin_date || ""), target = Date.parse(output?.forecast_date || "");
  const supported = Boolean(module && module.forecast != null && output?.status === "AVAILABLE" && output.prediction != null && Number.isFinite(output.prediction) && output.unit === selected[2]);
  const plotForecast = supported && Number.isFinite(origin) && Number.isFinite(target) && target > origin && filtered.some(p => time(p) === origin);
  const points: Array<{ time: number; measured: number | null; predicted: number | null; source: string }> = filtered.map(r => ({ time: time(r), measured: r.value, predicted: null, source: `${words(r.source)} · ${r.sourceId}` }));
  if (plotForecast && output) {
    const anchor = points.find(p => p.time === origin)!;
    anchor.predicted = anchor.measured;
    points.push({ time: target, measured: null, predicted: output.prediction, source: `${output.model} · ${output.model_version}` });
  }
  const showSources = () => {
    if (sourcesRef.current) { sourcesRef.current.open = true; sourcesRef.current.scrollIntoView({ behavior: "smooth", block: "start" }); sourcesRef.current.querySelector("summary")?.focus(); }
  };
  const add = (key = metric) => onAction({ type: ["hemoglobin", "creatinine", "egfr", "potassium", "bun", "acr", "urea", "albumin", "sodium", "calcium"].includes(key) ? "ADD_CLINICAL_HISTORY" : "ADD_LAB_RESULT", label: "Add laboratory result", focusKey: key === "hemoglobin" ? "hemoglobin" : key });
  const summaryKeys = ["creatinine", "egfr", "hemoglobin", "potassium", allSeries.urr?.length ? "urr" : allSeries.urea?.length ? "urea" : "urea_pre"];
  const assessmentValues = sources.filter(r => r.assessmentId && !r.sourceVerified && r.value != null);
  const uniqueAssessment = [...new Map(assessmentValues.map(r => [`${r.assessmentId}|${r.metric}`, r])).values()];

  return <section className="renal-trends" aria-label="Renal Intelligence — Clinical Trends & Research Forecasts">
    <header className="renal-trends-header"><div><span className="pci-kicker">Measured history and research forecast</span><h3>Renal Intelligence — Clinical Trends &amp; Research Forecasts</h3><p>{patientDisplay}</p></div><span className="renal-trends-badge" title="Renal status comes from the authorized clinical record. G5D requires verified chronic maintenance hemodialysis.">{data.currentRenalStatus.stage || "Status unconfirmed"}</span></header>
    <p className="renal-trends-basis">{data.currentRenalStatus.basis}</p>
    <dl className="renal-trends-metadata"><div><dt>Verified dated observations</dt><dd>{timeline ? timeline.verifiedDatedCount : "Refresh required"}</dd></div><div><dt>Latest measurement</dt><dd>{date(timeline?.latestObservedAt)}</dd></div><div><dt>Data coverage</dt><dd>{timeline?.firstObservedAt ? `${date(timeline.firstObservedAt)} – ${date(timeline.latestObservedAt)}` : "No verified dated coverage"}</dd></div><div><dt>Research prediction</dt><dd>{supported ? "Stored forecast available" : modelKey ? "See forecast readiness below" : "No model for this measurement"}</dd></div><div><dt>Last refreshed</dt><dd>{loadedAt}</dd></div></dl>
    <div className="renal-trends-controls"><label>Measurement<select aria-label="Renal trend measurement" value={metric} onChange={e => setMetric(e.target.value)}>{measurements.map(m => <option key={m[0]} value={m[0]}>{m[1]} · {m[2]}</option>)}</select></label>{contexts.length > 1 && <label>Sampling context<select aria-label="Renal sampling context" value={context} onChange={e => setSampleContext(e.target.value)}>{contexts.map(c => <option key={c} value={c}>{words(c)}</option>)}</select></label>}<label>Time range<select aria-label="Renal trend time range" value={range} onChange={e => setRange(e.target.value)}><option value="30">30 days</option><option value="3">3 months</option><option value="6">6 months</option><option value="12">12 months</option><option value="all">All</option></select></label><Button variant="outline" disabled={refreshing} onClick={onRefresh}><RefreshCw size={14} />Refresh trends</Button><Button disabled={!canWrite} onClick={() => add()}><Plus size={14} />Add laboratory result</Button><Button variant="outline" onClick={showSources}><History size={14} />View clinical history</Button></div>
    <div className="renal-trends-indicators" aria-label="Latest verified measurements">{summaryKeys.map(key => {
      const info = measurements.find(m => m[0] === key)!;
      const rows = (allSeries[key] || []).filter(valid).sort((a, b) => time(a) - time(b));
      const latest = rows.at(-1), previous = [...rows].reverse().find(r => latest && time(r) < time(latest) && r.unit === latest.unit && r.sampleContext === latest.sampleContext);
      return <button key={key} type="button" className={metric === key ? "is-selected" : ""} onClick={() => setMetric(key)}><span>{info[1]}</span><strong>{number(latest?.value)}{latest && <small> {latest.unit}</small>}</strong><time dateTime={latest?.observedAt || undefined}>{latest ? date(latest.observedAt) : "No verified dated result"}</time><span>{previous && latest ? `${latest.value! >= previous.value! ? "↑" : "↓"} ${number(latest.value! - previous.value!)} ${latest.unit} since ${date(previous.observedAt)}` : "Trend requires two comparable dates"}</span></button>;
    })}</div>
    <div className="renal-trends-plot"><div className="renal-trends-plot-heading"><h4>{selected[1]} Trend</h4><span title="A measured value is a verified laboratory result with its actual collection date. Forecast eligibility is evaluated separately.">{filtered.length} dated results · {filtered.length > 1 ? "Measured history" : filtered.length === 1 ? "Single measured point" : "Awaiting source data"}</span></div>
      {!points.length ? <div className="renal-trends-empty"><Activity size={22} /><div><strong>{series.length ? "No results in this time range" : "Historical graph not ready"}</strong><p>{!timeline ? "Refresh to load the verified clinical timeline. An older response cannot establish source verification." : series.length ? "Choose a wider time range to review recorded measurements." : `No verified dated ${selected[1]} measurements have been found for this patient.`}</p>{!series.length && <ol><li>Add the first dated result.</li><li>Add a second valid result from a different date.</li><li>Confirm units are {selected[2]} and save to the clinical record.</li></ol>}<span className="renal-trends-progress">{series.length}/2 dated results · Graph readiness only</span><div className="renal-trends-controls"><Button disabled={!canWrite} onClick={() => add()}>Add {selected[1]} result</Button><Button variant="outline" onClick={showSources}>View renal laboratory history</Button></div></div></div> : <>
        <div className="renal-trends-scroll" tabIndex={0} aria-label="Scrollable measurement chart"><div className="renal-trends-chart" role="img" aria-label={`${selected[1]}: ${filtered.length} verified measurements in ${selected[2]} on actual collection dates. ${plotForecast ? "Separate dashed research forecast." : "No research forecast plotted."}`}>
          <ResponsiveContainer width="100%" height="100%" minWidth={1}><LineChart key={`${metric}-${range}`} data={points} accessibilityLayer margin={{ left: 10, right: 24, top: 14, bottom: 12 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 5" /><XAxis dataKey="time" type="number" scale="time" domain={points.length === 1 ? [points[0].time - 86400000, points[0].time + 86400000] : ["dataMin", "dataMax"]} tickFormatter={v => date(new Date(Number(v)).toISOString())} minTickGap={55} tick={{ fontSize: 10 }} stroke="var(--chart-axis)" /><YAxis width={70} domain={["auto", "auto"]} tick={{ fontSize: 11 }} stroke="var(--chart-axis)" label={{value:selected[2],angle:-90,position:"insideLeft",fontSize:10,fill:"var(--chart-axis)"}} />
            <ChartTooltip labelFormatter={v => date(new Date(Number(v)).toISOString())} formatter={(v, name, item) => [`${number(Number(v))} ${selected[2]} · ${item.payload.source}`, name === "predicted" ? "Research forecast · not measured" : "EHR laboratory observation"]} />
            <Line dataKey="measured" type="linear" stroke="var(--text-accent)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--bg-surface)", strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />
            {plotForecast && <Line dataKey="predicted" type="linear" stroke="var(--chart-4, var(--brand-primary))" strokeDasharray="7 5" strokeWidth={2} dot={props => { const x = props.cx ?? 0, y = props.cy ?? 0; return <polygon points={`${x},${y-5} ${x+5},${y} ${x},${y+5} ${x-5},${y}`} fill="var(--brand-primary)" />; }} connectNulls isAnimationActive={false} />}
            {filtered.length > 4 && <Brush dataKey="time" height={24} tickFormatter={v => date(new Date(Number(v)).toISOString())} stroke="var(--text-accent)" />}
          </LineChart></ResponsiveContainer>
        </div></div><p className="renal-trends-legend"><span>● ━ Measured · {selected[2]}</span>{plotForecast && <span>◆ ┄ Research forecast · not a lab result</span>}</p>
        {filtered.length === 1 && <p className="renal-trends-note">One measured result is shown as a point. A trend requires a second comparable date.</p>}
      </>}
    </div>
    <aside className="renal-trends-forecast" aria-label="Research Forecast"><div><span className="pci-kicker">Research Forecast</span><strong>{supported && output ? `${number(output.prediction)} ${output.unit}` : modelKey ? module?.researchReadiness?.resultTitle || "Forecast unavailable" : "No supported forecast for this measurement"}</strong><p>{supported && output ? output.horizon_definition || "Supported next-observation horizon; calendar target not established" : module?.researchReadiness?.message || "Review measured history and add missing source results."}</p></div>{modelKey && <span className="renal-trends-badge" title="A research forecast has not undergone clinical validation and requires clinician review.">NOT CLINICALLY VALIDATED</span>}
      {modelKey && <details><summary>Model, completeness &amp; explanation</summary><p>Model: {output?.model || module?.researchModel?.model || "Unavailable"} · version {output?.model_version || module?.researchModel?.modelVersion || "Unavailable"}</p><p>Target: {output?.forecast_date ? date(output.forecast_date) : "No calendar target supplied"} · Method: {output?.method || "Not run"}</p><p>Input completeness: {module?.researchReadiness?.requiredReadyCount ?? "Unknown"} / {module?.researchReadiness?.requiredCount ?? "Unknown"} requirements. Two chart points do not establish model eligibility.</p>{module?.researchReadiness?.requirements.filter(r => !r.satisfied).map(r => <p key={r.key}>Required: {r.label} · {r.detail}</p>)}{output?.explanation.trends.map((t, i) => <p key={i}>{t}</p>)}{output?.explanation.top_factors.map((f, i) => <p key={i}>{words(f.feature)} · {String(f.value ?? "Missing")} · contribution {number(f.contribution)} ({output.explanation.contribution_unit || "contribution units not supplied"}; not a percentage change in clinical risk)</p>)}{output?.explanation.limitations.map((l, i) => <p key={i}>{l}</p>)}{output?.interval && Number.isFinite(output.interval.low) && Number.isFinite(output.interval.high) && output.interval.low <= output.interval.high && output.interval.level > 0 && output.interval.level <= 1 && <p>Supplied uncertainty interval: {number(output.interval.low)}?{number(output.interval.high)} {output.unit} ? {number(output.interval.level * 100)}% ? {output.interval.method}. Internal research interval; clinical calibration not established.</p>}{supported && Number.isFinite(origin) && series.some(r => time(r) > origin) && <p>Newer measured results exist after this forecast input. Reconcile the stored snapshot before interpretation.</p>}<p>Audit reference: {prediction?.id || data.snapshotId} · Review: {words(prediction?.review_state)}</p></details>}
    </aside>
    {uniqueAssessment.length > 0 && <details className="renal-trends-assessments"><summary>Current Assessment Values · source verification required</summary><p>Assessment values retain their entered source. Submission time is not a laboratory collection date. These values are excluded from verified summaries and graphs.</p>{uniqueAssessment.map(r => <p key={`${r.assessmentId}-${r.metric}`}>{words(r.metric)}: {number(r.value)} {r.unit} · {date(r.observedAt)} · assessment {r.assessmentId}</p>)}</details>}
    <details ref={sourcesRef} className="renal-trends-sources"><summary><Database size={14} /> Clinical Data Sources ({sources.length} source values)</summary><p>{timeline?.sourcePolicy || "Refresh the workspace to obtain source verification and inclusion decisions."}</p>{timeline?.historyTruncated && <p role="status">History exceeds retrieval limits. This is a partial timeline; reconcile source records before interpretation.</p>}{sources.length === 0 && <p>{timeline ? "No supported source results were returned by the authorized clinical sources. Add dated results or review the patient record. Access restrictions do not establish that no results exist elsewhere." : "The verified timeline has not loaded. This does not mean the patient has zero results."}</p>}
      <div className="renal-trends-table-scroll"><table><caption className="sr-only">Clinical evidence and inclusion decisions</caption><thead><tr>{["Observation date", "Measurement", "Value", "Unit", "Source", "Verification", "Included / excluded", "Reason"].map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{sources.map((r, i) => <tr key={`${r.sourceId}-${r.metric}-${i}`}><td>{date(r.observedAt)}</td><td>{words(r.metric)} {r.sampleContext && r.sampleContext !== "SERUM" ? words(r.sampleContext) : ""}</td><td>{number(r.originalValue ?? r.value)}</td><td>{r.originalUnit || r.unit}</td><td>{words(r.source)}{r.entrySource && <small>{words(r.entrySource)}</small>}<small>{r.sourceId}</small></td><td>{r.sourceVerified ? "Verified" : "Unverified"}</td><td>{r.included ? "Included" : "Excluded"}</td><td>{r.included ? "Verified dated source" : words(r.exclusionReason)}</td></tr>)}</tbody></table></div><div className="renal-trends-controls"><Button variant="outline" onClick={() => onAction({ type: "OPEN_CLINICAL_RECORD", label: "View clinical record", focusKey: null })}>View clinical record</Button><Button disabled={!canWrite} onClick={() => add()}>Add missing result</Button></div>
    </details><p className="renal-trends-note"><Info size={14} /> <span title="URR is calculated only from verified paired pre/post dialysis urea in a shared session.">URR: urea reduction ratio.</span> Measurements and research forecasts are separate evidence. No inference runs when viewing this chart.</p>
  </section>;
}
