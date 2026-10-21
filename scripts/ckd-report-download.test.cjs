const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function harness(response){
 const result={},calls={downloads:0,timers:[],requests:[]};
 const source=fs.readFileSync(require('node:path').join(__dirname,'../src/services/aiCdssService.ts'),'utf8').replaceAll('import.meta.env','__env');
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const anchor={click(){calls.downloads++},remove(){}};
 vm.runInNewContext(code,{exports:result,require:()=>({}),__env:{VITE_API_BASE_URL:'http://synthetic.invalid'},
  localStorage:{getItem:()=> 'SYNTHETIC-TEST-TOKEN'},crypto:require('node:crypto').webcrypto,DOMException,AbortSignal,
  fetch:async(url,options)=>{calls.requests.push({url,options});if(response instanceof Error)throw response;return response;},
  document:{createElement:()=>anchor,body:{appendChild(){}}},
  URL:{createObjectURL:()=> 'blob:synthetic',revokeObjectURL:()=>{calls.revoked=true}},
  window:{setTimeout:(callback,delay)=>calls.timers.push({callback,delay})}});
 return {result,calls};
}
test('valid saved PDFs use authenticated uncached requests and allow the browser to consume the blob',async()=>{
 const {result,calls}=harness(new Response('%PDF-SYNTHETIC SOFTWARE TEST',{headers:{'Content-Type':'application/pdf'}}));
 await result.downloadGeneratedCkdReport({id:'synthetic',fileName:'synthetic.pdf'});
 assert.equal(calls.downloads,1);assert.equal(calls.requests[0].options.headers.Authorization,'Bearer SYNTHETIC-TEST-TOKEN');
 assert.equal(calls.requests[0].options.cache,'no-store');assert.equal(calls.requests[0].options.mode,'cors');
 assert.equal(calls.revoked,undefined);assert.ok(calls.timers[0].delay>=1000);calls.timers[0].callback();assert.equal(calls.revoked,true);
});
test('an HTML/JSON or malformed PDF response cannot be saved as a clinical PDF',async()=>{
 for(const response of [new Response('{"error":"synthetic"}',{headers:{'Content-Type':'application/json'}}),new Response('invalid',{headers:{'Content-Type':'application/pdf'}})]){
  const {result,calls}=harness(response);await assert.rejects(result.downloadGeneratedCkdReport({id:'synthetic'}),/not a valid PDF/);assert.equal(calls.downloads,0);
 }
});
test('a cancelled patient request cannot trigger a delayed report download',async()=>{
 const {result,calls}=harness(new Response('%PDF-SYNTHETIC',{headers:{'Content-Type':'application/pdf'}}));
 const controller=new AbortController();controller.abort();
 await assert.rejects(result.downloadGeneratedCkdReport({id:'synthetic'},controller.signal),{name:'AbortError'});assert.equal(calls.downloads,0);
});

test('network errors explain how to recover without exposing raw Failed to fetch',async()=>{
 const {result,calls}=harness(new TypeError('Failed to fetch'));
 await assert.rejects(result.downloadGeneratedCkdReport({id:'synthetic'}),error=>/Cannot reach the report service/.test(error.message)&&!/Failed to fetch/.test(error.message));assert.equal(calls.downloads,0);
});
test('expired sessions remain blocked and explain sign-in recovery',async()=>{
 const {result,calls}=harness(new Response('{}',{status:401,headers:{'Content-Type':'application/json'}}));await assert.rejects(result.downloadGeneratedCkdReport({id:'synthetic'}),/session expired/);assert.equal(calls.downloads,0);
});
