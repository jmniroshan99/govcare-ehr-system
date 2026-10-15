# Testing and acceptance evidence — GovCare V41

Executed verification on 2026-10-09. These are software/research checks, not clinical validation. The local operational fixture contributes zero clinical-validation subjects. The retrospective source cohort remains 42 patients.

## Windows launcher follow-up — 2026-10-10

The renal setup/startup batch files now retain their windows after success or failure, preserve the npm exit status, and report missing setup prerequisites before launch. This corrects the confirmed disappearing-error-window mechanism; the File Explorer screenshot alone does not identify the user's underlying dependency or service failure. Full instructions are in `WINDOWS_STARTUP_FIX.md`.

Fresh affected startup regression execution passed **22 tests**, with zero failures/skips, exit 0. Static batch inspection confirmed all exit paths follow a pause, all `goto` labels resolve, and both files use CRLF. The prior complete package's **779** payload SHA-256 values were verified, and all **54** research files remain unchanged. No training or clinical/API implementation was repeated or changed.

**Windows CMD execution remains UNVERIFIED.** The 22 tests execute existing Node startup behavior on Linux; static batch checks do not substitute for Windows execution. The broader checks below are retained evidence from the completed checkpoint. `verification/renal-windows-startup-fix.json` records the follow-up scope and limits.

## Executed checks

| Check | Actual result | Scope |
|---|---|---|
| TypeScript + Vite production build | PASS | `npm run build`; source React integration and production bundle |
| Java 21 Maven test execution + executable JAR package | PASS — 118 tests, 0 failures/errors/skips | Includes 20 newly added renal tests: JWT, access, units, FHIR parsing, PDF, JSONB-to-HTTP null preservation |
| Full Node regression suite | PASS — 211 tests | Existing 200 role/access/dashboard/startup/theme/CKD/predictive checks plus 8 renal chart-unit and 3 credential-setup behavior tests |
| Renal chart sizing regression | PASS — 0 → 1148 px | Actual checkpoint chart DOM before/after scoped CSS correction; signed-in browser separately verifies SVG and solid/dashed series |
| Python causal preprocessing/artifact tests | PASS — 10 tests | Causal prefix invariance, next-target validity, HMAC, group separation, unit normalization, duplicate/invalid flags and independent train-only imputer reconstruction |
| Django inference/JWT API tests | PASS — 12 tests | Signature/algorithm/issuer/audience/lifetime/role/scope/UUID checks; no auth bypass, bad/future/stale/gapped/missing input, load failures, real artifact inference |
| Full migration chain, existing predictive constraints | PASS — 31 checks | 40 actual supplied migrations through V41, including V40 upgrade fixture; original project has no V22 file |
| New renal migration/persistence constraints | PASS — 20 checks | Tenant/model foreign keys, idempotent shapes, finite/range output constraints, append-only observations/reviews and mandatory interpretation reasons |
| Real local Spring→Django HTTP workflow | PASS — 33 checks | Actual password logins/JWTs; unauthorized roles/unassigned patient deny; observed history, repeated JDBC timestamp reads, snapshot/review ISO dates, baseline/SHAP predictions, all four review actions and stale-version deny |
| Actual API write→stored SQL/FHIR/audit inspection | PASS — 13 checks | Observations, snapshots, reviews, immutable trigger; 22 measured Observations, 4 renal RiskAssessments, 4 review ClinicalImpressions, 10 Provenance resources |
| Actual stored PDF HTTP generation/download | PASS — 9 pages | Verified model IDs/methods, provenance, DISMISS review, permission/clinical limitations; all rendered pages visually reviewed |
| Actual signed-in browser workflow | PASS — Chromium 133.0.6943.0, 11 check groups | Real doctor UI login and API; cards, baseline vs SHAP, measured vs predicted SVG including horizontal persistence, source/created dates and forecast-origin agreement, mixed-unit Hb/source-value preservation, source limits, four review actions/required fields, Tab/Shift+Tab containment and Escape/Cancel focus restoration, visible/hidden tooltip bounds in light/dark widths 375/768/1366 |
| Independent packaged-cohort refit | PASS — 16 candidate pipelines | Refit all numeric/classification candidates from the packaged pseudonymous CSV and fixed manifest; saved validation/test metrics match without original IDs/private key |
| Local configuration script | PASS — 3 behavior checks | Dedicated matched secret with no printing, idempotent re-run, mismatch refused without overwrite |

Browser evidence verifies zero page runtime errors, zero renal write requests during review inspection, unchanged review versions after canceling dialogs, no horizontal overflow with either active or hidden tooltips and no theme-triggered clinical refetch. Four actual clinician actions were separately saved by the HTTP verifier. Screenshots and JSON reports are in `verification/renal-screenshots`.

## Database and FHIR evidence limits

The SQL and live backend fixture used PGlite 0.5.8 with a PostgreSQL wire adapter. Its startup handshake was corrected to report the actual engine `SHOW server_version` and `SHOW integer_datetimes` values for JDBC compatibility. The missing integer timestamp parameter previously produced year-2000 dates once JDBC prepared a reused query; a failing repeated-read check reproduced that defect and now passes with the corrected handshake. No production timestamp setting or stored source date was changed. Database authentication in that isolated wire fixture is an adapter stub; application password/JWT/clinical authorization were exercised for real. This is **not native PostgreSQL** or a real hospital database. The full SQL chain was executed directly for the fixture; Flyway was disabled only in that disposable live fixture. Production configuration keeps Flyway enabled.

HAPI R4 parses persisted resource projections before insertion. This is not full FHIR profile/cardinality/terminology conformance validation, nor an external interoperability certification. No dialysis Procedure or clinical follow-up order is invented without an authorized clinical source.

Native PostgreSQL/Flyway upgrade execution, actual Windows batch execution, production deployment, independent hospital validation and prospective clinical-impact evaluation were not performed. Their limits are retained below.

## Final completion checkpoint

Completion check recorded at 2026-10-10T00:37:19.303090+05:30 (Asia/Colombo). Task 3 integration and Task 4 software verification/build/documentation/package work are complete within the recorded research scope. Previously completed training was preserved; no model was retrained in this completion pass.

The final source ZIP was reopened and its checksum, CRC and complete payload verified. Trained pipelines, metadata and research reports retain their previous bytes. The test results above are retained executed checkpoint evidence; they were not relabeled as new test runs.

An additional native PostgreSQL 16.15 verification attempt could not initialize its disposable cluster: this executor maps only UID/GID 0, ownership changes return EINVAL, and creating a non-root user mapping is denied. PostgreSQL requires a non-root cluster owner. Consequently native PostgreSQL/Flyway remains UNVERIFIED; this environment failure is not reported as a product regression or a passing native database test. The included compatible-database checks remain the executed database evidence.

The two data-limited criteria below still require missing upstream raw data and patient/date-linked dry-weight observations. Clinical validation and secondary-use permission require independent evidence and are not established by packaging or operational fixtures.

## Final acceptance criteria

PASS refers to the implemented and tested scope. PARTIAL means supplied data or environment cannot establish the stronger requirement; it is not quietly converted into a pass.

| # | Criterion | Result | Evidence / material limit |
|---:|---|---|---|
| 1 | Dataset fully audited | PASS | All 5 spreadsheets, SQLite tables, notebooks, pickle inventories and missing referenced raw files recorded. |
| 2 | Reproducible cleaning | PASS | Reusable preprocessing, canonical source hashes and quality action log. |
| 3 | Stable pseudonyms | PASS | HMAC IDs; no original identifiers/private key in model artifacts; packaged-cohort reproduction works without key. |
| 4 | Longitudinal structure | PASS | Chronological same-patient sequence and causal feature definitions. |
| 5 | No patient leakage | PASS | Disjoint primary train/validation/test patients; train-only grouped CV. Separate same-cohort temporal experiment has declared overlap. |
| 6 | No target/future leakage | PARTIAL | New implementation passes causal/target tests; upstream bidirectional source interpolation cannot be excluded without raw data. |
| 7 | Hb trained/evaluated | PASS | Four regressors/four exploratory classifiers; baseline gate rejects learned numeric model for serving. |
| 8 | URR trained/evaluated | PASS | Four regressors/four classifiers, recalculated URR, honest weak held-out metrics. |
| 9 | Dry weight benchmark | PARTIAL | Descriptive legacy export vs post-HD proxy executed; genuine next-current/rolling/LOCF impossible without patient/date/current fields. |
| 10 | Existing IDH re-audit | PASS | Direct SYS-target leakage and row-level splits documented; no source events or accepted model. |
| 11 | Baselines included | PASS | Persistence, causal rolling and training mean; classification prevalence/majority baselines. |
| 12 | Honest metrics | PASS | MAE/RMSE/R²/MedAE, all classification metrics, fold/temporal results and exploratory patient-bootstrap CIs. |
| 13 | Artifacts saved | PASS | Complete newly fitted pipelines and separate preprocessors; no legacy pickle execution. |
| 14 | Metadata saved | PASS | Features, hashes, versions, partitions, outcomes, selection and limitations. |
| 15 | SHAP/XAI generated | PASS | Global plots, reconstruction check, top features and real URR inference factors; Hb baseline correctly has no SHAP. |
| 16 | ML service loads models | PASS | Real packaged artifacts loaded by Django; model digest failures handled. |
| 17 | Prediction endpoints work | PASS | Health/models and authenticated Hb/URR/dry unavailable API tests; real Spring→Django calls. |
| 18 | Authentication works | PASS | Dedicated expiring service JWT and real application role/password logins; malformed/unauthorized deny tests. |
| 19 | Spring integration | PASS | Actual client/service/controller HTTP integration; timeout/unavailable unit coverage and finite output contracts. |
| 20 | ClinicalPatientAccess enforced | PASS | Every read/write boundary scoped; doctor unassigned patient and patient-role denied in actual HTTP checks. |
| 21 | Frontend displays forecasts | PASS | Integrated shared CKD panel; actual browser confirms available Hb/URR with honest baseline/research labels. |
| 22 | G5/G5D correct | PASS | Verified maintenance context produces G5D; existing eGFR clinical-rule tests preserve G5 and no creatinine-only dialysis inference. |
| 23 | FHIR RiskAssessment integration | PASS | Actual database resources, HAPI parsing, no forecast Observation or invented probability; external profile validation remains unperformed. |
| 24 | Clinician review works | PASS | ACCEPT/MODIFY/DEFER/DISMISS saved with reason/actor/model; stale version denied; browser keyboard/modal requirements checked. |
| 25 | Audit works | PASS | Actual record/predict/review audit rows; immutable reviews and transaction-required audit. |
| 26 | PDF includes provenance | PASS | Actual stored export/download, parsed required text and nine-page visual inspection. |
| 27 | Frontend build | PASS | Fresh TypeScript/Vite production build. |
| 28 | Backend build/tests | PASS | Java 21 Maven 118 tests and executable JAR package. |
| 29 | ML tests | PASS | 10 pipeline + 12 Django tests; independent 16-pipeline reproduction. |
| 30 | Runnable full project ZIP | PASS | Complete source, new models/reports/UI/API/migration/setup files; dependencies/secrets/private raw identifiers excluded. |

## Clinical/research status

**CLINICAL_VALIDATION = NOT_COMPLETED**; **DATASET_PERMISSION_STATUS = UNVERIFIED**. New pipeline leakage checks cannot repair missing source provenance. URR held-out R² is negative and baseline-improvement bootstrap CI includes zero. No treatment target, dose, clinically approved risk threshold, early-CKD classifier or stage-progression model was derived from this cohort.

The delivered system is runnable research integration. The two data-limited acceptance items remain PARTIAL; external clinical validity and clinical effectiveness are not established.

## Reproduction and evidence files

Commands and supported prerequisites are in `RUN_SRI_LANKAN_RENAL.md`. Full changed-file inventory is in `MODIFIED_FILES.md`; artifact/file SHA-256 inventory is in `PACKAGE_MANIFEST.json`. Verification JSON contains only operational evidence and no account passwords or tokens.
