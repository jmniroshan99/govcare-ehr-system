const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const exportsObject={};
const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/ckdOutlook.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(code,{exports:exportsObject,Intl,Date});
const {outlookPercent,outlookHistory,outlookCohort}=exportsObject;
test('unknown, invalid and out-of-range risks never become a zero-percent result',()=>{
 for(const input of [null,undefined,NaN,Infinity,-0.1,1.1])assert.equal(outlookPercent(input),'Not estimated');
 assert.equal(outlookPercent(0),'0.0%');assert.equal(outlookPercent(.306274373471),'30.6%');assert.equal(outlookPercent(.00001),'<0.1%');
});
test('history charts preserve chronological source instants and reject invalid or undated values',()=>{
 const points=outlookHistory([{value:25,observedAt:'2026-10-12T00:00:00Z'},{value:35,observedAt:'2026-06-12T00:00:00Z'},{value:30,observedAt:null},{value:NaN,observedAt:'2026-06-12'},{value:31,observedAt:'2026-09-10',state:'INVALID'}]);
 assert.equal(points.length,2);assert.equal(points[0].value,35);assert.equal(points[1].value,25);assert.ok(points[0].time<points[1].time);assert.ok(!points.some(p=>p.forecast));
});
test('cohort explanation does not round a positive rare event to no affected patients',()=>{
 assert.match(outlookCohort(.0001),/Fewer than 1/);assert.match(outlookCohort(.30627),/31 out of 100/);assert.match(outlookCohort(null),/eligible estimate/);
});
