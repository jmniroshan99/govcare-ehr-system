import { apiRequest } from "./apiClient";

export interface AIReportRecord {
 id:string; patientCode:string; patientName:string; age:string; diagnosis:string;
 aiModule:string; riskLevel:string; prediction:string; probability?:string;
 doctor:string; createdDate:string; status:string;
}

export async function getAIReports(filters: Record<string,string>) {
 const params=new URLSearchParams(filters);
 return apiRequest<AIReportRecord[]>(`/api/reports/ai-assessments?${params.toString()}`);
}
