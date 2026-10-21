def build(task, parameters, seed=42):
    from xgboost import XGBRegressor, XGBClassifier
    cls = XGBRegressor if task == 'regression' else XGBClassifier
    return cls(random_state=seed, n_jobs=1, **parameters)
