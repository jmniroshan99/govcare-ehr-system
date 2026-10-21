/** Display contracts keep model outputs, event probabilities, measurements and coverage distinct. */
export type ClinicalPercentKind = 'SCREENING_SCORE' | 'SELECTED_CLASS_SCORE' | 'RESEARCH_SCORE' | 'EVENT_PROBABILITY' | 'LAB_PERCENT' | 'INPUT_COVERAGE';
export function validatedUnitScore(value: unknown): number | null {
 return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}
export function modelScorePercent(value: unknown): string {
 const score=validatedUnitScore(value);return score===null?'Unavailable':`${(score*100).toFixed(2)}%`;
}
export function clinicalPercent(kind:ClinicalPercentKind,value:unknown,context?:{calibrated?:boolean;outcome?:string;horizon?:string}):string {
 if(kind==='EVENT_PROBABILITY'&&(!context?.calibrated||!context.outcome||!context.horizon))return 'Not estimated';
 if(kind==='LAB_PERCENT'||kind==='INPUT_COVERAGE')return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100?`${value.toFixed(2)}%`:'Unavailable';
 return modelScorePercent(value);
}
