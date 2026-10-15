import { apiRequest } from "./apiClient";
export type ClinicalCode = { system:string; code:string; display:string; version?:string|null; category:string };
export type CodeValidation = { valid:boolean; system?:string; code?:string; display?:string; category?:string; message?:string };
export const FHIR_SYSTEMS = {
  ICD10: "http://hl7.org/fhir/sid/icd-10",
  SNOMED: "http://snomed.info/sct",
  LOINC: "http://loinc.org",
  RXNORM: "http://www.nlm.nih.gov/research/umls/rxnorm",
} as const;
export async function searchClinicalCodes(query:string, system?:string){
 const p=new URLSearchParams({query}); if(system)p.set("system",system);
 return apiRequest<ClinicalCode[]>(`/fhir/CodeSystem/search?${p.toString()}`);
}
export function validateClinicalCode(system:string,code:string){return apiRequest<CodeValidation>("/fhir/$validate-code",{method:"POST",body:JSON.stringify({system,code})});}
export function saveCodedCondition(patientId:string, code:ClinicalCode){return apiRequest<{resourceType:string;id:string;code:string;display:string}>("/api/clinical-coding/conditions",{method:"POST",body:JSON.stringify({patientId,system:code.system,code:code.code})});}
