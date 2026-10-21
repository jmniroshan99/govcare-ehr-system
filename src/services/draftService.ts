import { apiRequest } from "./apiClient";
export type WorkflowDraft={draftId:string;patientId?:string;workflowType:string;formType:string;data?:Record<string,unknown>;status:"DRAFT"|"IN_PROGRESS"|"SAVED"|"ARCHIVED";version:number;updatedAt:string};
export const saveWorkflowDraft=(input:{draftId?:string;patientId?:string;workflowType:string;formType:string;data:Record<string,unknown>;status?:"DRAFT"|"IN_PROGRESS"|"SAVED";version?:number;requestId?:string},signal?:AbortSignal)=>apiRequest<WorkflowDraft>("/api/workflow-drafts",{method:"POST",signal,body:JSON.stringify({...input,requestId:input.requestId??crypto.randomUUID()})});
export const listWorkflowDrafts=(workflowType="",signal?:AbortSignal)=>apiRequest<{items:WorkflowDraft[]}>(`/api/workflow-drafts?workflowType=${encodeURIComponent(workflowType)}`,{signal});
export const getWorkflowDraft=(draftId:string,signal?:AbortSignal)=>apiRequest<WorkflowDraft>(`/api/workflow-drafts/${encodeURIComponent(draftId)}`,{signal});
export const archiveWorkflowDraft=(draftId:string,reason:string)=>apiRequest(`/api/workflow-drafts/${encodeURIComponent(draftId)}/archive`,{method:"PATCH",body:JSON.stringify({reason})});
