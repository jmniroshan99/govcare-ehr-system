import { AuthorizedPatientSelect } from "../components/forms/AuthorizedPatientSelect";
import type { AuthorizedPatient } from "../services/patientService";
import { useAuthStore } from "../stores/authStore";
import { authorizationContextKey } from "../lib/accessControl";
import { useCallback, useEffect, useState } from "react";
import { BrainCircuit, RefreshCw, ScanText, Upload } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { PageHeader } from "../components/ui/page-header";
import { extractPdfLocally, getPatientDocuments, uploadPatientDocument, type LocalPdfExtractionResult } from "../services/documentService";
import { createRiskAssessment, type RiskInput } from "../services/aiCdssService";

type RiskForm = Partial<RiskInput> & { patientId: string };
const initial: RiskForm = { patientId: "", supplementalOxygen: false, alteredMentalState: false };
const fields: Array<[string, keyof RiskInput, string]> = [["Respiratory rate", "respiratoryRate", "breaths/min"], ["Oxygen saturation (SpO₂)", "oxygenSaturation", "%"], ["Systolic blood pressure", "systolicBloodPressure", "mmHg"], ["Pulse rate", "pulse", "beats/min"], ["Temperature", "temperature", "°C"], ["White blood cell count", "wbc", "/mm³"], ["Haemoglobin", "haemoglobin", "g/dL"], ["Platelets", "platelets", "/mm³"]];

export function AICDSSDashboard() {
  const profile = useAuthStore(state => state.profile);
  return <ScopedRiskDashboard key={authorizationContextKey(profile)} />;
}

function ScopedRiskDashboard() {
  const [form, setForm] = useState<RiskForm>(initial);
  const [result, setResult] = useState<Awaited<ReturnType<typeof createRiskAssessment>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const selectPatient = useCallback((patient: AuthorizedPatient | null) => {
    setForm({ ...initial, patientId: patient?.id ?? "" }); setResult(null); setError("");
  }, []);
  const setValue = (key: keyof RiskInput, value: string) => setForm(x => ({ ...x, [key]: value === "" ? undefined : Number(value) }));
  const save = async () => {
    if (!form.patientId) { setError("Select an authorized patient first."); return; }
    const required = ["respiratoryRate", "oxygenSaturation", "systolicBloodPressure", "pulse", "temperature"] as const;
    if (required.some(key => !Number.isFinite(form[key]))) { setError("Enter all five required vital observations before calculating risk."); return; }
    try { setBusy(true); setError(""); setResult(await createRiskAssessment(form as RiskInput)); }
    catch (e) { setError(e instanceof Error ? e.message : "Assessment could not be saved."); }
    finally { setBusy(false); }
  };
  return <div className="space-y-6">
    <PageHeader eyebrow="GovCare · Clinical Intelligence" icon={<BrainCircuit size={17} />} title="Patient Deterioration AI-CDSS"
      description="Review observations or import a report to support timely clinical decisions."
      actions={<Button variant="outline" onClick={() => setRefreshKey(n => n + 1)}><RefreshCw className="h-4 w-4" />Refresh patients</Button>} />
    <p className="rounded-xl border border-warning-border bg-warning-surface p-3 text-sm text-warning"><b>Decision support only.</b> This does not diagnose disease or replace clinical judgement.</p>
    {error && <p role="alert" className="rounded-lg border border-danger-border bg-danger-surface p-3 text-danger">{error}</p>}
    <Card><CardHeader><CardTitle>New risk assessment</CardTitle></CardHeader><CardContent className="space-y-5">
      <div><label className="text-sm font-semibold">1. Select patient</label><AuthorizedPatientSelect value={form.patientId} assessmentLabel="Deterioration risk assessment" refreshKey={refreshKey} onChange={selectPatient} /></div>
      <div><p className="text-sm font-semibold">2. Import a PDF report or use manual entry</p><PdfReportReader key={form.patientId} patientId={form.patientId} onApply={values => setForm(x => ({ ...x, ...values }))} /></div>
      <div><p className="text-sm font-semibold">3. Manual clinical entry</p><div className="mt-3 grid gap-4 sm:grid-cols-2">{fields.map(([label, key, unit]) => <label className="text-sm font-medium" key={key}>{label} <span className="text-xs text-muted-foreground">({unit})</span><Input className="mt-1" type="number" min="0" step={key === "temperature" || key === "haemoglobin" ? "0.1" : "1"} value={(form[key] as number | undefined) ?? ""} onChange={e => setValue(key, e.target.value)} /></label>)}</div><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="flex gap-2 text-sm"><input type="checkbox" checked={Boolean(form.supplementalOxygen)} onChange={e => setForm(x => ({ ...x, supplementalOxygen: e.target.checked }))} />Supplemental oxygen</label><label className="flex gap-2 text-sm"><input type="checkbox" checked={Boolean(form.alteredMentalState)} onChange={e => setForm(x => ({ ...x, alteredMentalState: e.target.checked }))} />New confusion or reduced consciousness</label></div><Button className="mt-4 w-full" disabled={busy || !form.patientId} onClick={() => void save()}>{busy ? "Calculating…" : "Calculate and save assessment"}</Button>{result && <div className="mt-4 rounded-lg border border-success-border bg-success-surface p-4 text-sm"><b>Saved: {result.riskLevel} risk — score {result.score}</b><p>{result.recommendation}</p></div>}</div>
    </CardContent></Card>
  </div>;
}

function mapPdfVitals(extraction: LocalPdfExtractionResult): Partial<RiskInput> {
  const text=extraction.pages.map(p=>p.text).join("\n");
  const specs:Array<[keyof RiskInput,RegExp]>=[
    ["respiratoryRate",/(?:respiratory\s*rate|resp\.?\s*rate|\brr\b)\s*[:=-]?\s*(\d+(?:\.\d+)?)/i],
    ["oxygenSaturation",/(?:oxygen\s*saturation|spo2|sp[o₂]2)\s*[:=-]?\s*(\d+(?:\.\d+)?)\s*%?/i],
    ["systolicBloodPressure",/(?:systolic(?:\s*blood\s*pressure)?|\bsbp\b)\s*[:=-]?\s*(\d+(?:\.\d+)?)/i],
    ["pulse",/(?:pulse(?:\s*rate)?|heart\s*rate|\bhr\b)\s*[:=-]?\s*(\d+(?:\.\d+)?)/i],
    ["temperature",/(?:temperature|temp)\s*[:=-]?\s*(\d+(?:\.\d+)?)/i],
    ["wbc",/(?:white\s*blood\s*cell(?:\s*count)?|wbc)\s*[:=-]?\s*(\d+(?:\.\d+)?)/i],
    ["haemoglobin",/(?:haemoglobin|hemoglobin|hgb|hb)(?!\s*a1c)\s*[:=-]?\s*(\d+(?:\.\d+)?)/i],
    ["platelets",/(?:platelet(?:\s*count)?|plt)\s*[:=-]?\s*(\d+(?:\.\d+)?)/i],
  ];
  const out:Partial<RiskInput>={};
  for(const [key,re] of specs){const m=text.match(re);if(m){const v=Number(m[1]);if(Number.isFinite(v))(out as Record<string,unknown>)[key]=v;}}
  return out;
}

function PdfReportReader({ patientId, onApply }: { patientId: string; onApply: (values: Partial<RiskInput>) => void }) {
 const [docs,setDocs]=useState<Array<{id:string;title:string}>>([]);const [selected,setSelected]=useState("");const [extraction,setExtraction]=useState<LocalPdfExtractionResult|null>(null);const [busy,setBusy]=useState(false);const [uploading,setUploading]=useState(false);const [message,setMessage]=useState("");
 const loadDocs=()=>{if(!patientId)return;void getPatientDocuments(patientId,{sort:"newest"}).then(rows=>setDocs(rows.filter(x=>x.mimeType==="application/pdf").map(x=>({id:x.id,title:x.title})))).catch(()=>setDocs([]));};
 useEffect(()=>{setSelected("");setExtraction(null);setMessage("");loadDocs();},[patientId]);
 const readDocument=async(documentId:string)=>{if(!documentId||!patientId)return;setBusy(true);setMessage("");try{const result=await extractPdfLocally(patientId,documentId);setExtraction(result);const mapped=mapPdfVitals(result);const count=Object.keys(mapped).length;if(count){onApply(mapped);setMessage(`${count} recognized clinical value${count===1?"":"s"} automatically filled. Review them before assessment.`);}else if(result.status==="NEEDS_MANUAL_REVIEW"){setMessage("This appears to be a scanned/image-only PDF. No text values were auto-filled; manual verification is required.");}else setMessage("The PDF was read, but no supported deterioration-model values were found. No unrelated numbers were inserted.");}catch(e){setMessage(e instanceof Error?e.message:"Unable to read this PDF.");}finally{setBusy(false);}};
 const browse=async(file?:File)=>{if(!file||!patientId||file.type!=="application/pdf")return;setUploading(true);setMessage("");try{const doc=await uploadPatientDocument({patientId,file,documentType:"OTHER_CLINICAL_DOCUMENT",title:file.name,status:"SUBMITTED",visibilityLevel:"DEPARTMENT"});setSelected(doc.id);loadDocs();await readDocument(doc.id);}catch(e){setMessage(e instanceof Error?e.message:"Unable to upload/read PDF.");}finally{setUploading(false);}};
 return <div className="mt-3 rounded-lg border-2 border-dashed border-info-border p-4"><p className="flex items-center gap-2 font-semibold"><ScanText className="h-5 w-5 text-accent"/>PDF report input</p><p className="mt-1 text-xs text-muted-foreground">Upload a text-based clinical PDF or select an authorized report. Recognized vital/CBC values are read and filled automatically; unsupported values remain unchanged.</p><label className="mt-3 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-semibold"><Upload className="h-4 w-4"/>{uploading?"Uploading and reading PDF…":"Browse PDF from computer"}<input className="sr-only" type="file" accept="application/pdf,.pdf" disabled={uploading||busy||!patientId} onChange={e=>void browse(e.target.files?.[0])}/></label><select aria-label="Select PDF report" className="mt-3 min-h-11 w-full rounded-md border bg-background p-2" value={selected} onChange={e=>{const id=e.target.value;setSelected(id);if(id)void readDocument(id);}}><option value="">Select an authorized PDF report</option>{docs.map(d=><option key={d.id} value={d.id}>{d.title}</option>)}</select><Button type="button" variant="outline" className="mt-3 w-full" disabled={!selected||busy} onClick={()=>void readDocument(selected)}>{busy?"Reading report automatically…":"Read again and auto-fill recognized values"}</Button>{message&&<p role="status" className="mt-3 rounded-md border border-info-border bg-info-surface p-3 text-sm text-info">{message}</p>}{extraction&&<div className="mt-3 rounded border bg-muted p-3 text-sm"><b>{extraction.status==="COMPLETED"?"PDF reading completed":"Manual verification required"}</b>{extraction.warning&&<p className="mt-1 text-warning">{extraction.warning}</p>}{extraction.importantDetails.slice(0,12).map((d,i)=><p className="mt-2" key={`${d.sourcePage}-${i}`}><b>{d.priority}</b> · {d.statement} <span className="text-xs text-muted-foreground">(page {d.sourcePage})</span></p>)}</div>}</div>;
}

