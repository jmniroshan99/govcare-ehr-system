import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, TriangleAlert, X } from "lucide-react";
import { Button } from "../ui/button";
import type { AuthorizedPatient } from "../../services/patientService";
import type { MeasurementInput, MeasurementMetric as Metric } from "../../services/predictiveIntelligenceService";

const metricLabels: Record<Metric, string> = { urea:"Blood urea (not BUN)",albumin:"Serum albumin",sodium:"Sodium",calcium:"Calcium",egfr: "eGFR", creatinine: "Creatinine", acr: "Urine ACR", systolic: "Systolic BP",
  diastolic: "Diastolic BP", hba1c: "HbA1c", glucose: "Glucose", potassium: "Potassium", hemoglobin: "Hemoglobin",
  bun: "Blood urea nitrogen", bmi: "BMI", weight: "Weight", total_cholesterol: "Total cholesterol", hdl: "HDL cholesterol",
  ldl: "LDL cholesterol", triglycerides: "Triglycerides" };
const measurementUnits: Record<Metric,string[]> = { urea:["mmol/L","mg/dL"],albumin:["g/L","g/dL"],sodium:["mmol/L"],calcium:["mmol/L"],egfr:["mL/min/1.73m2"],creatinine:["mg/dL","umol/L"],acr:["mg/g","mg/mmol"],
  systolic:["mm[Hg]"],diastolic:["mm[Hg]"],hba1c:["%","mmol/mol"],glucose:["mg/dL","mmol/L"],
  potassium:["mmol/L","mEq/L"],hemoglobin:["g/dL","g/L"],bun:["mg/dL"],bmi:["kg/m2"],weight:["kg","g","lb"],
  total_cholesterol:["mg/dL","mmol/L"],hdl:["mg/dL","mmol/L"],ldl:["mg/dL","mmol/L"],triglycerides:["mg/dL","mmol/L"] };
export function ClinicalMeasurementDialog({ patient, onClose, onSave, initialMetric="egfr" }: { patient: AuthorizedPatient; initialMetric?:Metric; onClose:()=>void; onSave:(input:MeasurementInput,requestId:string)=>Promise<void> }) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [metric,setMetric]=useState<Metric>(initialMetric),[unit,setUnit]=useState(measurementUnits[initialMetric][0]),[value,setValue]=useState("");
  const [time,setTime]=useState(""),[low,setLow]=useState(""),[high,setHigh]=useState(""),[note,setNote]=useState(""),[verified,setVerified]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""); const request=useRef({content:"",id:""});
  useEffect(()=>{dialog.current?.showModal();},[]);
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();if(busy)return;setError("");
    const measured=new Date(time);
    if(!time||!Number.isFinite(measured.getTime())||measured.getTime()>Date.now()){setError("Enter the verified measurement time. It cannot be in the future.");return;}
    if(!value.trim()||!Number.isFinite(Number(value))||!note.trim()||!verified){setError("Enter a numeric result, document its source and confirm source verification.");return;}
    if(low!==""&&high!==""&&Number(low)>Number(high)){setError("The reference lower limit must not exceed the upper limit.");return;}
    const input:MeasurementInput={metric,unit,value:Number(value),observedAt:measured.toISOString(),referenceLow:low===""?null:Number(low),referenceHigh:high===""?null:Number(high),sourceNote:note.trim(),sourceVerified:verified};
    const content=JSON.stringify(input);if(request.current.content!==content)request.current={content,id:crypto.randomUUID()};
    setBusy(true);try{await onSave(input,request.current.id);}catch(e){setError(e instanceof Error?e.message:"Result could not be saved.");setBusy(false);}
  };
  return createPortal(<dialog ref={dialog} className="pci-dialog" aria-labelledby="pci-measurement-title" onClose={onClose} onCancel={e=>{if(busy)e.preventDefault();}}>
    <div className="pci-dialog-header"><span className="pci-soft-icon"><Plus size={22}/></span><button aria-label="Close measurement entry" disabled={busy} onClick={()=>dialog.current?.close()}><X size={20}/></button></div>
    <div className="pci-kicker">Verified clinical measurement</div><h2 id="pci-measurement-title">Record a dated result</h2><p className="pci-muted">{patient.full_name} · {patient.patient_no}</p>
    <form className="pci-measurement-form" onSubmit={e=>void submit(e)}><fieldset disabled={busy}>
      <div className="pci-entry-grid"><label>Measurement<select aria-label="Measurement" value={metric} onChange={e=>{const key=e.target.value as Metric;setMetric(key);setUnit(measurementUnits[key][0]);setLow("");setHigh("");}}>{Object.entries(metricLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label>Unit<select aria-label="Unit" value={unit} onChange={e=>setUnit(e.target.value)}>{measurementUnits[metric].map(u=><option value={u} key={u}>{u}</option>)}</select></label></div>
      <div className="pci-entry-grid"><label>Result <span className="pci-required">Required</span><input aria-label="Result" autoFocus type="number" step="any" min="0" value={value} onChange={e=>setValue(e.target.value)} required aria-required="true" /></label>
        <label>Measured date & time <span className="pci-required">Required</span><input aria-label="Measured date & time" type="datetime-local" value={time} onChange={e=>setTime(e.target.value)} required aria-required="true" /></label></div>
      <p className="pci-footnote">Time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Enter the measurement time from the verified source; do not substitute upload time.</p>
      <details className="pci-reference-entry"><summary>Source reference range (optional)</summary><div className="pci-entry-grid"><label>Lower limit<input type="number" step="any" value={low} onChange={e=>setLow(e.target.value)}/></label><label>Upper limit<input type="number" step="any" value={high} onChange={e=>setHigh(e.target.value)}/></label></div><p className="pci-footnote">Use the same units as the result. Leave blank when the source does not provide a range.</p></details>
      <label>Verified source <span className="pci-required">Required</span><textarea aria-label="Verified source" value={note} onChange={e=>setNote(e.target.value)} rows={2} maxLength={2000} required aria-required="true" placeholder="Report identifier, laboratory or clinical record reference" /></label>
      <label className="pci-verification-check"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)} required aria-required="true"/><span>I verified the value, unit and measurement time against the source.</span></label>
      {error&&<p role="alert" className="pci-inline-error"><TriangleAlert size={16}/>{error}</p>}
    </fieldset><div className="pci-dialog-actions"><Button variant="outline" disabled={busy} onClick={()=>dialog.current?.close()}>Cancel</Button><Button type="submit" disabled={busy}>{busy?"Saving result…":"Save verified result"}</Button></div></form>
  </dialog>, document.body);
}

