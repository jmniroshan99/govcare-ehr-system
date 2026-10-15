# GovCare V44 — Target Windows/PostgreSQL Verification

This verification pack executes the deployment checks that could not be truthfully completed in the cloud/Linux packaging environment. It is intentionally restricted to a **loopback PostgreSQL database** and disposable local QA fixtures for mutation tests.

## What it verifies

1. **Flyway V42 on native PostgreSQL** by starting the real Spring Boot service, waiting for `/actuator/health`, and then querying `flyway_schema_history`, `predictive_model_registry`, and the three V42 constraints through `psql`.
2. **Spring Maven tests** with Java 21 and Maven 3.9+.
3. **Django renal-service tests** in `ML_Server/.venv`, including JWT authorization, input validation, Hb/URR inference, hyperkalemia research-score behavior, and unavailable dry-weight behavior.
4. **Frontend regressions + production build**, including the CKD workspace, renal graphics, PGlite migration regression, TypeScript build, and Vite production bundle.
5. **Live patient-scoped renal API verification** against a disposable local test patient. This stages two verified monthly renal observations, exercises Hb/URR/hyperkalemia inference, G5D status, data-quality rejection, authorization boundaries and clinician-review versioning.
6. **CKD PDF end-to-end export verification**. A synthetic QA CKD assessment is persisted for the authorized test patient, the server generates the report, the report is downloaded over the authenticated API, and the verifier checks the PDF MIME type, `%PDF-` signature, non-trivial file size and report persistence. Maven tests separately inspect generated PDF text for all four renal panels and the non-diagnostic warnings.

## Important V44 runtime fix

`run-renal-ml.cjs` now loads `ML_Server/.env` before starting Django. V43 generated the dedicated `GOVCARE_RENAL_JWT_SECRET` into both local `.env` files, but the Django launcher did not read its file. On a fresh Windows shell this could leave `/api/ml/health/` in a degraded state and make Spring-to-Django inference fail with service authentication not configured. The launcher now fails closed if the file/secret is missing and passes the loaded values only to the Django child process.

## Prerequisites

- Windows 10/11
- PostgreSQL running locally, with `psql` in PATH or `GOVCARE_PSQL_PATH` set
- Node 22.12+ or Node 24+
- Java 21
- Apache Maven 3.9+
- Python 3.12+ with the Windows `py` launcher or `python`
- `spring-api\.env` configured for the **local** database with a strong non-placeholder `JWT_SECRET`
- A database backup if you are validating an existing local GovCare database

The verifier refuses a remote/non-loopback `DB_URL`.

## First run

From the project folder:

```cmd
verify-target-windows-postgres.bat -SkipLiveFixtures
```

This performs native PostgreSQL migration verification, Spring tests, Django tests, frontend regressions and the production build without creating QA clinical fixtures.

## Full live patient + PDF verification

Use a disposable local database. Prepare a **private** JSON file, for example:

`verification\local-renal-accounts.json`

with this structure:

```json
[
  {
    "role": "doctor",
    "email": "your-enabled-local-doctor@example.test",
    "password": "YOUR_LOCAL_TEST_PASSWORD",
    "patientId": "AUTHORIZED-TEST-PATIENT-UUID",
    "forbiddenPatientId": "DIFFERENT-TEST-PATIENT-UUID"
  },
  {
    "role": "patient",
    "email": "your-enabled-local-patient@example.test",
    "password": "YOUR_LOCAL_TEST_PASSWORD",
    "patientId": "AUTHORIZED-TEST-PATIENT-UUID"
  },
  {
    "role": "super_admin",
    "email": "your-enabled-local-superadmin@example.test",
    "password": "YOUR_LOCAL_TEST_PASSWORD",
    "patientId": "AUTHORIZED-TEST-PATIENT-UUID"
  }
]
```

Use only enabled local QA accounts whose temporary-password flow has already been completed. Do not commit or share this file. The live API verifier requires doctor, patient and super-admin logins; the doctor must be authorized for `patientId` and denied access to `forbiddenPatientId`.

Then run:

```cmd
verify-target-windows-postgres.bat -AccountsFile "verification\local-renal-accounts.json"
```

## Expected output

Results and service logs are written under:

`verification\target-windows-postgres\`

Important files:

- `TARGET_VALIDATION_RESULTS.md`
- `target-validation-results.json`
- `migration-spring.out.log` / `.err.log`
- `live-spring.out.log` / `.err.log`
- `live-ml.out.log` / `.err.log`
- `live-frontend.out.log` / `.err.log`
- `verification\renal-api-report.json`
- `verification\ckd-live-pdf-report.json`
- `verification\ckd-live-pdf\govcare-ckd-<assessment-id>.pdf`

A final exit code of **0** means all requested checks that were selected passed. Exit code **2** means non-live checks passed but live fixture checks are still pending. Exit code **1** means at least one check failed.

## Clinical/research boundary

The live verifier creates operational QA observations, predictions, review events and a synthetic CKD assessment in the selected disposable local database. These records are **not clinical validation subjects**, are not evidence of clinical effectiveness, and must never be run against production patient data.
