import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const java = tool => process.env.JAVA_HOME ? join(process.env.JAVA_HOME,"bin",tool+(process.platform==="win32"?".exe":"")) : tool;
const output = mkdtempSync(join(tmpdir(),"govcare-predictive-domain-"));
try {
  const sources = [
    "src/main/java/lk/gov/health/govcare/ai/ClinicalIntelligenceEngine.java",
    "src/main/java/lk/gov/health/govcare/ai/ClinicalMeasurementDates.java",
    "src/main/java/lk/gov/health/govcare/ai/predictive/ClinicalDataQualityService.java",
    "src/main/java/lk/gov/health/govcare/ai/predictive/RenalSafetyGateService.java",
    "src/test/java/lk/gov/health/govcare/ai/ClinicalIntelligenceChecks.java"
  ];
  const compile = spawnSync(java("javac"),["--release","21","-d",output,...sources.map(p=>join(root,"spring-api",p))],{encoding:"utf8"});
  process.stdout.write(compile.stdout??"");process.stderr.write(compile.stderr??"");
  if(compile.error||compile.status!==0)throw new Error(compile.error?.message??"Java 21 domain compilation failed.");
  const checks = spawnSync(java("java"),["-cp",output,"lk.gov.health.govcare.ai.ClinicalIntelligenceChecks"],{encoding:"utf8"});
  process.stdout.write(checks.stdout??"");process.stderr.write(checks.stderr??"");
  if(checks.error||checks.status!==0)throw new Error(checks.error?.message??"Clinical intelligence checks failed.");
} finally { rmSync(output,{recursive:true,force:true}); }
