// Real React forms with a DOM emulator. Does not claim browser layout or live API verification.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module'),ts=require('typescript');
const {JSDOM}=require(process.env.GOVCARE_JSDOM_MODULE||'jsdom');
const dom=new JSDOM('<!doctype html><html><body><button id="opener">Open</button><main id="root"></main></body></html>',{url:'http://localhost/'});
for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','HTMLTextAreaElement','HTMLDialogElement','Event','MouseEvent'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new Event('close'));};
const React=require('react'),{createRoot}=require('react-dom/client'),{act}=React;
const rootPath=path.resolve(__dirname,'..'),cache=new Map(),calls=[],checks=[];
let respond=async()=>({saved:true}),saved=0,closed=0;
function load(file){
 if(cache.has(file))return cache.get(file).exports;
 const module={exports:{}};cache.set(file,module);const native=createRequire(file);
 const localRequire=specifier=>{
  if(specifier.endsWith('.css'))return {};
  if(specifier.endsWith('/apiClient'))return {apiRequest:async(url,options)=>{calls.push({url,...options});return respond(url,options);}};
  if(!specifier.startsWith('.'))return native(specifier);
  const target=path.resolve(path.dirname(file),specifier),resolved=['.ts','.tsx','.js','/index.ts'].map(ext=>target+ext).find(p=>fs.existsSync(p));
  return resolved?load(resolved):native(specifier);
 };
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInThisContext('(function(require,module,exports){'+code+'\n})',{filename:file})(localRequire,module,module.exports);return module.exports;
}
const {CkdEvidenceDialog,CkdEvidenceSetup,CkdResearchDemoTools}=load(path.join(rootPath,'src/components/ai/CkdEvidenceSetup.tsx'));
const patient={id:crypto.randomUUID(),patient_no:'SYNTH-CKD-QA',full_name:'SYNTHETIC SOFTWARE FIXTURE'};
let root=createRoot(document.getElementById('root'));
const render=async(element)=>{await act(async()=>root.render(element));};
const reset=async()=>{await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));};
const fill=async(label,value)=>{const el=document.querySelector(`[aria-label="${label}"]`);assert.ok(el,label);const proto=el instanceof HTMLSelectElement?HTMLSelectElement.prototype:el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;await act(async()=>{Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new Event(el instanceof HTMLSelectElement?'change':'input',{bubbles:true}));});};
const click=async(el)=>{assert.ok(el);await act(async()=>el.click());};
const submit=async()=>{await act(async()=>document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));};
const button=text=>[...document.querySelectorAll('button')].find(el=>el.textContent===text);
const dialog=()=>React.createElement(CkdEvidenceDialog,{patient,kind:'trend',onClose:()=>closed++,onSaved:()=>saved++});
(async()=>{
 try {
  await render(React.createElement(CkdEvidenceSetup,{data:{clinicalFeatureData:{history:{}},cardiovascularMonitoring:{requirements:[{key:'diabetes_status',satisfied:false}]},dialysisAdequacy:{currentValue:null}},canWrite:false,onTrend:()=>{},onDiabetes:()=>{},onDialysis:()=>{}}));
  assert.equal(document.querySelectorAll('.ckd-evidence-tasks button').length,5);assert.ok([...document.querySelectorAll('.ckd-evidence-tasks button')].every(b=>b.disabled));checks.push('All five evidence actions honor read-only access');
  await reset();document.getElementById('opener').focus();await render(dialog());
  for(const label of ['Baseline value','Later value','Baseline measurement time','Later measurement time'])assert.equal(document.querySelector(`[aria-label="${label}"]`).value,'');
  assert.equal(document.querySelector('input[type="checkbox"]').checked,false);checks.push('No source values, dates or verification are prefilled');
  await submit();assert.equal(calls.length,0);assert.ok(document.querySelector('[role="alert"]'));
  await fill('Trend unit','umol/L');await fill('Baseline value','176.8');await fill('Later value','265.2');await fill('Baseline measurement time','2026-08-01T10:00');await fill('Later measurement time','2026-09-01T10:00');await fill('Baseline source reference','Synthetic source A');await fill('Later source reference','Synthetic source B');await click(document.querySelector('input[type="checkbox"]'));
  respond=async()=>{throw Error('Synthetic retryable failure');};await submit();assert.match(document.querySelector('[role="alert"]').textContent,/retryable failure/);assert.equal(saved,0);assert.equal(document.querySelector('[aria-label="Later value"]').value,'265.2');
  const first=JSON.parse(calls.at(-1).body);respond=async()=>({saved:true});await submit();const retry=JSON.parse(calls.at(-1).body);assert.equal(saved,1);assert.equal(retry.requestId,first.requestId);assert.equal(retry.baselineValue,176.8);assert.equal(retry.currentValue,265.2);assert.equal(retry.unit,'umol/L');assert.equal(retry.sourceVerified,true);assert.ok(retry.baselineAt<retry.currentAt);checks.push('Real controlled form sends verified values and dates; errors retain inputs, retry UUID and success refresh callback');
  await reset();assert.equal(document.activeElement.id,'opener');await render(React.createElement(CkdEvidenceDialog,{patient,kind:'diabetes',onClose:()=>closed++,onSaved:()=>saved++}));
  assert.equal(document.querySelector('[aria-label="Diabetes context"]').value,'UNCONFIRMED');assert.equal(document.querySelectorAll('input[type="number"]').length,0);await fill('Clinical verification time','2026-09-01T10:00');await fill('Clinical source and reason','Synthetic reviewed clinical record');await click(document.querySelector('input[type="checkbox"]'));await submit();assert.equal(JSON.parse(calls.at(-1).body).status,'UNCONFIRMED');checks.push('Diabetes context defaults to unknown and can preserve unknown without fabricating lab values');
  await reset();let selected=null;respond=async()=>({synthetic:true,patients:[patient,{...patient,id:crypto.randomUUID(),full_name:'SECOND SYNTHETIC FIXTURE'}]});await render(React.createElement(CkdResearchDemoTools,{onSelect:p=>{selected=p;}}));
  assert.equal(calls.filter(c=>c.url.endsWith('research-demonstrations')).length,0);await click(button('Create two synthetic demo patients'));assert.equal(JSON.parse(calls.at(-1).body).acknowledgedSyntheticData,true);assert.equal(document.querySelectorAll('.ckd-demo-choices button').length,2);await click(button(patient.full_name));assert.equal(selected.id,patient.id);checks.push('Demo creation requires a button click, explicitly acknowledges synthetic data and selects a returned new patient');
  await reset();let pending,signal;respond=async(url,options)=>{signal=options.signal;return new Promise(resolve=>{pending=resolve;});};await render(React.createElement(CkdResearchDemoTools,{onSelect:()=>{throw Error('Unmounted component selected a patient');}}));await click(button('Create two synthetic demo patients'));await reset();assert.equal(signal.aborted,true);await act(async()=>pending({synthetic:true,patients:[patient]}));checks.push('Unmount cancels the pending demo request and suppresses stale selection');
  const output=path.join(rootPath,'verification/ckd-evidence-v55');fs.mkdirSync(output,{recursive:true});const report={status:'passed',checks:checks.length,checksDetail:checks,engine:'React 19 + jsdom 26; mocked API transport, real controlled components and request serialization',limitations:'No native browser layout, modal focus trap, live Spring HTTP or live PostgreSQL verification'};fs.writeFileSync(path.join(output,'dom-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 } finally {await act(async()=>root.unmount());dom.window.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
