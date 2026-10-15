import type { OutlookPoint } from "../services/ckdOutlookService";

export function outlookPercent(value:number|null|undefined) {
  if(value==null||!Number.isFinite(value)||value<0||value>1)return "Not estimated";
  if(value>0&&value<0.001)return "<0.1%";
  return new Intl.NumberFormat("en",{style:"percent",maximumFractionDigits:1,minimumFractionDigits:1}).format(value);
}
export function outlookDate(value:string|null|undefined,includeYear=true) {
  if(!value)return "Date unverified";
  const parsed=new Date(value);if(!Number.isFinite(parsed.getTime()))return "Date unverified";
  return new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",...(includeYear?{year:"numeric" as const}:{})}).format(parsed);
}
export function outlookHistory(points:OutlookPoint[]|undefined) {
  return (Array.isArray(points)?points:[]).filter(p=>p.state!=="INVALID"&&typeof p.value==="number"&&Number.isFinite(p.value)&&!!p.observedAt&&Number.isFinite(Date.parse(p.observedAt)))
    .map(p=>({...p,time:Date.parse(p.observedAt)})).sort((a,b)=>a.time-b.time);
}
export function outlookCohort(value:number|null) {
  if(value==null||!Number.isFinite(value)||value<0||value>1)return "A cohort illustration will appear when an eligible estimate is recorded.";
  const count=value*100;
  return count>0&&count<1?"Fewer than 1 out of 100 similar patients are estimated to require dialysis or transplantation within this horizon.":`Approximately ${Math.round(count)} out of 100 similar patients are estimated to require dialysis or transplantation within this horizon.`;
}
export const outlookActions:Record<string,{label:string;tone:string;detail:string}>={
  KRT_PLANNING_REVIEW:{label:"Review kidney replacement planning",tone:"rose",detail:"Two-year risk exceeds the KDIGO 40% planning review threshold. Interpret with the full clinical context."},
  MULTIDISCIPLINARY_REVIEW:{label:"Review multidisciplinary care",tone:"amber",detail:"Two-year risk exceeds the KDIGO 10% multidisciplinary-care review threshold."},
  NEPHROLOGY_REVIEW:{label:"Review nephrology follow-up",tone:"amber",detail:"Five-year risk reaches the KDIGO 3–5% referral review range. Local pathways and other criteria also apply."},
  INDIVIDUALIZED_MONITORING:{label:"Continue individualized monitoring",tone:"teal",detail:"An estimate below these review thresholds does not exclude other complications or replace clinical judgment."},
};
