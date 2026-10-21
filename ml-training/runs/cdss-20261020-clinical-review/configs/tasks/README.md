# Prespecified tasks

`short_horizon.json` defines all three current-data tasks. Predictors use current/past observations, with missing historical features allowed at the first origin and imputed in the fitting partition. The existing serving contract applies a stricter two-observation eligibility gate; the benchmark is not a new clinical-serving validation. +30 days is a display anchor, never an invented exact target date. The immediate next available row must be within inclusive 14–62 days; invalid immediate outcomes are not skipped.

Three training-only grouped folds compare two settings per family. SVC sigmoid calibration nests three additional grouped folds inside each fitting partition. Both classes must exist in fitting/calibration folds; otherwise the candidate records its exact failure. No threshold tuning occurs: sensitivity/specificity use 0.5. Hyperkalemia means next pre-HD potassium ≥5.5 mmol/L, following the existing documented label.

Validation freezes selection before any final candidate test evaluation. Regression must improve persistence by at least 5% and beat both training constants; classification must improve training-prevalence Brier by at least 5%, beat majority-class Brier and have validation AUC ≥0.5. These are exploratory engineering gates. Clinical utility, calibration, sensitivity and external validation remain separate requirements. Frozen models are not refit on validation before the reused test is evaluated.

The historical split is preserved verbatim. All rows for each patient remain in one partition. Previously examined test patients are reused, so no result is described as independent external validation.

`survival.json` is a separate, future endpoint workflow. The default CIF and optional net estimand require different interpretations. A one-index-per-patient endpoint cohort, a supplied split manifest and readiness gates precede fitting. Grouped tuning still requires event and horizon support inside each fold. See the endpoint contract and five-year readiness guide.
