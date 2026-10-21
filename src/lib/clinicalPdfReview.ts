import type { ClinicalExtractionValue, ClinicalPdfExtraction } from "../services/aiCdssService";
export type PdfReviewCandidate=ClinicalExtractionValue & {candidateId:string;fingerprint:string;sourceReport:string;sourceType:"UPLOADED_PDF"|"EHR_REPORT";reportId?:string;documentId?:string;reportDate?:string;importReviewed:true;sourceVerified:false;editedByClinician?:boolean};
/** Pure comparison: never selects a competing source or writes to the clinical form. */
export function pdfReviewCandidates(reports:ClinicalPdfExtraction[]){
 const groups:Record<string,PdfReviewCandidate[]>={};const seen=new Set<string>();
 for(const report of reports){if(!report.success||(report.identityStatus==="MISMATCH"&&!(report.syntheticPatient===true&&report.documentClassification==="TEST_DOCUMENT")))continue;
  for(const value of [...Object.values(report.extractedValues||{}),...Object.values(report.measurementCandidates||{}).flat()]){
   if(!Number.isFinite(value.value))continue;const fingerprint=report.fingerprint||report.clinicalReportId||report.documentId||report.fileName||"unknown";
   const id=`${fingerprint}|${value.feature}|${value.clinicalDate||""}|${value.value}|${value.unit}`;if(seen.has(id))continue;seen.add(id);
   (groups[value.feature]??=[]).push({...value,candidateId:id,fingerprint,sourceReport:report.fileName||"Clinical PDF",sourceType:report.source,reportId:report.clinicalReportId,documentId:report.documentId,reportDate:report.reportDates?.reportDate,importReviewed:true,sourceVerified:false});
  }
 }return groups;
}
export const conflictingPdfFeatures=(groups:Record<string,PdfReviewCandidate[]>)=>Object.keys(groups).filter(key=>new Set(groups[key].map(c=>`${c.value}|${c.unit}`)).size>1);
