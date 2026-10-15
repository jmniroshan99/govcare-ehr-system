import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();

try {
  await db.exec(`
    create table patients (
      id uuid primary key,
      hospital_id uuid not null,
      status text not null default 'active',
      created_at timestamptz not null default now()
    )
  `);

  const migration = await readFile(
    new URL("../spring-api/src/main/resources/db/migration/V34__patient_registration_workflow.sql", import.meta.url),
    "utf8",
  );
  await db.exec(migration);

  const hospitalId = "00000000-0000-0000-0000-000000000001";
  await db.query("insert into patients(id, hospital_id) values ($1, $2)", [
    "00000000-0000-0000-0000-000000000101",
    hospitalId,
  ]);
  await db.query("insert into patients(id, hospital_id, registration_type) values ($1, $2, $3)", [
    "00000000-0000-0000-0000-000000000102",
    hospitalId,
    "emergency",
  ]);

  const registrationTypes = await db.query(
    "select registration_type from patients order by id",
  );

  let invalidTypeRejected = false;
  try {
    await db.query("insert into patients(id, hospital_id, registration_type) values ($1, $2, $3)", [
      "00000000-0000-0000-0000-000000000103",
      hospitalId,
      "invalid",
    ]);
  } catch {
    invalidTypeRejected = true;
  }

  const indexes = await db.query(
    "select indexname from pg_indexes where tablename = 'patients' and indexname = 'idx_patients_hospital_registration_type_created'",
  );

  const result = {
    defaultRegistrationType: registrationTypes.rows[0]?.registration_type,
    explicitRegistrationType: registrationTypes.rows[1]?.registration_type,
    invalidTypeRejected,
    indexCreated: indexes.rows.length === 1,
  };

  console.log(JSON.stringify(result, null, 2));

  if (
    result.defaultRegistrationType !== "walk_in"
    || result.explicitRegistrationType !== "emergency"
    || !result.invalidTypeRejected
    || !result.indexCreated
  ) {
    process.exitCode = 1;
  }
} finally {
  await db.close();
}
