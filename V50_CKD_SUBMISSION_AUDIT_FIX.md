# V50 — CKD submission audit persistence fix

The V49 clinical-feature capture hook could abort every new CKD assessment with a database error. V50 corrects that audit insert and adds a regression through the actual PostgreSQL JDBC driver, Spring SQL helpers, patient authorization and assessment transaction. The existing assessment, feature mapping, six-card UI, PDF, research eligibility and clinician workflow are retained.

## Confirmed cause

The screenshot reports HTTP 500 with error reference `50F1B394`. A screenshot contains no server exception, so its particular error-ID match cannot be established without the Windows Spring log.

Independently, the exact V49 production save path was reproduced against all 44 shipped migration files through JDBC. `ClinicalPredictionFeatureService.capture()` inserted `actor_email` and `details` into `audit_logs`; neither column exists. PostgreSQL returned **SQLSTATE 42703**, `column "actor_email" of relation "audit_logs" does not exist`. Spring translated that to `BadSqlGrammarException`, which the existing generic exception handler reports as HTTP 500.

The same insert also omitted the required `module` and bound a string directly to the `user_role` enum. These were corrected together against the established schema. The defect occurred after input and feature persistence but inside the enclosing CKD transaction, causing those writes to roll back. V49's earlier mocked save tests did not execute this audit SQL against the database and missed the mismatch.

## Change and compatibility

Only `ClinicalPredictionFeatureService.java` changes production behavior:

- Existing columns are used: `hospital_id`, `actor_id`, `actor_role`, `module`, `action`, `entity_type`, `entity_id`, `after_state`.
- The audit module is `ai_cdss` and the role uses `cast(:role as user_role)`.
- `after_state` records the saved assessment ID and normalization version.
- Patient-derived hospital scoping and the existing audit action remain in use.
- Audit persistence remains mandatory in the assessment transaction. A genuine audit failure still rolls back the assessment; the error is not swallowed or bypassed.

**Database:** No new migration. All migrations through V45 remain byte-for-byte unchanged. A V48-or-earlier database still needs the already shipped additive V45 during normal Spring startup.

**API:** Existing routes, input fields, response fields, permissions and request-ID behavior are retained. Successful persistence allows the existing response and downstream normalized measurements to be returned.

**UI/PDF/ML:** The V49 integration remains present. Its original frontend build, feature mapping, PDF export and model artifacts are retained. This fix adds no model, diagnosis or probability.

`MODIFIED_FILES_V50_CKD_SUBMISSION_FIX.txt` contains the exact release delta. Earlier reports and evidence are preserved.

## Fresh verification

| Check | Result | Actual boundary |
|---|---|---|
| Immutable V49 regression | Expected failure: 4 errors and 1 assertion failure, all caused by the invalid audit insert | Exact old production class, same five JDBC checks, all 44 migrations |
| Corrected submission checks | **5 passed; zero failures/errors/skips** | Real `CkdPredictionService`, `ClinicalPredictionFeatureService`, `ClinicalPatientAccess`, `SqlSupport`, PostgreSQL JDBC and Spring transactions |
| Typed JDBC successful submissions | **4 passed** | Extended protocol; values, dates, enum cast, duplicate protection and network scope |
| Complete Spring suite | **201 passed; zero failures/errors/skips** | Includes the five opt-in JDBC checks and all 46 production controller mappings |
| Client/API/startup regression | **95 passed** | Existing client, renal, clinical-feature, workspace, units and launcher contracts |
| Feature migration/backfill regression | **31 checks passed**, plus its 7 client checks | Existing assessment values/dates/units, tenant constraints, immutability and no manufactured dialysis data |
| Portable fixture launcher | **Passed** | Separate QA dependencies, all migrations, loopback socket, clean startup/shutdown |

The five persistence checks cover:

1. Manual undated submission: all 17 observations/inputs, the normalized projection, its audit and three FHIR resources persist. Potassium 2 and Hb 3 from the screenshot's visible fields are retained as measurements, not invented forecasts.
2. Dated submission: explicit clinical dates survive the JDBC round trip.
3. Repeated request UUID: HTTP-level conflict semantics are retained and no second assessment/audit is created.
4. Deliberately injected audit failure: no assessment, projection, observations, audit or FHIR resource survives the rolled-back save.
5. Network Super Admin: the selected patient's hospital scopes the feature projection and audit, including a different home hospital.

The database is isolated **PGlite PostgreSQL WASM exposed over TCP**, not native Windows PostgreSQL. The driver and Spring transaction are real. One JDBC session makes the single-backend adapter deterministic. Extended protocol was verified for successful saves; simple protocol was used for the combined suite and the intentionally failing audit, because the socket adapter did not reliably resynchronize after a deliberately raised database exception in extended mode. This is test-harness configuration only; production Hikari settings are unchanged. Intermediate harness failures were investigated rather than treated as application failures.

Operational fixtures contain no private clinical subjects. Clinical validation, an authenticated private-patient browser session and native Windows/PostgreSQL execution are not claimed. Previous V49 browser/PDF/Django evidence is retained as prior verification; it is not relabeled as a fresh V50 run.

## Use V50 on the existing machine

1. Stop the existing full-stack launcher and its Spring process.
2. Extract the complete V50 archive into a new folder.
3. Copy the existing private runtime configuration into the matching locations. Retain the existing PostgreSQL patient database.
4. From the new project folder, run `npm ci` if dependencies are not installed, then run `start-renal-fullstack-windows.bat`.
5. Retry the CKD assessment. Confirm the saved assessment appears in history, that its measurements populate the renal cards, and that PDF export includes them.

Do not edit old migration checksums or reset the patient database. If a 500 remains, copy the full Spring Boot console exception around its displayed error ID; that log distinguishes a remaining target-machine issue from the reproduced V49 audit defect.

## Repeat the JDBC regression in a disposable fixture

Application dependencies are unchanged. Install optional fixture tools into a separate directory from the project root:

```powershell
npm install --prefix ../govcare-ckd-qa-tools --no-audit --no-fund --ignore-scripts --legacy-peer-deps @electric-sql/pglite@0.5.9 @electric-sql/pglite-socket@0.2.12
node verification/ckd-submission-v50/start-jdbc-fixture.mjs ../govcare-ckd-qa-tools
```

Keep that console running. In another console, from the project root with Java 21 and Maven available:

```powershell
mvn -f spring-api/pom.xml test -Dtest=CkdSubmissionPersistenceJdbcTest -Dgovcare.ckd.persistence.jdbc=true "-Dgovcare.ckd.persistence.url=jdbc:postgresql://127.0.0.1:55450/postgres?sslmode=disable&gssEncMode=disable&prepareThreshold=0&preferQueryMode=simple"
```

Omit `-Dtest=CkdSubmissionPersistenceJdbcTest` to run the complete suite with these checks enabled. Press Ctrl+C in the fixture console afterward. The server creates a fresh memory-only database and accepts no patient database URL. The Java test requires its explicit opt-in flag, loopback URL and QA marker before writing any fixture rows. Normal Maven runs skip these five external-database checks unless enabled.

See `verification/ckd-submission-v50/` for baseline/fixed/typed/full logs, validation summary, source diff and preservation evidence.
