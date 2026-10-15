import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
const db = new PGlite({ extensions: { pgcrypto } });
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };
const rejects = async (query, params, message) => { await assert.rejects(db.query(query, params), undefined, message); checks++; };
const h = "00000000-0000-4000-8000-000000000001", p = "00000000-0000-4000-8000-000000000002";
const model = "GOVCARE-CKD-LOGISTIC-1.0";
const keys = ["ckd", "ckd_progression", "kfre", "aki", "cardiovascular", "hyperkalemia", "anemia"];
const snapshot = () => ({ schemaVersion: 1, capturedAt: "2026-10-07T12:00:00Z", entries: keys.map(key => ({ key, label: key,
  status: key === "ckd" ? "AVAILABLE" : "NOT_AVAILABLE", probability: key === "ckd" ? .32145 : null,
  modelVersion: key === "ckd" ? model : "not-installed", horizon: key === "ckd" ? "Current assessment" : "Not available",
  validationStatus: key === "ckd" ? "EXISTING_MODEL" : "NOT_INSTALLED", reason: "Synthetic database test fixture", purpose: "Model output contract" })) });
try {
  const dir = new URL("../spring-api/src/main/resources/db/migration/", import.meta.url);
  const files = (await readdir(dir)).filter(f => /^V\d+__.*\.sql$/.test(f)).sort((a, b) => Number(a.match(/^V(\d+)/)[1]) - Number(b.match(/^V(\d+)/)[1]));
  for (const file of files) await db.exec(await readFile(new URL(file, dir), "utf8"));
  check(files.at(-1).startsWith("V40__"), "Complete schema chain through V40 applied");
  await db.query("insert into hospitals(id,code,name) values($1,'PROB-QA','Synthetic fixture hospital')", [h]);
  await db.query("insert into patients(id,hospital_id,patient_no,full_name,date_of_birth) values($1,$2,'PROB-QA','SYNTHETIC TEST FIXTURE','1970-01-01')", [p, h]);
  const service = await readFile(new URL("../spring-api/src/main/java/lk/gov/health/govcare/ai/CkdPredictionService.java", import.meta.url), "utf8");
  const insert = service.match(/sql\.required\("(insert into ai_ckd_predictions[^"\n]+)"/)[1];
  const values = { hospital: h, patient: p, probability: .32145, category: "LOW", confidence: .99, predictedClass: "0", input: "{}", factors: "[]", recommendations: "[]", model, request: "synthetic-database-test", actor: null, diseaseProbabilities: JSON.stringify(snapshot()) };
  const names = [], params = [];
  const actualInsert = insert.replace(/(?<!:):([A-Za-z][A-Za-z0-9_]*)/g, (_, name) => {
    if (!names.includes(name)) { assert.ok(name in values, `Unknown parameter ${name}`); names.push(name); params.push(values[name]); }
    return `$${names.indexOf(name) + 1}`;
  });
  const { rows } = await db.query(actualInsert, params); checks++;
  const saved = await db.query("select disease_probability_snapshot from ai_ckd_predictions where id=$1", [rows[0].id]);
  check(saved.rows[0].disease_probability_snapshot.entries[0].probability === .32145, "Production insert preserves actual probability");
  check(saved.rows[0].disease_probability_snapshot.entries.slice(1).every(e => e.probability === null), "Unavailable outputs stored as nulls");
  await rejects("update ai_ckd_predictions set disease_probability_snapshot=$1 where id=$2", [JSON.stringify({}), rows[0].id], "Snapshot cannot be rewritten");
  await db.query("update ai_ckd_predictions set disease_probability_snapshot=disease_probability_snapshot where id=$1", [rows[0].id]); checks++;
  await rejects("update ai_ckd_predictions set probability=.9 where id=$1", [rows[0].id], "Current probability cannot diverge from stored snapshot");
  const valid = async s => (await db.query("select govcare_valid_disease_probability_snapshot_v2($1::jsonb,.32145,$2) valid", [s === null ? null : JSON.stringify(s), model])).rows[0].valid;

  // Database layer enforces durable invariants; Java record validation enforces richer display metadata.
  for (const alteration of [
    s => delete s.schemaVersion,
    s => s.schemaVersion = 2,
    s => s.entries.pop(),
    s => s.entries[1] = s.entries[0],
    s => s.entries[1].key = "foreign",
    s => s.entries[1].probability = .5,
    s => s.entries[0].probability = 50,
    s => s.entries[0].probability = -.1,
    s => s.entries[0].probability = .9,
    s => s.entries[0].modelVersion = "other-model",
    s => delete s.entries[1].status,
    s => s.entries[1].status = "AVAILABLE"
  ]) {
    const value = snapshot(); alteration(value); check(await valid(value) === false, "Invalid durable probability invariant rejected");
  }
  check(await valid(snapshot()), "Complete valid snapshot accepted");
  check(await valid(null), "Historical SQL null is supported without backfill");
  const omittedNull = snapshot(); for (const entry of omittedNull.entries.slice(1)) delete entry.probability;
  check(await valid(omittedNull), "Unavailable outputs may omit the null probability property");

  const related = snapshot(); Object.assign(related.entries[1], { status: "AVAILABLE", probability: .25, modelVersion: "SYNTHETIC-VALIDATED-TEST-MODEL", validationStatus: "VALIDATED", horizon: "12 months" });
  check(await valid(related), "Future model adapter can persist a real numeric output with provenance");
  const registry = await db.query("select model_key,version,status,runtime_status from predictive_model_registry order by model_key,version");
  check(registry.rows.some(r => r.model_key === "egfr_trajectory" && r.version === "trend-linear-1.0" && r.runtime_status === "RETIRED"), "Historical V37 trajectory runtime remains registered and is retired");
  check(registry.rows.some(r => r.model_key === "egfr_trajectory" && r.version === "trend-linear-2.0" && r.runtime_status === "ACTIVE"), "Governed V40 trajectory runtime is active");
  check(registry.rows.filter(r => ["ckd_progression","kfre","aki","hyperkalemia","cardiovascular","anemia"].includes(r.model_key)).every(r => r.version === "not-installed"), "Future disease models remain not installed");
  console.log(`Disease probability migration checks passed: ${checks}; ${files.length} migrations (isolated PGlite, no live hospital connection).`);
} finally { await db.close(); }
