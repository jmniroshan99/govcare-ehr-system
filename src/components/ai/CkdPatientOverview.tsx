import {useEffect,useState} from 'react';
import {getCkdHistory,type CkdPrediction} from '../../services/aiCdssService';
import {DATA_MUTATED_EVENT} from '../../services/apiClient';
import {modelScorePercent} from '../../lib/clinicalScore';
export function CkdPatientOverview({patientId}:{patientId:string}){
 const [latest,setLatest]=useState<CkdPrediction|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{const listener=(event:Event)=>{if((event as CustomEvent).detail?.path==='/api/ai-cdss/ckd/predict')setRevision(value=>value+1);};window.addEventListener(DATA_MUTATED_EVENT,listener);return()=>window.removeEventListener(DATA_MUTATED_EVENT,listener);},[]);
 useEffect(()=>{let active=true;getCkdHistory(patientId).then(data=>{if(active){setLatest(data.items[0]||null);setError('');}}).catch(()=>{if(active)setError('Saved assessment overview is unavailable. Retry by reopening this patient.');});return()=>{active=false;};},[patientId,revision]);
 return <section className="ckd-patient-overview" aria-label="Patient assessment overview"><div><span>Latest saved screening score</span><strong>{latest?modelScorePercent(latest.probability):'No saved assessment'}</strong><small>Uncalibrated model score</small></div><div><span>Selected-class score</span><strong>{latest?modelScorePercent(latest.confidence):'Unavailable'}</strong><small>Not clinical certainty</small></div><div><span>Review band</span><strong>{latest?.riskCategory?.replaceAll('_',' ')||'Not assessed'}</strong><small>Clinical interpretation required</small></div><div><span>Latest assessment</span><strong>{latest?.createdAt?new Date(latest.createdAt).toLocaleDateString():'Not recorded'}</strong><small>Saved evidence remains unchanged</small></div>{error&&<p role="alert">{error}</p>}</section>;
}
