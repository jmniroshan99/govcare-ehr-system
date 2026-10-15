# V49 — CKD assessment clinical feature integration

Saved CKD assessment measurements now reach the existing six renal intelligence cards, their current-value summary, dated charts and PDF report. The original CKD assessment, patient selector, report extraction, drafts, assessment history, coding assistance, permissions, research model adapters and clinician reviews remain in place.

This release implements measurement-based monitoring rules. It does not create a newly trained progression, AKI or anemia model, and it does not convert a snapshot monitoring band into a future-event probability.

## 1. Root cause and extended data flow

The CKD form already saved `ai_ckd_predictions.input_data`, `ai_assessment_inputs` and `clinical_observations`. The renal cards primarily consumed `sri_lankan_renal_observations`, a separate source for renal/hemodialysis entries. Thus CKD creatinine, eGFR, ACR, potassium and Hb could exist while the cards correctly found no HD observations.

`CkdPredictionService` now calls `ClinicalPredictionFeatureService.capture()` after input persistence, inside the existing assessment transaction. The service reads the saved inputs and their source observations/reports, normalizes them and appends a `clinical_prediction_features` row. It retains raw inputs, units, individual clinical dates, source associations and the assessment ID. A failed projection write rolls back with the assessment transaction.

`RenalClinicalModuleService` combines that projection with authorized clinical observation history and the existing renal/HD overview. `ClinicalFeatureMappingEngine` produces monitoring results, explanations and completeness. The original HD research readiness remains separately exposed. The browser consumes these backend results; it does not calculate clinical classifications itself.

## 2. Modified and added files

| Area | Main files | Change |
|---|---|---|
| New feature layer | `ClinicalFeatureNormalizer.java`, `ClinicalPredictionFeatureService.java`, `ClinicalFeatureMappingEngine.java` | Normalization, authorized retrieval/persistence, module mapping and explainable monitoring |
| Existing assessment producer | `CkdPredictionService.java` | Atomic feature capture after saved assessment inputs; original logistic coefficients and outputs preserved |
| Existing renal consumers | `RenalClinicalModuleService.java`, `RenalClinicalModules.java`, `SriLankanRenalIntelligenceService.java` | Unified current/history data, separate research eligibility, actual method/version attribution and unified source safety checks |
| Existing PDF export | `CkdAssessmentReportService.java` | Assessment-associated feature results, completeness, explanations, requirements, recommendations and measured charts |
| Existing UI | `SriLankanRenalPanel.tsx`, `RenalClinicalModules.tsx`, `renal-clinical-modules.css`, `renalIntelligenceService.ts` | Mapped measurements, readiness percentages, clinical/research distinction, dated charts and source provenance |
| Existing workflow integration | `CKDRiskResultDashboard.tsx`, `CkdClinicalWorkspace.tsx`, `PredictiveClinicalIntelligence.tsx` | Refresh after each assessment, patient-preserving tab navigation and shared measurement form |
| Shared existing form | `ClinicalMeasurementDialog.tsx` | Extracted the existing verified-measurement dialog; reused its fields, units, source verification, API and request UUID handling |
| Migration and verification | `V45__unified_clinical_prediction_features.sql`, `verify-clinical-feature-migration.mjs`, `verify-live-postgres-v45.mjs`, `verify-clinical-feature-browser.mjs`, `clinical-feature-contracts.test.cjs` | Additive backfill, storage constraints, native target verifier and regression evidence |

The exact file list, including verification artifacts and rebuilt frontend assets, is in `MODIFIED_FILES_V49_CLINICAL_FEATURE_LAYER.txt`. Previous release reports and evidence are retained.

## 3. Database changes

Flyway migration **V45** adds `clinical_prediction_features`. Existing migrations are unchanged.

Required columns are present: `id`, `patient_id`, `observation_date`, `creatinine`, `egfr`, `acr`, `potassium`, `hemoglobin`, `hba1c`, `proteinuria`, `source`.

Additional columns preserve tenant scope and provenance: `hospital_id`, `source_assessment_id`, `recorded_at`, `raw_inputs`, `feature_metadata`, `normalization_version`, `created_at`. Supporting fields include age, BMI, systolic/diastolic pressure, glucose, BUN, edema, family history, previous AKI and NSAID-use input.

The migration backfills existing saved CKD assessments, normalizes supported explicit units, and preserves every original assessment row. It does not create dialysis observations, pair unrelated samples or replace absent values with zero. `observation_date` is nullable: an undated assessment remains useful for snapshot monitoring. Per-feature dates in `feature_metadata` govern chronology; the row date is a summary of actual source dates and is not assumed to apply to every parameter.

Composite foreign keys bind the feature row to the same hospital/patient/assessment. The assessment association is unique. Numeric bounds, JSON shape and date constraints are enforced, and an append-only trigger prevents projection updates/deletes. Patient/date indexes support retrieval. The shared SQL normalizer/date helper serves backfill; new assessment capture uses the corresponding tested Java normalizer.

## 4. Feature mapping and clinical semantics

| Existing card / key | Available input use | Result and limitations |
|---|---|---|
| CKD Progression / Renal Trajectory — `renalTrajectory` | Creatinine, eGFR, protein in urine, ACR; age, SBP, DBP, fasting glucose, HbA1c as supporting context | Low / Moderate / High qualitative monitoring band; actual values and available dated trends. No progression probability or forecast horizon |
| Kidney Failure / G5D — `kidneyFailureStatus` | eGFR, creatinine, protein in urine, ACR and verified dialysis context | High kidney-failure monitoring signal for eGFR <15 or verified chronic maintenance HD. A low eGFR alone never assigns G5D |
| Hyperkalemia — `hyperkalemia` | Generic serum potassium; actual pre/post-HD results remain separately identified | <5.0: below the hyperkalemia monitoring threshold; 5.0–5.5 inclusive: Monitor; >5.5: High monitoring signal. The low band does not exclude hypokalemia |
| Anemia / Hb — `anemia` | Current Hb and independently dated Hb history | <10: anemia monitoring signal; 10–12 inclusive: Monitor; >12: above the configured low-Hb band. These are project monitoring bands, not universal normal ranges |
| Dialysis Adequacy / URR — `dialysisAdequacy` | Actual pre/post urea from one verified session, with the session date | URR = ((pre − post) / pre) ×100. Without a valid session: “Requires hemodialysis session data.” General CKD BUN cannot supply this result |
| AKI / Renal Deterioration — existing `renalDeterioration`, plus root `akiRisk` | Current and previous creatinine with distinct actual dates | Measured percentage change and an explicit baseline/date requirement. The existing directional deterioration composite remains available as separate evidence |

The progression band condenses the eGFR/ACR grid: High if eGFR <45, ACR >300, or eGFR <60 with ACR ≥30; Moderate if eGFR <60 or ACR ≥30; Low requires both eGFR ≥60 and ACR <30. A normal-looking single marker does not manufacture a Low band when the other marker is unknown. Creatinine, proteinuria, BP and glycemic measurements remain explicit context; no unsupported weights or fixed creatinine cutoff are invented. Creatinine is described as above range only when a valid source reference range and its units are recorded. Glucose/HbA1c do not confirm a diabetes diagnosis.

AKI percentage change uses the requested formula. An acute creatinine review signal requires a rise ≥0.3 mg/dL within 48 hours or ≥1.5 times a dated baseline within 7 days. The engine checks relevant baselines in the window, not only the latest previous point. A monthly change remains a trend. Historical results and verified maintenance-HD context do not generate a current acute AKI claim; urine output and clinical diagnosis are not inferred. The Hb decline rate is `(previous Hb − current Hb) / elapsed days`, so improvement produces a negative decline rate.

## 5. Readiness, dates and explanations

Every active card receives backend `clinicalDataReadiness`: percentage, available count, parameter count, missing count and policy. Percentage is rounded `100 × available / listed parameters`; it is not diagnostic certainty or disease probability. Denominators are explicit: progression 9, kidney failure 5 including dialysis verification, current potassium 1, current Hb 1, measured URR 3, and AKI change 4 including both values/dates. A monitoring band can be available from sufficient renal evidence before the complete supporting profile is present.

Undated values support snapshot monitoring; they cannot create trend points or an AKI baseline. Actual dated values remain independently usable when other parameters are undated. Future/invalid dates, invalid values/units and conflicting same-time results are excluded. Repeated equal same-time results count once. Stale results are explicitly historical. Fractions of a second are compared as instants. Source records already represented by the assessment projection are not counted again as supplemental observations, avoiding false retrieval truncation.

Cards show “Why?”, current values/units/dates, factual eGFR/ACR/creatinine changes, Hb decline rate, missing requirements and useful actions. Available parameters appear as compact chips; the full checklist and provenance are expandable. Missing values do not become a stable trend or a zero-risk result.

Research model installation, cohort eligibility, current HD sampling, supported interval, predictor coverage and safety remain separate. Generic CKD potassium/creatinine are never relabeled pre/post-HD. Source safety also applies at the actual prediction API: extreme/conflicting potassium or a truncated unified source history suppress research inference and stored numeric forecast display. Model artifacts, feature contracts, monthly-cohort gates and training weights are retained.

## 6. API changes and workflow compatibility

No existing route was removed or replaced.

| Existing endpoint | Change |
|---|---|
| `POST /api/ai-cdss/ckd/predict` | Saves the normalized projection in the existing assessment transaction; input/request/source contract unchanged |
| `GET /api/ai-cdss/ckd/patients/{patientId}/predictive-intelligence` | Schema **3**; preserves the six module keys/order and adds `clinicalFeatureData`, `akiRisk`, per-card `clinicalAssessment`, `researchReadiness`, `researchStatus`, `researchModel` and clinical completeness |
| `POST /api/ai-cdss/ckd/patients/{patientId}/observations` | Existing verified generic measurement API is reused by historical/current-data actions; no HD sampling claim is added |
| `POST /api/ai-cdss/ckd/patients/{patientId}/renal-intelligence/observations` | Existing dialysis/renal source entry remains the URR session workflow |
| `POST /api/ai-cdss/ckd/patients/{patientId}/renal-intelligence/dialysis-status` | Existing explicit clinician verification remains required; no lab value is manufactured |
| `POST /api/ai-cdss/ckd/patients/{patientId}/predictive-intelligence/reviews` | Same immutable snapshot, module key, request UUID, expected version and clinical reason contract; primary method/version identify the actual mapping rule |
| `POST /api/ai-cdss/ckd/assessments/{id}/report` | Same export endpoint; uses an assessment-associated saved renal snapshot, or maps the requested saved assessment and prior available clinical records without calling ML |

The general `/intelligence` overview remains distinct from the six-module response. Authentication, RBAC, `ClinicalPatientAccess`, patient/hospital association checks, cancellation, audit and FHIR R4 resources remain in use. FHIR clinical impressions link CKD assessment sources and identify monitoring as clinical review support. No new confirmed Condition is created by the mapping rules.

## 7. UI and PDF behavior

The existing CKD results refresh renal intelligence after each completed assessment. The top summary now shows mapped creatinine, eGFR, potassium and Hb; dated CKD feature history supplies clinical creatinine, eGFR, ACR, potassium and Hb charts. Existing HD-specific series remain separate.

Historical-data actions reuse the existing verified-measurement form with the appropriate generic metric selected. Actions for unsupported form fields return to the existing CKD assessment view with the same patient. Dialysis entry/verification and the accessible desktop/mobile review drawer retain their original APIs and permissions. Clinical monitoring, separate research forecasting and missing-session states are visible together.

PDF export includes the original assessment summary/inputs and the mapped six-card monitoring page, completeness, “Why?”, actual dated mini-charts, AKI/Hb changes, missing-data explanation, source evidence and clinical recommendations. It does not print an HD-domain “0/2” checklist as if a valid generic CKD creatinine trend were absent. The report distinguishes URR measurement from next-period forecasting and does not invent a risk percentage.

## 8. Fresh testing results

| Verification | Result | Evidence |
|---|---|---|
| Spring complete suite | **196 passed; 0 failures/errors/skips** | Includes 46 production controller mappings, existing authorization/review/FHIR/PDF tests and new feature tests |
| Django renal suite | **17 passed**, system check clean | Real packaged inference/authentication regression; no model retraining |
| Affected Node/client/startup suite | **95 passed** | Existing routes/payloads, generic-history contract, workspace, graphics, units and startup behavior |
| Feature migration/backfill | **31 checks passed** | Existing-table CKD rows migrated, values/dates/units preserved, tenant FK/uniqueness/immutability and invalid input handling |
| Six-module persistence | **14 checks passed** | Snapshot/review storage, scope, null-score invariants and append-only behavior through V45 |
| Responsive current-feature UI | **27 checks passed**, no runtime errors/overflow | Actual components at 1366/768/375; migrated CKD responses, charts, forms, verification, URR, review and read-only actions |
| Legacy readiness UI | **21 checks passed**, no runtime errors | Preserved schema-2 modules, safety/error/installation states, drawer and source workflows |
| TypeScript + Vite | **Passed** | Fresh production build |
| OpenPDF | **Passed** | Actual dated/undated reports parsed and final pages visually inspected |

Two regression tests first failed against V48 because saved CKD measurements did not reach monitoring results. Their baseline failures and fresh successful evidence are retained in `verification/clinical-feature-v49/`.

The database tests use isolated **PGlite PostgreSQL WASM**, not native Windows PostgreSQL. The fixtures are actual saved CKD assessment rows in the existing schema, backfilled by V45 and consumed by Java mapping/PDF tests. They are operational software fixtures, not private clinical patients. Browser tests intercept HTTP boundaries while exercising the actual components and forms; a signed-in native full-stack patient session is not claimed. Readiness percentages and measured change percentages in samples are arithmetic results, not clinical model probabilities.

Screenshots and two operational PDF samples are included with the evidence. Exact commands/results and release preservation hashes are supplied. Clinical validation, dataset permission verification and probability calibration are not established by these software tests.

## 9. Target-machine upgrade and verification

Extract the full V49 archive into a new folder. Retain the existing database and copy the previous private runtime `.env` files into their matching locations. Run the existing setup/start launchers as required for that environment. Spring startup applies additive Flyway V45; do not edit old migration checksums or reset the patient database.

```powershell
npm ci
start-renal-fullstack-windows.bat
```

After the API starts, the added read-only native verifier checks successful Flyway V45, required columns/constraints, the immutable trigger and assessment/backfill counts without printing patient values:

```powershell
npm run test:postgres:v45
```

The existing `verify-target-windows-postgres.ps1` also includes this check. Software fixture commands are:

```powershell
npm run test:ckd:features
npm run test:renal:six-modules
```

For a real authorized patient, complete the existing CKD form and confirm the displayed values match its saved assessment. Verify the two available-current monitoring cards, progression and kidney-failure indicator, baseline/date guidance, and PDF export. Enter actual prior laboratory dates for trend verification; enter genuine paired session data for URR. Native Windows/PostgreSQL and this authenticated patient flow remain target-machine checks.

## 10. Clinical references and interpretation limits

- KDIGO 2024 CKD guideline: https://kdigo.org/wp-content/uploads/2024/03/KDIGO-2024-CKD-Guideline.pdf — renal markers, chronicity and risk interpretation.
- National Kidney Foundation classification: https://www.kidney.org/how-to-classify-ckd — GFR/albuminuria categories.
- KDIGO AKI guideline: https://kdigo.org/wp-content/uploads/2016/10/KDIGO-2012-AKI-Guideline-English.pdf — timing-dependent creatinine criteria and clinical interpretation.

The configured potassium/Hb bands follow the requested monitoring specification. They do not define universal reference ranges, exclude other abnormalities, confirm diabetes/AKI/CKD or prescribe treatment. A single abnormal eGFR/ACR does not establish chronicity. Verified chronic maintenance dialysis is required for G5D and cohort model eligibility. The existing Hb persistence forecast remains a baseline, and research forecasts retain their clinical-validation limitations.
