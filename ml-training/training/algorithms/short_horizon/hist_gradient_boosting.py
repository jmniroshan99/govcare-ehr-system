from sklearn.ensemble import HistGradientBoostingRegressor, HistGradientBoostingClassifier

def build(task, parameters, seed=42):
    cls = HistGradientBoostingRegressor if task == 'regression' else HistGradientBoostingClassifier
    return cls(random_state=seed, early_stopping=False, **parameters)
