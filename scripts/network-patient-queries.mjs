import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { join } from "node:path";

// Execute the production SQL, rather than reproducing a directory query in the test.
export async function verifyNetworkPatientQueries(db, root, t) {
  const java = await fs.readFile(join(root, "spring-api/src/main/java/lk/gov/health/govcare/patient/NetworkPatientDirectory.java"), "utf8");
  const filter = java.match(/String FILTER = """([\s\S]*?)"""/)[1];
  const rows = java.match(/rows = sql.list\("""([\s\S]*?)""" \+ FILTER \+ "([^"]+)"/);
  const rowSql = rows[1] + filter + rows[2];
  const hospitalSql = java.split("public List<Map<String, Object>> hospitals")[1].match(/sql.list\("""([\s\S]*?)"""/)[1];
  const repo = await fs.readFile(join(root, "spring-api/src/main/java/lk/gov/health/govcare/patient/PatientRepository.java"), "utf8");
  const matchSql = repo.match(/@Query\(value = """([\s\S]*?)""", nativeQuery = true\)/)[1];
  async function query(sql, params) {
    const names = [];
    const bound = sql.replace(/(?<!:):([A-Za-z_]\w*)/g, (_, name) => {
      if (!names.includes(name)) names.push(name);
      assert.ok(Object.hasOwn(params, name), `Missing SQL parameter ${name}`);
      return `$${names.indexOf(name) + 1}`;
    });
    return (await db.query(bound, names.map(n => params[n]))).rows;
  }
  const base = { hospital: null, ward: null, q: "", raw: "", like: "%%", limit: 50, offset: 0 };
  const browse = p => query(rowSql, { ...base, ...p });
  const count = async p => Number((await query("select count(*) total from patients p " + filter, { ...base, ...p }))[0].total);
  const hospitals = await query(hospitalSql, {});
  const demo = hospitals.filter(h => h.code.startsWith("DEMO-HOSP-"));

  await t.test("network pagination reaches every registered patient without duplicates", async () => {
    const expected = (await db.query("select id from patients where status<>'deleted' order by created_at desc,id")).rows.map(p => p.id);
    assert.equal(await count({}), expected.length);
    assert.equal(demo.length, 10);
    assert.ok(demo.every(h => h.patient_count === 400));
    const actual = [];
    for (let offset = 0; offset < expected.length; offset += 200) {
      const page = await browse({ limit: 200, offset });
      assert.ok(page.every(p => p.hospital_name && p.hospital_code));
      actual.push(...page.map(p => p.id));
    }
    assert.deepEqual(actual, expected);
    assert.equal(new Set(actual).size, actual.length);
    assert.equal((await browse({ offset: expected.length })).length, 0);
  });
  await t.test("each hospital filter returns its own 400 patients with exact totals", async () => {
    for (const hospital of demo) {
      assert.equal(await count({ hospital: hospital.id }), 400);
      const page = await browse({ hospital: hospital.id });
      assert.equal(page.length, 50);
      assert.ok(page.every(p => p.hospital_id === hospital.id && p.hospital_code === hospital.code));
    }
  });
  const patient = (await db.query("select * from patients where patient_no='PAT-NET-H10-0400'")).rows[0];
  await t.test("UUID, patient number and QR search find a patient outside the first 50 results", async () => {
    for (const term of [patient.id, patient.patient_no, patient.qr_payload].filter(Boolean)) {
      const p = { q: term.toLowerCase(), raw: term, like: `%${term}%` };
      assert.equal(await count(p), 1);
      assert.equal((await browse(p))[0].id, patient.id);
      assert.equal(await count({ ...p, hospital: demo.find(h => h.id !== patient.hospital_id).id }), 0);
    }
    assert.equal((await query(matchSql, { identifier: patient.id }))[0].id, patient.id);
  });
  await t.test("ward filters and admission labels remain in the patient's hospital", async () => {
    const ward = (await db.query("select w.id,w.hospital_id from wards w join hospitals h on h.id=w.hospital_id where h.code='DEMO-HOSP-01' and w.ward_code='DEMO-W-001'")).rows[0];
    assert.equal(await count({ ward: ward.id }), 2);
    const items = await browse({ ward: ward.id });
    assert.ok(items.every(p => p.hospital_id === ward.hospital_id && p.ward_id === ward.id && p.bed_code && p.admission_id));
    assert.equal(await count({ ward: ward.id, hospital: demo.find(h => h.id !== ward.hospital_id).id }), 0);
  });
  await t.test("cross-hospital identifier collisions are detected instead of selecting a random record", async () => {
    await db.exec("begin");
    try {
      const other = (await db.query("select id from patients where hospital_id<>$1 and patient_no like 'PAT-NET-%' limit 1", [patient.hospital_id])).rows[0];
      await db.query("update patients set patient_no=$1 where id=$2", [patient.patient_no, other.id]);
      assert.equal((await query(matchSql, { identifier: patient.patient_no })).length, 2);
      assert.equal((await query(matchSql, { identifier: patient.id })).length, 1);
    } finally { await db.exec("rollback"); }
  });
}
