"""Canonical family IDs, implementation locations and output semantics.

Factories are imported lazily so a missing optional survival dependency never
prevents dataset auditing or short-horizon training.
"""
from importlib import import_module

SHORT_HORIZON = {
    'regularized_linear': 'regularized_linear', 'random_forest': 'random_forest',
    'extra_trees': 'extra_trees', 'hist_gradient_boosting': 'hist_gradient_boosting',
    'xgboost': 'xgboost_model', 'support_vector': 'support_vector', 'nearest_neighbors': 'nearest_neighbors',
}
SURVIVAL = {
    'cox_elastic_net': 'cox_elastic_net', 'weibull_aft': 'weibull_aft',
    'random_survival_forest': 'random_survival_forest', 'extra_survival_trees': 'extra_survival_trees',
    'gradient_boosting_survival': 'gradient_boosting_survival', 'xgboost_aft': 'xgboost_aft',
    'logistic_hazard': 'logistic_hazard',
}

def short_estimator(algorithm, task, parameters, seed=42):
    if task not in {'regression','classification'}: raise ValueError('Unsupported task')
    return import_module('training.algorithms.short_horizon.'+SHORT_HORIZON[algorithm]).build(task, parameters, seed)

def survival_estimator(algorithm, parameters=None):
    return import_module('training.algorithms.survival.'+SURVIVAL[algorithm]).build(parameters or {})
