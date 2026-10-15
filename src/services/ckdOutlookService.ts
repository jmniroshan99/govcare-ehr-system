import { apiRequest } from "./apiClient";

export type OutlookInput = { label:string; value:number|string|null; unit?:string|null; state:string; observedAt?:string|null; source?:string; sourceId?:string; recordedValue?:string };
export type OutlookPoint = {value:number;observedAt:string;unit:string;source?:string;sourceId?:string;state?:string};
export type OutlookEvidence = {
  inputs:Record<"age"|"sex"|"egfr"|"acr",OutlookInput>;
  history:Partial<Record<string,OutlookPoint[]>>; excludedData:unknown[];
  fingerprint:string;stage:string;dialysisStatus:string;dialysisVerifiedAt?:string|null;maintenanceDialysis:boolean;
  historyTruncated:boolean;recentAdmission:boolean;acuteReviewSignal:boolean;
  monitoring:Array<{key:string;title:string;status:string;currentValue:number|null;unit:string;horizon:string;longTermStatus:string;supportedHorizon?:string}>;
};
export type OutlookModel = {name:string;version:string;method:string;outcome:string;population:string;calibration:string;externalValidation:string;localValidation:string;deploymentStatus:string;reference:string;calculatorReference:string;uncertainty:string;inputPolicy:string;thresholdReference:string;horizonsYears:number[];confidenceInterval:null};
export type OutlookMilestone={year:number;title:string};
export type OutlookReadiness = {
  status:"AVAILABLE"|"NOT_APPLICABLE"|"INSUFFICIENT_DATA"|"SOURCE_REVIEW_REQUIRED"|"CLINICAL_CONTEXT_REQUIRED";
  assessedAt:string;model:OutlookModel;evidence:OutlookEvidence;twoYearRisk:number|null;fiveYearRisk:number|null;
  riskCategory:string|null;missingInputs:string[];reasons:string[];interpretation:string;eligibility:string;
  completeness:{available:number;required:number;percent:number;meaning:string};canCalculateAfterConfirmation:boolean;limitations:string[];
};
export type OutlookAssessment=OutlookReadiness & {
  id:string;patientId:string;hospitalId:string;evidenceFingerprint:string;reviewState:string;reviewVersion:number;
  review:{reason:string;clinical_note:string|null;modified_interpretation:string|null;milestones:OutlookMilestone[];reviewedAt:string}|null;
  confirmation?:{sexForEquation:string;confirmedChronicCkd:boolean;noKidneyReplacementTherapy:boolean;clinicallyStable:boolean;sourceNote:string};
};
export type OutlookHistoryItem=Pick<OutlookAssessment,"id"|"assessedAt"|"status"|"twoYearRisk"|"fiveYearRisk"|"evidenceFingerprint">;
export type CkdOutlook={patientId:string;hospitalId:string;generatedAt:string;evidence:OutlookEvidence;readiness:OutlookReadiness;assessment:OutlookAssessment|null;previousAssessments:OutlookHistoryItem[];reportAssessmentId:string|null;canWrite:boolean};
export type OutlookAssessmentInput={requestId:string;evidenceFingerprint:string;sexForEquation:"MALE"|"FEMALE";confirmedChronicCkd:true;noKidneyReplacementTherapy:true;clinicallyStable:true;sourceNote:string};
export type OutlookReviewInput={snapshotId:string;requestId:string;expectedVersion:number;action:"ACCEPT"|"MODIFY"|"DEFER"|"DISMISS";reason:string;note:string;modifiedInterpretation:string;milestones:OutlookMilestone[]};
export type OutlookScenario={hypothetical:true;persisted:false;snapshotId:string;twoYearRisk:number;fiveYearRisk:number;label:string;assumptions:{egfr:number;acrMgG:number};recordedAsOf:string};
const base=(patient:string)=>`/api/ai-cdss/ckd/patients/${encodeURIComponent(patient)}/outlook`;
export const getCkdOutlook=(patient:string,signal?:AbortSignal)=>apiRequest<CkdOutlook>(base(patient),{signal});
export const calculateCkdOutlook=(patient:string,input:OutlookAssessmentInput,signal?:AbortSignal)=>apiRequest<OutlookAssessment>(`${base(patient)}/assessments`,{method:"POST",signal,body:JSON.stringify(input)});
export const reviewCkdOutlook=(patient:string,input:OutlookReviewInput,signal?:AbortSignal)=>apiRequest<{id:string;saved:boolean;reviewVersion:number}>(`${base(patient)}/reviews`,{method:"POST",signal,body:JSON.stringify(input)});
export const exploreCkdOutlook=(patient:string,input:{snapshotId:string;egfr:number;acr:number;acrUnit:string},signal?:AbortSignal)=>apiRequest<OutlookScenario>(`${base(patient)}/scenarios`,{method:"POST",signal,body:JSON.stringify(input)});
