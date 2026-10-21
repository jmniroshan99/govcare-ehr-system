"""Explicit comparators; constants must be calculated from training labels only."""
import numpy as np

def regression_baselines(y_train, current):
    return {'persistence': np.asarray(current, dtype=float),
            'training_mean': np.full(len(current), np.mean(y_train)),
            'training_median': np.full(len(current), np.median(y_train))}

def classification_baselines(y_train, n):
    prevalence = float(np.mean(y_train))
    return {'training_prevalence': np.full(n, prevalence),
            'majority_class': np.full(n, float(prevalence >= .5))}
