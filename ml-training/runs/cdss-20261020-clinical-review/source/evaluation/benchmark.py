"""Patient-level uncertainty and exploratory probability calibration."""
import numpy as np
from sklearn.calibration import calibration_curve
from evaluation.metrics import regression_metrics, classification_metrics

def metrics(kind, y, prediction):
    out = regression_metrics(y, prediction) if kind == 'regression' else classification_metrics(y, prediction, threshold=.5)
    if kind == 'classification':
        observed, predicted = calibration_curve(y, prediction, n_bins=5, strategy='quantile')
        out.update(Prevalence=float(np.mean(y)), calibration={'method':'five quantile bins; descriptive, small sample',
            'mean_predicted':predicted.tolist(),'fraction_positive':observed.tolist()})
        if len(np.unique(y))<2:
            out['unestimable_metrics']={'ROC_AUC':'Only one observed class','PR_AUC_average_precision':'Only one observed class; not a discrimination comparison'}
    elif len(y)<2:out['unestimable_metrics']={'R2':'Fewer than two observations'}
    return out

def uncertainty(kind, y, prediction, groups, baseline, iterations=200):
    y, prediction, groups, baseline = map(np.asarray, (y,prediction,groups,baseline))
    ids=np.unique(groups); rows={p:np.flatnonzero(groups==p) for p in ids}; rng=np.random.default_rng(314159)
    key='MAE' if kind=='regression' else 'BrierScore'
    primary=[]; diffs=[]; auc=[]
    for _ in range(iterations):
        idx=np.concatenate([rows[p] for p in rng.choice(ids,len(ids),replace=True)])
        # Compute only resampled estimands; avoid repeated calibration fitting.
        v=float(np.mean(np.abs(y[idx]-prediction[idx]))) if kind=='regression' else float(np.mean((y[idx]-prediction[idx])**2))
        b=float(np.mean(np.abs(y[idx]-baseline[idx]))) if kind=='regression' else float(np.mean((y[idx]-baseline[idx])**2))
        primary.append(v); diffs.append(v-b)
        if kind=='classification' and len(np.unique(y[idx]))==2:
            from sklearn.metrics import roc_auc_score
            auc.append(roc_auc_score(y[idx],prediction[idx]))
    out={'unit':'patient','iterations':iterations,'patients':len(ids),'seed':314159,
         key+'_percentile_95':np.quantile(primary,[.025,.975]).tolist(),
         'candidate_minus_baseline_95':np.quantile(diffs,[.025,.975]).tolist(),
         'limitation':'Exploratory interval; only a small reused test cohort; no model-selection correction.'}
    if kind=='classification':out.update(ROC_AUC_95=np.quantile(auc,[.025,.975]).tolist() if auc else None, unestimable_auc_resamples=iterations-len(auc))
    return out

def selection(kind, candidate, baselines):
    key='MAE' if kind=='regression' else 'BrierScore'
    anchor=baselines['persistence' if kind=='regression' else 'training_prevalence'][key]
    improvement=1-candidate[key]/anchor if anchor>0 else -np.inf
    passes=improvement>=.05 and candidate[key]<min(b[key] for b in baselines.values())
    if kind=='classification':passes=passes and candidate.get('ROC_AUC') is not None and candidate['ROC_AUC']>=.5
    return bool(passes), float(improvement)
