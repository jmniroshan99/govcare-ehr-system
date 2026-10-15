# Project analysis and implemented changes — V41

## Project identification and architecture

Base project: GovCare EHR Modern Clinical Intelligence V40, supplied as a full source archive. Source dataset project: e19 AI-Driven Renal Care Management for Hospitals in Sri Lanka. The source repository contains 5 spreadsheets, 24 notebooks, 5 legacy pickle artifacts, a Django SQLite file, and a separate React/Express/MySQL application. The SQLite clinical tables contain no source clinical cohort; legacy pickle metadata was inspected statically without execution.

GovCare remains React 19 / TypeScript / Vite → Spring Boot 3.5.3 / Java 21 → PostgreSQL/Flyway + HAPI FHIR R4. The new stateless `ML_Server` runs Django with dedicated service JWT authentication. The existing optional FastAPI service and existing GovCare modules remain available under their original launch/configuration paths. No detached alternative EHR was introduced.

The authenticated patient workflow is React shared API client → Spring role/permission and ClinicalPatientAccess → scoped server-stored verified history → dedicated short-lived JWT → Django reviewed artifacts → Spring immutable snapshots/audit/FHIR → integrated UI. The browser has no access to the dedicated ML service credential.

## Problems and their causes

| Finding | Cause/evidence | Implemented resolution |
|---|---|---|
| Repeated-patient validation leakage in legacy notebooks | Row-random splits of longitudinal rows | Patient-disjoint split and train-only GroupKFold; distinct purged temporal experiment |
| Possible upstream temporal leakage | Bidirectional interpolation before splitting; referenced raw files absent | Causal new features/targets; explicit unresolved provenance flag in reports, API and UI |
| Implausible confidence in legacy model metrics | Original fitted artifacts and evaluation exports are not new grouped validation | Newly executed multi-algorithm comparisons; original pickle files not executed |
| Hb model does not beat persistence | Validation XGBoost MAE 1.0432 vs persistence 0.9792 | Prespecified baseline gate fails; honest persistence forecast and baseline explanation |
| URR generalization remains weak | Held-out MAE 11.0023 percentage points and R² −0.0199 | Research-only output, actual metrics/limitations, mandatory clinician review |
| Invalid numbers/duplicates/units | 5 duplicate rows; Hb `SS`; post-HD creatinine `S`; post-urea exceeding pre-urea; missing absolute urea units; uric acid unit mismatch | Logged quality actions, invalid outcomes unavailable, explicit normalization, no clamping; ambiguous variables excluded |
| Dry-weight grouped/temporal validation unsupported | Export has no patient/date/current-dry-weight fields | Descriptive proxy comparison only; no accepted model/runtime |
| IDH target leakage | SYS-derived label with SYS retained as predictor; session dataset missing | Re-audit documented; no reused model or fabricated event counts |
| EHR/service integration absent for this cohort | Different technology stacks and no reviewed shared contracts | New Django API, Spring client/controller/service and integrated renal panel |
| Predictions could be confused with laboratory values | Forecast data require a different provenance and resource type | Measured Observation, predicted RiskAssessment, separate solid/dashed chart series and review provenance |
| Mixed-unit source history obscures forecasts | Stored Hb can be `g/L` while forecast output is `g/dL`; other source units also differ | Explicit chart-only Hb/albumin/creatinine/whole-urea conversions; unsupported units are omitted and explained; original source values/units remain intact |
| Renal SVG rendered with zero width | The global `.recharts-wrapper { max-width: 100%; }` rule constrains Recharts' explicit measured wrapper inside its zero-width sizing element | Scoped renal wrapper override; actual checkpoint DOM reproduced width 0 before and 1148 px after; signed-in browser validates visible solid/dashed series |
| Review dialog keyboard/lifecycle failures | Native Tab can move to browser chrome; unmounting an open dialog prevents focus restoration; queued native close events can dismiss a reopened dialog during React StrictMode effect replay | Explicit visible/enabled Tab/Shift+Tab cycling; close the native modal before unmounting, synchronize dismissal with React state, and ignore stale close events; browser verifies immediate reopening, Escape/Cancel focus restoration and no saved clinical changes |
| Shared CKD page overflows a 375 px mobile viewport | The AI assessment switcher label/select retained a 407 px intrinsic flex width, producing 438 px document width | Bound the existing label/select to their container and allow wrapping; navigation and assessment options retain their existing behavior |
| Hidden renal tooltip causes overflow after desktop-to-mobile resizing | Recharts retains an off-screen desktop translation on its hidden tooltip wrapper; corrected actual dates exposed this interaction in the forecast chart | Remove only the hidden tooltip's layout footprint, bound visible tooltip width and wrap its text; actual browser checks hover the future point and verify visible/hidden tooltip bounds in six light/dark layouts |
| Disposable verification adapter distorted dates after repeated reads | Its startup handshake omitted the engine's `integer_datetimes` parameter; JDBC decoded integer binary timestamps as floating-point seconds after statement preparation, displaying year 2000 | Correct the private fixture handshake using the actual engine setting; repeated HTTP reads verify measured, snapshot and review instants; browser checks match measured/created dates and forecast origins. Production timestamp configuration is unchanged |

## Implemented changes

- Reproducible preprocessing/training/evaluation/XAI modules under `ml-training`, HMAC pseudonyms, chronological feature contracts, immediate subsequent targets, group manifests, hashes and package versions.
- Dedicated stateless Django endpoints, algorithm/issuer/audience/lifetime/role/scope/UUID JWT checks, strict input units/dates/limits, artifact digest verification and unavailable/insufficient results.
- Spring clinical access checks at every patient boundary, patient's hospital scoping, server-built history, fixed supported model keys, request idempotency, finite output/unit/status validation, bounded HTTP timeout and structured service errors.
- Additive V41 migration reusing existing prediction snapshots/registry, introducing verified renal source observations and append-only clinician reviews. Tenant/model identity foreign keys, unique constraints, immutable triggers and JSON/status constraints preserve existing 3/6/12-month workflows.
- Scoped renal JSON serialization preserves explicit unavailable prediction/probability/interval nulls and nested baseline contribution nulls despite the original Spring NON_NULL configuration; stored JSONB decoding and HTTP serialization have dedicated regression coverage.
- All four clinician actions with mandatory reason, MODIFY interpretation, optimistic versions and immutable event history. Audit failure rolls back the clinical transaction; review does not replace a measured result.
- FHIR measured Observations and explicitly verified maintenance-dialysis Condition; forecast RiskAssessment and source/model Provenance; review ClinicalImpression and Provenance. No performed dialysis Procedure is invented without a verified procedure record. Existing encounter/follow-up modules remain the appropriate source for those resources.
- Stored forecasts/provenance/review/limitations appended to the existing assessment PDF. Export performs a scoped read and does not generate a new prediction.
- Shared CKD workspace cards, seven measured trend selectors, forecast/empirical interval distinctions, source-verified observation entry and accessible review dialogs.
- Unit-conversion regression tests and signed-in mixed-unit chart/source-table checks; scoped chart-sizing repair and bidirectional review focus cycling complete the resumed Task 3 checkpoint.
- Timestamp contract checks cover JDBC statement reuse, forecast-origin agreement, snapshot/review times and actual rendered dates; snapshot creation dates also expose their ISO value through a semantic `time` element.
- Local renal configuration tests verify matched dedicated credentials, secret-free console output, idempotent setup and mismatch refusal without overwriting either service.
- Windows setup/start scripts, dedicated local configuration and dependency pins; unchanged existing launch workflow remains available.

## Clinical meaning and boundaries

The supplied cohort supports retrospective next-observation Hb/URR research in maintenance hemodialysis, not CKD-vs-non-CKD or G1→G5 progression. A current explicitly clinician-verified maintenance-hemodialysis source establishes the G5D display. Otherwise existing eGFR clinical rules apply; neither creatinine alone nor an ML forecast establishes dialysis status.

No source research subject is imported as a real EHR patient. Operational tests use clearly named fixtures and count zero clinical-validation subjects. Dataset permission remains UNVERIFIED. Research probabilities and clinical thresholds are not deployed; continuous forecasts return probability=null and require review.

## Research contribution supported by this implementation

An implemented FHIR R4-compatible EHR-integrated explainable predictive clinical intelligence framework combining longitudinal Sri Lankan hemodialysis data, patient-aware causal forecasting, explicit baseline selection, data-quality gating, clinician-controlled interpretation, and auditable model/prediction provenance. This is an engineering/research contribution demonstrated by executed internal evaluation and operational verification; it is not proof of clinical effectiveness or external novelty priority.

## Next evidence needed

Recover the precleaning raw source data and permitted secondary-use documentation; verify original lab units and dialysis provenance; collect patient/date-linked dry-weight and IDH events; predefine clinically approved endpoints and calibration; run native PostgreSQL/Flyway and Windows checks in the deployment environment; evaluate an independent hospital and prospective clinician workflow before clinical deployment.
