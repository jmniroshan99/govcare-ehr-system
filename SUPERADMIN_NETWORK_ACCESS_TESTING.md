# Super Admin network access testing

Verification date: 2 October 2026. This report applies to the Super Admin patient/AI update; earlier reports remain historical evidence for prior changes.

## Executed checks

| Check | Result | Evidence and scope |
| --- | --- | --- |
| `npm run build` | PASS | TypeScript project build and Vite production build completed. |
| Existing role, dashboard and startup Node tests | PASS — 63 tests | `node --test scripts/role-access.test.cjs scripts/role-dashboard-contract.test.cjs scripts/run-spring.test.mjs scripts/run-full-stack.test.cjs`. Includes supported role routing and permission contracts; these are not live logins. |
| `npm run test:superadmin` | PASS — 5 Node tests and 19 Java service checks | Java 21 compiles 17 actual production classes with isolated test doubles for external dependencies and the database boundary. No production class implementation is replaced by a copied access algorithm. |
| `npm run test:demo` | PASS — 14 reported Node tests, including nested query/fixture tests | All supplied PostgreSQL migrations through V32, `pgcrypto`, and the unchanged ten-hospital seed run against PGlite 0.5.8, an embedded PostgreSQL engine. Production directory and repository SQL are extracted from Java sources and executed. |
| Java syntax parse | PASS — 137 sources, zero syntax errors | JDK 21 compiler parser processes all backend main/test Java source files. Parsing alone is not a complete dependency-resolved Spring compilation. |
| `mvn test` | BLOCKED before compilation | Spring Boot parent POM 3.5.3 could not be downloaded: `repo.maven.apache.org: Temporary failure in name resolution`. The Maven test suite did not execute. |
| Browser interface / responsive verification | BLOCKED | Local Vite starts, but the cloud browser rejects the local URL with `net::ERR_BLOCKED_BY_CLIENT`. The local Playwright installation has no Chromium executable. No browser result is claimed for 375, 768, 1366 or 1920 pixels. |

## Verified behaviors

The Java service checks execute Super Admin network authorization, hospital resolution and clinical write logic. They confirm:

- Super Admin can resolve a patient in another hospital, including when the operator has no home hospital. The patient's hospital is used while preserving operator ID, permissions and credential version. A foreign department is not reused.
- Other governance and staff roles cannot claim network access, including with a wildcard permission set. Doctors still require their hospital and an assigned clinical relationship. Patient/guardian demographic access remains linked-record only.
- Inactive accounts, temporary-password accounts, missing patient permissions, revoked clinical permissions and missing clinical write permissions are denied.
- Page sizes are bounded; a ward from another selected hospital is rejected. A demographics-only Super Admin directory omits clinical arrays.
- Direct clinical patient loading and assessment/history resolution use the selected patient and recheck clinical access.
- A complete CKD assessment writes its prediction, assessment, all 17 manual/calculated input observations and three FHIR resources under the patient's hospital, with the original operator. The CKD model version remains unchanged.
- General AI and deterioration assessment writes use the same patient hospital context.
- Super Admin clinical document viewing requires the documented permissions; other governance roles retain their clinical document restrictions. Source PDF upload is permitted without granting clinical report verification authority, and a revoked clinical permission blocks that upload.
- Patient document release rules still require the linked patient, verified status and patient release. CKD drafts remain owned by their operator and restoration rechecks clinical access.

The PostgreSQL tests execute the production directory/filter/hospital/native-identifier queries. They traverse every active registered patient through pagination without duplication; verify all ten demo hospitals each expose their own 400 patients; search by UUID, patient number and QR payload; validate ward/admission/bed labels; and detect an identifier duplicated across two hospitals. Existing fixture tests also verify all 1,000 doctors have exactly four assigned patients, hospital links, real bcrypt credential matches, loader guards and idempotent reruns.

The frontend service tests confirm that search and registration routes do not become a patient ID, valid patient/document routes retain their UUID, clinical 403/500 errors do not trigger a demographics fallback, and hospital/search/page/cancellation parameters reach the clinical endpoint.

## Limits and deployment validation

The focused Java checks use database/dependency doubles; the PostgreSQL tests execute SQL and migrations independently. Their combination does not establish that the complete Spring application starts, that PDF generation/storage works end to end, or that live JWT/MFA logins succeed. No user's running database or account was modified in this environment.

Before deployment, run these checks on the configured PostgreSQL and Spring environment:

1. Run `mvn test`, start the full API, and confirm Flyway/JPA startup without errors.
2. Rebuild/restart the frontend and backend, sign out and sign back in as an active Super Admin. Complete any required temporary-password change using the normal login workflow.
3. Open Patient search with All hospitals. Filter each hospital, page beyond the first results, open a patient profile and launch AI assessment. Confirm the same patient and hospital appear.
4. Import a reviewed clinical PDF, restore an owned CKD draft, run assessment with all reviewed required features, reopen its history and generate/download the report. Inspect prediction, observation, document, report and FHIR hospital IDs and operator IDs in PostgreSQL.
5. Sign in with every supported role using valid current credentials. Confirm dashboard routing, assigned doctor patients, hospital isolation, document release rules, and denial of forged foreign-hospital/network requests. The existing `npm run verify:roles` supports configured local role login checks.
6. Verify the patient directory, profile, CKD selector and deterioration assessment at 375, 768, 1366 and 1920 CSS pixels, including long hospital/patient names, pagination, loading and API-error states.

See [SUPERADMIN_NETWORK_ACCESS_FIX.md](SUPERADMIN_NETWORK_ACCESS_FIX.md) for build instructions and the permission/API matrix. Full production deployment readiness remains conditional on these blocked live checks.
