from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier

def build(task, parameters, seed=42):
    cls = RandomForestRegressor if task == 'regression' else RandomForestClassifier
    return cls(random_state=seed, n_jobs=1, **parameters)
