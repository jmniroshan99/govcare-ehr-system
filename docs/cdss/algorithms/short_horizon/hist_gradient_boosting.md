# Histogram Gradient Boosting regression / classification

Adds small trees that correct previous errors using binned feature values.

Included because: Tests bounded boosting without an external tree library.

Supported tasks: next-observed hemoglobin regression (g/dL), URR regression (%), and hyperkalemia classification (next pre-HD potassium ≥5.5 mmol/L). The target is the immediate next observation within inclusive 14–62 days, not an exact 30-day outcome.

Inputs: 84 canonical current/past laboratory and trend features from `preprocessing/longitudinal_features.py`. Patient ID, row references, future observations, uncertain absolute urea/UA and outcomes are excluded. Training-only median imputation and standardization are fitted anew inside every tuning/calibration partition. Initial origins may have missing historical features. The unchanged serving contract is stricter and requires two eligible observations.

Important hyperparameters: 80 iterations, 7 leaves, learning rate 0.05, L2=10; minimum leaf 10 or 20. Early stopping disabled to avoid a hidden row-level validation split.

Strengths and limitations: Captures interactions; small cohorts and many correlated features can still yield unstable improvements. Suitability is exploratory: only 42 source patients, with 24/9/9 historical train/validation/test patients; outcome eligibility can reduce these counts. Grouping reduces new within-pipeline leakage but cannot undo possible upstream interpolation. Dataset permission is unverified; clinical validation is not completed.

Training command (runs this family together with the other six):

```powershell
.venv-cdss312/Scripts/python.exe ml-training/benchmark_cdss.py --output ml-training/runs/NEW_UNIQUE_RUN
```

Implementation: `ml-training/training/algorithms/short_horizon/hist_gradient_boosting.py`.
Configuration: `ml-training/configs/algorithms/short_horizon.json`, key `hist_gradient_boosting`; task policy in `configs/tasks/short_horizon.json`.
Artifacts: `ml-training/runs/cdss-20261020-final/short_horizon/<task>/hist_gradient_boosting/model.joblib`, with `manifest.json`, `MODEL_CARD.md`, `metrics.json`, `training_status.json` and dated `test_predictions.csv`.

| Task | Training status | Evaluated | Validation MAE/Brier | Reused test MAE/Brier | Validation gate passed | New artifact served |
|---|---|---|---:|---:|---|---|
| hb | TRAINED_RESEARCH_ONLY | True | 1.0814823549588573 | 0.915998480897616 | False | no |
| urr | TRAINED_RESEARCH_ONLY | True | 9.985621680829869 | 11.385031020338454 | False | no |
| hyperkalemia | TRAINED_RESEARCH_ONLY | True | 0.22128874572130985 | 0.14072956758959157 | False | no |

Validation selects using prespecified MAE/Brier and baseline gates before test evaluation. Every candidate is evaluated after freezing selection; an evaluated result is not a clinical approval. Full RMSE/R², discrimination, threshold confusion, descriptive calibration, per-patient variation and patient-bootstrap uncertainty are retained in the metrics file as applicable. One-class metrics are explicitly unavailable.

Serving: these newly fitted candidates are staged. See the main catalog for the retained deployed Hb persistence / URR XGBoost / hyperkalemia logistic regression methods. The deployed algorithm name alone does not identify one of these new artifacts.
