"""Patient-grouped benchmark candidate; never automatically promoted to serving."""
from sklearn.tree import DecisionTreeRegressor, DecisionTreeClassifier


def build(task, parameters, seed=42):
    estimator = DecisionTreeRegressor if task == 'regression' else DecisionTreeClassifier
    return estimator(random_state=seed, **parameters)
