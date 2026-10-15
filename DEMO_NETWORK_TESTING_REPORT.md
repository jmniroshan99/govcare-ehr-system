# GovCare ten-hospital dataset verification

Verified on 2026-10-02 against the source in
`GovCare_EHR_Access_Roles_COMPILE_FIXED_FULL_SOURCE(1).zip`.

## Executed checks

| Command | Result | Evidence |
| --- | --- | --- |
| `npm run test:demo` | PASS | 8 tests; full PostgreSQL schema, fixture, credential and isolation checks |
| `npm run test:roles` | PASS | 44 existing role-access tests |
| `npm run test:dashboard` | PASS | 7 existing dashboard contract tests |
| `npm run test:startup` | PASS | 12 existing launcher tests |
| `npm run build` | PASS | TypeScript compilation and Vite production build |
| `npm ls @electric-sql/pglite --depth=0` | PASS | Test dependency installed at locked version 0.5.8 |
| `mvn test` with Java 21 / Maven 3.9.11 | BLOCKED | Maven Central DNS/network access unavailable; Spring Boot parent POM 3.5.3 could not be downloaded |

## Actual database verification

The integration suite uses PGlite 0.5.8 with its `pgcrypto` extension: an embedded PostgreSQL
engine, not mocked query responses. It executes all 31 SQL migration files supplied in the
uploaded V1–V32 schema (that source has no V22 file). A minimal test-only Flyway history row
records V32 success after the migrations run; this does not claim the Java Flyway runner was tested.

It then executes the supplied seed and read-only verification SQL. All ten hospitals have
exactly 400 patients, 100 doctors, 100 wards, 800 beds, 400 visits, 200 admissions,
200 appointments and 200 OPD queue entries after the initial load.

The suite extracts the actual `ClinicalPatientAccess.visiblePatientIds` SQL from the preserved
Java source and executes it for **every one of the 1,000 doctors**. Each doctor sees exactly
four assigned patient IDs. A doctor queried in a different hospital sees none. All twenty
patient/guardian account identities point to a patient in the same hospital, and each of
the ten ward managers has two active admissions in the assigned ward department.

The credential CSV contains 1,060 distinct usernames and 1,060 distinct initial passwords.
Every inserted user's role ID matches the role code, hospital matches the CSV, password
hash uses bcrypt cost 10 and first-login password change is enabled. PostgreSQL `crypt()`
also confirms the password/hash match for one account from each of the seven seeded roles.

Further checks verify:

- Missing explicit opt-in or incomplete V32 prevents loading.
- An unrelated owner of a reserved hospital or account identifier aborts the transaction.
- All initial user, guardian, ward, bed, visit, appointment, queue, admission and bed-assignment
  relationships stay within their hospital.
- The read-only verifier detects a deliberately injected foreign-hospital doctor on a visit.
- Hash snapshots of all thirteen affected tables prove original NHSL data stays unchanged.
- After changing a password, patient name, ward name and queue status, and discharging an
  admission/releasing its bed assignment, a second seed produces identical table snapshots:
  no duplicates, password resets, overwritten edits or reopened admissions.
- Loader arguments keep the database password in the subprocess environment, not the command
  arguments, reject remote URLs and production profiles, and preserve argument boundaries.

## Changes and limits

This is a data-fixture update. No existing application frontend or Java source, Flyway migration,
RBAC grant, CKD/FHIR implementation or API route changed. A comparison with the uploaded ZIP
confirmed that only README and package manifests changed among existing files; the remaining
changes are the new fixture, launcher, tests, credentials and documentation.

The current environment has no running customer PostgreSQL service or `psql` executable.
The data has therefore **not been loaded into the user's database**; run the provided loader
on the user's computer. Native Windows batch execution, live API/HTTP logins for all 1,060
accounts, browser end-to-end checks and visual checks at 375/768/1366/1920 pixels were not run.
Existing responsive dashboard contract tests pass, but those are source checks, not visual evidence.
The SQL-scope and credential checks above do not substitute for live HTTP authentication testing.

The backend Maven test command was attempted and failed before compilation because the parent
dependency could not be resolved. Backend unit tests are not reported as passed. Re-run
`mvn test` from `spring-api` on a machine with Maven Central access, then load the fixture and
verify the hospital-specific logins in the running application.

Use [DEMO_NETWORK_SETUP.md](DEMO_NETWORK_SETUP.md) for installation and verification instructions,
and [CHANGED_FILES_DEMO_NETWORK.txt](CHANGED_FILES_DEMO_NETWORK.txt) for the file list.
