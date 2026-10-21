import numpy as np
from sklearn.metrics import (mean_absolute_error, mean_squared_error, median_absolute_error, r2_score,
    accuracy_score, balanced_accuracy_score, precision_score, recall_score, f1_score, roc_auc_score,
    average_precision_score, confusion_matrix, brier_score_loss)

def regression_metrics(y, prediction):
    return {'MAE': float(mean_absolute_error(y,prediction)),
            'RMSE': float(np.sqrt(mean_squared_error(y,prediction))),
            'R2': float(r2_score(y,prediction)) if len(y)>1 else None,
            'MedianAbsoluteError': float(median_absolute_error(y,prediction))}

def classification_metrics(y, probability, threshold=0.5):
    prediction=np.asarray(probability)>=threshold
    tn,fp,fn,tp=confusion_matrix(y,prediction,labels=[0,1]).ravel()
    two_classes=len(np.unique(y))==2
    return {'Accuracy':float(accuracy_score(y,prediction)), 'BalancedAccuracy':float(balanced_accuracy_score(y,prediction)),
            'Precision':float(precision_score(y,prediction,zero_division=0)),
            'Recall':float(recall_score(y,prediction,zero_division=0)),
            'Sensitivity':float(recall_score(y,prediction,zero_division=0)),
            'Specificity':float(tn/(tn+fp)) if tn+fp else None,
            'F1':float(f1_score(y,prediction,zero_division=0)),
            'ROC_AUC':float(roc_auc_score(y,probability)) if two_classes else None,
            'PR_AUC_average_precision':float(average_precision_score(y,probability)) if two_classes else None,
            'BrierScore':float(brier_score_loss(y,probability)),
            'ConfusionMatrix':[[int(tn),int(fp)],[int(fn),int(tp)]],
            'PositiveEvents':int(np.sum(y)), 'NegativeEvents':int(len(y)-np.sum(y)), 'threshold':threshold}

def patient_bootstrap(y,prediction,groups,baseline=None,iterations=500):
    y=np.asarray(y);prediction=np.asarray(prediction);groups=np.asarray(groups)
    patients=np.unique(groups);rng=np.random.default_rng(314159);rows={p:np.flatnonzero(groups==p) for p in patients}
    values=[];differences=[]
    for _ in range(iterations):
        idx=np.concatenate([rows[p] for p in rng.choice(patients,len(patients),replace=True)])
        mae=mean_absolute_error(y[idx],prediction[idx]); values.append(mae)
        if baseline is not None: differences.append(mean_absolute_error(y[idx],np.asarray(baseline)[idx])-mae)
    result={'method':'Patient-cluster bootstrap, 500 resamples, exploratory small-cohort CI',
            'patients':len(patients),'MAE_95CI':np.quantile(values,[.025,.975]).tolist()}
    if differences: result['baseline_minus_model_MAE_95CI']=np.quantile(differences,[.025,.975]).tolist()
    return result
