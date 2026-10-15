import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import Papa from "papaparse";
import { demoCommand } from "./seed-demo-network.mjs";
import { verifyNetworkPatientQueries } from "./network-patient-queries.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const seed = await fs.readFile(join(root, "database/postgresql/seed-demo-network.sql"), "utf8");
const verify = await fs.readFile(join(root, "database/postgresql/verify-demo-network.sql"), "utf8");
const clinicalSource = await fs.readFile(join(root, "spring-api/src/main/java/lk/gov/health/govcare/security/ClinicalPatientAccess.java"), "utf8");
const scopeSql = clinicalSource.split("public List<UUID> visiblePatientIds")[1].match(/sql\.list\("""([\s\S]*?)"""/)[1]
  .replace(/:h\b/g, "$1").replace(/:u\b/g, "$2");
const csv = Papa.parse(await fs.readFile(join(root, "database/postgresql/demo-network-credentials.csv"), "utf8"), { header: true, skipEmptyLines: true });
assert.equal(csv.errors.length, 0);

test("loader refuses remote/production connections and preserves argument boundaries", () => {
  const isolatedRoot = join(root, "test-only-no-env");
  assert.throws(() => demoCommand("seed", { DB_URL: "jdbc:postgresql://hospital.example/real" }, isolatedRoot), /localhost/);
  assert.throws(() => demoCommand("seed", { NODE_ENV: "production" }, isolatedRoot), /production/);
  assert.throws(() => demoCommand("seed", { SPRING_PROFILES_ACTIVE: "dev,prod" }, isolatedRoot), /production/);
  assert.throws(() => demoCommand("seed", { DB_URL: "jdbc:postgresql://localhost/test?sslmode=disable" }, isolatedRoot));
  assert.throws(() => demoCommand("unknown", {}, isolatedRoot), /mode/);
  const request = demoCommand("seed", { DB_URL: "jdbc:postgresql://localhost:5432/qa_db", DB_PASSWORD: "private-test-value" }, isolatedRoot);
  assert.equal(request.config.database, "qa_db");
  assert.ok(request.args.includes("set govcare.allow_demo_seed = 'on'"));
  assert.ok(!request.args.includes("private-test-value"));
  assert.equal(request.env.PGPASSWORD, "private-test-value");
  assert.ok(!demoCommand("verify", {}, isolatedRoot).args.includes("set govcare.allow_demo_seed = 'on'"));
});

test("full V1-V32 PostgreSQL schema and the linked ten-hospital dataset", { timeout: 180000 }, async (t) => {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.waitReady;
  t.after(() => db.close());
  const migrations = join(root, "spring-api/src/main/resources/db/migration");
  const files = (await fs.readdir(migrations)).filter(f => /^V\d+__.*\.sql$/.test(f))
    .sort((a, b) => Number(a.match(/^V(\d+)/)[1]) - Number(b.match(/^V(\d+)/)[1]));
  for (const file of files) await db.exec(await fs.readFile(join(migrations, file), "utf8"));
  await db.exec("create table flyway_schema_history(version text, success boolean); insert into flyway_schema_history values('32',true)");
  const tables = ["hospitals", "departments", "app_users", "guardians", "patients", "wards", "ward_rooms", "beds", "visits", "admissions", "appointments", "opd_queue", "patient_bed_assignments"];
  async function snapshot(existingOnly = false) {
    const values = {};
    for (const table of tables) {
      const where = !existingOnly ? "" : table === "hospitals"
        ? "where t.code='NHSL'"
        : table === "ward_rooms" ? "where t.ward_id in(select w.id from wards w join hospitals h on h.id=w.hospital_id where h.code='NHSL')"
          : "where t.hospital_id=(select id from hospitals where code='NHSL')";
      values[table] = (await db.query(`select md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by t.id),'')) digest from ${table} t ${where}`)).rows[0].digest;
    }
    return values;
  }
  const legacy = await snapshot(true);

  await t.test("seed is opt-in and a failed load rolls back", async () => {
    await assert.rejects(db.exec(seed), /explicitly enabled/);
    await db.exec("rollback");
    assert.deepEqual(await snapshot(true), legacy);
    await db.exec("set govcare.allow_demo_seed='on'; update flyway_schema_history set success=false");
    await assert.rejects(db.exec(seed), /Flyway V32/);
    await db.exec("rollback; update flyway_schema_history set success=true");
    await db.exec("insert into hospitals(code,name) values('DEMO-HOSP-01','Existing unrelated hospital')");
    await assert.rejects(db.exec(seed), /reserved demo hospital code/);
    await db.exec("rollback; delete from hospitals where code='DEMO-HOSP-01'");
    await db.exec("insert into app_users(hospital_id,role,full_name,email,password_hash) select id,'doctor','Unrelated existing doctor','doctor.h01.001@govcare.test','collision-test-only' from hospitals where code='NHSL'");
    await assert.rejects(db.exec(seed), /reserved demo account identifier/);
    await db.exec("rollback; delete from app_users where email='doctor.h01.001@govcare.test'");
    assert.equal((await db.query("select count(*)::int n from hospitals where code like 'DEMO-HOSP-%'")).rows[0].n, 0);
    assert.deepEqual(await snapshot(true), legacy);
  });

  await db.exec(seed);
  await t.test("production Super Admin network directory queries", async t => {
    await verifyNetworkPatientQueries(db, root, t);
  });
  await t.test("every hospital has 400 patients, 100 doctors, 100 wards, 800 beds and correct links", async () => {
    const counts = (await db.query(`select h.code,
      (select count(*)::int from patients where hospital_id=h.id) patients,
      (select count(*)::int from app_users where hospital_id=h.id and role='doctor') doctors,
      (select count(*)::int from wards where hospital_id=h.id) wards,
      (select count(*)::int from beds where hospital_id=h.id) beds,
      (select count(*)::int from visits where hospital_id=h.id) visits,
      (select count(*)::int from admissions where hospital_id=h.id) admissions,
      (select count(*)::int from appointments where hospital_id=h.id) appointments,
      (select count(*)::int from opd_queue where hospital_id=h.id) queue
      from hospitals h where settings->>'govcare_demo_fixture'='network-v1' order by h.code`)).rows;
    assert.equal(counts.length, 10);
    for (let i = 0; i < 10; i++) assert.deepEqual(counts[i], { code: `DEMO-HOSP-${String(i + 1).padStart(2, "0")}`,
      patients: 400, doctors: 100, wards: 100, beds: 800, visits: 400, admissions: 200, appointments: 200, queue: 200 });
    await db.exec(verify);
    assert.deepEqual(await snapshot(true), legacy, "existing NHSL data changed");
  });

  await t.test("all 1,000 doctors have exactly four patients through the actual clinical-access SQL", async () => {
    const doctors = (await db.query("select id,hospital_id from app_users where role='doctor' and auth_uid like 'govcare-demo-network-v1:%'")).rows;
    assert.equal(doctors.length, 1000);
    for (const doctor of doctors) assert.equal((await db.query(scopeSql, [doctor.hospital_id, doctor.id])).rows.length, 4);
    const first = doctors[0], other = doctors.find(d => d.hospital_id !== first.hospital_id);
    assert.equal((await db.query(scopeSql, [other.hospital_id, first.id])).rows.length, 0);
    const portal = (await db.query("select count(*)::int n from app_users u join patients p on p.id=u.patient_id and p.hospital_id=u.hospital_id where u.role in ('patient','guardian') and u.auth_uid like 'govcare-demo-network-v1:%'")).rows[0];
    assert.equal(portal.n, 20);
    const wardScope = (await db.query("select u.id,count(a.id)::int n from app_users u join wards w on w.department_id=u.department_id and w.hospital_id=u.hospital_id join admissions a on a.ward_id=w.id and a.hospital_id=u.hospital_id and a.status='active' where u.role='ward_manager' and u.auth_uid like 'govcare-demo-network-v1:%' group by u.id")).rows;
    assert.equal(wardScope.length, 10);
    assert.ok(wardScope.every(x => x.n === 2));
  });

  await t.test("credential CSV matches real bcrypt hashes, role ids and first-login gates", async () => {
    assert.equal(csv.data.length, 1060);
    assert.equal(new Set(csv.data.map(r => r.username)).size, 1060);
    assert.equal(new Set(csv.data.map(r => r.initial_password)).size, 1060);
    const accounts = (await db.query("select u.email,u.password_hash,u.must_change_password,u.role::text, r.code role_code, h.code hospital_code from app_users u join roles r on r.id=u.role_id join hospitals h on h.id=u.hospital_id where u.auth_uid like 'govcare-demo-network-v1:%'")).rows;
    assert.equal(accounts.length, 1060);
    for (const account of accounts) {
      const credential = csv.data.find(r => r.username === account.email);
      assert.ok(credential && credential.initial_password.length >= 20);
      assert.equal(account.must_change_password, true);
      assert.equal(account.role, account.role_code);
      assert.equal(credential.role, account.role);
      assert.equal(credential.hospital_code, account.hospital_code);
      assert.match(account.password_hash, /^\$2a\$10\$/);
    }
    for (const role of ["doctor", "hospital_admin", "nurse", "ward_manager", "receptionist", "patient", "guardian"]) {
      const credential = csv.data.find(r => r.role === role);
      assert.equal((await db.query("select password_hash=crypt($1,password_hash) matches from app_users where email=$2", [credential.initial_password, credential.username])).rows[0].matches, true);
    }
  });

  await t.test("verification detects a foreign-hospital doctor reference", async () => {
    const visit = (await db.query("select id,doctor_id,hospital_id from visits where visit_no like 'VIS-NET-%' limit 1")).rows[0];
    const foreign = (await db.query("select id from app_users where role='doctor' and hospital_id<>$1 limit 1", [visit.hospital_id])).rows[0];
    await db.query("update visits set doctor_id=$1 where id=$2", [foreign.id, visit.id]);
    await assert.rejects(db.exec(verify), /demo visit crosses hospitals/);
    await db.exec("rollback");
    await db.query("update visits set doctor_id=$1 where id=$2", [visit.doctor_id, visit.id]);
    await db.exec(verify);
  });

  await t.test("reruns retain changed passwords, edited patients and wards, completed queues and discharged beds", async () => {
    const admission = (await db.query("select id,bed_id,patient_id from admissions where admission_no='ADM-NET-H01-0001'")).rows[0];
    await db.exec("begin");
    await db.query("update admissions set status='completed',discharged_at=now() where id=$1", [admission.id]);
    await db.query("update patient_bed_assignments set active=false,released_at=now() where admission_id=$1", [admission.id]);
    await db.query("update beds set status='CLEANING',current_patient_id=null,current_admission_id=null where id=$1", [admission.bed_id]);
    await db.query("update patients set full_name='Demo Patient Edited' where id=$1", [admission.patient_id]);
    await db.exec("update app_users set password_hash=crypt('ChangedDemoPassword!',gen_salt('bf',4)),must_change_password=false where email='doctor.h01.001@govcare.test'; update wards set name='Demo Renamed Ward' where ward_code='DEMO-W-001'; update opd_queue set queue_status='completed',completed_at=now() where token_no='DEMO-Q-H01-0003'; commit");
    const before = await snapshot();
    await db.exec(seed);
    assert.deepEqual(await snapshot(), before, "rerun reset existing records or duplicated data");
    await db.exec(verify);
  });
});
