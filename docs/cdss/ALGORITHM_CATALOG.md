# Algorithm catalog and actual status

Latest clinical-review benchmark: [eight families / 24 candidates](../../ml-training/runs/cdss-20261020-clinical-review/COMPARISON.md), including Decision Tree. The seven-family results below are retained as the earlier archived run; serving artifacts are unchanged. See [current clinical handover](../clinical-intelligence/README.md).

Canonical completed run: `ml-training/runs/cdss-20261020-final/`. Seven families × three short-horizon tasks = 21 trained and evaluated candidates. Seven separate survival candidates are registered and blocked by absent endpoints. KFRE is a published equation, not a model trained on this dataset. Hyperparameter settings and baselines are not additional algorithm families.

| Task | Research selection | Selection status | Reused test MAE/Brier | Method actually served |
|---|---|---|---:|---|
| hb | persistence | BASELINE_SELECTED | 0.870886 | LAST_OBSERVATION_CARRIED_FORWARD |
| urr | xgboost | TRAINED_RESEARCH_ONLY | 11.095649 | XGBoost |
| hyperkalemia | random_forest | TRAINED_RESEARCH_ONLY | 0.161778 | LogisticRegression |

New seven-family artifacts are staged. Deployed URR XGBoost was repaired through a separate legacy-specification replay after the original pickle failed to load in both environments; this is not the new seven-family XGBoost artifact. The original artifacts, validation gate, new checksum and revision are retained in `runs/cdss-20261020-serving-repair/serving_repair.json`. Hyperkalemia retains the original logistic object; Hb retains persistence. Dataset permission UNVERIFIED and clinical validation NOT_COMPLETED apply to all these research outputs.

| Task | Algorithm documentation | Training status | Evaluated | Passed validation baseline gate | New artifact served |
|---|---|---|---|---|---|
| hb | [regularized_linear](algorithms/short_horizon/regularized_linear.md) | TRAINED_RESEARCH_ONLY | True | False | no |
| urr | [regularized_linear](algorithms/short_horizon/regularized_linear.md) | TRAINED_RESEARCH_ONLY | True | False | no |
| hyperkalemia | [regularized_linear](algorithms/short_horizon/regularized_linear.md) | TRAINED_RESEARCH_ONLY | True | True | no |
| hb | [random_forest](algorithms/short_horizon/random_forest.md) | TRAINED_RESEARCH_ONLY | True | False | no |
| urr | [random_forest](algorithms/short_horizon/random_forest.md) | TRAINED_RESEARCH_ONLY | True | True | no |
| hyperkalemia | [random_forest](algorithms/short_horizon/random_forest.md) | TRAINED_RESEARCH_ONLY | True | True | no |
| hb | [extra_trees](algorithms/short_horizon/extra_trees.md) | TRAINED_RESEARCH_ONLY | True | False | no |
| urr | [extra_trees](algorithms/short_horizon/extra_trees.md) | TRAINED_RESEARCH_ONLY | True | True | no |
| hyperkalemia | [extra_trees](algorithms/short_horizon/extra_trees.md) | TRAINED_RESEARCH_ONLY | True | True | no |
| hb | [hist_gradient_boosting](algorithms/short_horizon/hist_gradient_boosting.md) | TRAINED_RESEARCH_ONLY | True | False | no |
| urr | [hist_gradient_boosting](algorithms/short_horizon/hist_gradient_boosting.md) | TRAINED_RESEARCH_ONLY | True | False | no |
| hyperkalemia | [hist_gradient_boosting](algorithms/short_horizon/hist_gradient_boosting.md) | TRAINED_RESEARCH_ONLY | True | False | no |
| hb | [xgboost](algorithms/short_horizon/xgboost.md) | TRAINED_RESEARCH_ONLY | True | False | no |
| urr | [xgboost](algorithms/short_horizon/xgboost.md) | TRAINED_RESEARCH_ONLY | True | True | no |
| hyperkalemia | [xgboost](algorithms/short_horizon/xgboost.md) | TRAINED_RESEARCH_ONLY | True | True | no |
| hb | [support_vector](algorithms/short_horizon/support_vector.md) | TRAINED_RESEARCH_ONLY | True | False | no |
| urr | [support_vector](algorithms/short_horizon/support_vector.md) | TRAINED_RESEARCH_ONLY | True | True | no |
| hyperkalemia | [support_vector](algorithms/short_horizon/support_vector.md) | TRAINED_RESEARCH_ONLY | True | False | no |
| hb | [nearest_neighbors](algorithms/short_horizon/nearest_neighbors.md) | TRAINED_RESEARCH_ONLY | True | False | no |
| urr | [nearest_neighbors](algorithms/short_horizon/nearest_neighbors.md) | TRAINED_RESEARCH_ONLY | True | False | no |
| hyperkalemia | [nearest_neighbors](algorithms/short_horizon/nearest_neighbors.md) | TRAINED_RESEARCH_ONLY | True | True | no |
| first KRT survival | [cox_elastic_net](algorithms/survival/cox_elastic_net.md) | BLOCKED_MISSING_ENDPOINT | false | unavailable | no |
| first KRT survival | [weibull_aft](algorithms/survival/weibull_aft.md) | BLOCKED_MISSING_ENDPOINT | false | unavailable | no |
| first KRT survival | [random_survival_forest](algorithms/survival/random_survival_forest.md) | BLOCKED_MISSING_ENDPOINT | false | unavailable | no |
| first KRT survival | [extra_survival_trees](algorithms/survival/extra_survival_trees.md) | BLOCKED_MISSING_ENDPOINT | false | unavailable | no |
| first KRT survival | [gradient_boosting_survival](algorithms/survival/gradient_boosting_survival.md) | BLOCKED_MISSING_ENDPOINT | false | unavailable | no |
| first KRT survival | [xgboost_aft](algorithms/survival/xgboost_aft.md) | BLOCKED_MISSING_ENDPOINT | false | unavailable | no |
| first KRT survival | [logistic_hazard](algorithms/survival/logistic_hazard.md) | BLOCKED_MISSING_ENDPOINT | false | unavailable | no |

Each per-algorithm page links its implementation, configuration, command, artifacts and measured results. Every successful short-horizon candidate has a versioned manifest and model card. `runs/cdss-20261020-final/COMPARISON.md` includes explicit baselines; task results include full metrics, patient variation and patient-bootstrap uncertainty. `model_registry/cdss-20261020-final.json` is the machine-readable deployment/status snapshot.

REGISTERED means an implementation exists. TRAINED_RESEARCH_ONLY means fitted, staged and not served. `evaluated=true` records an actual held-out calculation and does not imply validation approval. BASELINE_SELECTED records a failed promotion gate. BLOCKED_MISSING_ENDPOINT records a data blocker with a reason. RESEARCH_SERVING_APPROVED in the deployed snapshot describes only the existing packaged research-serving scope, not clinical approval.

Measured limitations in this run: selected URR XGBoost has reused-test R² = -0.013710 and MAE = 11.095649 percentage points (persistence MAE = 12.121505). Selected hyperkalemia Random Forest has AUC = 0.584577, sensitivity = 0 at threshold 0.5, and Brier = 0.161778, worse than the test training-prevalence baseline of 0.132010. Hb persistence has MAE = 0.870886 g/dL. Selection was frozen on validation before these test results; these weak results are reported, not used to retune on the test cohort. Read the confusion matrices and uncertainty; a validation ranking is not evidence of clinical utility.
