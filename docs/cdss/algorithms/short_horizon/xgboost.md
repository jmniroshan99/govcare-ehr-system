# Extreme Gradient Boosting (XGBoost) regression / classification

Adds shallow regularized trees with subsampling and shrinkage.

Included because: Compares the existing project tree family against the other six families.

Supported tasks: next-observed hemoglobin regression (g/dL), URR regression (%), and hyperkalemia classification (next pre-HD potassium ≥5.5 mmol/L). The target is the immediate next observation within inclusive 14–62 days, not an exact 30-day outcome.

Inputs: 84 canonical current/past laboratory and trend features from `preprocessing/longitudinal_features.py`. Patient ID, row references, future observations, uncertain absolute urea/UA and outcomes are excluded. Training-only median imputation and standardization are fitted anew inside every tuning/calibration partition. Initial origins may have missing historical features. The unchanged serving contract is stricter and requires two eligible observations.

Important hyperparameters: 80 trees, depth 2, learning rate 0.05, lambda=10, subsample=0.8, feature fraction=0.7; child weight 5 or 10.

Strengths and limitations: Flexible nonlinear prediction; complexity does not establish clinical usefulness and negative test R² remains possible. Suitability is exploratory: only 42 source patients, with 24/9/9 historical train/validation/test patients; outcome eligibility can reduce these counts. Grouping reduces new within-pipeline leakage but cannot undo possible upstream interpolation. Dataset permission is unverified; clinical validation is not completed.

Training command (runs this family together with the other six):

```powershell
.venv-cdss312/Scripts/python.exe ml-training/benchmark_cdss.py --output ml-training/runs/NEW_UNIQUE_RUN
```

Implementation: `ml-training/training/algorithms/short_horizon/xgboost_model.py`.
Configuration: `ml-training/configs/algorithms/short_horizon.json`, key `xgboost`; task policy in `configs/tasks/short_horizon.json`.
Artifacts: `ml-training/runs/cdss-20261020-final/short_horizon/<task>/xgboost/model.joblib`, with `manifest.json`, `MODEL_CARD.md`, `metrics.json`, `training_status.json` and dated `test_predictions.csv`.

| Task | Training status | Evaluated | Validation MAE/Brier | Reused test MAE/Brier | Validation gate passed | New artifact served |
|---|---|---|---:|---:|---|---|
| hb | TRAINED_RESEARCH_ONLY | True | 1.056378314230177 | 0.942727924298636 | False | no |
| urr | TRAINED_RESEARCH_ONLY | True | 9.213276849672102 | 11.09564902948674 | True | no |
| hyperkalemia | TRAINED_RESEARCH_ONLY | True | 0.20211704075336456 | 0.14492976665496826 | True | no |

Validation selects using prespecified MAE/Brier and baseline gates before test evaluation. Every candidate is evaluated after freezing selection; an evaluated result is not a clinical approval. Full RMSE/R², discrimination, threshold confusion, descriptive calibration, per-patient variation and patient-bootstrap uncertainty are retained in the metrics file as applicable. One-class metrics are explicitly unavailable.

Serving: these newly fitted candidates are staged. See the main catalog for the retained deployed Hb persistence / URR XGBoost / hyperkalemia logistic regression methods. The deployed algorithm name alone does not identify one of these new artifacts.
