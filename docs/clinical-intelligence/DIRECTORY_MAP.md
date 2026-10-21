# Source tracing and directory map

Paths are relative to the repository root. [Exact changed-file inventory](../../verification/clinical-intelligence-v2/changed-files.json) is generated from the working tree and excludes compiled files, caches, application logs, storage and environment secrets. Earlier changes in the same workspace remain preserved.

| Location | Responsibility and traced data |
|---|---|
| `src/components/ai/CkdClinicalWorkspace.tsx` | Existing `/ai-cdss/ckd` assessment/outlook route and patient/view URL state. |
| `src/components/ai/SriLankanRenalPanel.tsx` | Authorized patient load, stale-request/abort protection, actual source entry, added same-session urea identifier and pre/post collection times; report receives current snapshot UUID. |
| `src/components/ai/RenalClinicalModules.tsx` | Active parent now renders the saved-contract clinical dashboard; retains review/missing-data drawers and supplementary renal status. |
| `src/components/ai/CkdRelatedClinicalDashboard.tsx` and `ckd-related-clinical-dashboard.css` | Five cards, unresolved priorities, source warnings, counts, actual rule/model explanations, evidence expansion and review actions. No frontend severity calculation. Chart x positions use real collection times. |
| `src/components/ai/CKDRiskResultDashboard.tsx`, `CkdFiveYearOutlook.tsx` | Report selection forwards displayed clinical/outlook snapshots. Existing CKD screening output has explicit model-score semantics. |
| `src/services/renalIntelligenceService.ts`, `aiCdssService.ts` | Typed v4 contracts, sampling context and PDF snapshot-selection payload. |
| `src/lib/ckdClinicalRiskDashboard.ts` | Compatibility presentation helpers; canonical coverage is preferred. |
| `spring-api/.../ai/ClinicalFeatureNormalizer.java` | Source units/date/quality normalization, original values, optional iron/CBC fields, explicit patient/hospital and encounter/specimen/sample metadata. Invalid/unreliable/conflicting sources are excluded from clinical calculations. |
| `spring-api/.../ai/ClinicalPredictionFeatureService.java` | Loads authorized recorded assessments/measurements and documented context; retrieves recorded demographics, never infers sex/diabetes. |
| `spring-api/.../ai/ClinicalFeatureMappingEngine.java` | Source collection/history, conflict and date rules, comparable observed trends, BP pair verification, safety gates and v4 publication. |
| `spring-api/.../ai/ClinicalRuleRegistry.java`, `ClinicalIntelligenceRules.java` | Versioned deterministic definitions and shared result contracts; potassium/Hb/progression/URR rules, evidence, future-output separation and ordered review priorities. |
| `spring-api/.../ai/UreaReductionRatio.java` | Authoritative same-session calculator shared by ingestion, source canonicalization and saved clinical results. Invalid pairs return null and named reasons. |
| `spring-api/.../ai/SriLankanRenalIntelligenceService.java`, `RenalClinicalModules.java` | Stored measured observations, source checks, inference gates, numeric normalization, immutable predictions and review/FHIR persistence. No composite disease percentage. |
| `spring-api/.../ai/RenalClinicalModuleService.java` | Tenant/patient scope; source fingerprint; immutable saved v4 snapshot; optimistic/idempotent append-only review, historical/export selection and FHIR saved-contract extension. |
| `spring-api/.../ai/RenalPredictionFhir.java` | Pure FHIR builder: continuous forecasts in ClinicalImpression; research classifier score in RiskAssessment extension, not probability fields; actual model/horizon/quality/interval provenance. |
| `spring-api/.../ai/CkdAssessmentReportController.java`, `CkdAssessmentReportService.java`, `ClinicalIntelligencePdfSummary.java` | Explicit saved-snapshot report selection; PDF uses stored contracts without inference; readable summary, exact coverage, severity warnings and detailed source/review appendix. Legacy snapshots retain a compatibility formatter. |
| `spring-api/.../ai/CkdOutlookEngine.java`, `CkdOutlookService.java`, `predictive/KfreFourVariableEquation.java` | Existing two-/five-year published equation, separate population/source eligibility, actual horizon thresholds and saved selected outlook export. |
| `spring-api/src/main/resources/db/migration/V48__renal_sampling_context.sql` | Adds nullable-in-meaning JSON metadata with empty legacy default. No historical timestamps or sessions are inferred. Version numbers have a pre-existing gap; the native verifier applied 47 SQL files including V48. |
| `ML_Server/renal_service/inference.py` | Serving artifact contract, severe-potassium gate, explicit research/continuous output type, event probability null, actual baseline/SHAP method, contribution units and imputed predictors. |
| `ml-training/training/algorithms/short_horizon/decision_tree.py`, `training/algorithm_registry.py`, `configs/algorithms/short_horizon.json` | Added eighth family with actual deterministic classifier/regressor and bounded tuning config. |
| `ml-training/runs/cdss-20261020-clinical-review/` | New 24-candidate benchmark; copied source/configs, patient split, dataset audit, model cards/manifests, predictions, metrics, selection and uncertainty. No serving promotion. |
| `ml-training/model_registry/cdss-20261020-clinical-review.json` | New research manifest, with the retained deployed methods copied from the previous registry. |
| `spring-api/src/test/java/.../ClinicalIntelligenceRulesTest.java`, `ClinicalIntelligenceConsistencyTest.java` | Thresholds, screenshot cases, missing/invalid inputs, provenance/context separation, actual saved-contract PDF and FHIR semantics; Java-generated browser fixtures. |
| Other affected `spring-api/src/test/java/...` tests | Updated existing fixtures to supply genuine session metadata or expect withheld results; existing authorization, review, report and equation checks remain active. |
| `ML_Server/renal_service/tests.py`, `ml-training/tests/test_cdss_enhancement.py` | Severe low/high potassium blocks all research outputs; eight-family registry and training/survival protocol validation. |
| `scripts/verify-clinical-intelligence-browser.mjs` | Real React panel/forms with Java-generated synthetic contracts; captures review and sampling requests; desktop/mobile/dark screenshots. |
| `scripts/verify-clinical-intelligence-stack.py` | Fresh isolated local PostgreSQL database plus real Spring/Django; source ingestion, KFRE, review, saved PDF and persisted FHIR. Existing hospital database is untouched by this verifier. |
| `verification/clinical-intelligence-v2/`, `verification/cdss-enhancement/clinical-review-*.log` | Synthetic artifacts and actual command results; no operational patient export or credentials. |

## Data flow

`authorized assessment / laboratory / dialysis row → source normalization → mapping + versioned rule/model → persisted module snapshot → React saved-contract view → selected snapshot PDF / FHIR ClinicalImpression → append-only clinician review + Provenance`

For KFRE, explicit eligibility confirmation and verified age/sex/eGFR/urine-ACR evidence feed the existing published equation; the resulting saved two-/five-year outlook is a separate event-risk result. For research ML, stored verified HD history feeds the dedicated JWT-authenticated Django service; model output, artifact revision, explanation and data quality are saved before presentation. Export does not rerun either path.

Ordinary longitudinal trends may compare different clinical encounters when patient, units, dates and sampling context are comparable. An encounter mismatch cannot create a paired BP reading; a patient/session mismatch cannot create URR. This preserves legitimate longitudinal history without mixing simultaneous measurements.
