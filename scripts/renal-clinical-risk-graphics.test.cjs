const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('active assessment replaces the legacy disease probability panel with the authorized renal workspace',()=>{
 const dashboard=read('src/components/ai/CKDRiskResultDashboard.tsx');assert.match(dashboard,/patient\.id===result\.patientId/);assert.match(dashboard,/<SriLankanRenalPanel/);assert.doesNotMatch(dashboard,/<DiseaseProbabilityPanel/);
});
test('live six modules are sourced from the patient-scoped Spring contract',()=>{
 const panel=read('src/components/ai/SriLankanRenalPanel.tsx'),service=read('src/services/renalIntelligenceService.ts');assert.match(panel,/getRenalPredictiveIntelligence\(patient\.id/);assert.match(panel,/result\.patientId !== patient\.id/);assert.match(panel,/result\.hospitalId !== patient\.hospital_id/);assert.match(panel,/<RenalClinicalModules/);assert.match(service,/predictive-intelligence\/reviews/);assert.doesNotMatch(service,/http:\/\/.*8000/);
});
test('missing data and directional percentages are labelled without manufactured probabilities',()=>{
 const component=read('src/components/ai/RenalClinicalModules.tsx');assert.match(component,/not a disease probability/);assert.match(component,/Research score/);assert.doesNotMatch(component,/researchRiskScore\*100/);assert.match(component,/researchRiskScore!=null/);assert.match(component,/directionalPercent!=null/);assert.match(component,/not independently validated diagnoses/);
});
test('research illustration is retained and six cards have desktop tablet mobile layouts',()=>{
 assert.ok(fs.statSync(path.join(root,'public/research/ckd-risk-predictive-intelligence-v45.png')).size>100000);
 const css=read('src/components/ai/renal-clinical-modules.css');assert.match(css,/repeat\(3,minmax\(0,1fr\)\)/);assert.match(css,/repeat\(2,minmax\(0,1fr\)\)/);assert.match(css,/@media\(max-width:680px\)/);
});
