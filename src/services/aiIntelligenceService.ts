import { apiRequest } from "./apiClient";
export type AIModule="ckd"|"diabetes"|"cardiovascular"|"sepsis"|"readmission"|"length-of-stay";
export type AIPrediction={id:string;module:AIModule;risk:"LOW"|"MODERATE"|"HIGH"|"CRITICAL";probability:number;confidence:number;recommendation:string;modelVersion:string};
export const getAIIntelligenceDashboard=()=>apiRequest<{summary:{totalPredictions:number;highRiskPatients:number;criticalAlerts:number};recent:Array<Record<string,unknown>>;mode:string}>("/api/ai/dashboard");
export const runAIPrediction=(module:AIModule,patientId:string,features:Record<string,number|string|boolean>)=>apiRequest<AIPrediction>(`/api/ai/predict/${module}`,{method:"POST",body:JSON.stringify({patientId,features})});
export const getAIPredictionHistory=(patientId:string)=>apiRequest<{items:Array<Record<string,unknown>>}>(`/api/ai/history/${encodeURIComponent(patientId)}`);
