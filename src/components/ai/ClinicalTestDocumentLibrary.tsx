import {useEffect,useState} from 'react';
import {Button} from '../ui/button';
import {getClinicalTestLibrary,type ClinicalTestFixture} from '../../services/aiCdssService';
export function ClinicalTestDocumentLibrary({patientId,hospitalName,busy,onUse}:{patientId:string;hospitalName?:string;busy:boolean;onUse:(fixture:string)=>void}){
 const [items,setItems]=useState<ClinicalTestFixture[]>([]),[error,setError]=useState('');
 useEffect(()=>{const controller=new AbortController();getClinicalTestLibrary(patientId,controller.signal).then(data=>{if(!controller.signal.aborted&&data.patientId===patientId)setItems(data.items);}).catch(error=>{if(!controller.signal.aborted)setError(error instanceof Error?error.message:'The library could not be loaded.');});return()=>controller.abort();},[patientId]);
 return <details className="pdf-test-library"><summary>Clinical Test Document Library</summary><p>Reusable synthetic fixtures for this selected testing patient{hospitalName?` at ${hospitalName}`:''}. Select a different authorized hospital and patient with Change patient. Each import has its own patient and hospital association.</p>{error&&<p role="alert">{error}</p>}<div className="pdf-test-library-grid">{items.map(item=><div key={item.id}><strong>{item.title}</strong><small>{item.imageOnly?'Image-only: OCR or manual review':'Text-based laboratory fixture'}</small><Button variant="outline" disabled={busy} onClick={()=>onUse(item.id)}>Use {item.title}</Button></div>)}</div><p>These fixtures never verify measurements automatically or relax real-patient checks.</p></details>;
}
