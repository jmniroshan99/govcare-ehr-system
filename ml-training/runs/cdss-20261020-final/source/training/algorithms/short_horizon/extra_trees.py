from sklearn.ensemble import ExtraTreesRegressor, ExtraTreesClassifier

def build(task, parameters, seed=42):
    cls = ExtraTreesRegressor if task == 'regression' else ExtraTreesClassifier
    return cls(random_state=seed, n_jobs=1, **parameters)
