import { useEffect, useMemo, useRef, useState } from "react";
import { Check, FileText, MoreHorizontal, Upload, X } from "lucide-react";
import { ClinicalPdfObservationReview } from "./ClinicalPdfObservationReview";
import { ClinicalTestDocumentLibrary } from "./ClinicalTestDocumentLibrary";
import { useClinicalTestFixture } from "../../services/aiCdssService";
import { Button } from "../ui/button";
import { apiRequest } from "../../services/apiClient";
import { getPatientDocuments } from "../../services/documentService";
import { extractClinicalPdf, uploadClinicalPdf, getPdfPatientContext, type PdfPatientContext, type ConfirmedPdfValue, extractClinicalEhrReport, previewClinicalPdf, saveClinicalPdf, type ClinicalPdfExtraction } from "../../services/aiCdssService";
import { PatientOperationScope } from "../../lib/patientOperationScope";
import { pdfReviewCandidates, conflictingPdfFeatures, type PdfReviewCandidate } from "../../lib/clinicalPdfReview";
import type { AuthorizedPatient } from "../../services/patientService";
import type { PatientDocument } from "../../types/document";
import "./clinical-pdf-import.css";

type QueueRow={id:string;name:string;file?:File;documentId?:string;preview?:ClinicalPdfExtraction;reading?:boolean;error?:string;revisionFrom?:string;revisionReason?:string};
export type PdfWizardStep=1|2|3;
type SavedSource={id:string;documentId:string;originalFilename:string;version:number;reportDate?:string;extractionStatus?:string};
const statusLabel:Record<string,string>={COMPLETED:"Ready for review",PARTIAL:"Some results need review",OCR_REQUIRED:"Scan needs OCR",NO_SUPPORTED_MEASUREMENTS:"No supported results",PATIENT_MISMATCH:"Patient mismatch",EXTRACTION_FAILED:"Could not read"};
const date=(v?:string)=>v?new Date(v).toLocaleDateString():"Not recorded";
const message=(e:unknown)=>e instanceof Error?e.message:"The source could not be read.";
export function ClinicalPdfImportWorkspace({patient,values,valueSources,labels,onApply,onBusy,onResults,onSaveDraft,step,onStepChange,onEnterManual,onVerified}:{patient:AuthorizedPatient;values:Record<string,number>;valueSources:Record<string,{sourceVerified?:boolean;source?:string}>;labels:Record<string,string>;onApply:(items:PdfReviewCandidate[])=>void;onBusy:(busy:boolean)=>void;onResults:(items:ClinicalPdfExtraction[])=>void;onSaveDraft:()=>void;step:PdfWizardStep;onStepChange:(step:PdfWizardStep)=>void;onEnterManual:(key:string)=>void;onVerified:(items:ConfirmedPdfValue[])=>void}){
 const [context,setContext]=useState<PdfPatientContext|null>(null);
 const [rows,setRowsState]=useState<QueueRow[]>([]),[documents,setDocuments]=useState<PatientDocument[]>([]),[savedSources,setSavedSources]=useState<SavedSource[]>([]);
 const [search,setSearch]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [identityConfirmed,setIdentityConfirmed]=useState(false),[selected,setSelected]=useState<Record<string,string>>({}),[approved,setApproved]=useState<Record<string,boolean>>({});
 const [edits,setEdits]=useState<Record<string,string>>({}),[preview,setPreview]=useState<{name:string;url:string}|null>(null);
 const dialogRef=useRef<HTMLDialogElement>(null),restoreFocus=useRef<HTMLElement|null>(null),headingRef=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{if(preview){dialogRef.current?.showModal();return()=>URL.revokeObjectURL(preview.url);}},[preview]);
 useEffect(()=>{headingRef.current?.focus();},[step]);
 const queueRef=useRef<QueueRow[]>([]),busyRef=useRef(false);
 const setRows=(update:QueueRow[]|((current:QueueRow[])=>QueueRow[]))=>{const next=typeof update==="function"?update(queueRef.current):update;queueRef.current=next;setRowsState(next);return next;};
 const scopeRef=useRef(new PatientOperationScope()),fileRef=useRef<HTMLInputElement>(null);
 useEffect(()=>{const scope=new PatientOperationScope();scopeRef.current=scope;return()=>scope.dispose();},[]);
 const refreshSources=async(signal:AbortSignal)=>{
  const result=await Promise.allSettled([getPatientDocuments(patient.id,{},signal),apiRequest<{items:SavedSource[]}>(`/api/ai-cdss/pdf/patients/${patient.id}/reports`,{signal}),getPdfPatientContext(patient.id,signal)]);
  if(signal.aborted)return;
  if(result[0].status==="fulfilled")setDocuments(result[0].value.filter(d=>d.mimeType?.toLowerCase()==="application/pdf"));
  if(result[1].status==="fulfilled")setSavedSources(result[1].value.items);
  if(result[2].status==="fulfilled"&&result[2].value.patientId===patient.id)setContext(result[2].value);
  for(const item of result)if(item.status==="rejected")throw item.reason;
 };
 useEffect(()=>{const scope=scopeRef.current,request=scope.begin();void refreshSources(request.signal).catch(e=>{if(scope.accepts(request))setError(`Saved sources could not be fully loaded. ${message(e)}`);}).finally(()=>scope.finish(request));return()=>request.abort();},[patient.id]);
 const previews=useMemo(()=>rows.flatMap(row=>row.preview?[row.preview]:[]),[rows]);
 const groups=useMemo(()=>pdfReviewCandidates(previews),[previews]);
 const keys=Object.keys(groups).filter(key=>key!=="Age"&&key in labels),conflicts=conflictingPdfFeatures(groups);
 const chosen=(key:string)=>groups[key]?.find(c=>c.candidateId===(selected[key]||(groups[key]?.length===1?groups[key][0].candidateId:"")));
 const approvedItems=keys.flatMap(key=>{
  const item=chosen(key);if(!approved[key]||!item)return [];
  const edited=edits[item.candidateId];if(edited===undefined)return [item];
  if(!edited.trim()||!Number.isFinite(Number(edited)))return [];
  return [{...item,value:Number(edited),editedByClinician:Number(edited)!==item.value}];
 });
 const addFiles=(incoming:File[])=>{
  if(busyRef.current||!incoming.length)return;
  if(queueRef.current.length+incoming.length>10){setError("Select at most ten reports at a time. Clear the current selection to read another batch.");return;}
  const added=incoming.map(file=>({id:crypto.randomUUID(),name:file.name,file}));
  setRows(current=>[...current,...added]);setNotice("");setError("");void read(added);
 };
 const failure=(row:QueueRow,e:unknown):ClinicalPdfExtraction=>({success:false,patientId:patient.id,fileName:row.name,source:row.file?"UPLOADED_PDF":"EHR_REPORT",status:"EXTRACTION_FAILED",extractionMethod:"NOT_COMPLETED",detectedCount:0,extractedValues:{},unrecognizedResults:[],warnings:[message(e)],message:message(e),processingStages:[{stage:"READ_REPORT",status:"FAILED",message:message(e)}]});
 const read=async(targets:QueueRow[]=queueRef.current)=>{
  if(busyRef.current||!targets.length)return;const scope=scopeRef.current,request=scope.begin();busyRef.current=true;setBusy(true);onBusy(true);setError("");setNotice("");
  const targetIds=new Set(targets.map(row=>row.id));setRows(current=>current.map(row=>targetIds.has(row.id)?{...row,reading:true}:row));setApproved({});setSelected({});setEdits({});setIdentityConfirmed(false);
  try{
   const results=new Map<string,ClinicalPdfExtraction>();const local=targets.filter(r=>r.file&&!r.documentId),ehr=targets.filter(r=>r.documentId);
   await Promise.all([
    (async()=>{
     // Separate requests avoid the server's aggregate multipart limit and isolate failures.
     const pending=[...local];await Promise.all(Array.from({length:Math.min(3,pending.length)},async()=>{
      while(pending.length){const row=pending.shift()!;try{const result=await (row.preview?extractClinicalPdf(patient.id,row.file!,request.signal):uploadClinicalPdf(patient.id,row.file!,request.signal));if(result.patientId!==patient.id)throw new Error("Response patient association is invalid.");results.set(row.id,result);}catch(e){if(request.signal.aborted)throw e;results.set(row.id,failure(row,e));}}
     }));
    })(),
    ...ehr.map(async row=>{try{const result=await extractClinicalEhrReport(patient.id,row.documentId!,request.signal);if(result.patientId!==patient.id)throw new Error("Response patient association is invalid.");results.set(row.id,result);}catch(e){if(request.signal.aborted)throw e;results.set(row.id,failure(row,e));}}),
   ]);
   if(!scope.accepts(request))return;
   const next=setRows(current=>current.map(row=>results.has(row.id)?{...row,preview:results.get(row.id),documentId:results.get(row.id)?.documentId||row.documentId,reading:false,error:undefined}:row));onResults(next.flatMap(r=>r.preview?[r.preview]:[]));setApproved({});setSelected({});setEdits({});setIdentityConfirmed(false);
   setNotice("PDF processing complete. Accepted files are stored for this patient. Review values and dates before confirming observations.");await refreshSources(request.signal);
  }catch(e){if(scope.accepts(request))setError(message(e));}finally{if(scope.accepts(request)){busyRef.current=false;setBusy(false);onBusy(false);setRows(current=>current.map(row=>row.reading?{...row,reading:false}:row));}scope.finish(request);}
 };
 const useFixture=async(fixture:string)=>{
  if(busyRef.current||queueRef.current.length>=10)return;const scope=scopeRef.current,request=scope.begin();busyRef.current=true;setBusy(true);onBusy(true);setError('');
  try{const result=await useClinicalTestFixture(patient.id,fixture,request.signal);if(!scope.accepts(request))return;if(result.patientId!==patient.id||result.documentClassification!=='TEST_DOCUMENT')throw new Error('The testing-patient association could not be verified.');
   const next=setRows(current=>current.some(row=>row.documentId===result.documentId)?current.map(row=>row.documentId===result.documentId?{...row,preview:result}:row):[...current,{id:crypto.randomUUID(),name:result.fileName||fixture+'.pdf',documentId:result.documentId,preview:result}]);onResults(next.flatMap(row=>row.preview?[row.preview]:[]));setNotice('Test document copied to this patient. Review values, units and collection dates before saving observations.');await refreshSources(request.signal);onStepChange(2);
  }catch(error){if(scope.accepts(request))setError(message(error));}finally{if(scope.accepts(request)){busyRef.current=false;setBusy(false);onBusy(false);}scope.finish(request);}
 };
 const save=async(row:QueueRow)=>{
  if(busyRef.current||!identityConfirmed||!row.preview||row.preview.identityStatus==="MISMATCH"&&!row.preview.syntheticPatient||row.preview.status==="PATIENT_MISMATCH")return;const scope=scopeRef.current,request=scope.begin();busyRef.current=true;setBusy(true);onBusy(true);setError("");
  try{
   const result=await saveClinicalPdf(patient.id,{file:row.file,documentId:row.documentId||row.preview.documentId,identityConfirmed,replacesReportId:row.revisionFrom||undefined,revisionReason:row.revisionReason},request.signal);
   if(!scope.accepts(request))return;if(result.patientId!==patient.id)throw new Error("Saved report patient association is invalid.");
   setRows(current=>current.map(r=>r.id===row.id?{...r,documentId:result.documentId,preview:{...r.preview!,saved:true,duplicate:result.duplicate,documentId:result.documentId,clinicalReportId:result.clinicalReportId,savedVersion:result.version}}:r));
   setNotice(result.duplicate?"This report is already saved. The existing source was reused; no observations were added.":"Source report saved. Extracted values remain unverified; no laboratory observations or predictions were created.");await refreshSources(request.signal);
  }catch(e){if(scope.accepts(request))setError(message(e));}finally{if(scope.accepts(request)){busyRef.current=false;setBusy(false);onBusy(false);setRows(current=>current.map(row=>row.reading?{...row,reading:false}:row));}scope.finish(request);}
 };
 const removeRows=(ids:Set<string>)=>{
  const next=setRows(current=>current.filter(row=>!ids.has(row.id)));onResults(next.flatMap(row=>row.preview?[row.preview]:[]));setApproved({});setSelected({});setEdits({});setIdentityConfirmed(false);
 };
 const openPreview=async(row:QueueRow)=>{
  const active=document.activeElement as HTMLElement;
  restoreFocus.current=active.closest("details")?.querySelector("summary")||active;
  const scope=scopeRef.current,request=scope.begin();
  try{
   const documentId=row.documentId||row.preview?.documentId;
   const blob=row.file?row.file:(documentId?(await previewClinicalPdf(patient.id,documentId,request.signal)).blob:undefined);
   if(!scope.accepts(request)||!blob)return;
   setPreview({name:row.name,url:URL.createObjectURL(blob)});
  }catch(e){if(scope.accepts(request))setError(message(e));}finally{scope.finish(request);}
 };
 const closePreview=()=>{dialogRef.current?.close();setPreview(null);restoreFocus.current?.focus();};
 const mismatched=rows.filter(row=>row.preview?.identityStatus==="MISMATCH"&&!row.preview.syntheticPatient||row.preview?.status==="PATIENT_MISMATCH");
 const unresolved=previews.filter(p=>p.identityStatus==="UNVERIFIED").length;
 const go=(next:PdfWizardStep)=>{onStepChange(next);};
 const missingKeys=Object.keys(labels).filter(key=>!Number.isFinite(values[key])&&!groups[key]?.length);
 const selectedList=<div className="pdf-report-list" aria-label="Selected reports">
  <div className="pdf-report-head" aria-hidden="true"><span>Filename</span><span>Report date</span><span>Status</span><span>Options</span></div>
  {rows.map(row=><div className="pdf-report-row" key={row.id}>
   <div className="pdf-report-name"><FileText size={18}/><strong>{row.name}</strong></div>
   <span className="pdf-report-date">{date(row.preview?.reportDates?.reportDate)}</span>
   <span className={`pdf-status ${row.preview?.identityStatus==="MISMATCH"?"pdf-status-warning":""}`}>{row.reading?"Reading…":row.preview?.identityStatus==="MISMATCH"&&!row.preview.syntheticPatient||row.preview?.status==="PATIENT_MISMATCH"?"Patient mismatch":row.preview?.documentClassification==="TEST_DOCUMENT"&&row.preview.identityStatus!=="MATCHED"?"TEST_DOCUMENT - identity needs review":row.preview?.fileAccepted&&!row.preview.duplicate?"Uploaded - ready for clinical review":row.preview?.saved||row.preview?.duplicate?"Previously saved — available for reuse":row.preview?statusLabel[row.preview.status]:"Selected"}</span>
   <details className="pdf-overflow"><summary aria-label={`More options for ${row.name}`}><MoreHorizontal size={20}/></summary><div>
    <button type="button" disabled={busy||(!row.documentId&&!row.preview?.fileAccepted)} onClick={e=>{e.currentTarget.closest("details")!.open=false;void openPreview(row);}}>Preview PDF</button>
    <button type="button" disabled={busy} onClick={e=>{e.currentTarget.closest("details")!.open=false;void read([row]);}}>Re-read PDF</button>
    <button type="button" disabled={busy} onClick={()=>removeRows(new Set([row.id]))}>Remove from selection</button>
    {(row.documentId||row.preview?.documentId)&&<button type="button" onClick={e=>{e.currentTarget.closest("details")!.open=false;void openPreview({...row,file:undefined});}}>View saved report</button>}
   </div></details>
  </div>)}
  {!rows.length&&<p className="pdf-empty">No reports selected. Add a PDF or choose a saved report.</p>}
 </div>;
 return <section className="pdf-import gov-clinical-section" aria-label="Clinical PDF sources" aria-busy={busy}>
  <nav aria-label="Clinical report workflow"><ol className="pdf-stepper">{(["Select reports","Review data","Run assessment"] as const).map((name,index)=><li key={name}><button type="button" aria-current={step===index+1?"step":undefined} disabled={busy} onClick={()=>go((index+1) as PdfWizardStep)}><span>{step>index+1?<Check size={16}/>:index+1}</span><strong>{name}</strong></button></li>)}</ol></nav>
  <header><span className="gov-kicker">Step {step} of 3</span><h3 tabIndex={-1} ref={headingRef}>{step===1?"Select Clinical Reports":step===2?"Review Clinical Measurements":"CKD Assessment Readiness"}</h3><p>{step===1?"Add reports from your device or reuse reports saved for this patient.":step===2?"Review values, units and collection dates, then confirm selected measurements for the clinical record.":"Complete the remaining details, then run the assessment when the server confirms readiness."}</p></header>
  {mismatched.length>0&&<aside className="pdf-warning" role="alert"><strong>{mismatched.length} {mismatched.length===1?"report requires":"reports require"} patient identity review</strong><p>These reports belong to another patient. Their values cannot be applied or saved here. Other reports can continue.</p><details><summary>View affected reports</summary><ul>{mismatched.map(row=><li key={row.id}>{row.name}</li>)}</ul></details><div className="pdf-import-actions"><Button variant="outline" onClick={()=>{const button=document.getElementById("ckd-change-patient");if(button?.getAttribute("aria-expanded")!=="true")button?.click();window.setTimeout(()=>{const picker=document.getElementById("ckd-shared-patient-picker");picker?.scrollIntoView({block:"center"});picker?.querySelector<HTMLInputElement>("input")?.focus();},0);}}>Select correct patient</Button><Button variant="outline" disabled={busy} onClick={()=>removeRows(new Set(mismatched.map(row=>row.id)))}>Remove mismatched reports</Button></div></aside>}
  {notice&&<p className="pdf-import-info" role="status">{notice}</p>}{error&&<p className="pdf-import-error" role="alert">{error} <button type="button" disabled={busy} onClick={()=>{const scope=scopeRef.current,request=scope.begin();void refreshSources(request.signal).then(()=>{if(scope.accepts(request))setError("");}).catch(e=>{if(scope.accepts(request))setError(message(e));}).finally(()=>scope.finish(request));}}>Retry saved reports</button></p>}
  <div className="sr-only" role="status" aria-live="polite">{busy?"Reading selected reports. Please wait.":`${rows.length} reports selected. ${Object.keys(groups).length} recognized measurement types.`}</div>
  {step===1&&<>
   {context?.syntheticPatient&&<ClinicalTestDocumentLibrary patientId={patient.id} hospitalName={patient.hospital_name} busy={busy||rows.length>=10} onUse={fixture=>void useFixture(fixture)}/>}
   {context?.syntheticPatient&&<p className="pdf-import-info">Synthetic testing patient. Valid PDFs can be associated with this selected patient as TEST_DOCUMENT, even when printed identifiers differ. Extracted measurements still require explicit review.</p>}
   <div className="pdf-import-upload" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!busy)addFiles(Array.from(e.dataTransfer.files));}}><Upload size={24}/><div><h4>Upload Clinical PDF</h4><p>Drop PDFs here or browse. Up to 10 reports, 15 MB each.</p></div><input ref={fileRef} type="file" multiple accept="application/pdf,.pdf" aria-label="Browse clinical PDFs" disabled={busy} onChange={e=>{addFiles(Array.from(e.target.files||[]));e.currentTarget.value="";}}/></div>
   {selectedList}
   <details className="pdf-library"><summary>Choose reports saved in this patient's EHR ({documents.length})</summary><label className="sr-only" htmlFor="pdf-library-search">Search saved reports by filename or date</label><input id="pdf-library-search" type="search" placeholder="Search filename or date" value={search} onChange={e=>setSearch(e.target.value)}/><div className="pdf-import-saved-list">{documents.filter(doc=>{const source=savedSources.find(s=>s.documentId===doc.id);return `${doc.title} ${doc.originalFileName} ${doc.fileName} ${doc.createdAt} ${source?.reportDate} ${date(source?.reportDate)} ${date(doc.createdAt)}`.toLowerCase().includes(search.toLowerCase());}).map(doc=>{
    const source=savedSources.find(s=>s.documentId===doc.id),checked=rows.some(row=>row.documentId===doc.id);return <label key={doc.id}><input type="checkbox" value={doc.id} disabled={busy||(!checked&&rows.length>=10)} checked={checked} onChange={e=>{if(busyRef.current)return;if(e.target.checked){const added={id:crypto.randomUUID(),name:doc.originalFileName||doc.title,documentId:doc.id};setRows(current=>[...current,added]);void read([added]);}else removeRows(new Set(rows.filter(row=>row.documentId===doc.id).map(row=>row.id)));}}/><span><strong>{doc.originalFileName||doc.title}</strong><small>Report: {date(source?.reportDate)} — Saved: {date(doc.createdAt)}{source?` — Version ${source.version}`:""}</small></span></label>;
   })}{!documents.length&&<p>No saved PDFs available. Browse a local report to continue.</p>}</div></details>
   <footer className="pdf-wizard-footer"><Button variant="outline" disabled={busy} onClick={onSaveDraft}>Save draft</Button><Button disabled={busy} onClick={()=>go(2)}>{busy?"Reading reports…":"Continue to Data Review"}</Button></footer>
  </>}
  {step===2&&<>
   <div className="pdf-import-summary" aria-label="Extraction summary"><span><b>{Object.keys(groups).length}</b> recognized measurement types</span><span><b>{missingKeys.length}</b> missing required inputs</span><span><b>{conflicts.length}</b> conflicting results</span><span><b>{previews.filter(p=>p.status==="OCR_REQUIRED").length}</b> scans need OCR</span><span><b>{mismatched.length+unresolved}</b> identity reviews</span></div>
   <ClinicalPdfObservationReview patientId={patient.id} reports={previews} definitions={context?.measurements||[]} onBusy={active=>{busyRef.current=active;setBusy(active);onBusy(active);}} onVerified={items=>{onVerified(items);setNotice(`${items.length} reviewed observations saved to this patient's clinical record. Missing model inputs remain required.`);onStepChange(3);}} onBack={()=>go(1)} onManual={()=>go(3)}/>
   <details className="pdf-advanced"><summary>Assessment draft autofill and source audit details</summary>
   {rows.length>0&&<label className="pdf-import-identity"><input type="checkbox" disabled={busy} checked={identityConfirmed} onChange={e=>setIdentityConfirmed(e.target.checked)}/>I checked these reports against {patient.patient_no||patient.full_name||patient.id}. Reports without identifiers need confirmation; mismatched reports remain blocked.</label>}
   {keys.length>0&&<div className="pdf-import-actions"><Button variant="outline" disabled={busy||!identityConfirmed} onClick={()=>setApproved(Object.fromEntries(keys.map(key=>[key,groups[key].length===1&&!Number.isFinite(values[key])])))}>Approve unambiguous empty fields</Button><small>Competing results and existing values always require individual review.</small></div>}
   <div className="pdf-import-table-scroll"><table><caption className="sr-only">Review extracted measurements and enter missing clinical data</caption><thead><tr><th>Measurement</th><th>Extracted value</th><th>Source</th><th>Status</th></tr></thead><tbody>{Object.keys(labels).map(key=>{
    const candidate=chosen(key);return <tr key={key} className={!groups[key]?.length?"pdf-manual-row":undefined}><th scope="row">{labels[key]}{Number.isFinite(values[key])&&<small>Current: {values[key]} — {valueSources[key]?.sourceVerified?"Verified laboratory result":"Assessment input - not lab verified"}</small>}</th>
     <td data-label="Extracted value">{candidate?<><label className="sr-only" htmlFor={`pdf-value-${key}`}>Reviewed value for {labels[key]}</label><div className="pdf-inline-value"><input id={`pdf-value-${key}`} type="number" step="any" disabled={busy} value={edits[candidate.candidateId]??candidate.value} onChange={e=>{setEdits(current=>({...current,[candidate.candidateId]:e.target.value}));setApproved(current=>({...current,[key]:false}));}}/><span>{candidate.unit}</span></div><small>Printed: {candidate.originalValue} {candidate.originalUnit}</small></>:groups[key]?.length?"Choose a result to compare":Number.isFinite(values[key])?"Already available":"Missing"}</td>
     <td data-label="Source">{groups[key]?.length?<><select aria-label={`Source for ${labels[key]}`} disabled={busy} value={candidate?.candidateId||""} onChange={e=>{setSelected(current=>({...current,[key]:e.target.value}));setApproved(current=>({...current,[key]:false}));}}><option value="">Choose a result</option>{groups[key].map(item=><option key={item.candidateId} value={item.candidateId}>{item.value} {item.unit} — {item.sourceReport} — {date(item.clinicalDate||item.reportDate)}</option>)}</select>{candidate&&<><small>Collected: {candidate.clinicalDate?date(candidate.clinicalDate):"Not recorded"} — Report: {date(candidate.reportDate)}</small><small>PDF extraction — Unverified</small></>}</>:<span>{key==="Age"?"Selected EHR patient":Number.isFinite(values[key])?(valueSources[key]?.sourceVerified?"Verified laboratory result":"Current assessment form"):"—"}</span>}</td>
     <td data-label="Status">{candidate?<label className="pdf-approval"><input type="checkbox" aria-label={`Approve ${labels[key]}`} disabled={busy||!identityConfirmed} checked={Boolean(approved[key])} onChange={e=>setApproved(current=>({...current,[key]:e.target.checked}))}/>{approved[key]?"Approved":edits[candidate.candidateId]!==undefined?"Edited by clinician — approve":"Review"}</label>:<><span>{conflicts.includes(key)?"Conflict — select a source":Number.isFinite(values[key])?"Available":"Add value"}</span><button type="button" className="pdf-text-action" onClick={()=>onEnterManual(key)}>{key==="Age"?"Review demographics":"Enter / edit value"}</button></>}{candidate&&conflicts.includes(key)&&<small>Competing results — review selection</small>}</td>
    </tr>;
   })}</tbody></table></div>
   <details className="pdf-advanced"><summary>Advanced options: reports, corrections and audit details</summary>
    {selectedList}
    {previews.map((p,index)=><div key={`${p.fingerprint}-${index}`}><strong>{p.fileName}</strong><details><summary>Processing stages and conversion details</summary>{p.processingStages?.map(stage=><p key={stage.stage}>{stage.stage}: {stage.status} - {stage.message}</p>)}{Object.values(p.measurementCandidates||{}).flat().map((value,i)=><p key={i}>{value.feature}: {value.originalValue} {value.originalUnit} to {value.value} {value.unit} - {value.conversionMethod} - page {value.sourcePage} - {value.confidenceBasis}</p>)}</details><small>Status code: {p.status} — Identity: {p.identityStatus} — {p.extractionMethod}</small>{p.warnings?.map((w,n)=><p key={n}>{w}</p>)}{p.unrecognizedResults?.map((u,n)=><p key={n}>{u.text} — {u.reason}</p>)}</div>)}
    {rows.filter(row=>row.preview&&row.preview.identityStatus!=="MISMATCH"&&!["PATIENT_MISMATCH","EXTRACTION_FAILED"].includes(row.preview.status)).map(row=><div className="pdf-save-source" key={row.id}><strong>{row.name}</strong><p>Saving the document is separate from applying values. Extracted measurements stay unverified.</p>{!row.preview?.saved&&<><label>Previous source for a reviewed correction<select aria-label={`Revision source for ${row.name}`} value={row.revisionFrom||""} onChange={e=>setRows(current=>current.map(r=>r.id===row.id?{...r,revisionFrom:e.target.value}:r))}><option value="">Independent source report</option>{savedSources.map(source=><option key={source.id} value={source.id}>{source.originalFilename} — Version {source.version}</option>)}</select></label>{row.revisionFrom&&<label>Review reason<textarea value={row.revisionReason||""} maxLength={2000} onChange={e=>setRows(current=>current.map(r=>r.id===row.id?{...r,revisionReason:e.target.value}:r))}/></label>}</>}<Button variant="outline" disabled={busy||!identityConfirmed||Boolean(row.revisionFrom&&!row.revisionReason?.trim())} onClick={()=>void save(row)}>{row.preview?.saved?"Reuse saved report":row.revisionFrom?"Save reviewed correction":"Save document"}</Button></div>)}
    <Button variant="outline" disabled={busy||!rows.length} onClick={()=>removeRows(new Set(rows.map(row=>row.id)))}>Clear current selection</Button>
   </details>
   <div className="pdf-import-actions"><Button variant="outline" disabled={busy} onClick={()=>go(1)}>Back</Button><Button disabled={busy||(approvedItems.length>0&&!identityConfirmed)||Object.values(approved).filter(Boolean).length>approvedItems.length} onClick={()=>{if(approvedItems.length){onApply(approvedItems);setApproved({});setNotice(`${approvedItems.length} reviewed values applied. Complete any remaining inputs.`);}go(3);}}>{approvedItems.length?`Apply values to assessment draft (${approvedItems.length})`:"Continue with Current Values"}</Button></div>
   </details>
  </>}
  <dialog ref={dialogRef} className="pdf-preview-dialog" aria-labelledby="pdf-preview-title" onCancel={closePreview} onClose={()=>{if(preview)closePreview();}}><header><h3 id="pdf-preview-title">{preview?.name}</h3><button type="button" aria-label="Close PDF preview" autoFocus onClick={closePreview}><X size={22}/></button></header>{preview&&<><iframe title={`PDF preview: ${preview.name}`} src={preview.url}/><a href={preview.url} target="_blank" rel="noopener noreferrer">Open PDF in browser viewer</a></>}</dialog>
 </section>;
}
