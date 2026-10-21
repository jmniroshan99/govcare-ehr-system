from sklearn.neighbors import KNeighborsRegressor, KNeighborsClassifier

def build(task, parameters, seed=42):
    cls = KNeighborsRegressor if task == 'regression' else KNeighborsClassifier
    return cls(n_jobs=1, **parameters)
