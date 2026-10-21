# k-Nearest Neighbours regression / classification

Predicts from the closest normalized training observations, weighted by distance.

Included because: Provides a simple local similarity comparator.

Supported tasks: next-observed hemoglobin regression (g/dL), URR regression (%), and hyperkalemia classification (next pre-HD potassium ≥5.5 mmol/L). The target is the immediate next observation within inclusive 14–62 days, not an exact 30-day outcome.

Inputs: 84 canonical current/past laboratory and trend features from `preprocessing/longitudinal_features.py`. Patient ID, row references, future observations, uncertain absolute urea/UA and outcomes are excluded. Training-only median imputation and standardization are fitted anew inside every tuning/calibration partition. Initial origins may have missing historical features. The unchanged serving contract is stricter and requires two eligible observations.

Important hyperparameters: k=5 or 15; inverse-distance weights.

Strengths and limitations: Transparent local matching; high dimensionality, correlated visits and sparse patient coverage can make neighbours unreliable. Suitability is exploratory: only 42 source patients, with 24/9/9 historical train/validation/test patients; outcome eligibility can reduce these counts. Grouping reduces new within-pipeline leakage but cannot undo possible upstream interpolation. Dataset permission is unverified; clinical validation is not completed.

Training command (runs this family together with the other six):

```powershell
.venv-cdss312/Scripts/python.exe ml-training/benchmark_cdss.py --output ml-training/runs/NEW_UNIQUE_RUN
```

Implementation: `ml-training/training/algorithms/short_horizon/nearest_neighbors.py`.
Configuration: `ml-training/configs/algorithms/short_horizon.json`, key `nearest_neighbors`; task policy in `configs/tasks/short_horizon.json`.
Artifacts: `ml-training/runs/cdss-20261020-final/short_horizon/<task>/nearest_neighbors/model.joblib`, with `manifest.json`, `MODEL_CARD.md`, `metrics.json`, `training_status.json` and dated `test_predictions.csv`.

| Task | Training status | Evaluated | Validation MAE/Brier | Reused test MAE/Brier | Validation gate passed | New artifact served |
|---|---|---|---:|---:|---|---|
| hb | TRAINED_RESEARCH_ONLY | True | 1.3462413672718863 | 1.3499984171971717 | False | no |
| urr | TRAINED_RESEARCH_ONLY | True | 9.702792737565074 | 11.492753635612738 | False | no |
| hyperkalemia | TRAINED_RESEARCH_ONLY | True | 0.20443681851011855 | 0.15715335859286134 | True | no |

Validation selects using prespecified MAE/Brier and baseline gates before test evaluation. Every candidate is evaluated after freezing selection; an evaluated result is not a clinical approval. Full RMSE/R², discrimination, threshold confusion, descriptive calibration, per-patient variation and patient-bootstrap uncertainty are retained in the metrics file as applicable. One-class metrics are explicitly unavailable.

Serving: these newly fitted candidates are staged. See the main catalog for the retained deployed Hb persistence / URR XGBoost / hyperkalemia logistic regression methods. The deployed algorithm name alone does not identify one of these new artifacts.
