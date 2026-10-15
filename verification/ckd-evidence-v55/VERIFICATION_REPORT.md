# V55 verification - 15 October 2026

V55 was implemented over the complete V54 project. It completes source-confirmed evidence entry and optional synthetic-case creation. It does not establish clinical validation or manufacture missing information for a real patient.

## Fresh results

| Check | Result | Evidence |
| --- | --- | --- |
| TypeScript and Vite production build | Passed | `frontend-build.log`; rebuilt `dist/` included |
| Spring API suite, Java 21 | 242 total: 237 passed, 5 skipped, 0 failed/errors | `spring-test-report.json` |
| Client, dashboard, feature, outlook, workspace, theme and startup regressions | 106 passed | `client-tests.log` |
| Existing ML training/pipeline regressions | 16 passed | `ml-pipeline-tests.log` |
| Existing Django renal API regressions | 17 passed | `ml-api-tests.log` |
| PostgreSQL-compatible migration execution | 26 checks passed; all 46 migration files through V47 applied | `database-report.json` |
| Real React evidence/demo form interactions | 6 scenario groups passed | `dom-report.json`; real controlled components with jsdom 26 and intercepted API transport |
| Actual OpenPDF summary | Passed text regression; all 5 rendered pages visually inspected | `synthetic-evidence-summary-v55.pdf`; synthetic software fixture only |
| Preservation against V54 | Protected source/data/model files byte-identical; no non-build baseline files removed | `preservation-report.json` |

The five skipped Spring cases are the pre-existing `CkdSubmissionPersistenceJdbcTest` cases requiring `govcare.ckd.persistence.jdbc`. No live PostgreSQL connection was configured. They are not counted as passing tests.

## Observable requirements and evidence

| Requirement | Implementation and check |
| --- | --- |
| Establish measured trends from actual data | `CkdClinicalEvidenceService` validates both source values, units, notes and ordered dates before calling the existing observation service. Focused tests cover authorization first, unsupported/invalid input rejection before either write, stable distinct child request UUIDs and original unit/date preservation. The public method is transactional. Full JDBC rollback for this new route was not exercised against a native PostgreSQL server. |
| Keep current source quality explicit | Production normalizer + module/mapping tests establish a historical pair without assigning a date/value to the separate undated snapshot. Invalid current sources remain blocked. Historical fallback does not produce an acute review signal. A single actual dated value counts its date but does not become a trend. |
| Record diabetes context | Append-only, scoped, dated verification event; idempotent retry and changed-content conflict tests. Mapping tests show five available factor groups only with confirmed clinical context, four when unknown, and no diagnosis inferred from high HbA1c. Cardiovascular risk remains not estimated. |
| Add true dialysis evidence | The task panel opens the existing paired renal-session form. The synthetic HD series exercises the production module/rule mapping: measured URR 70%, original Hb/URR/hyperkalemia input gates ready, no forecast stored merely because inputs are present. |
| Optional research demonstration | Authorization and explicit acknowledgement precede SQL. Tests verify two new synthetic patient IDs, ten calls to the existing CKD pipeline, three paired renal-observation calls, two source-confirmed dialysis/diabetes contexts, assigned-hospital scope and stable creation retry. Existing patients are never updated by this service. |
| Preserve five-year semantics | The non-dialysis synthetic source series enters the existing KFRE confirmation gate and becomes available only after explicit confirmation. The HD case remains not applicable. No projected eGFR or certainty about future events is introduced. |
| Usable, resilient forms | Controlled React form checks cover empty defaults, source confirmation, actual values/dates, API serialization, failure retention, stable retry UUIDs, refresh callback, read-only actions, explicit demo creation, returned-patient selection and cancellation on unmount. Demo selection also updates the authorized patient URL so the shared selector resolves the same patient. |
| Consistent PDF | Shared report text says monitoring inputs are available, not prediction-ready. The five disease cards retain evidence/actions/notes, and cardiovascular evidence includes context, verification date and source. A page-flow correction keeps the mapped evidence section with its introduction instead of producing a mostly empty intermediary page. The existing five-year appendix and report persistence routes remain intact. |
| Additive persistence | V47 is applied after every existing migration in PGlite. Checks cover patient/hospital foreign keys, append-only triggers, idempotency uniqueness, required source/status constraints, report-as-of cutoff, explicit unknown context and required synthetic-demo marker. Migration creates no observations or prediction results. |

## Reproduction

From the project root:

```sh
npm ci
npm run build
npm run test:ckd:evidence
npm run test:ckd:evidence:migration
node --test scripts/ckd-evidence.test.cjs scripts/ckd-clinical-dashboard.test.cjs scripts/ckd-outlook.test.cjs scripts/ckd-workspace.test.cjs scripts/clinical-feature-contracts.test.cjs scripts/renal-clinical-risk-graphics.test.cjs scripts/renal-api-contracts.test.cjs scripts/theme.test.mjs scripts/run-spring.test.mjs scripts/run-full-stack.test.cjs scripts/api-port.test.cjs scripts/run-renal-stack.test.cjs scripts/renal-port.test.cjs scripts/renal-ml-env.test.cjs scripts/renal-local-config.test.cjs
python -m unittest discover -s ml-training/tests -v
```

Run the Python tests in the existing renal environment with the packaged requirements. From `ML_Server`, run `python manage.py test renal_service --noinput`. From `spring-api`, use Java 21 and `mvn -q test`. Optional property `-Dgovcare.ckd.evidence.qa.output=<directory>` writes the synthetic PDF fixture during the PDF test.

For DOM verification, provide jsdom 26 separately through `GOVCARE_JSDOM_MODULE` and run `node scripts/verify-ckd-evidence-dom.cjs`. This avoids changing production dependencies or the application lockfile. The build, test runs and report generation used local development tooling, not a connected hospital session.

## Boundaries

- Native-browser layout, responsive rendering and native dialog keyboard/focus behavior are **not freshly verified**. The DOM emulator is not a browser layout engine. Prior V54 browser execution was blocked by this environment; existing browser scripts remain available for a supported workstation.
- Native Windows startup, the exact previously denied Windows port and an authenticated full-stack HTTP/PostgreSQL workflow remain **unverified on the target computer**. Startup/port regressions passed and their source is preserved.
- Atomicity is implemented with Spring transactions and the existing persistence seams. Migration constraints were executed in PGlite; native JDBC execution of the new endpoints was not performed.
- The synthetic cases establish software demonstration inputs, not patient outcomes, treatment effects, prospective performance, calibration or clinical validity. No model was retrained in V55. Packaged model artifacts and the original prediction horizons are unchanged.
- Old assessment-linked or frozen PDF snapshots retain their original source evidence. Later entries require a refreshed appropriate assessment/snapshot for an updated export.

See `../../CKD_EVIDENCE_ESTABLISHED_V55.md` for target upgrade and demonstration instructions.
