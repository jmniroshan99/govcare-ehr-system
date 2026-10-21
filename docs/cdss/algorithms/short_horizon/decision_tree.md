# Decision Tree

Eighth short-horizon family. Actual sklearn DecisionTreeRegressor for Hb/URR and DecisionTreeClassifier for next-observed high potassium. Implemented in `ml-training/training/algorithms/short_horizon/decision_tree.py`, registered in `training/algorithm_registry.py`; bounded parameters are in `configs/algorithms/short_horizon.json`.

Training-only imputation and patient-grouped tuning share the common benchmark pipeline. Reused historical held-out test patients are not a fresh test set. Target, units, complete validation/test metrics, selection and uncertainty are saved in `runs/cdss-20261020-clinical-review/summary.json` and each task's Decision Tree artifact manifest. All three task candidates trained and evaluated; none passed its validation baseline gate and none is served. Clinical validation incomplete and dataset permission unverified.
