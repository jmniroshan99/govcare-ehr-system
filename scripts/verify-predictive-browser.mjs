import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Live local installation only. This script does not mock APIs, fabricate data or bypass authentication.
const site=new URL(process.env.GOVCARE_VISUAL_URL??"http://127.0.0.1:5300");
const api=new URL(process.env.GOVCARE_VISUAL_API??"http://127.0.0.1:4002");
for(const url of [site,api])assert.ok(["localhost","127.0.0.1","[::1]"].includes(url.hostname),"Use a local test installation.");
if(!process.env.GOVCARE_VISUAL_ACCOUNTS)throw new Error("Set GOVCARE_VISUAL_ACCOUNTS to a private local JSON array of enabled test accounts: {role,email,password,patientId,forbiddenPatientId?}. Use test patients and complete temporary-password changes first.");
const accounts=JSON.parse(await fs.readFile(process.env.GOVCARE_VISUAL_ACCOUNTS,"utf8"));
for(const role of ["super_admin","doctor","patient"])assert.ok(accounts.some(a=>a.role===role),`Missing ${role} test account`);
const module=process.env.GOVCARE_PLAYWRIGHT_MODULE?pathToFileURL(resolve(process.env.GOVCARE_PLAYWRIGHT_MODULE)).href:"playwright";
const {chromium}=await import(module);
const output=resolve(process.env.GOVCARE_VISUAL_OUTPUT??"verification/predictive-screenshots");
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch();const report=[];
try {
  for(const account of accounts) {
    assert.match(account.role,/^[a-z_]+$/);assert.match(account.patientId,/^[0-9a-f-]{36}$/i);
    const context=await browser.newContext({viewport:{width:1366,height:1000},reducedMotion:"reduce"});
    try {
      const page=await context.newPage(),errors=[];let intelligenceRequests=0;
      page.on("pageerror",e=>errors.push(e.message));page.on("request",request=>{if(new URL(request.url()).pathname.endsWith("/intelligence"))intelligenceRequests++;});
      await page.goto(new URL("/login",site).href);
      await page.locator('input[type="email"]').fill(account.email);await page.locator('input[type="password"]').fill(account.password);
      await page.getByRole("button",{name:"Login",exact:true}).click();
      await page.waitForURL(url=>!url.pathname.endsWith("/login"),{timeout:30000});
      const token=await page.evaluate(()=>localStorage.getItem("govcare-api-token"));assert.ok(token,"Authenticated API token required");
      const headers={Authorization:`Bearer ${token}`};
      const endpoint=`/api/ai-cdss/ckd/patients/${account.patientId}/intelligence`;
      const response=await context.request.get(new URL(endpoint,api).href,{headers});
      const allowed=["super_admin","doctor","surgeon","anesthetist"].includes(account.role);
      if(!allowed) {
        assert.ok([403,404].includes(response.status()),`${account.role} must be denied by the backend`);
        await page.goto(new URL("/ai-cdss/ckd/predictive-intelligence",site).href);
        await page.waitForURL(url=>!url.pathname.endsWith("/predictive-intelligence"));
        report.push({role:account.role,backendAccess:"denied",routeAccess:"denied"});continue;
      }
      assert.equal(response.status(),200,`${account.role} authorized patient read`);const payload=await response.json();
      assert.equal(payload.patient.id,account.patientId,"Patient identity must match scoped response");
      if(account.forbiddenPatientId&&account.role!=="super_admin") {
        const forbidden=await context.request.get(new URL(`/api/ai-cdss/ckd/patients/${account.forbiddenPatientId}/intelligence`,api).href,{headers});
        assert.ok([403,404].includes(forbidden.status()),"Other/unassigned patient cannot be read");
      }
      await page.goto(new URL(`/ai-cdss/ckd/predictive-intelligence?patientId=${account.patientId}`,site).href);
      await page.waitForURL(url=>url.pathname==="/ai-cdss/ckd"&&url.searchParams.get("view")==="intelligence");
      await page.locator(".pci-summary-grid").waitFor();
      assert.equal(await page.getByRole("combobox",{name:"Select authorized patient",exact:true,includeHidden:true}).count(),1,"Both views share one authorized patient selector");
      await page.getByRole("tab",{name:/^CKD risk assessment/}).click();
      const clinicalInput=page.locator('#ckd-assessment-panel input[type="number"]').first();
      const recordedValue=await clinicalInput.inputValue();
      await page.getByRole("tab",{name:/^Predictive clinical intelligence/}).click();
      await page.locator(".pci-summary-grid").waitFor();
      await page.getByRole("tab",{name:/^CKD risk assessment/}).click();
      assert.equal(await clinicalInput.inputValue(),recordedValue,"Changing views preserves assessment values");
      await page.getByRole("tab",{name:/^Predictive clinical intelligence/}).click();
      await page.locator(".pci-summary-grid").waitFor();
      for(const width of [375,768,1366,1920]) {
        await page.setViewportSize({width,height:1080});
        for(const mode of ["dark","light"]) {
          const before=intelligenceRequests;
          if(await page.locator("html").getAttribute("data-theme")!==mode)await page.getByRole("button",{name:`Switch to ${mode} mode`,exact:true}).click();
          await page.waitForFunction(expected=>document.documentElement.dataset.theme===expected,mode);
          const layout=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,content:document.documentElement.scrollWidth,
            clipped:[...document.querySelectorAll(".pci-workspace h1,.pci-workspace h2,.pci-summary-value strong,.pci-risk-card h3")].filter(e=>e.clientWidth>0&&e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflowX==="hidden").map(e=>e.textContent),
            theme:document.documentElement.dataset.theme}));
          assert.ok(layout.content<=layout.viewport+1,`${mode}/${width}: horizontal overflow`);assert.equal(layout.clipped.length,0,"No hidden headings");
          assert.equal(intelligenceRequests,before,"Theme change must not refetch clinical data");assert.equal(errors.length,0,"No browser runtime errors");
          const filename=`${account.role}-${mode}-${width}.png`;await page.screenshot({path:resolve(output,filename),fullPage:true,animations:"disabled"});
          report.push({role:account.role,mode,width,layout,screenshot:filename});
        }
      }
      await page.setViewportSize({width:1366,height:1000});
      const requestsBefore=intelligenceRequests;
      await page.getByRole("button",{name:"Trends",exact:true}).click();await page.getByRole("combobox",{name:"Chart measurement"}).selectOption("creatinine");
      await page.getByRole("button",{name:"3M",exact:true}).click();assert.equal(intelligenceRequests,requestsBefore,"Chart controls use the existing aggregate response");
      await page.getByRole("button",{name:/Care gaps/}).click();
      const review=page.getByRole("button",{name:/^(Review finding|Update review)$/}).first();
      if(await review.count()&&await review.isEnabled()) {
        await review.click();await page.getByRole("dialog").waitFor();
        assert.equal(await page.locator(".pci-dialog textarea[aria-required='true']").count(),1,"Clinical reason required");
        await page.getByRole("button",{name:"Cancel",exact:true}).click();
        await page.getByRole("dialog").waitFor({state:"hidden"});
        const focus=await review.evaluate(e=>document.activeElement===e);assert.ok(focus,"Focus returns to the initiating review button");
      }
      report.push({role:account.role,chartControls:"no refetch",reviewDialog:"checked when available",runtimeErrors:errors.length});
    } finally {await context.close();}
  }
} finally {await browser.close();await fs.writeFile(resolve(output,"browser-report.json"),JSON.stringify(report,null,2));}
console.log(`Live clinical workspace checks passed. Report: ${output}`);
