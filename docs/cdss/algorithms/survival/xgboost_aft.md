# XGBoost accelerated failure time

Fits boosted log-time location predictions under a specified AFT distribution.

Included because: Provides a separate boosted AFT family rather than another Cox parameter setting.

Supported task: time from a prespecified eligible nondialysis CKD origin to first maintenance KRT. Predictor order is age, verified sex indicator, eGFR (mL/min/1.73m²), urine ACR (mg/g). Predictor dates must be at/before origin; imputation/scaling are fitted only on fitting patients. Serum albumin cannot supply urine ACR. Temporary acute dialysis and prior KRT are excluded.

Important hyperparameters: normal log-time noise; scale=1.2; depth 1 or 2; 80 rounds; event bounds [t,t], right-censor bounds [t,+inf].

Strengths and limitations: Deriving probabilities requires the recorded distribution and scale. Treating a point time prediction as a probability would be wrong.

Output semantics: each adapter produces cause-specific net survival. The default orchestration fits separate kidney-failure and competing-death adapters and integrates them on a daily grid to estimate research CIF; the optional net estimand is labelled separately. These outputs are not clinically validated. No unsupported-horizon extrapolation is allowed. Discrete grids and all fitted preprocessing are confined to development fitting data.

Suitability: the actual current data contain no event/censoring contract and are a maintenance-dialysis cohort. This candidate is not feasible for clinical five-year training. Future event-count, partition, horizon and censoring-support gates must pass; a more complex estimator does not avoid these requirements.

Training/readiness command:

```powershell
../.venv-cdss312/Scripts/python.exe -m training.tasks.survival --source data/deidentified_monthly.csv --output runs/NEW_SURVIVAL_READINESS
```

Run from `ml-training`. For genuine future data add `--split PATH_TO_PRESPECIFIED_MANIFEST`. Never use synthetic test fixtures as clinical training/evaluation records.

Implementation: `ml-training/training/algorithms/survival/xgboost_aft.py`.
Configuration: `ml-training/configs/algorithms/survival.json`, key `xgboost_aft`; gates in `configs/tasks/survival.json`; endpoint in `data_contracts/survival_endpoint.json`.
Current artifact: none. Status evidence: `ml-training/runs/cdss-20261020-final/survival/readiness.json`.
Future artifacts, only after readiness: `<survival-output>/xgboost_aft/model.joblib`, `manifest.json`, `MODEL_CARD.md`, `metrics.json`.

Status: **BLOCKED_MISSING_ENDPOINT**. Registered: yes. Trained on current clinical data: no. Evaluated on clinical five-year outcomes: no. Served: no.

Reason: No genuine adjudicated first-KRT and competing-death/follow-up contract in this file.; Laboratory observation span is not verified outcome ascertainment. Serum albumin is not urine ACR.; Historical source cohort is maintenance dialysis, ineligible for first-future-KRT initiation.

Clinical five-year metrics are null. Synthetic fitting/curve/censoring tests verify software behaviour only. The full data-collection and estimand specification is in `FIVE_YEAR_MODEL_READINESS.md`.
