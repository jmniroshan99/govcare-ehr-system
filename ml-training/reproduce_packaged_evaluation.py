"""Refit all numeric candidates from packaged pseudonymous rows and fixed partitions.

No original subject IDs or private HMAC key are needed. This reproduces internal
research evaluation; it cannot verify the source's upstream cleaning provenance.
Run with the pinned training requirements and one BLAS/OpenMP thread.
"""
import json
from pathlib import Path
import numpy as np
import pandas as pd
from run_training import reg_models, class_models
from preprocessing.longitudinal_features import create_targets
from preprocessing.validate_data import assert_patient_split
from evaluation.metrics import regression_metrics, classification_metrics

ROOT = Path(__file__).resolve().parent

def main():
    frame = pd.read_csv(ROOT/'data/deidentified_monthly.csv', parse_dates=['observed_at'], float_precision='round_trip')
    manifest = json.loads((ROOT/'reports/patient_split_manifest.json').read_text())
    summary = json.loads((ROOT/'reports/training_summary.json').read_text())
    groups = {key: set(partition['patients']) for key, partition in manifest.items()}
    reproduced = []
    for target in ('hb', 'urr'):
        ordered, features, outcomes, _, valid = create_targets(frame, target)
        eligible = ordered.loc[valid].reset_index(drop=True)
        features = features.loc[valid].reset_index(drop=True)
        outcomes = outcomes.loc[valid].reset_index(drop=True)
        indices = {key: np.flatnonzero(eligible.patient_id.isin(ids)) for key, ids in groups.items()}
        assert_patient_split(eligible, indices)
        metrics = summary[target]['metrics']
        for name, model in reg_models().items():
            model.fit(features.iloc[indices['train']], outcomes.iloc[indices['train']])
            for partition in ('validation', 'test'):
                actual = regression_metrics(outcomes.iloc[indices[partition]], model.predict(features.iloc[indices[partition]]))
                for key, value in actual.items():
                    np.testing.assert_allclose(value, metrics[name][partition][key], rtol=1e-5, atol=1e-5)
            reproduced.append(target + '/' + name)
        labels = ((outcomes < 10) | (outcomes > 12)).astype(int) if target == 'hb' else (outcomes < 65).astype(int)
        for name, model in class_models().items():
            model.fit(features.iloc[indices['train']], labels.iloc[indices['train']])
            for partition in ('validation', 'test'):
                actual = classification_metrics(labels.iloc[indices[partition]], model.predict_proba(features.iloc[indices[partition]])[:, 1])
                expected = metrics['exploratory_classification'][name][partition]
                for key in ('Accuracy', 'BalancedAccuracy', 'ROC_AUC', 'PR_AUC_average_precision', 'BrierScore'):
                    np.testing.assert_allclose(actual[key], expected[key], rtol=1e-5, atol=1e-5)
            reproduced.append(target + '/' + name + ' classifier')
    print('Packaged-cohort refit reproduced validation/test metrics for ' + str(len(reproduced)) + ' candidate pipelines.')
    print('Clinical validation NOT_COMPLETED; upstream provenance and permission UNVERIFIED.')

if __name__ == '__main__':
    main()
