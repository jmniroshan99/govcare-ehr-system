# Clinical intelligence implementation — 20 October 2026

The existing `/ai-cdss/ckd` workspace now consumes saved, versioned clinical results. Potassium 2.0 mmol/L remains a **severe low-potassium finding with prompt source/date verification and clinical review**, including when its collection date is unknown and inference is unavailable. No treatment order is generated. This is software verification, not clinical validation.

The five primary cards distinguish recorded values, severity, observed change, future continuous predictions, research scores, input coverage, evidence quality, prediction readiness and review priority. Unknown dates stay unknown. One recorded Hb or potassium input is labelled “1 of 1 listed inputs recorded”; cardiovascular 4/5 is coverage only. A single creatinine observation has no progression category. Separate BP components retain their provenance and are not presented as a verified paired reading.

## Reviewable deliverables

- [Calculation and threshold references](CALCULATIONS.md).
- [Source tracing and directory map](DIRECTORY_MAP.md).
- [Verification results and reproducible commands](VERIFICATION.md).
- [Machine-readable changed source files](../../verification/clinical-intelligence-v2/changed-files.json).
- [Desktop cards](../../verification/clinical-intelligence-v2/browser/cards-1440.png), [mobile cards](../../verification/clinical-intelligence-v2/browser/cards-390.png), [dark theme](../../verification/clinical-intelligence-v2/browser/clinical-dark.png).
- [Clearly synthetic PDF](../../output/pdf/govcare-clinical-intelligence-synthetic.pdf), [saved example contracts](../../verification/clinical-intelligence-v2/saved-fhir-contract.json), [rule registry](../../verification/clinical-intelligence-v2/rule-registry.json).
- [Eight-family, three-task comparison](../../ml-training/runs/cdss-20261020-clinical-review/COMPARISON.md) and [full metrics, uncertainty and provenance](../../ml-training/runs/cdss-20261020-clinical-review/summary.json).

## Saved-result contract and review

Each result carries `coverage`, `evidenceQuality`, `clinicalSignal`, `trend`, `prediction`, `explanation` and `review`. The snapshot, rule/version, outcome, units, actual collection times and source identifiers travel with the result. `clinicalSignal.eventProbability` and unsupported `prediction.eventProbability` are null. Quantitative KFRE estimates use a separate eligible-population workflow with their actual two-/five-year horizons.

Expandable evidence explains the actual calculation or model. Persistence identifies the repeated eligible measurement. Model explanations disclose contribution units, imputed predictors, stored interval and artifact revision where present; associations are not causal effects. Missing attribution remains unavailable. A model failure preserves recorded measurements and findings.

Clinicians can accept, modify, defer or dismiss a module result and record interpretation/notes. Reviews are append-only, scoped to patient/hospital, idempotent by request UUID and guarded by expected review version. FHIR ClinicalImpression and Provenance retain the saved contract and review history. There is no synthesized overall disease probability or heuristic “marks out of 100”.

Card report actions send the displayed clinical snapshot UUID. An explicitly selected outlook snapshot is also retained. The server verifies patient, hospital and parent assessment. Default historical exports reuse the first matching assessment snapshot; if none exists, the one-time reconstruction is bounded to evidence recorded by that assessment time and then frozen. Historical exports never invoke inference or substitute the newest assessment. Existing generated report files remain separate immutable versions.

## Data and model status

The latest benchmark trains and evaluates **24 candidates: eight families × Hb, URR and next-observed high potassium**. Families are regularized linear/logistic, Decision Tree, Random Forest, Extra Trees, histogram gradient boosting, XGBoost, support vector and nearest neighbours. Hyperparameter variants and baselines are not additional families. The Decision Tree implementation, config and per-task manifests are included. Earlier seven-family runs remain archived.

The packaged cleaned file has 386 observations from 42 patient identifiers, 2024-01-01 through 2024-12-01, maximum individual follow-up 335 days. Its SHA-256 is `683e3ce49330922c91581e3f49896c611af0bc2da52abf1f9faea9567aff3da9`. Original dataset bytes and the historical 24/9/9 patient partition are preserved; target filtering leaves 23 training patients in these tasks. The reused historical test set is **not a new independent test set**. Grouped tuning/preprocessing occurs within training patients, and selection is frozen before test scoring. Upstream cleaning/interpolation before the supplied file cannot be reconstructed or certified leakage-free.

The supplied monthly maintenance-HD dataset does not establish a general nondialysis CKD population, five-year kidney-failure endpoints, permission for secondary use, a verified institutional cohort identity, or representative external validation. The source workbook/raw measurements, original cleaning lineage and permission evidence are absent from the accessible project. No such evidence was invented or downloaded from an unverified cohort.

Seven implemented survival adapters remain `BLOCKED_MISSING_ENDPOINT`; no learned five-year metrics are manufactured. The short-horizon target is the immediate next observation 14–62 days later; +30 days is a display anchor, not a fixed validated horizon. Baseline Hb, the separately repaired legacy URR model and original logistic potassium model remain serving. New benchmark candidates are staged only. Research model scores use a raw 0–1 scale and never populate FHIR probability fields. The existing CKD screening classifier is also labelled as a model score with calibration unverified rather than a future event probability.

## Remaining clinical requirements

1. Obtain documented dataset provenance, consent/secondary-use permission and original preprocessing lineage; verify institution and cohort identity with the data custodian.
2. Obtain adequately followed, eligible nondialysis records with dated predictors, first KRT/kidney-failure endpoint, death and censoring for any learned five-year model. No short-term extrapolation or synthetic clinical-performance claim replaces this.
3. Conduct independent temporal/external validation, calibration and clinical utility review, subgroup evaluation and prospective workflow evaluation. Internal metrics and synthetic safety tests do not provide clinical deployment approval.
4. **[Confirm with the nephrologist]** local potassium escalation, population-specific Hb pathways (including pregnancy/pediatrics), sample timing/quality, dialysis prescription and adequacy targets, KFRE calibration choice and care thresholds. Adult reference comparisons do not diagnose iron deficiency or prescribe treatment.
5. Supporting ferritin, TSAT, reticulocytes, PCV and RBC can be normalized when actually recorded. Medication/treatment context and investigations absent from linked structured evidence still require chart review; they are not inferred from Hb. A linked clinical-record action is provided.
6. Historical records lacking session identity or collection times remain incomplete. They are not automatically backfilled. A URR result or forecast requires verified compatible same-session sources.

The PDF and UI are usable for reviewing source evidence and research outputs. Clinical validation remains `NOT_COMPLETED`; local protocol approval is not asserted.
