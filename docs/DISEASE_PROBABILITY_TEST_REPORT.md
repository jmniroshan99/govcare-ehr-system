# Related disease probability testing report

Verification date: 2026-10-06. Source compared with the preceding full-source ZIP. No live hospital database, account or patient record was modified.

## Fresh executed checks

| Check | Result | Evidence/scope |
| --- | --- | --- |
| `npm run build` | PASS | TypeScript compilation and Vite production output after the final UI/print-token edits; `verification/disease-probabilities/final-build.log` |
| Combined Node checks | PASS — 127 tests | 21 new probability/actual React-rendering checks, 30 CKD-workspace checks, 24 predictive access checks, 45 role checks, 7 dashboard checks; `frontend-tests.log` |
| `npm run test:roles` | PASS — 45 | Required command executed independently; `roles.log` |
| `npm run test:dashboard` | PASS — 7 | Required command executed independently; `dashboard.log` |
| `npm run test:theme` | PASS — 10 | Generated CSS consistency, token contrast/behavior, print-independent paper colors; `theme.log` |
| Disease probability domain | PASS — 30 | Actual dependency-free Java 21 snapshot class; finite/unit-range boundaries, unavailable nulls, missing adapters, snapshot/model/score/date mismatch, immutability and future validated-output contract; `domain.log` |
| Disease snapshot SQL/migration | PASS — 30 | All 35 migration files through V36 applied to isolated PGlite; actual production prediction INSERT executes; JSON constraints, SQL-null legacy support and update immutability checked; `migration.log` |
| Predictive migration regression | PASS — 23 | Complete V36 schema chain plus actual predictive production queries, provenance, tenant FKs, immutable history and unavailable outputs; `predictive-regression.log` |
| Clinical intelligence domain regression | PASS — 53 | Existing Java measured-history and safety rules; `clinical-domain.log` |
| Java syntax audit | PASS — 151 files | Zero parse errors in production/test Java; `java-syntax.log` |
| Patient/network access service regression | PASS — 20 | Actual production clinical/service classes compiled with isolated framework, SQL and JSON test doubles, including the modified CKD service; tenant writes and clinical boundaries verified; `network-scope.log` |
| Source comparison | PASS | Existing CKD feature arrays, coefficients/scaling and RBAC/patient-scope files unchanged; earlier migrations unchanged |

Repeated role/dashboard runs are not additional unique tests. PGlite is an isolated PostgreSQL-compatible engine and does not establish live PostgreSQL/Spring integration correctness. Syntax parsing and isolated compilation do not substitute for a full Maven build.

The first new migration-check attempts exposed incomplete synthetic fixture DOB and a test distinction between JSON `null` and SQL NULL. Those test fixtures were corrected; the final migration log is authoritative. The nullable production column supports SQL NULL for existing records, while malformed JSON-null snapshots are rejected.

## Maven and actual PDF verification

`cd spring-api && mvn -B clean test` was run with Java 21 and Maven 3.9.11. It stopped before compilation because the Spring Boot 3.5.3 parent POM was not cached and `repo.maven.apache.org` could not be resolved. See `verification/disease-probabilities/maven.log`.

New JUnit checks are present:

- `DiseaseProbabilitySnapshotTest`: runs the 30 pure snapshot checks under Maven.
- `CkdAssessmentReportTest`: renders the actual OpenPDF report and extracts its text with PDFBox; verifies every related outcome, current score/confidence distinction, unavailable states, captured time and legacy reports. It also checks denied generation, clinical-write enforcement and download authorization before storage access.

**These JUnit tests were not executed here. Actual OpenPDF generation, PDF page/image inspection and saved-report HTTP/storage/FHIR transaction checks remain unverified for this release.** The frontend's actual React render was checked: six cards, six disclosures, seven print rows, only validated outputs producing meters, escaped metadata and absence of fabricated related percentages. This verifies markup/data, not PDF typography or page layout.

The earlier user's Windows evidence of 72 passing JUnit tests belongs to the previous backend source and is preserved in its original report. It must not be presented as a successful build of this new V36/report implementation.

## Browser and role-login verification

No authenticated running Spring/PostgreSQL test installation or configured live test accounts were available. No local Chromium executable is installed. No dark/light screenshots, real role logins, print-dialog checks or viewport executions were produced for this update.

| Viewport | Implemented layout | Live visual status |
| --- | --- | --- |
| 375 px | One card column, wrapping controls/metadata | Not executed |
| 768 px | Two card columns | Not executed |
| 1366 px | Three card columns | Not executed |
| 1920 px | Three card columns | Not executed |

Source checks confirm token-only colors, native accessible disclosures, touch-size shared buttons, long-text wrapping, reduced-motion support and print-filter independence. Browser overflow, final contrast, keyboard interactions, filter persistence, cancelled/duplicate exports and PDF print pagination still require live verification.

## Completion boundary

The UI, assessment snapshot, migration and saved-PDF section are implemented and the executed checks above passed. No related clinical risk adapter was installed or activated. Related-disease percentages remain unavailable until model-specific runtime and clinical validation work is completed. This report does not certify production release readiness or clinical accuracy.
