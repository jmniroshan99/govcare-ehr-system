# Predictive Clinical Intelligence architecture

> Latest UI update (2026-10-05): CKD assessment and predictive intelligence now share one patient workspace, and the modern theme is applied across the application. See `START_HERE_UNIFIED_CLINICAL_UI.md`, `docs/UNIFIED_THEME_SYSTEM.md`, `docs/CKD_WORKSPACE_INTEGRATION.md` and `docs/UNIFIED_UI_TEST_REPORT.md` for the current UI and verification status. The backend architecture and prior evidence below remain preserved.


## Scope and preserved functionality

The implementation extends the current GovCare source with a patient-specific longitudinal clinical workspace. Existing role dashboards, registration workflow, hospital/ward/bed administration, doctor notes, Spring APIs, authentication, RBAC, PostgreSQL integration and CKD classifier remain available. The existing classifier coefficients and risk equation were not changed.

This is the Phase 1 foundation plus safe model-capability interfaces. It does not train, validate or activate medical ML models. The current logistic assessment is separate from the longitudinal screen and is not presented as a future-risk model.

## Data path

1. Existing authenticated profile selects a permitted route. Frontend permissions guide navigation; backend permissions authorize access.
2. `ClinicalPatientAccess.clinicalScope` checks the stored patient, tenant, role, assignment, active account and permissions before clinical queries.
3. `PredictiveIntelligenceService` retrieves patient identity, final clinical observations, verified numeric laboratory results and patient-linked final/amended/corrected FHIR observations.
4. `ClinicalIntelligenceEngine` normalizes supported units, rejects unsuitable values/times, deduplicates repeated imports, excludes conflicting simultaneous values and computes observed trends on the server.
5. The aggregate response supplies categories, data-quality notices, safety reasons, deterministic findings, persisted review states, model availability and the latest supported clinical activity.
6. Explicit clinician actions save verified measurements or versioned reviews. Their source/evidence, feedback, FHIR resources and audit events are stored transactionally.

The frontend keeps clinical responses in component memory. Changing identity/tenant/permissions remounts the workspace; changing patients clears clinical state and aborts in-flight requests. Clinical responses are not stored in localStorage/sessionStorage. Existing authentication and theme preference storage are retained.

## Observation provenance and normalization

| Input | Clinical time | Source rule |
| --- | --- | --- |
| Clinical observation | `effective_at`, otherwise its linked active report's specimen/result/report date | Never use upload/created time as a measurement date. |
| Verified numeric lab result | Sample collection, result entry, verification or approval time | Verification/approval is result-context time, not an inferred specimen time. No unstructured-text numeric guessing. |
| FHIR Observation | `effectiveDateTime` or explicit period end | Only patient-linked resources with a matching local Patient reference and usable quantities. BP components are supported. |
| Verified result entry | Clinician-supplied instant | Explicit source confirmation and note required; no default measurement date or fabricated value. |

Original units, values, observation IDs, source IDs and available LOINC codes are retained. Creatinine µmol/L converts to mg/dL, ACR mg/mmol to mg/g and hemoglobin g/L to g/dL. Nonindexed GFR, unsupported HbA1c units, future/unknown dates, nonfinite/implausible values and conflicting simultaneous results are excluded. Invalid reference ranges are ignored with a warning; the measurement itself remains usable.

Clinical observations and FHIR projections can describe the same measurement. Identical metric/time/value imports are deduplicated. Different values at exactly the same metric/time are excluded for reconciliation; they are not averaged. Different actual collection times are retained.

Reads are bounded to 5,000 relational observations and 5,000 FHIR observations. Partial history is labeled and suppresses forecasting. Unknown dates are not backfilled during migration.

## Deterministic calculations

| Calculation | Behavior |
| --- | --- |
| Latest / previous / baseline | Use actual included measurements ordered by their clinical timestamps. |
| Absolute / percentage change | Based on the two latest included measurements. Missing comparisons remain unavailable. |
| Rolling changes | 30, 90, 180 and 365 days; at least two measurements in the window. The baseline is an actual observation. |
| Observed slope | Least-squares regression using actual elapsed time and a 365.25-day year; at least three measurements spanning 90 days. It is not a forecast. |
| G / A categories | Recorded eGFR and urine ACR measurement categories. A single abnormal result, or G1/G2 alone, does not establish CKD. |
| Persistence evidence | Current qualifying abnormality plus a qualifying prior dated result at least 90 days earlier. Described as evidence requiring clinician confirmation. |
| Renal safety | Recent laboratory creatinine change criteria. Urine output, acute illness and full medication context are not comprehensively evaluated. No automatic AKI diagnosis or clearance. |

The 90-day freshness, three-point/90-day longitudinal sufficiency and seven-metric completeness policies are local workspace policies, not guideline-mandated monitoring frequencies or model confidence. Measurement frequency must be individualized. Adult-model eligibility is not inferred for an unknown birth date or a child.

## Findings and review

Findings cover possible acute renal change, eGFR change exceeding the review threshold, missing/stale eGFR or ACR, unestablished chronicity and potassium/hemoglobin outside recorded source reference limits. Medication reconciliation is presented as a context check because a prescription does not prove current ingestion.

Recommendations have a rule version and SHA-256 evidence fingerprint. Patient and hospital are included when generating their stable IDs. A review is applied only to current server-derived evidence. New/changed evidence creates a new finding identity and cannot inherit an earlier dismissal. Version checks prevent concurrent overwrites. Request UUIDs support safe retries of saved reviews and measurements.

Accept, Modify, Dismiss and Defer all require a reason. Modify additionally requires revised recommendation text. Reviews are clinical feedback; accepting a finding does not create a diagnosis, prescription, referral or order. A deferred review is stored; timed reminders/Task scheduling are a later extension.

FHIR review write-back creates a ClinicalImpression and Provenance. Verified entry creates an Observation and Provenance. Actor identity is recorded as a GovCare user identifier rather than inventing a Practitioner resource. Existing Patient links are reused, or a linked minimal Patient resource is created from stored identity. No method-specific LOINC code is invented for manually transcribed measurements.

## Model capabilities

Seven registry rows describe eGFR trajectory, CKD progression, KFRE, AKI, hyperkalemia, cardiovascular and anemia capabilities. All start `NOT_AVAILABLE`; no runtime prediction adapter is installed. Forecast requests accept 3/6/12-month horizons and record model/version, inputs, quality and safety with `NOT_AVAILABLE`, `INSUFFICIENT_DATA` or `SUPPRESSED`. Outputs remain empty and future probabilities/uncertainty are absent.

KFRE retains its published 2/5-year horizon contract; it is not relabeled as a 3/6/12-month prediction. Registering or editing a model row does not enable an unvalidated adapter. Enabling predictions requires a separately reviewed implementation, schema extension, eligibility policy, external evaluation/calibration, uncertainty validation, monitoring and governance.

## UI and performance

The page and Recharts component are separate lazy chunks. Charts are loaded only when dated points exist. Theme, tab, chart metric and history-window changes use the existing aggregate response. Patient switch/refresh makes one aggregate request; reads are bounded, patient-scoped and avoid per-observation database queries. Mutations disable duplicate submission, keep entered text on errors and reload scoped evidence after success.

The scoped stylesheet uses existing semantic tokens, glass backgrounds and chart variables. Desktop summaries use four cards; clinical panels use two columns with responsive stacking. Dialogs use native focus containment and Escape/close behavior, visible Required badges, associated labels and inline text/icon errors. Live browser confirmation at requested viewport widths remains pending as recorded in the testing report.

## Next implementation phases

- Phase 2: reviewed trajectory adapter, horizon-specific uncertainty, external validation and eligibility; no activation from a database seed.
- Phase 3: independent outcome-specific models, validated calibration, population/slice evaluation and drift monitoring. No automatic medical retraining.
- Phase 4: separately authorized population worklists, aggregated hospital intelligence, scheduled care tasks, supported FHIR profiles and operational deployment/monitoring.

## Rule references

- [KDIGO 2024 CKD guideline](https://kdigo.org/wp-content/uploads/2024/03/KDIGO-2024-CKD-Guideline.pdf): G/A categories; chronicity practice points 1.1.3.1–1.1.3.2; subsequent eGFR change practice point 2.1.3. The workspace uses this change principle as a clinician review signal without asserting CKD in an unconfirmed patient.
- [KDIGO 2012 published AKI guideline](https://kdigo.org/wp-content/uploads/2016/10/KDIGO-2012-AKI-Guideline-English.pdf): creatinine review criteria in 2.1.1. The laboratory screen does not cover the complete urine-output criterion or establish a diagnosis.

Rules and local data-quality policies need clinical governance review before clinical deployment. No clinical-validation claim is made.
