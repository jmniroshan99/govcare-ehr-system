import {modelScorePercent,validatedUnitScore} from "../../lib/clinicalScore";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, BrainCircuit, CheckCircle2, FileCheck2, Download, Info, Plus, RefreshCw, ShieldCheck, TriangleAlert, X } from "lucide-react";
import { RenalTrendsDashboard } from "./RenalTrendsDashboard";
import { Button } from "../ui/button";
import { RenalClinicalModules } from "./RenalClinicalModules";
import { ClinicalMeasurementDialog } from "./ClinicalMeasurementDialog";
import { CkdEvidenceDialog,CkdEvidenceSetup } from "./CkdEvidenceSetup";
import type { EvidenceMetric } from "../../services/ckdClinicalEvidenceService";
import { recordVerifiedMeasurement, type MeasurementInput, type MeasurementMetric as Metric } from "../../services/predictiveIntelligenceService";
import { RenalResearchInfographic } from "./RenalResearchInfographic";
import { ApiRequestError } from "../../services/apiClient";
import type { AuthorizedPatient } from "../../services/patientService";
import { renalModuleOrder, getRenalPredictiveIntelligence, predictRenalOutcome, recordRenalObservation, reviewRenalPrediction,
  verifyRenalDialysisStatus,type RenalDialysisVerificationInput,
  type RenalPredictiveIntelligence, type RenalMeasurementKey, type RenalModelKey, type RenalObservation,
  type RenalObservationInput, type RenalPrediction, type RenalReviewAction, type RenalReviewInput, type RenalDataAction } from "../../services/renalIntelligenceService";
import "./sri-lankan-renal.css";
import "./predictive-intelligence.css";

const models: Array<{ key: RenalModelKey; label: string; unit: string }> = [
  { key: "hb", label: "Hemoglobin", unit: "g/dL" },
  { key: "urr", label: "Urea reduction ratio", unit: "%" },
  { key: "hyperkalemia", label: "Next-period hyperkalemia research risk", unit: "risk score" },
  { key: "dry-weight", label: "Dry weight", unit: "kg" },
];
const fields: Array<{ key: RenalMeasurementKey; label: string; unit: string }> = [
  { key: "hb", label: "Hemoglobin", unit: "g/dL" },
  { key: "albumin", label: "Serum albumin", unit: "g/L" },
  { key: "calcium", label: "Calcium", unit: "mmol/L" },
  { key: "sodium", label: "Sodium", unit: "mmol/L" },
  { key: "potassium_pre", label: "Potassium · pre-dialysis", unit: "mmol/L" },
  { key: "potassium_post", label: "Potassium · post-dialysis", unit: "mmol/L" },
  { key: "creatinine_pre", label: "Creatinine · pre-dialysis", unit: "umol/L" },
  { key: "creatinine_post", label: "Creatinine · post-dialysis", unit: "umol/L" },
  { key: "urea_pre", label: "Urea · pre-dialysis", unit: "mmol/L" },
  { key: "urea_post", label: "Urea · post-dialysis", unit: "mmol/L" },
  { key: "dry_weight", label: "Recorded dry weight", unit: "kg" },
];
const readable = (value: string | null | undefined) => value ? value.toLowerCase().replaceAll("_", " ").replaceAll("-", " ") : "Unavailable";
const formatNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "Unavailable";
const formatDate = (value?: string | null) => value && Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "Date unavailable";
const observedTime = (observation: RenalObservation) => Date.parse(observation.observed_at);
const latestObservation = (observations: RenalObservation[], metric: RenalMeasurementKey) => observations
  .filter(row => Number.isFinite(row.measurements?.[metric]) && Number.isFinite(observedTime(row)))
  .sort((a, b) => observedTime(b) - observedTime(a))[0];
const latestPrediction = (predictions: RenalPrediction[], key: RenalModelKey) => predictions
  .filter(row => row.model_key === key && row.outputs?.model_key === key)
  .sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0))[0];
const inputIsStale = (prediction?: RenalPrediction) => Boolean(prediction?.outputs.forecast_origin_date &&
  Number.isFinite(Date.parse(prediction.outputs.forecast_origin_date)) && Date.now() - Date.parse(prediction.outputs.forecast_origin_date) > 62 * 86400000);
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "The renal intelligence request could not be completed.";
const dryWeightLimitation = "Unavailable: the source dry-weight data do not establish a patient/date cohort for safe longitudinal model training.";


/** The enclosing CKD workspace owns the selected and authorized patient. */
type RenalPanelProps={patient:AuthorizedPatient;onGenerateReport?:(clinicalSnapshotId?:string)=>void;reportBusy?:boolean};
export function SriLankanRenalPanel({ patient, onGenerateReport, reportBusy }: RenalPanelProps) {
  return <RenalPatientWorkspace key={`${patient.id}:${patient.hospital_id ?? ""}`} patient={patient} onGenerateReport={onGenerateReport} reportBusy={reportBusy}/>;
}

function RenalPatientWorkspace({ patient, onGenerateReport, reportBusy }: RenalPanelProps) {
  const navigate=useNavigate();
  const [data, setData] = useState<RenalPredictiveIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorReference,setErrorReference]=useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [busyModel, setBusyModel] = useState<RenalModelKey | null>(null);
  const [observationOpen, setObservationOpen] = useState(false);
  const [clinicalEntry,setClinicalEntry]=useState<Metric|null>(null);
  const [evidenceEntry,setEvidenceEntry]=useState<{kind:"trend"|"diabetes";metric?:EvidenceMetric}|null>(null);
  const [entryFocus,setEntryFocus]=useState("");
  const history=useRef<HTMLDetailsElement>(null);
  const [review, setReview] = useState<RenalPrediction | null>(null);
  const operation = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const predictionRequests = useRef<Partial<Record<RenalModelKey, string>>>({});
  useEffect(() => {
    operation.current?.abort();
    setObservationOpen(false); setClinicalEntry(null); setEvidenceEntry(null); setReview(null);
    setNotice(""); setBusyModel(null); predictionRequests.current = {};
  }, [patient.id]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; operation.current?.abort(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setLoading(true); setError(""); setErrorReference(""); setData(null);
    void getRenalPredictiveIntelligence(patient.id, controller.signal).then(result => {
      if (!active || controller.signal.aborted) return;
      if (result.patientId !== patient.id || (patient.hospital_id && result.hospitalId !== patient.hospital_id)) {
        throw new Error("Patient and hospital association could not be verified. Refresh the selected patient.");
      }
      if (!Array.isArray(result.observations) || !Array.isArray(result.predictions)) throw new Error("The renal response is incomplete. Refresh or contact support.");
      if (!result.snapshotId || !result.dataQuality || !Array.isArray(result.moduleOrder)
        || JSON.stringify(result.moduleOrder) !== JSON.stringify(renalModuleOrder)
        || result.schemaVersion<2 || !result.readinessSummary || !Array.isArray(result.readinessSummary.missingDataGroups)
        || renalModuleOrder.some(key => !result[key] || result[key].key !== key || !Array.isArray(result[key].limitations)
          || !result[key].readiness || !Array.isArray(result[key].readiness.requirements) || !result[key].readiness.nextAction))
        throw new Error("The six-module renal response is incomplete. Refresh or contact support.");
      setData(result);
    }).catch(failure => { if (active && !controller.signal.aborted) {setError(errorMessage(failure));setErrorReference(failure instanceof ApiRequestError?failure.errorId??"":"");} })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [patient.id, patient.hospital_id, refresh]);

  const scopedData = data?.patientId === patient.id ? data : null;
  const canWrite = Boolean(scopedData?.canReview && !loading && !busyModel);
  const latestRows = models.map(model => ({ ...model, snapshot: latestPrediction(scopedData?.predictions ?? [], model.key) }));
  const mutate = async <T,>(action: (signal: AbortSignal) => Promise<T>) => {
    if (!scopedData?.canReview || loading || operation.current) throw new Error("Clinical write permission and a ready patient workspace are required.");
    const controller = new AbortController(); operation.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 60000);
    try {
      const result = await action(controller.signal);
      if (!mounted.current || controller.signal.aborted) throw new Error("The request was interrupted. Refresh to confirm the saved state before retrying.");
      return result;
    } catch (failure) {
      if (controller.signal.aborted) throw new Error("The request was interrupted or timed out. Refresh to confirm the saved state before retrying.");
      throw failure;
    } finally { window.clearTimeout(timeout); if (operation.current === controller) operation.current = null; }
  };

  const runPrediction = async (key: RenalModelKey) => {
    const moduleKey=renalModuleOrder.find(k=>scopedData?.[k].modelKey===key);
    if (!canWrite || busyModel || key === "dry-weight" || !moduleKey || !(scopedData?.[moduleKey].researchReadiness??scopedData?.[moduleKey].readiness)?.ready || !scopedData?.[moduleKey].canRun) return;
    const requestId = predictionRequests.current[key] ?? crypto.randomUUID(); predictionRequests.current[key] = requestId;
    setBusyModel(key); setError(""); setErrorReference(""); setNotice("");
    try {
      const result=await mutate(signal => predictRenalOutcome(patient.id, key, requestId, signal));
      if (!mounted.current) return;
      delete predictionRequests.current[key];
      setNotice(result.status==="AVAILABLE"?"Research prediction snapshot saved. Reconciliation with the patient record is in progress; clinician review is required.":"No prediction was calculated. The attempt was recorded; the updated module status explains the reason.");
      setRefresh(value => value + 1);
    } catch (failure) { if (mounted.current) {setError(errorMessage(failure));setErrorReference(failure instanceof ApiRequestError?failure.errorId??"":"");} }
    finally { if (mounted.current) setBusyModel(null); }
  };
  const saveObservation = async (input: RenalObservationInput) => {
    await mutate(signal => recordRenalObservation(patient.id, input, signal));
    if (!mounted.current) return;
    setObservationOpen(false); setNotice("Dated source measurements saved. URR is derived by the server only from a valid paired urea result.");
    setRefresh(value => value + 1);
  };
  const saveDialysisVerification=async(input:RenalDialysisVerificationInput)=>{
    await mutate(signal=>verifyRenalDialysisStatus(patient.id,input,signal));
    if(!mounted.current)return;setObservationOpen(false);setNotice("Dated clinical dialysis verification saved. Past laboratory sampling contexts remain unchanged.");setRefresh(value=>value+1);
  };
  const saveReview = async (snapshot: RenalPrediction, input: Omit<RenalReviewInput, "patientId" | "expectedVersion">) => {
    await mutate(signal => reviewRenalPrediction(snapshot.id, { ...input, patientId: patient.id, expectedVersion: snapshot.review_version }, signal));
    if (!mounted.current) return;
    setReview(null); setNotice("Clinician review saved against this prediction snapshot. No treatment orders were created.");
    setRefresh(value => value + 1);
  };
  const takeDataAction=(action:RenalDataAction)=>{
    if(action.focusKey==="diabetes_status"){if(canWrite)setEvidenceEntry({kind:"diabetes"});return;}
    if(action.focusKey?.startsWith("trend:")){if(canWrite)setEvidenceEntry({kind:"trend",metric:action.focusKey.slice(6) as EvidenceMetric});return;}
    if(action.type==="ADD_CLINICAL_HISTORY"){
      if(!canWrite)return;
      const supported:Metric[]=["egfr","creatinine","acr","potassium","hemoglobin","hba1c","systolic","diastolic","glucose","bmi","bun","urea","albumin","sodium","calcium"];
      if(supported.includes(action.focusKey as Metric))setClinicalEntry(action.focusKey as Metric);
      else navigate(`/ai-cdss/ckd?patientId=${encodeURIComponent(patient.id)}&view=assessment`);
    }else if(action.type==="ADD_LAB_RESULT"||action.type==="VERIFY_DIALYSIS_STATUS") {
      if(!canWrite)return;setEntryFocus(action.focusKey??(action.type==="VERIFY_DIALYSIS_STATUS"?"dialysis":"observedAt"));setObservationOpen(true);
    }else if(action.type==="VIEW_HISTORY") {
      if(history.current){history.current.open=true;history.current.scrollIntoView({behavior:"smooth",block:"start"});history.current.querySelector("summary")?.focus();}
    }else if(action.type==="OPEN_CLINICAL_RECORD")navigate(`/patients/${encodeURIComponent(patient.id)}`);
  };

  return <section className="sri-renal" aria-label="Sri Lankan renal research intelligence" aria-busy={loading}>
    <div className="pci-section-header sri-renal-header"><div><span className="pci-kicker">Sri Lankan longitudinal renal research</span><h2>CKD clinical monitoring workspace</h2>
      <p className="pci-muted">Review related clinical risks, complete source evidence and access renal research forecasts.</p></div>
      <div className="sri-renal-actions">{onGenerateReport&&<Button variant="outline" disabled={reportBusy||loading||Boolean(busyModel)} onClick={()=>onGenerateReport(scopedData?.snapshotId)}><Download size={15}/>{reportBusy?"Preparing report…":"Generate report"}</Button>}{scopedData?.canReview && <Button disabled={!canWrite} onClick={() => {setEntryFocus("observedAt");setObservationOpen(true);}}><Plus size={15} /> Add verified renal results</Button>}
        <Button variant="outline" aria-label="Refresh renal research intelligence" disabled={loading || Boolean(busyModel) || observationOpen || Boolean(clinicalEntry) || Boolean(review)} onClick={() => { setNotice(""); setRefresh(value => value + 1); }}><RefreshCw size={15} className={loading ? "pci-spin" : ""} /> Refresh</Button></div>
    </div>
    <div className="sri-renal-governance" aria-label="Research governance status"><span><BrainCircuit size={14} /> Internal research evaluation</span><span><ShieldCheck size={14} /> Clinical validation not completed</span><span><Info size={14} /> Dataset permission unverified</span></div>
    {notice && <div className="sri-renal-message sri-renal-message-success" role="status"><CheckCircle2 size={17} /><p>{notice}</p><button type="button" aria-label="Dismiss renal confirmation" onClick={() => setNotice("")}><X size={16} /></button></div>}
    {error && <div className="sri-renal-message sri-renal-message-error" role="alert"><TriangleAlert size={18} /><div><strong>Renal intelligence request failed</strong><p>{error}</p>{errorReference&&<small>Request reference: {errorReference}</small>}</div><Button variant="outline" disabled={loading || Boolean(busyModel)} onClick={() => setRefresh(value => value + 1)}>Retry</Button></div>}
    {loading && <div className="sri-renal-empty" role="status"><Activity size={22} /><strong>Loading authorized renal history…</strong></div>}
    {scopedData && <>
      <CkdEvidenceSetup data={scopedData} canWrite={canWrite&&!busyModel&&!evidenceEntry} onTrend={metric=>setEvidenceEntry({kind:"trend",metric})} onDiabetes={()=>setEvidenceEntry({kind:"diabetes"})} onDialysis={()=>{setEntryFocus("urea_pre");setObservationOpen(true);}}/>
      <div className="sri-renal-status"><div><span className="pci-kicker">Recorded renal status</span><strong>{scopedData.currentRenalStatus?.stage ?? "Unconfirmed"}</strong><span>{scopedData.currentRenalStatus?.label ?? "Clinical status unavailable"}</span></div>
        <p>{scopedData.currentRenalStatus?.basis ?? "Confirm renal status from the clinical record."} G5D requires verified chronic maintenance hemodialysis; high creatinine alone does not establish it.</p></div>
      {scopedData.clinicalFeatureData?<div className="sri-renal-latest" aria-label="Mapped CKD source measurements">{["creatinine","egfr","potassium","hemoglobin"].map(key=>{const value=scopedData.clinicalFeatureData!.current[key];return <div key={key}><span>{value.label}</span><strong>{value.available?formatNumber(value.value):"Result required"}{value.available&&<small> {value.unit}</small>}</strong><time dateTime={value.observedAt??undefined}>{value.observedAt?formatDate(value.observedAt):value.available?"Undated assessment snapshot":"No recorded value"}</time></div>;})}</div>:<div className="sri-renal-latest" aria-label="Latest source measurements">{(["potassium_pre", "sodium", "calcium", "albumin"] as const).map(key => {
        const source = latestObservation(scopedData.observations, key); const field = fields.find(item => item.key === key)!;
        return <div key={key}><span>{field.label}</span><strong>{formatNumber(source?.measurements[key])}{source && <small> {source.units[key] ?? "Unit unavailable"}</small>}</strong>
          <time dateTime={source?.observed_at}>{source ? formatDate(source.observed_at) : "No dated source result"}</time></div>;
      })}</div>}
      {!scopedData.canReview && <p className="sri-renal-permission"><ShieldCheck size={15} /> Read-only clinical access. Recording observations and reviewing predictions require clinical write permission.</p>}
      {!scopedData.observations.length && (!scopedData.clinicalFeatureData?.assessmentCount?<div className="sri-renal-empty"><FileCheck2 size={23} /><strong>No dated dialysis observations recorded</strong><p>Record verified source results with explicit units and a measurement date. Predictions require sufficient patient history.</p></div>:<p className="sri-renal-small">CKD assessment measurements support the monitoring results below. Dialysis adequacy and maintenance-HD forecasts require separately verified session data.</p>)}
      <RenalClinicalModules data={scopedData} patientDisplay={`${patient.full_name||"Authorized patient"} · ${patient.patient_no||patient.id}`} canWrite={canWrite} busyModel={busyModel} onRun={key => void runPrediction(key)} onRefresh={() => setRefresh(value => value + 1)} onAction={takeDataAction} onGenerateReport={onGenerateReport}/>
      <details className="sri-renal-sources"><summary>Stored research model history and legacy review</summary><div className="sri-renal-models">{latestRows.map(model => <RenalModelCard key={model.key} model={model} canWrite={canWrite} busy={busyModel === model.key}
        onRun={() => void runPrediction(model.key)} onReview={setReview} />)}</div></details>
      <RenalTrendsDashboard key={patient.id} data={scopedData} patientDisplay={`${patient.patient_no || patient.id}`} canWrite={canWrite} refreshing={loading || Boolean(busyModel)} onAction={takeDataAction} onRefresh={() => setRefresh(value => value + 1)} />
      <details ref={history} className="sri-renal-sources"><summary>Dialysis session records ({scopedData.observations.length} sessions)</summary>
        {scopedData.clinicalFeatureData&&<section><h4>Saved CKD assessment sources ({scopedData.clinicalFeatureData.assessmentCount})</h4><ul>{scopedData.clinicalFeatureData.assessmentSources.map(source=><li key={source.assessmentId}>Assessment {source.assessmentId} · recorded {formatDate(source.recordedAt)} · measurement date {source.observationDate?formatDate(source.observationDate):"Not verified"}</li>)}</ul><p>Recording time is distinct from laboratory measurement time. Each feature retains its own source date.</p></section>}
        {scopedData.currentRenalStatus.dialysisStatus&&<div className="sri-renal-status"><div><strong>Clinician-recorded dialysis context</strong><span>{readable(scopedData.currentRenalStatus.dialysisStatus)} · {formatDate(scopedData.currentRenalStatus.dialysisVerifiedAt)}</span></div><p>{scopedData.currentRenalStatus.dialysisEvidence}</p></div>}
        <div className="pci-table-wrap"><table className="sri-renal-table"><caption className="sr-only">Dated dialysis measurements and recorded source</caption><thead><tr><th scope="col">Observed date</th><th scope="col">Measurements</th><th scope="col">Clinical context and source</th></tr></thead>
          <tbody>{[...scopedData.observations].sort((a, b) => observedTime(b) - observedTime(a)).map(row => <tr key={row.id}><td><time dateTime={row.observed_at}>{formatDate(row.observed_at)}</time></td>
            <td>{Object.entries(row.measurements ?? {}).filter(([, value]) => Number.isFinite(value)).map(([key, value]) => <span className="sri-renal-source-value" key={key}>{key === "urr" ? "URR (server-derived)" : fields.find(item => item.key === key)?.label ?? readable(key)}: {formatNumber(value)} {row.units?.[key as RenalMeasurementKey | "urr"]}</span>)}</td>
            <td><span>{row.maintenance_hemodialysis_verified ? "Chronic maintenance hemodialysis verified" : "Maintenance dialysis not confirmed"}</span><p>{row.source_note || "Source note unavailable"}</p></td></tr>)}</tbody></table></div>
      </details>
      <details className="sri-renal-sources"><summary>Research methods & thesis illustration</summary><RenalResearchInfographic /></details>
      <p className="sri-renal-footer"><ShieldCheck size={14} /> Forecasts are continuous research estimates, not disease probabilities or treatment recommendations. A clinician must reconcile source data and review each snapshot.</p>
    </>}
    {observationOpen && <RenalObservationDialog patient={patient} focusKey={entryFocus} onClose={() => setObservationOpen(false)} onSave={saveObservation} onVerify={saveDialysisVerification} />}
    {clinicalEntry&&<ClinicalMeasurementDialog patient={patient} initialMetric={clinicalEntry} onClose={()=>setClinicalEntry(null)} onSave={async(input:MeasurementInput,requestId:string)=>{
      await mutate(signal=>recordVerifiedMeasurement(patient.id,input,requestId,signal));if(!mounted.current)return;
      setClinicalEntry(null);setNotice("Verified clinical measurement saved. CKD feature mapping and readiness will refresh from the database.");setRefresh(value=>value+1);
    }}/>}
    {evidenceEntry&&<CkdEvidenceDialog patient={patient} kind={evidenceEntry.kind} initialMetric={evidenceEntry.metric} onClose={()=>setEvidenceEntry(null)} onSaved={()=>{setEvidenceEntry(null);setNotice("Verified evidence saved. Clinical calculations are refreshing from the source records.");setRefresh(value=>value+1);}}/>}
    {review && <RenalReviewDialog key={review.id} prediction={review} onClose={() => setReview(null)} onSave={saveReview} />}
  </section>;
}

function RenalModelCard({ model, canWrite, busy, onRun, onReview }: {
  model: { key: RenalModelKey; label: string; unit: string; snapshot?: RenalPrediction };
  canWrite: boolean; busy: boolean; onRun: () => void; onReview: (prediction: RenalPrediction) => void;
}) {
  const snapshot = model.snapshot; const output = snapshot?.outputs;
  const isClassifier = model.key === "hyperkalemia";
  const valueAvailable = model.key !== "dry-weight" && output?.status === "AVAILABLE" &&
    (isClassifier ? validatedUnitScore(output?.probability)!==null : Number.isFinite(output?.prediction));
  const displayValue = isClassifier && Number.isFinite(output?.probability) ? modelScorePercent(output?.probability) : formatNumber(output?.prediction);
  const stale = inputIsStale(snapshot);
  const interval = output?.interval;
  const performanceNote = output?.explanation?.limitations?.find(note => /negative|poor|r.?2|baseline|performance|improv/i.test(note));
  const qualityFlags = output?.data_quality?.flags ?? [];
  return <article className="sri-renal-model"><div className="sri-renal-model-heading"><span className="pci-soft-icon"><Activity size={18} /></span><span className="sri-renal-pill">{model.key === "dry-weight" ? "Unavailable" : snapshot ? readable(snapshot.status) : "Not run"}</span></div>
    <h3>{model.label}</h3><div className="sri-renal-model-value"><strong>{valueAvailable ? displayValue : "Unavailable"}</strong>{valueAvailable && !isClassifier && <span>{output?.unit ?? model.unit}</span>}{valueAvailable && isClassifier && <span>research risk score</span>}</div>
    <p className="sri-renal-method">{output?.method === "PERSISTENCE_BASELINE" ? "Persistence baseline · carries forward the last observation" : output?.method === "RESEARCH_MODEL" ? `Research model · ${output.algorithm || "Algorithm unavailable"}` : "Research capability"}</p>
    {model.key === "dry-weight" ? <p className="sri-renal-limitation">{dryWeightLimitation}</p> : <p>{output?.forecast_date ? `Display anchor: ${formatDate(output.forecast_date)} · approximately ${output.horizon_days ?? 30} days after input` : "A prediction needs adequate dated measurements and verified dialysis context."}</p>}
    {output?.forecast_origin_date && <p>Input date: <time dateTime={output.forecast_origin_date}>{formatDate(output.forecast_origin_date)}</time>{stale && <span className="sri-renal-stale"> Stale input · over 62 days old</span>}</p>}
    {performanceNote && <p className="sri-renal-limitation">{performanceNote}</p>}
    {qualityFlags.length > 0 && <p className="sri-renal-limitation">Data quality: {readable(qualityFlags[0])}{qualityFlags.length > 1 ? ` · ${qualityFlags.length} flags` : ""}</p>}
    {valueAvailable && interval && !isClassifier && <p>Empirical residual interval: <strong>{formatNumber(interval.low)} – {formatNumber(interval.high)} {output?.unit}</strong><small className="sri-renal-small">Internal cohort estimate; not clinically calibrated.</small></p>}
    {valueAvailable && isClassifier && <p className="sri-renal-limitation">Uncalibrated research model score for next pre-HD K+ ≥5.5 mmol/L in the 14–62 day next-observation window. It is not clinically calibrated and does not replace the current-potassium safety rule.</p>}
    {snapshot && <><p className="sri-renal-review-state"><FileCheck2 size={13} /> Review: {readable(snapshot.review_state)} · v{snapshot.review_version}</p>
      <details className="sri-renal-explanation"><summary>Why this output?</summary><PredictionExplanation prediction={snapshot} /></details></>}
    <div className="sri-renal-model-actions"><Button variant="outline" disabled={!canWrite || model.key === "dry-weight"} onClick={onRun}>{busy ? "Running…" : model.key === "dry-weight" ? "Model unavailable" : model.key === "hyperkalemia" ? "Run K+ risk model" : `Run ${model.key === "hb" ? "Hb" : "URR"} forecast`}</Button>
      {snapshot && <Button variant="ghost" disabled={!canWrite} onClick={() => onReview(snapshot)}>Review output</Button>}</div>
  </article>;
}

function PredictionExplanation({ prediction }: { prediction: RenalPrediction }) {
  const output = prediction.outputs; const explanation = output.explanation;
  const flags = output.data_quality?.flags ?? []; const missing = output.data_quality?.missing_fields ?? [];
  return <div className="sri-renal-explanation-body"><dl><div><dt>Model</dt><dd>{output.model || "Unavailable"}</dd></div><div><dt>Version</dt><dd>{output.model_version || "Unavailable"}</dd></div>
    <div><dt>Method</dt><dd>{readable(output.method)}</dd></div><div><dt>Created</dt><dd><time dateTime={prediction.created_at}>{formatDate(prediction.created_at)}</time></dd></div><div><dt>Clinical validation</dt><dd>{readable(output.clinical_validation)}</dd></div>
    <div><dt>Dataset permission</dt><dd>{readable(output.dataset_permission_status)}</dd></div></dl>
    {explanation?.top_factors?.length ? <><strong>{explanation.method === "SHAP" ? "SHAP contributions to model output" : "Baseline explanation"}</strong>
      <p>{explanation.method === "SHAP" ? (prediction.model_key === "hyperkalemia" ? "These are model associations in standardized log-odds contribution units, not causal effects, calibrated probabilities or treatment instructions." : "These are model associations, not causal effects or treatment instructions. Contributions use the prediction unit.") : "This baseline carries forward the most recent measured value. No learned-model SHAP contributions apply."}</p><div className="pci-table-wrap"><table className="sri-renal-table"><thead><tr><th scope="col">Feature</th><th scope="col">Input</th><th scope="col">Contribution</th><th scope="col">Direction</th></tr></thead><tbody>
        {explanation.top_factors.slice(0, 8).map((factor, index) => <tr key={`${factor.feature}-${index}`}><td>{readable(factor.feature)}</td><td>{typeof factor.value === "number" ? formatNumber(factor.value) : factor.value ?? "Missing"}</td><td>{factor.contribution == null ? "Not applicable" : <>{factor.contribution > 0 ? "+" : ""}{formatNumber(factor.contribution)}</>}</td><td>{readable(factor.direction)}</td></tr>)}
      </tbody></table></div></> : <p>{output.method === "PERSISTENCE_BASELINE" ? "No trained-model SHAP explanation applies to carrying forward the last value." : "SHAP explanation unavailable for this snapshot."}</p>}
    {explanation?.trends?.length > 0 && <><strong>Recorded trends used by the model</strong><ul>{explanation.trends.map((trend, index) => <li key={index}>{trend}</li>)}</ul></>}
    <strong>Data quality</strong>{flags.length || missing.length ? <ul>{flags.map((flag, index) => <li key={`flag-${index}`}>{readable(flag)}</li>)}{missing.map(field => <li key={`missing-${field}`}>Missing: {readable(field)}</li>)}</ul> : <p>No data-quality flags returned; source review remains necessary.</p>}
    {explanation?.limitations?.length > 0 && <><strong>Limitations</strong><ul>{explanation.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul></>}
    {output.horizon_definition && <p>Horizon definition: {output.horizon_definition}</p>}
  </div>;
}

function RenalDialog({ title, description, onClose, busy, children }: { title: string; description: string; onClose: () => void; busy: boolean; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);
  useEffect(() => {
    const opener = document.activeElement;
    const element = dialog.current;
    closing.current = false;
    element?.showModal();
    return () => {
      closing.current = true;
      if (element?.open) element.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  const requestClose = () => {
    if (busy || closing.current) return;
    closing.current = true;
    dialog.current?.close();
    onClose();
  };
  return <dialog ref={dialog} className="pci-dialog sri-renal-dialog" aria-labelledby="sri-renal-dialog-title" aria-describedby="sri-renal-dialog-description"
    onClose={event => {
      // A queued native close event must not dismiss a reopened dialog.
      if (event.currentTarget.open || closing.current || !event.currentTarget.isConnected) return;
      closing.current = true;
      onClose();
    }} onCancel={event => { event.preventDefault(); requestClose(); }}
    onKeyDown={event => {
      if (event.key !== "Tab") return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
        "button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]",
      )).filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1), active = document.activeElement;
      if (!first) { event.preventDefault(); event.currentTarget.focus(); }
      else if (event.shiftKey && (active === first || active === event.currentTarget)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (active === last || active === event.currentTarget)) { event.preventDefault(); first.focus(); }
    }}>
    <div className="pci-dialog-header"><span className="pci-kicker">Verified clinical workflow</span><button type="button" disabled={busy} aria-label="Close renal dialog" onClick={requestClose}><X size={18} /></button></div>
    <h2 id="sri-renal-dialog-title">{title}</h2><p id="sri-renal-dialog-description" className="pci-muted">{description}</p>{children}
  </dialog>;
}

function requestForPayload(attempt: { current: { body: string; id: string } | null }, payload: unknown) {
  const body = JSON.stringify(payload);
  if (attempt.current?.body !== body) attempt.current = { body, id: crypto.randomUUID() };
  return attempt.current.id;
}

function RenalObservationDialog({ patient, focusKey, onClose, onSave,onVerify }: { patient: AuthorizedPatient; focusKey:string; onClose: () => void; onSave: (input: RenalObservationInput) => Promise<void>;onVerify:(input:RenalDialysisVerificationInput)=>Promise<void> }) {
  const verificationOnly=focusKey==="dialysis";
  const [dialysisStatus,setDialysisStatus]=useState<RenalDialysisVerificationInput["status"]>("UNCONFIRMED");
  useEffect(()=>{const frame=requestAnimationFrame(()=>document.querySelector<HTMLElement>(`dialog[open] [data-renal-entry="${focusKey}"]`)?.focus());return()=>cancelAnimationFrame(frame);},[focusKey]);
  const [values, setValues] = useState<Partial<Record<RenalMeasurementKey, string>>>({});
  const [observedAt, setObservedAt] = useState(""); const [sourceNote, setSourceNote] = useState("");
  const [ureaUnit, setUreaUnit] = useState("mmol/L"); const [sourceVerified, setSourceVerified] = useState(false);
  const [sessionId,setSessionId]=useState(""),[preCollectedAt,setPreCollectedAt]=useState(""),[postCollectedAt,setPostCollectedAt]=useState(""),[regimen,setRegimen]=useState("");
  const [dialysisVerified, setDialysisVerified] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const attempt = useRef<{ body: string; id: string } | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return; setError("");
    const time = Date.parse(observedAt);
    if (!Number.isFinite(time) || time > Date.now()) { setError("Use a valid source measurement date and time that is not in the future."); return; }
    if (!sourceVerified || !sourceNote.trim()) { setError("Confirm the source and describe the report or dialysis session."); return; }
    if(verificationOnly){const payload={status:dialysisStatus,verifiedAt:new Date(time).toISOString(),sourceNote:sourceNote.trim(),sourceVerified:true as const};setBusy(true);try{await onVerify({...payload,requestId:requestForPayload(attempt,payload)});}catch(failure){setError(errorMessage(failure));}finally{setBusy(false);}return;}
    const measurements: RenalObservationInput["measurements"] = {}; const units: RenalObservationInput["units"] = {};
    for (const field of fields) {
      const raw = values[field.key]?.trim(); if (!raw) continue; const value = Number(raw);
      if (!Number.isFinite(value) || value < 0 || (field.key === "urea_pre" && value === 0)) { setError(`Enter a valid nonnegative ${field.label.toLowerCase()} value${field.key === "urea_pre" ? " greater than zero" : ""}.`); return; }
      measurements[field.key] = value; units[field.key] = field.key.startsWith("urea_") ? ureaUnit : field.unit;
    }
    if (!Object.keys(measurements).length) { setError("Enter at least one source measurement."); return; }
    if ((measurements.urea_pre == null) !== (measurements.urea_post == null)) { setError("Enter both pre- and post-dialysis urea from the same session, or leave both blank. URR cannot be entered as a substitute."); return; }
    if (measurements.urea_pre != null && measurements.urea_post! > measurements.urea_pre) { setError("Post-dialysis urea exceeds pre-dialysis urea. Reconcile the paired source results before saving."); return; }
    const hasUreaPair=measurements.urea_pre!=null&&measurements.urea_post!=null;
    const preTime=Date.parse(preCollectedAt),postTime=Date.parse(postCollectedAt);
    if(hasUreaPair&&(!sessionId.trim()||!Number.isFinite(preTime)||!Number.isFinite(postTime)||preTime>=postTime||postTime>Date.now())){setError("Verify the same dialysis session identifier and actual pre/post collection times. The post sample must follow the pre sample and not be in the future.");return;}
    const payload = { observedAt: new Date(time).toISOString(), maintenanceHemodialysisVerified: dialysisVerified, measurements, units, sourceNote: sourceNote.trim(), sourceVerified: true as const,
      ...(hasUreaPair?{samplingContext:{sessionId:sessionId.trim(),preCollectedAt:new Date(preTime).toISOString(),postCollectedAt:new Date(postTime).toISOString(),regimen}}:{}) };
    setBusy(true); try { await onSave({ ...payload, requestId: requestForPayload(attempt, payload) }); } catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
  };
  return <RenalDialog title={verificationOnly?"Verify clinical dialysis status":"Record verified renal source results"} description={verificationOnly?`Record source-confirmed clinical dialysis context for ${patient.full_name||patient.patient_no||"the selected patient"}. No laboratory value is required. This does not relabel past laboratory sampling context.`:`Record the measured values for ${patient.full_name || patient.patient_no || "the selected patient"}. Every field retains explicit source units; leave unavailable results blank. Dialysis verification must be confirmed from the clinical record.`} onClose={onClose} busy={busy}>
    <form onSubmit={event => void submit(event)} className="sri-renal-form"><fieldset disabled={busy}><label>{verificationOnly?"Clinical verification date and time":"Source measurement date and time"} <span className="pci-required">Required</span><input data-renal-entry="observedAt" type="datetime-local" required aria-required="true" value={observedAt} onChange={event => setObservedAt(event.target.value)} /></label>
      {verificationOnly?<label>Clinical dialysis context<select data-renal-entry="dialysis" value={dialysisStatus} onChange={event=>setDialysisStatus(event.target.value as RenalDialysisVerificationInput["status"])}><option value="UNCONFIRMED">Not yet confirmed</option><option value="MAINTENANCE_HD">Verified chronic maintenance hemodialysis</option><option value="NOT_ON_MAINTENANCE_HD">Verified not on chronic maintenance hemodialysis</option></select></label>:<div className="pci-entry-grid">{fields.map(field => <label key={field.key}>{field.label} <small>({field.key.startsWith("urea_") ? ureaUnit : field.unit})</small><input data-renal-entry={field.key} type="number" min="0" step="any" inputMode="decimal" value={values[field.key] ?? ""} onChange={event => setValues(previous => ({ ...previous, [field.key]: event.target.value }))} /></label>)}</div>}
      {!verificationOnly&&<label>Paired urea source unit<select value={ureaUnit} onChange={event => setUreaUnit(event.target.value)}><option value="mmol/L">mmol/L · both values</option><option value="mg/dL">mg/dL · both values</option></select></label>}
      {!verificationOnly&&(values.urea_pre||values.urea_post)&&<fieldset className="sri-sampling-context"><legend>Same-session urea sampling evidence</legend><label>Dialysis session identifier<input aria-label="Dialysis session identifier" value={sessionId} maxLength={80} onChange={event=>setSessionId(event.target.value)} required/></label><div className="pci-entry-grid"><label>Pre-dialysis collection time<input aria-label="Pre-dialysis collection time" type="datetime-local" value={preCollectedAt} onChange={event=>setPreCollectedAt(event.target.value)} required/></label><label>Post-dialysis collection time<input aria-label="Post-dialysis collection time" type="datetime-local" value={postCollectedAt} onChange={event=>setPostCollectedAt(event.target.value)} required/></label></div><label>Recorded dialysis regimen<select aria-label="Recorded dialysis regimen" value={regimen} onChange={event=>setRegimen(event.target.value)}><option value="">Not verified; no universal adequacy target</option><option value="IN_CENTRE_HD_THREE_TIMES_WEEKLY">In-centre hemodialysis three times weekly</option><option value="OTHER_VERIFIED_REGIMEN">Other verified regimen; individual target review</option></select></label></fieldset>}
      {!verificationOnly&&<p className="sri-renal-small">Both urea values must use the same explicit unit and dialysis session. The server derives measured URR; forecasts and user-entered URR cannot replace a measured pair.</p>}
      <label>Source report or session <span className="pci-required">Required</span><textarea required aria-required="true" maxLength={2000} rows={3} value={sourceNote} onChange={event => setSourceNote(event.target.value)} placeholder="Report reference, session date, sampling context and verifier" /></label>
      {!verificationOnly&&<label className="pci-verification-check"><input data-renal-entry="dialysis" type="checkbox" checked={dialysisVerified} onChange={event => setDialysisVerified(event.target.checked)} />I have separately confirmed chronic maintenance hemodialysis in the clinical record. Acute dialysis or high creatinine alone is insufficient.</label>}
      <label className="pci-verification-check"><input type="checkbox" required aria-required="true" checked={sourceVerified} onChange={event => setSourceVerified(event.target.checked)} />{verificationOnly?"I checked this clinical context and verification date against the source.":"I checked these measurements, units and dates against the clinical source."}</label>
      {error && <p role="alert" className="pci-inline-error"><TriangleAlert size={15} />{error}</p>}</fieldset><div className="pci-dialog-actions"><Button variant="outline" disabled={busy} onClick={event => { event.currentTarget.closest("dialog")?.close(); onClose(); }}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving source…" : "Save verified results"}</Button></div>
    </form>
  </RenalDialog>;
}

function RenalReviewDialog({ prediction, onClose, onSave }: { prediction: RenalPrediction; onClose: () => void;
  onSave: (prediction: RenalPrediction, input: Omit<RenalReviewInput, "patientId" | "expectedVersion">) => Promise<void> }) {
  const [action, setAction] = useState<RenalReviewAction>("DEFER"); const [reason, setReason] = useState(""); const [note, setNote] = useState(""); const [modified, setModified] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const attempt = useRef<{ body: string; id: string } | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return; setError("");
    if (!reason.trim() || (action === "MODIFY" && !modified.trim())) { setError("A clinical reason is required. Modified interpretation is also required when choosing Modify."); return; }
    const payload = { action, reason: reason.trim(), note: note.trim(), modifiedInterpretation: action === "MODIFY" ? modified.trim() : "" };
    setBusy(true); try { await onSave(prediction, { ...payload, requestId: requestForPayload(attempt, payload) }); }
    catch (failure) { setError(failure instanceof ApiRequestError && failure.status === 409 ? "This snapshot's review has changed. Close this dialog, refresh and review the current version." : errorMessage(failure)); }
    finally { setBusy(false); }
  };
  return <RenalDialog title="Review renal research output" description={`Review the ${models.find(model => model.key === prediction.model_key)?.label ?? "renal"} snapshot created ${formatDate(prediction.created_at)}. The decision applies to version ${prediction.review_version}; acceptance does not establish clinical validation.`} onClose={onClose} busy={busy}>
    <div className="sri-renal-review-summary"><strong>{formatNumber(prediction.outputs.prediction)} {prediction.outputs.prediction != null ? prediction.outputs.unit : ""}</strong><p>{readable(prediction.outputs.method)} · {readable(prediction.status)}</p><p>Clinical validation not completed · Dataset permission unverified</p></div>
    <form onSubmit={event => void submit(event)} className="sri-renal-form"><fieldset disabled={busy}><label>Clinical decision<select value={action} onChange={event => setAction(event.target.value as RenalReviewAction)}><option value="DEFER">Defer · additional evidence needed</option><option value="ACCEPT">Accept · retain interpretation</option><option value="MODIFY">Modify · record clinical interpretation</option><option value="DISMISS">Dismiss · output not applicable</option></select></label>
      <label>Clinical reason <span className="pci-required">Required</span><textarea required aria-required="true" rows={3} maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} /></label>
      {action === "MODIFY" && <label>Modified interpretation <span className="pci-required">Required</span><textarea required aria-required="true" rows={3} maxLength={2000} value={modified} onChange={event => setModified(event.target.value)} /></label>}
      <label>Clinical note <small>(optional)</small><textarea rows={2} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} /></label>
      {error && <p role="alert" className="pci-inline-error"><TriangleAlert size={15} />{error}</p>}</fieldset><div className="pci-dialog-actions"><Button variant="outline" disabled={busy} onClick={event => { event.currentTarget.closest("dialog")?.close(); onClose(); }}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving review…" : "Save renal review"}</Button></div>
    </form>
  </RenalDialog>;
}
