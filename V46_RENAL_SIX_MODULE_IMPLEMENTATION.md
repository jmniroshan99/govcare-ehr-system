# GovCare V46 — six renal intelligence modules

## 1. Project identification

Updated the supplied GovCare V44 project through the current V45 working copy. This is the existing React / Spring / PostgreSQL / Django application, with the V45 research infographic retained. The complete source, packaged research artifacts, migration chain, prebuilt frontend, scripts and original verification evidence are included.

## 2. Architecture changes

The selected authorized patient remains owned by the existing CKD workspace. Both the assessment result and Predictive Clinical Intelligence overview now render `SriLankanRenalPanel` with `RenalClinicalModules`. React calls Spring only. Existing clinical authorization runs before patient queries, predictions, review and export. The existing server-issued scoped JWT connects Spring to stateless Django inference.

New `RenalClinicalModules` assembles monitoring rules and stored model outputs without running ML. `RenalClinicalModuleService` persists an immutable, evidence-fingerprinted six-module snapshot and append-only module reviews. Repeated reads of the same evidence reuse the snapshot. New measurements or model outputs produce new evidence snapshots and require fresh review.

## 3. Old modules replaced

The active `DiseaseProbabilityPanel` call in `CKDRiskResultDashboard` was replaced. The separate old capability grid was removed from the clinical overview. Active AKI and cardiovascular outcome cards are replaced by renal deterioration and dialysis adequacy. Legacy disease adapters, API contracts, historical probability snapshots and their tests are retained for compatibility; they are not presented as installed renal prediction models.

## 4. New six-module implementation

| Order | Module | Actual method and behavior |
|---|---|---|
| 1 | Renal Clinical Trajectory | Longitudinal Trend. Creatinine, urea, K, Hb, albumin and paired-session URR; Stable / Improving / Declining / Mixed / Insufficient data. Current and previous measurements, elapsed-time mini graphs, usable points and reliability. No G1-to-G5 prognosis. |
| 2 | Kidney Failure / G5D | Clinical Rule. G5D requires current explicit clinician-verified maintenance HD. Persistent abnormal eGFR evidence may support a G5 review label; clinician confirmation is required. High creatinine does not establish G5D. Evidence and verification date are displayed. No failure probability. |
| 3 | Hyperkalemia Monitoring | LK-RENAL-HYPERK-1.0. Actual stored next-period pre-HD K >=5.5 mmol/L classifier output, labelled Research Risk Score; no invented high/moderate/low cutoffs. Measured pre/post K and difference, SHAP associations, version, population and limitations. Extreme current K blocks research inference for source/clinical review. |
| 4 | Anemia / Hb Deterioration | Persistence Baseline. Carries forward the latest measured Hb because learned candidates failed the persistence comparison gate. Declining/increasing/stable Hb trends; no fabricated anemia classifier probability or claim that XGBoost/LightGBM is serving Hb. |
| 5 | Dialysis Adequacy / URR | LK-RENAL-URR-1.0 continuous next-period research forecast. Current URR is recalculated from valid paired pre/post urea in the same verified session and explicit compatible source units. Previous/current URR, trend, actual stored forecast and limitations. No dialysis context means Not applicable. |
| 6 | Renal Clinical Deterioration | Transparent Composite. Cr/urea/K rising; Hb/albumin/URR falling. Only valid comparable domains count. At least three evaluable domains are required. The directional component percentage is explicitly not a disease probability or validated prognosis score. |

Statuses distinguish available monitoring/output, insufficient history, missing installed artifact, not applicable HD context, research capability and a blocked safety gate. Missing numbers stay null, never zero. Existing wide plausibility boundaries, explicit unit conversion, chronological observation dates and data-quality flags are applied. URR is not accepted from an unverified source-supplied percentage.

## 5. Modified files

See `MODIFIED_FILES_V46_RENAL_SIX_MODULES.txt` for the complete change list. Major additions are the Java assembler/service/controller, Flyway V43, the typed six-module React component and CSS, three Java test classes, and database/browser/native-PostgreSQL verification scripts. The frontend `dist/` is regenerated.

## 6. Database / Flyway

Additive `V43__renal_six_module_snapshots.sql` creates `renal_clinical_module_snapshots` and `renal_clinical_module_reviews`. It enforces patient/tenant foreign keys, exact module order, source-fingerprint uniqueness, review-version uniqueness, mandatory review reason, Modify interpretation, null nonclassifier risk scores and bounded actual hyperkalemia scores. Snapshots and reviews reject updates/deletes. Previous migrations are unchanged.

## 7. API changes

- `GET /api/ai-cdss/ckd/patients/{patientId}/predictive-intelligence` returns patient/hospital IDs, snapshot ID, generated time, quality, the ordered six modules, source observations, stored predictions and clinician-review status. Response uses explicit JSON nulls and `Cache-Control: no-store`.
- `POST .../predictive-intelligence/reviews` accepts snapshot UUID, request UUID, module key, expected review version, Accept/Modify/Defer/Dismiss, reason, note and optional revised interpretation. Scope is derived from the signed-in principal and stored patient; the body cannot select a different tenant.
- Existing observation, research-prediction and historical prediction-review endpoints remain supported. Numeric inference runs only when the clinician selects Run research prediction and prerequisites are met.

## 8. ML mapping

Packaged Hb, URR and hyperkalemia models and metadata are retained without retraining or modifying artifact bytes. SHA-256 verification remains before loading. Hb baseline serving no longer unpickles an unused learned candidate. URR uses its packaged research regressor; hyperkalemia uses its packaged research classifier. Ordered features and target metadata remain exposed in the Django output/registry. Missing artifact dependencies fail closed. Feature extraction and preprocessing remain matched to the packaged pipelines.

The research population is Sri Lankan maintenance-HD longitudinal data. Monthly next-observation support is 14–62 days; a +30-day display anchor is not a per-session horizon. Clinical validation remains NOT COMPLETED, probability calibration is not established and dataset permission remains UNVERIFIED. SHAP shows model associations, not causation.

The packaged CSV retains `uric_acid_source` and `urr_source`; unverified source units are not guessed or promoted to model predictors. There is no verified structured dialysis-access field in the serving contract. No new values for these fields were manufactured. Verified diagnosis/dialysis evidence and dates retain the existing clinical/FHIR paths.

## 9. FHIR

Existing source measurements remain Observation resources, explicitly verified maintenance dialysis may create a clinician-sourced Condition, and research predictions remain RiskAssessment resources. New trajectory/composite snapshots and module reviews produce parseable ClinicalImpression and Provenance resources, with the patient, source sessions, actor, timestamp, snapshot, method and version. Model predictions are not written as measured laboratory Observations or autonomously confirmed diagnoses. Existing care plans and assessment coding workflows are retained.

## 10. PDF

The CKD PDF now renders all six modules in the same row order, small measured trend charts, actual stored risk/forecast values, method/version/validation, source evidence, explanations and review status. Unsupported legacy six-outcome tables are no longer in the active report. Production export reads the latest stored authorized six-module snapshot and does not contact Django or generate new inference. If no snapshot exists, the report explicitly identifies this and shows available stored evidence rather than inventing historical outputs.

Footer text: Clinical Decision Support / Research Use. Outputs require clinician interpretation. Research-model outputs are not independently validated diagnoses.

## 11. Fresh testing results

| Check | Result |
|---|---|
| Full frontend TypeScript / Vite production build | Passed |
| Java 21 / Maven Spring suite | 135 tests passed, 0 failures/errors |
| Django system check and actual packaged model inference/auth tests | Check passed; 15 tests passed |
| Targeted frontend / access / CKD / units / launcher checks | 67 passed |
| Preserved disease-adapter and role regression checks | 66 passed |
| Original renal persistence regression through complete migration chain | 28 checks passed |
| New V43 snapshot/review persistence checks | 14 checks passed, all 42 migration files applied |
| Actual six-module React browser component | Four checks passed; 1366/768/375 widths; 3/2/1 columns; no overflow or runtime errors; read-only controls disabled; review Modify form and empty history checked |
| Actual OpenPDF six-module report | Parsed and visually inspected; order, research-score provenance, method and disclaimer verified |
| New snapshot/review FHIR | HAPI parser tested; authorization, cached snapshot reuse, null retention, actor/method/review persistence and optimistic conflict tested |

Evidence is in `verification/*v46*` and `verification/renal-six-modules-v46/`. Browser data is a Java-assembled operational fixture, not a simulated signed-in clinical session. These checks are software verification, not clinical validation.

## 12. Known limitations

Native Windows/PostgreSQL/Flyway and a signed-in multi-service HTTP/browser session were not executed here. Native PostgreSQL could not be launched under this runtime's single-UID restriction (`setresuid` is unavailable); database verification used PostgreSQL-compatible PGlite. The genuine local verification scripts were extended for V43 and six modules and must be run against a disposable target installation with authorized fixture accounts. No live test was falsely reported as completed.

Fresh or sufficiently complete patient history is required to run the monthly research models. Older predictions are suppressed from current six-card scores when their source observation is superseded. The directional composite is an equally weighted heuristic using the latest two valid values per domain and a 1% neutral band. Dry-weight prediction remains unavailable and appears only inside the retained, collapsed model-history area.

## 13. Exact Windows startup / build instructions

From the extracted project root, use Node 22.12+ or 24, Java 21, Maven 3.9+, Python 3.12 and the configured local PostgreSQL installation. Keep existing `spring-api/.env` and `ML_Server/.env` credentials/configuration. For a fresh installation only, copy the respective `.env.example` files and fill in the actual local values as described in the existing setup guides.

```bat
npm ci
npm run renal:configure
py -3.12 -m venv ML_Server\.venv
ML_Server\.venv\Scripts\python.exe -m pip install -r ML_Server\requirements.txt
npm run build
mvn -f spring-api\pom.xml clean test
ML_Server\.venv\Scripts\python.exe ML_Server\manage.py check
ML_Server\.venv\Scripts\python.exe ML_Server\manage.py test renal_service -v 2
npm run test:renal:six-modules
npm run dev:renal
```

`dev:renal` uses the existing full-stack launcher and adds the configured renal inference service. In a separate terminal after Spring has applied migrations:

```bat
npm run test:postgres:v42
npm run test:postgres:v43
verify-target-windows-postgres.bat
```

For the genuine disposable patient flow, supply the private local role-account fixture file documented in `TARGET_WINDOWS_POSTGRESQL_VALIDATION.md`:

```powershell
$env:GOVCARE_VISUAL_ACCOUNTS="C:\private\govcare-local-renal-accounts.json"
$env:GOVCARE_RENAL_TEST_MUTATIONS="disposable-local"
node scripts\verify-renal-api.mjs
npm run test:ckd:pdf:live
```

The fixture file contains authorized operational accounts and a disposable patient; it is intentionally not packaged. The automated target Windows script checks Flyway V42 and V43, Spring, Django, frontend and six-module persistence. Use its existing AccountsFile argument for genuine local HTTP verification.

## 14. Complete ZIP

`GovCare_V46_Six_Renal_Intelligence_FULL.zip` contains the full application with the new six modules, backend/API/FHIR/PDF changes, V43, packaged ML artifacts, updated tests and Windows verification. Dependency caches, private runtime configuration, generated operational fixtures and temporary browser screenshots are excluded. The research PNG and widescreen presentation PDF from V45 remain packaged as optional research resources.
