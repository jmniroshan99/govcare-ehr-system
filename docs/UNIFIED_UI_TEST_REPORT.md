# Modern UI and integrated CKD testing report

Verification date: 2026-10-05. Logs are in `verification/modern-ui/system-theme-*`.

## Fresh completed checks

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run build` (TypeScript and Vite) | PASS; final build completed | `system-theme-build.log` |
| Role access regressions | 45 passed, zero failures | `system-theme-roles.log` |
| Role dashboard contracts | 7 passed, zero failures | `system-theme-dashboard.log` |
| Theme contrasts, generation and preference state | 10 passed, zero failures | `system-theme-theme.log` |
| New embedded CKD permissions and patient request lifecycle | 30 passed, zero failures | `system-theme-ckd-workspace.log` |
| Patient registration regression | 8 passed, zero failures; isolated migration/index verification passed | `system-theme-patient-registration.log` |
| Doctor workspace profile behavior | 5 passed, zero failures | `system-theme-doctor-workspace.log` |
| Searchable selector placement | 3 passed, zero failures | `system-theme-searchable-select.log` |
| Predictive frontend access boundary | 24 passed, zero failures | `system-theme-predictive-access.log` |
| Java 21 predictive domain compilation/checks | 53 checks passed | `system-theme-predictive.log` |
| Isolated predictive schema and production SQL checks | 23 checks passed across 34 migrations through V35 | `system-theme-predictive-migration.log` |

The Node suites total 132 passing tests. The isolated Java and database checks are additional. Several existing suites include source contracts; these counts do not imply 132 real user login or clinical workflow tests. No synthetic test fixtures were written into a hospital database or displayed as product analytics.

The new tests exercise all 24 defined roles, missing clinical permissions, suspended/anonymous contexts, wildcard-role boundaries, invalid deep links and cancellation/late-response behavior across patient changes. The live browser script now also checks the integrated route, a single shared selector and preservation of actual existing assessment values when switching views.

## Backend compilation evidence

All 147 Java files are byte-identical to the previous full source ZIP, including the corrected `ClinicalIntelligenceEngine.Observation` reference and explicit FHIR imports. This UI update changes no Java, clinical model or database migration.

A fresh `mvn clean test` attempt with Java 21 and Maven 3.9.11 failed before compilation because the Spring Boot parent POM was absent from the local cache and Maven Central could not resolve: `repo.maven.apache.org: Temporary failure in name resolution`. See `system-theme-maven.log`. This is not evidence of a new Java syntax failure; it also does not establish a fresh full backend pass here.

Earlier user-supplied Windows evidence, preserved in `windows-maven-and-startup-supplied.log`, records a real backend compilation and 72 JUnit tests with zero failures/errors/skips, followed by successful V35 application on PostgreSQL. That evidence is retained with its provenance; it was not reproduced by this delivery environment. Previous startup-port fixes remain included.

## Live browser and responsive status

A fresh Playwright launch failed because the Chromium headless executable is missing. The earlier failed browser download is already recorded. A running authenticated local Spring/PostgreSQL stack and enabled role test accounts were also unavailable for live browser checks.

Consequently, **dark/light screenshots, viewport checks at 375/768/1366/1920px and live login/authorization verification remain pending**. Source layouts, responsive rules and token contrasts were checked; these do not replace browser verification. No screenshot or production-validation pass is claimed.

On an authorized local test installation with Playwright/Chromium available, set `GOVCARE_VISUAL_ACCOUNTS` to a private file containing enabled local test accounts, and use the existing `GOVCARE_VISUAL_URL`, `GOVCARE_VISUAL_API` and `GOVCARE_VISUAL_OUTPUT` settings as needed. Run `npm run test:theme:browser` and `npm run test:predictive:browser`. The account file is excluded from the ZIP. Use dedicated test patients, complete temporary-password changes first and confirm the Doctor's forbidden/unassigned patient is denied.

Before deployment, complete the live role/viewport checks, keyboard tab/focus checks, report import/draft/prediction flow, view switching during pending requests, patient switching, FHIR/audit write-back and backend `mvn clean test` in the configured installation. Forecast/model clinical validation remains outside this UI update; uninstalled adapters continue to return unavailable states.
