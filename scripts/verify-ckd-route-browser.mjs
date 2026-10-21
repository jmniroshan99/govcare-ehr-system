// Actual application route and shell; isolated browser storage and synthetic API fixtures.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const site = process.env.GOVCARE_ROUTE_QA_URL || 'http://127.0.0.1:5300';
const output = new URL('../verification/cdss-enhancement/route/', import.meta.url);
const fixtures = JSON.parse(await fs.readFile(new URL('../verification/ckd-outlook-v54/ui-fixtures.json', import.meta.url), 'utf8'));
const {chromium} = await import(process.env.GOVCARE_PLAYWRIGHT_MODULE || 'playwright');
const hospital = fixtures.available.hospitalId;
const patients = [
  {id:fixtures.available.patientId, hospital_id:hospital, full_name:'Synthetic route patient A', patient_no:'SYNTHETIC-ROUTE-A'},
  {id:'00000000-0000-4000-8000-000000000009', hospital_id:hospital, full_name:'Synthetic route patient B', patient_no:'SYNTHETIC-ROUTE-B'},
];
const deniedId = '00000000-0000-4000-8000-000000000099';
const errors = [], checks = [], requests = [];
const headers = {'access-control-allow-origin':new URL(site).origin,'access-control-allow-headers':'*','access-control-allow-methods':'GET,OPTIONS'};
let browser, page;
await fs.mkdir(output,{recursive:true});
try {
  browser = await chromium.launch({headless:true,executablePath:process.env.GOVCARE_CHROMIUM_EXECUTABLE || undefined});
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  const profile = {id:'synthetic-route-doctor',uid:'synthetic-route-doctor',role:'doctor',hospitalId:hospital,status:'active',displayName:'Synthetic QA clinician',email:'synthetic@example.invalid',permissions:['PATIENT_VIEW_CLINICAL'],mfaEnabled:false};
  await context.addInitScript(profile => {
    localStorage.setItem('govcare-auth-session',JSON.stringify({profile,sessionExpiresAt:Date.now()+1800000}));
    localStorage.setItem('govcare-local-auth-user',JSON.stringify({uid:profile.uid,email:profile.email,displayName:profile.displayName,intendedRole:profile.role}));
    localStorage.setItem('govcare-api-token','synthetic-browser-fixture-only');
  },profile);
  await context.route('**/api/**',async route => {
    const request=route.request(), url=new URL(request.url());
    if(request.method()==='OPTIONS') return route.fulfill({status:204,headers});
    requests.push({method:request.method(),path:url.pathname});
    // Every API call is intercepted; this script never writes hospital records.
    assert.equal(request.method(),'GET',`Unexpected mutation: ${url.pathname}`);
    const reply=(body,status=200)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(body)});
    if(url.pathname==='/api/auth/me') return reply(profile);
    if(url.pathname==='/api/ai-cdss/ckd/patients') return reply({items:patients,total:2});
    const patient=patients.find(p=>url.pathname===`/api/ai-cdss/ckd/patients/${p.id}`);
    if(patient) return reply({patient});
    if(url.pathname===`/api/ai-cdss/ckd/patients/${deniedId}`) return reply({message:'Synthetic unauthorized patient link'},403);
    const outlookPatient=patients.find(p=>url.pathname===`/api/ai-cdss/ckd/patients/${p.id}/outlook`);
    if(outlookPatient){
      const data=structuredClone(outlookPatient.id===patients[0].id?fixtures.available:fixtures.missing);
      data.patientId=outlookPatient.id;
      if(data.assessment) data.assessment.patientId=outlookPatient.id;
      data.readiness.learnedModel={status:'INSUFFICIENT_LONG_TERM_OUTCOME_DATA',probability:null,curve:null,reasons:[]};
      return reply(data);
    }
    if(url.pathname.endsWith('/documents')) return reply([]);
    if(url.pathname.includes('/drafts')) return reply({items:[]});
    return reply({items:[]});
  });
  page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  const selected=async view=>page.locator(`#ckd-${view}-panel-tab[aria-selected="true"]`).waitFor();
  const loaded=async()=>page.locator('.co-outcome').waitFor();
  await page.goto(`${site}/ai-cdss/ckd?view=outlook&patientId=${patients[0].id}`);
  await loaded(); await selected('outlook');
  assert.match(await page.locator('.co-patient').innerText(),/Synthetic route patient A/);
  assert.match(await page.locator('.co-probability-dial').innerText(),/30\.6%/);
  const readiness=page.getByLabel('Learned five-year research model readiness',{exact:true});
  assert.equal(await readiness.evaluate(node=>node.closest('aside')?.getAttribute('aria-label')),'Evidence and interpretation');
  await readiness.locator('summary').click();
  assert.match(await readiness.innerText(),/No learned five-year estimate is installed/);
  checks.push('Direct outlook/patient link renders the actual router, application shell and research-model evidence');
  await page.reload(); await loaded(); await selected('outlook');
  assert.equal(new URL(page.url()).searchParams.get('patientId'),patients[0].id);
  checks.push('Refresh restores the selected outlook and authorized patient');
  await page.getByRole('button',{name:'CKD assessment',exact:true}).click();
  await selected('assessment');
  assert.equal(new URL(page.url()).searchParams.get('view'),'assessment');
  assert.equal(new URL(page.url()).searchParams.get('patientId'),patients[0].id);
  await page.locator('#ckd-outlook-panel-tab').click(); await loaded();
  assert.equal(new URL(page.url()).searchParams.get('view'),'outlook');
  await page.goBack(); await selected('assessment');
  await page.goForward(); await selected('outlook'); await loaded();
  checks.push('Assessment action, workspace tabs and browser Back/Forward share URL state');
  await page.getByRole('button',{name:'Change patient',exact:true}).click();
  await page.getByRole('combobox',{name:'Select authorized patient',exact:true}).selectOption(patients[1].id);
  await loaded();
  await page.locator('.co-patient').getByText(patients[1].full_name,{exact:true}).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('patientId'),patients[1].id);
  assert.equal(new URL(page.url()).searchParams.get('view'),'outlook');
  assert.equal(await page.locator('.co-dial-empty').count(),1);
  await page.reload(); await loaded();
  assert.match(await page.locator('.co-patient').innerText(),/Synthetic route patient B/);
  checks.push('Patient switching updates the deep link, removes the prior estimate and survives refresh');
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});
    await page.getByLabel('Learned five-year research model readiness',{exact:true}).locator('summary').click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:fileURLToPath(new URL(`route-${width}.png`,output)),fullPage:true});
    await page.getByLabel('Learned five-year research model readiness',{exact:true}).locator('summary').click();
  }
  checks.push('Desktop and mobile route render without horizontal overflow');
  await page.evaluate(id=>{history.pushState(null,'',`/ai-cdss/ckd?view=outlook&patientId=${id}`);dispatchEvent(new PopStateEvent('popstate'));},deniedId);
  await page.getByRole('alert').filter({hasText:'Synthetic unauthorized patient link'}).waitFor();
  assert.equal(await page.locator('.co-outcome').count(),0);
  assert.ok(!requests.some(r=>r.path===`/api/ai-cdss/ckd/patients/${deniedId}/outlook`));
  checks.push('Denied patient link clears previous clinical panels before authorization and never requests its outlook');
  await page.getByRole('combobox',{name:'Select authorized patient',exact:true}).selectOption(patients[0].id);
  await loaded();
  await page.getByRole('button',{name:'Change patient',exact:true}).click();
  await page.getByRole('combobox',{name:'Select authorized patient',exact:true}).selectOption('');
  assert.equal(new URL(page.url()).searchParams.has('patientId'),false);
  assert.equal(await page.locator('.co-outcome').count(),0);
  checks.push('Clearing patient removes the identifier and clinical panels while preserving the outlook tab');
  assert.deepEqual(errors,[]);
  const report={status:'passed',site,route:'/ai-cdss/ckd',scope:'Actual React application/router/shell with intercepted synthetic API responses; no live database writes or clinical validation.',checks,requests,runtimeErrors:errors,browser:await browser.version()};
  await fs.writeFile(new URL('browser-report.json',output),JSON.stringify(report,null,2));
  console.log(JSON.stringify({status:report.status,checks,output:fileURLToPath(output)}));
} catch(error) {
  const failure={status:'failed',message:String(error),checks,requests,runtimeErrors:errors,url:page?.url(),body:await page?.locator('body').innerText().catch(()=>null)};
  await fs.writeFile(new URL('browser-report.json',output),JSON.stringify(failure,null,2));
  await page?.screenshot({path:fileURLToPath(new URL('route-failure.png',output)),fullPage:true}).catch(()=>{});
  console.error(JSON.stringify(failure));
  throw error;
} finally {await browser?.close();}
