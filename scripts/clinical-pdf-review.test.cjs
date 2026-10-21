const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const mod={exports:{}};new Function('exports','module',ts.transpileModule(fs.readFileSync('src/lib/clinicalPdfReview.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod.exports,mod);
const {pdfReviewCandidates,conflictingPdfFeatures}=mod.exports;
const report=(hash,value,extra={})=>({success:true,fingerprint:hash,fileName:'same.pdf',source:'UPLOADED_PDF',identityStatus:'MATCHED',extractedValues:{SerumCreatinine:{feature:'SerumCreatinine',value,unit:'mg/dL',originalValue:value,originalUnit:'mg/dL',originalText:`Creatinine ${value} mg/dL`}},...extra});
test('re-reading the same content deduplicates candidates without mutating the source or form',()=>{
 const input=[report('hash-a',1.4),report('hash-a',1.4)],before=JSON.stringify(input),form={SerumCreatinine:2.1};
 const groups=pdfReviewCandidates(input);assert.equal(groups.SerumCreatinine.length,1);assert.equal(JSON.stringify(input),before);assert.equal(form.SerumCreatinine,2.1);assert.equal(groups.SerumCreatinine[0].sourceVerified,false);assert.equal(groups.SerumCreatinine[0].clinicalDate,undefined);
});
test('different content with the same filename preserves competing candidates and does not select a winner',()=>{
 const groups=pdfReviewCandidates([report('hash-a',1.4),report('hash-b',1.1)]);assert.equal(groups.SerumCreatinine.length,2);assert.deepEqual(conflictingPdfFeatures(groups),['SerumCreatinine']);assert.deepEqual(groups.SerumCreatinine.map(v=>v.value),[1.4,1.1]);
});
test('OCR failure, identity mismatch, invalid values and missing features never become candidates',()=>{
 const groups=pdfReviewCandidates([report('a',1.4,{success:false}),report('b',1.4,{identityStatus:'MISMATCH'}),report('c',NaN)]);assert.deepEqual(groups,{});assert.equal(groups.Edema,undefined);
});
test('saved source references and original values survive normalization without inventing a collection date',()=>{
 const source=report('hash',1.403,{clinicalReportId:'saved-id',documentId:'attachment-id',reportDates:{reportDate:'2026-09-28'}});source.extractedValues.SerumCreatinine.originalValue=124;source.extractedValues.SerumCreatinine.originalUnit='umol/L';const c=pdfReviewCandidates([source]).SerumCreatinine[0];assert.equal(c.reportId,'saved-id');assert.equal(c.originalValue,124);assert.equal(c.reportDate,'2026-09-28');assert.equal(c.clinicalDate,undefined);
});

test('competing values from one PDF remain separate candidates requiring source selection',()=>{
 const first=report('same-content',1.4),second=report('same-content',2.1);
 const source={...first,extractedValues:{},measurementCandidates:{SerumCreatinine:[first.extractedValues.SerumCreatinine,second.extractedValues.SerumCreatinine]}};
 const groups=pdfReviewCandidates([source]);assert.equal(groups.SerumCreatinine.length,2);assert.deepEqual(conflictingPdfFeatures(groups),['SerumCreatinine']);
 assert.ok(groups.SerumCreatinine.every(candidate=>candidate.sourceVerified===false&&candidate.importReviewed===true));
});

test('mismatched reports cannot contribute candidates through either response representation',()=>{
 const source=report('wrong-patient',1.4,{identityStatus:'MISMATCH'});source.measurementCandidates={SerumCreatinine:[source.extractedValues.SerumCreatinine]};
 assert.deepEqual(pdfReviewCandidates([source]),{});
});

test('only explicit server-designated test documents retain mismatched measurements for review',()=>{
 const source=report('synthetic',1.4,{identityStatus:'MISMATCH',syntheticPatient:true,documentClassification:'TEST_DOCUMENT'});
 assert.equal(pdfReviewCandidates([source]).SerumCreatinine.length,1);
 assert.equal(pdfReviewCandidates([source]).SerumCreatinine[0].sourceVerified,false);
 assert.deepEqual(pdfReviewCandidates([{...source,syntheticPatient:false}]),{});
 assert.deepEqual(pdfReviewCandidates([{...source,documentClassification:'CLINICAL_DOCUMENT'}]),{});
});
