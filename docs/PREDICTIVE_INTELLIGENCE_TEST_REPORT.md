# Modern clinical workspace — testing report

> Latest UI update (2026-10-05): CKD assessment and predictive intelligence now share one patient workspace, and the modern theme is applied across the application. See `START_HERE_UNIFIED_CLINICAL_UI.md`, `docs/UNIFIED_THEME_SYSTEM.md`, `docs/CKD_WORKSPACE_INTEGRATION.md` and `docs/UNIFIED_UI_TEST_REPORT.md` for the current UI and verification status. The backend architecture and prior evidence below remain preserved.


Verification date: 2026-10-05. This report applies to the isolated `GovCare_EHR_Modern_Clinical_Intelligence` source copy, compared with the current patient-registration/doctor-workspace baseline. No live hospital database, accounts or clinical records were modified.

## Windows confirmation and startup follow-up

The user subsequently supplied a Windows log showing successful compilation of 140 production Java files and seven test sources, a successful package build, and a real `mvn clean test` run: **72 tests, zero failures/errors/skips**. This includes the engine test (with 53 internal checks) and all six new predictive security tests. The same log shows a real PostgreSQL connection and successful V35 application on the user's installation, followed by startup failure because API port 4002 was occupied.

The delivery environment did not perform those live Windows operations. The original local Maven DNS blocker remains recorded below; it is now supplemented by the user's successful compiler/JUnit/migration evidence. Source log: `verification/modern-ui/windows-maven-and-startup-supplied.log`.

The current startup fix changes only Node launchers, tests and documentation. Fresh verification: `npm run test:startup` passes all **22** tests, and a frontend production build with `VITE_API_BASE_URL=http://127.0.0.1:14002` passes. The compiled assets confirm that all six frontend API consumers use the configured URL. A real occupied TCP listener reproduces the old failure; the new launcher picks a different port, shares it with Vite/Spring and leaves the original listener running. A separate check confirms that backend `.env` cannot overwrite the selected port.

Maven is a fixture in launcher tests; the new launchers have not been used to boot a live authenticated Windows Spring/PostgreSQL stack in this environment. HTTP authorization, FHIR/audit transaction write-back, live role logins and browser/responsive screenshots remain pending. See `STARTUP_PORT_CONFLICT_FIX.md` and `verification/modern-ui/api-port-*` for details.

## Compiler hotfix follow-up

The user's Windows build reached Java 21 compilation of 140 production sources and exposed an ambiguous `Observation` type in the previously delivered predictive service. That source defect is corrected by explicit FHIR imports and a qualified `ClinicalIntelligenceEngine.Observation` declaration. No clinical logic changes were made. See `BUILD_FIX_OBSERVATION_AMBIGUITY.md` for the one-file replacement and Windows commands.

After this fix, fresh checks pass: 147 Java files parse without syntax errors; 53 Java domain checks, 24 frontend access tests and 23 PGlite database checks pass. The fresh Maven retry still stops before compilation because Maven Central DNS resolution fails here. Full backend compilation/JUnit execution is therefore still unverified for the corrected source in this environment. The frontend is unchanged by the hotfix, and the user's supplied frontend build succeeded. Hotfix logs have the prefix `verification/modern-ui/observation-build-fix-`.

## Executed checks

| Check | Result | Evidence and scope |
| --- | --- | --- |
| `npm run build` | PASS | TypeScript project compilation and Vite production build. The new page and chart are separate lazy chunks. |
| Java domain compilation and checks | PASS — 53 checks | Java 21 `javac --release 21` compiled the actual dependency-free engine, clinical-date helper and checks. Covers units, dates, implausible values, references, duplicate/conflicting observations, G/A boundaries, chronicity, actual-time regression, renal safety, data gaps and evidence fingerprints. |
| Predictive frontend access | PASS — 24 tests | Executes the actual TypeScript role policy. Includes authorized clinical roles, prohibited roles with wildcard permissions, missing permissions, inactive users and incomplete password changes. |
| Predictive migration/database | PASS — 23 checks | Applies all 34 existing migration files through V35 in ephemeral PGlite with pgcrypto. Exercises actual production observation/timeline SQL and verified-measurement writes, tenant foreign keys, optimistic review locking, idempotency constraints and immutable journals. No live PostgreSQL connection. |
| `npm run test:roles` | PASS — 45 tests | Existing route and permission regression checks. These are not interactive role logins. |
| `npm run test:dashboard` | PASS — 7 tests | Existing role-dashboard contracts. |
| `npm run test:theme` | PASS — 10 tests | Generated token consistency and existing theme checks. Visual contrast remains a browser verification item. |
| `npm run test:patient-registration` | PASS — 8 tests plus migration checks | Existing registration regression and ephemeral migration verification. |
| `npm run test:doctor-workspace` | PASS — 5 tests | Existing notes/profile workspace behavior checks. |
| `npm run test:superadmin` | PASS — 11 Node tests and 20 Java service checks | Existing facility/navigation checks and actual Java production-service logic compiled with isolated framework/SQL test doubles. This does not replace Spring integration testing. |
| `npm run test:java:syntax` | PASS | Parsed all 147 Java source files with zero syntax errors. This checks syntax, not dependency resolution, type linking or full backend compilation. |

The commands and raw logs are retained under `verification/modern-ui/`. The final individual domain, access and migration logs are authoritative for their results. `npm run test:predictive` groups these three checks for repeatable local verification.

## Maven compilation and integration blocker

`cd spring-api && mvn clean test` was attempted with Java 21 and Maven 3.9.11. It failed while resolving the Spring Boot 3.5.3 parent POM: `repo.maven.apache.org: Temporary failure in name resolution`. The parent is absent from the local cache. Maven did not reach full compilation or JUnit execution.

The local Maven attempt did not execute `ClinicalIntelligenceEngineTest` or `PredictiveIntelligenceSecurityTest`; the subsequent user's Windows run executed both successfully, as recorded above. Those are unit/contract checks. HTTP authentication, Spring transaction write-back, FHIR serialization/linking during saved reviews, concurrent request behavior and live clinical queries remain unverified by those unit tests. Successful migration/startup initialization does not establish complete application workflow verification.

## Browser and screenshot blocker

Local Chromium installation failed because the Playwright download returned an empty/invalid archive. The available remote browser blocked the local preview URL with `net::ERR_BLOCKED_BY_CLIENT`. No screenshots were captured and no live role accounts or running authenticated backend were available for the requested login checks.

| Viewport | Dark mode | Light mode |
| --- | --- | --- |
| 375 px | Not executed | Not executed |
| 768 px | Not executed | Not executed |
| 1366 px | Not executed | Not executed |
| 1920 px | Not executed | Not executed |

Responsive CSS, semantic theme tokens, native dialog focus handling and reduced-motion styles are implemented and frontend compilation passes. Horizontal overflow, visible contrast, keyboard interactions, patient-switch behavior and role-specific live rendering still require browser verification. The provided `npm run test:predictive:browser` helper uses normal authenticated logins, real authorized API data and the listed widths/themes; setup is in the build guide. It does not mock clinical data or save clinician decisions.

## Clinical and release limits

This is the Phase 1 longitudinal research-CDSS foundation and modern UI. No model was trained, clinically validated or activated. Future-risk capabilities return explicit unavailable, insufficient-data or suppressed states; they do not produce fabricated probabilities or projected lab values. Historic measurements and deterministic rules remain distinguishable from predictions.

Before production release, complete live Spring/PostgreSQL workflow and role/browser checks, verify the updated launchers on the deployment platform, review the additive migration on a backed-up staging database, and obtain local clinical governance approval for the documented rules and freshness policies. This delivery does not assert production release readiness or clinical model validation.
