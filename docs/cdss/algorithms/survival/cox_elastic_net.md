# Elastic-net Cox proportional hazards

A regularized relative-hazard model with an estimated baseline survival function.

Included because: A standard low-complexity time-to-event comparator.

Supported task: time from a prespecified eligible nondialysis CKD origin to first maintenance KRT. Predictor order is age, verified sex indicator, eGFR (mL/min/1.73m²), urine ACR (mg/g). Predictor dates must be at/before origin; imputation/scaling are fitted only on fitting patients. Serum albumin cannot supply urine ACR. Temporary acute dialysis and prior KRT are excluded.

Important hyperparameters: l1_ratio=0.5 or 0.9; alpha=0.05; fit_baseline_model=True.

Strengths and limitations: Requires proportional hazards; baseline survival is mandatory for horizon probabilities, and extrapolation is not validated.

Output semantics: each adapter produces cause-specific net survival. The default orchestration fits separate kidney-failure and competing-death adapters and integrates them on a daily grid to estimate research CIF; the optional net estimand is labelled separately. These outputs are not clinically validated. No unsupported-horizon extrapolation is allowed. Discrete grids and all fitted preprocessing are confined to development fitting data.

Suitability: the actual current data contain no event/censoring contract and are a maintenance-dialysis cohort. This candidate is not feasible for clinical five-year training. Future event-count, partition, horizon and censoring-support gates must pass; a more complex estimator does not avoid these requirements.

Training/readiness command:

```powershell
../.venv-cdss312/Scripts/python.exe -m training.tasks.survival --source data/deidentified_monthly.csv --output runs/NEW_SURVIVAL_READINESS
```

Run from `ml-training`. For genuine future data add `--split PATH_TO_PRESPECIFIED_MANIFEST`. Never use synthetic test fixtures as clinical training/evaluation records.

Implementation: `ml-training/training/algorithms/survival/cox_elastic_net.py`.
Configuration: `ml-training/configs/algorithms/survival.json`, key `cox_elastic_net`; gates in `configs/tasks/survival.json`; endpoint in `data_contracts/survival_endpoint.json`.
Current artifact: none. Status evidence: `ml-training/runs/cdss-20261020-final/survival/readiness.json`.
Future artifacts, only after readiness: `<survival-output>/cox_elastic_net/model.joblib`, `manifest.json`, `MODEL_CARD.md`, `metrics.json`.

Status: **BLOCKED_MISSING_ENDPOINT**. Registered: yes. Trained on current clinical data: no. Evaluated on clinical five-year outcomes: no. Served: no.

Reason: No genuine adjudicated first-KRT and competing-death/follow-up contract in this file.; Laboratory observation span is not verified outcome ascertainment. Serum albumin is not urine ACR.; Historical source cohort is maintenance dialysis, ineligible for first-future-KRT initiation.

Clinical five-year metrics are null. Synthetic fitting/curve/censoring tests verify software behaviour only. The full data-collection and estimand specification is in `FIVE_YEAR_MODEL_READINESS.md`.
