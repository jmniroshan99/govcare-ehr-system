# GovCare V44 — Target Windows/PostgreSQL Validation Preparation Report

## Project identification

GovCare EHR Modern Clinical Intelligence remains a React/TypeScript frontend, Spring Boot/Java 21 backend, PostgreSQL/Flyway persistence layer, stateless Django renal inference service, FHIR R4 integration layer and clinician-in-the-loop CKD/renal decision-support workflow. V44 does not rebuild that architecture; it hardens the target-runtime path and adds repeatable native validation tooling.

## Root cause found and fixed

The V43 Windows renal setup generated the same dedicated `GOVCARE_RENAL_JWT_SECRET` in `spring-api/.env` and `ML_Server/.env`. Spring loaded its `.env`, but `scripts/run-renal-ml.cjs` started Django with the parent shell environment only and did **not** load `ML_Server/.env`. On a fresh Windows terminal this could make Django report `authentication_configured=false`, reject Spring-to-Django inference with `SERVICE_AUTHENTICATION_NOT_CONFIGURED`, and prevent the live renal pipeline from working even though setup had succeeded.

V44 fixes the launcher to load `ML_Server/.env`, preserve the dedicated service credential only in the child environment, validate that the file exists, require at least 32 UTF-8 bytes for the secret, and fail closed when configuration is missing. A dependency-free regression test verifies the loader.

## New target validation tooling

- `verify-target-windows-postgres.bat`
- `scripts/verify-target-windows-postgres.ps1`
- `scripts/verify-live-postgres-v42.mjs`
- `scripts/verify-live-ckd-pdf.mjs`
- `scripts/renal-ml-env.test.cjs`
- `TARGET_WINDOWS_POSTGRESQL_VALIDATION.md`

The Windows verifier executes the requested sequence on the actual target machine: native PostgreSQL/Flyway V42 verification, Spring Maven tests, Django tests, CKD/renal regressions, full frontend production build, live patient-scoped renal API verification and CKD PDF export verification. Mutation checks are restricted to a loopback database and an explicitly supplied private disposable-local fixture.

## Checks executed in the packaging environment

- Combined dependency-free Node regression suite: **38/38 passed**.
  - CKD workspace: 30 tests
  - renal risk graphics: 4 tests
  - renal local secret configuration: 3 tests
  - renal ML `.env` launcher regression: 1 test
- Java source syntax validation: **172 sources, 0 syntax errors**.
- Packaged ML training/unit tests: **10/10 passed**.
- Python byte-code compilation: `ML_Server` and `ml-training` passed.
- Direct renal inference smoke test passed for:
  - Hb: `AVAILABLE`, persistence research forecast
  - URR: `AVAILABLE`, research forecast
  - Hyperkalemia: `AVAILABLE`, bounded `RESEARCH_RISK_SCORE`
  - Dry weight: `NOT_AVAILABLE`, no manufactured result
- New Node verifier scripts pass `node --check`.

## Checks that require the user's target Windows/PostgreSQL machine

The packaging environment is Linux, has no native PostgreSQL client/server or Maven, and outbound npm/pip registry DNS is unavailable. Therefore the following are intentionally **not** reported as executed here:

- native Windows execution;
- native PostgreSQL Flyway V42 execution;
- dependency-aware Spring Maven/JUnit execution;
- Django test execution requiring the pinned Django install;
- full `npm ci` + Vite production build;
- live patient-scoped API test against the user's local database;
- end-to-end CKD PDF generation/download against that local database.

Those checks are now automated by `verify-target-windows-postgres.bat`. It writes PASS/FAIL/PENDING results and service logs under `verification/target-windows-postgres/`.

## Clinical/research boundary

The hyperkalemia output remains a research risk score, not a clinically calibrated probability. The renal deterioration composite remains a heuristic directional summary, not a disease probability. Operational fixtures created by the target verifier are QA-only and contribute zero clinical-validation subjects.
