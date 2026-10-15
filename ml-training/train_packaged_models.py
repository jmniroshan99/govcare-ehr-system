#!/usr/bin/env python3
"""Refit supported renal models from the packaged cohort and its fixed patient split.

Outputs are staged by default. --promote copies only passing research artifacts;
it never changes clinical rules, service routes, authorization or raw source data.
The previously evaluated patient split is reused, not a new independent test set.
"""
import argparse
import copy
import hashlib
import importlib.metadata
import platform
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import GroupKFold

from run_training import reg_models, class_models, write_json, evaluate_classifier_plots
from preprocessing.longitudinal_features import create_targets, feature_frame
from preprocessing.validate_data import assert_patient_split, assert_feature_contract
from evaluation.metrics import regression_metrics, classification_metrics, patient_bootstrap
from explainability.xai import write_global_xai
import train_hyperkalemia_from_packaged as hyperkalemia

ROOT=Path(__file__).resolve().parent
RESEARCH_LIMITATIONS=[
    'Refit of the previously evaluated packaged cohort and fixed split; not a new independent test set.',
    'Original precleaning data are unavailable. Possible upstream bidirectional interpolation cannot be ruled out.',
    'Internal retrospective research evaluation only; clinical validation NOT_COMPLETED; dataset permission UNVERIFIED.',
]

def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def partition_indices(eligible, manifest):
    groups={name:set(details['patients']) for name,details in manifest.items()}
    if set(groups)!={'train','validation','test'}:raise ValueError('Exact train/validation/test partitions required')
    if any(groups[a]&groups[b] for a,b in [('train','validation'),('train','test'),('validation','test')]):
        raise ValueError('Patient overlap in split manifest')
    patients=set(eligible.patient_id)
    if not patients.issubset(set.union(*groups.values())):raise ValueError('Patients missing from fixed manifest')
    result={name:np.flatnonzero(eligible.patient_id.isin(ids)) for name,ids in groups.items()}
    if any(len(ids)==0 for ids in result.values()):raise ValueError('Every split needs eligible observations')
    assert_patient_split(eligible,result)
    return result

def forecast_gate(candidate_validation, baselines):
    persistence=baselines['Persistence']['validation']['MAE']
    improvement=1-candidate_validation['MAE']/persistence if persistence>0 else float('-inf')
    best_simple=min(v['validation']['MAE'] for v in baselines.values())
    return bool(improvement>=.05 and candidate_validation['MAE']<best_simple),float(improvement)

def verify_pipeline(path, model, features):
    restored=joblib.load(path)
    np.testing.assert_allclose(restored.predict(features),model.predict(features),rtol=1e-10,atol=1e-10)

def train_numeric(target, frame, manifest, out, run_id):
    ordered,X,y,next_date,valid=create_targets(frame,target)
    eligible=ordered.loc[valid].copy();eligible['target_date']=next_date.loc[valid];eligible['target_value']=y.loc[valid]
    eligible=eligible.reset_index(drop=True);X=X.loc[valid].reset_index(drop=True);y=y.loc[valid].reset_index(drop=True)
    names=list(X.columns);assert_feature_contract(names);indices=partition_indices(eligible,manifest)
    train,val,test=(indices[p] for p in ('train','validation','test'))
    directory=out/'artifacts'/(target+'-risk');reports=out/'reports'/(target+'-risk')
    directory.mkdir(parents=True);reports.mkdir(parents=True)
    candidates=reg_models();metrics={};cv={}
    # All candidate families/parameters come from the existing fixed specification.
    for name,model in candidates.items():
        cv[name]=[]
        for tr,te in GroupKFold(n_splits=3).split(X.iloc[train],groups=eligible.iloc[train].patient_id):
            fold=copy.deepcopy(model);fold.fit(X.iloc[train[tr]],y.iloc[train[tr]])
            cv[name].append(regression_metrics(y.iloc[train[te]],fold.predict(X.iloc[train[te]])))
        model.fit(X.iloc[train],y.iloc[train])
        metrics[name]={'validation':regression_metrics(y.iloc[val],model.predict(X.iloc[val]))}
    predictions={'Persistence':eligible[target].to_numpy(),'RollingMean3':X[target+'_mean3'].to_numpy(),
                 'TrainingMean':np.full(len(y),float(y.iloc[train].mean()))}
    baselines={name:{p:regression_metrics(y.iloc[idx],values[idx]) for p,idx in indices.items() if p!='train'} for name,values in predictions.items()}
    best=min(candidates,key=lambda name:metrics[name]['validation']['MAE'])
    retain,improvement=forecast_gate(metrics[best]['validation'],baselines)
    model=candidates[best];served=model.predict(X) if retain else predictions['Persistence']
    # Selection/gate are frozen before test evaluation; the historical holdout is reused transparently.
    for name,candidate in candidates.items():metrics[name]['test']=regression_metrics(y.iloc[test],candidate.predict(X.iloc[test]))
    method='RESEARCH_MODEL' if retain else 'PERSISTENCE_BASELINE'
    meta=json.loads((ROOT/'artifacts'/(target+'-risk')/'metadata.json').read_text())
    previous_meta=copy.deepcopy(meta)
    joblib.dump(model,directory/'model.joblib',compress=3);joblib.dump(model[:-1],directory/'preprocessor.joblib',compress=3)
    verify_pipeline(directory/'model.joblib',model,X.iloc[test])
    xai=write_global_xai(model,X.iloc[test],names,reports)
    if xai['max_prediction_reconstruction_error']>1e-3:raise ValueError('SHAP reconstruction failed')
    residual=np.abs(y.iloc[val].to_numpy()-served[val])
    meta.update(algorithm=best,served_method=method,accepted_for_experimental_forecast=retain,
        selection_reason='Fixed candidates selected by validation MAE; prespecified >=5% persistence-improvement and best-simple-baseline gate.',
        training_date=datetime.now(timezone.utc).isoformat(),training_run_id=run_id,
        source_input_kind='PACKAGED_CLEANED_PSEUDONYMOUS_COHORT',
        original_source_dataset_sha256=previous_meta.get('source_dataset_sha256'),
        source_dataset_sha256=sha256(ROOT/'data/deidentified_monthly.csv'),
        packaged_cleaned_dataset_sha256=sha256(ROOT/'data/deidentified_monthly.csv'),
        split_manifest_sha256=sha256(ROOT/'reports/patient_split_manifest.json'),
        artifact_sha256=sha256(directory/'model.joblib'),feature_names=names,feature_order=names,
        validation_improvement_vs_persistence=improvement,selection_uses_test=False,
        test_set_is_new=False,clinical_validation='NOT_COMPLETED',dataset_permission_status='UNVERIFIED',
        interval_half_width=float(np.quantile(residual,.95,method='higher')),xai=xai,
        research_test_metrics=metrics[best]['test'],persistence_test_metrics=baselines['Persistence']['test'],
        partitions={p:{'patients':int(eligible.iloc[idx].patient_id.nunique()),'observations':len(idx)} for p,idx in indices.items()})
    meta['limitations']=list(dict.fromkeys(RESEARCH_LIMITATIONS+previous_meta.get('limitations',[])))
    # Replace any old numeric warning with this run's measured value.
    meta['limitations']=[l for l in meta['limitations'] if not l.startswith('Weak held-out performance:')]
    if metrics[best]['test']['R2']<=0:
        meta['limitations'].insert(0,f"Weak held-out performance: candidate R2={metrics[best]['test']['R2']:.4f}; test MAE={metrics[best]['test']['MAE']:.4f} {meta['unit']}, persistence MAE={baselines['Persistence']['test']['MAE']:.4f}. Experimental research only.")
    labels=((y<10)|(y>12)).astype(int) if target=='hb' else (y<65).astype(int)
    classifiers=class_models();classification={}
    for name,clf in classifiers.items():
        clf.fit(X.iloc[train],labels.iloc[train]);classification[name]={'validation':classification_metrics(labels.iloc[val],clf.predict_proba(X.iloc[val])[:,1])}
    best_cls=min(classifiers,key=lambda name:classification[name]['validation']['BrierScore'])
    for name,clf in classifiers.items():classification[name]['test']=classification_metrics(labels.iloc[test],clf.predict_proba(X.iloc[test])[:,1])
    classification.update(selected_by_validation_brier=best_cls,deployment_status='NOT_SERVED; original protocol labels are not validated disease probabilities',definition='Next Hb outside 10–12 g/dL' if target=='hb' else 'Next URR <65%')
    joblib.dump(classifiers[best_cls],directory/'research_classifier.joblib',compress=3)
    evaluate_classifier_plots(labels.iloc[test],classifiers[best_cls].predict_proba(X.iloc[test])[:,1],reports/'classification_curves.png',target.upper())
    metrics.update(baselines=baselines,group_kfold_train_only=cv,selected_candidate=best,served_method=method,
        served_test=regression_metrics(y.iloc[test],served[test]),exploratory_classification=classification,
        selected_candidate_test_cluster_bootstrap=patient_bootstrap(y.iloc[test],model.predict(X.iloc[test]),eligible.iloc[test].patient_id,predictions['Persistence'][test]))
    write_json(directory/'metadata.json',meta);write_json(directory/'metrics.json',metrics)
    for partition,idx in indices.items():
        rows=eligible.iloc[idx][['patient_id','observed_at','target_date','target_value']].copy()
        rows['candidate_prediction']=model.predict(X.iloc[idx]);rows['persistence']=predictions['Persistence'][idx]
        rows['served_prediction']=served[idx];rows['split']=partition;rows.to_csv(reports/(partition+'_predictions.csv'),index=False,date_format='%Y-%m-%d')
    print(target.upper(),best,'gate',retain,'validation MAE',metrics[best]['validation']['MAE'],'test MAE',metrics[best]['test']['MAE'],flush=True)
    return {'candidate':best,'gate_passed':retain,'served_method':method,'validation':metrics[best]['validation'],
            'test':metrics[best]['test'],'persistence_test':baselines['Persistence']['test'],
            'validation_improvement':improvement,'partitions':meta['partitions'],'artifact_sha256':meta['artifact_sha256']}

def main(output,promote=False):
    out=Path(output).resolve()
    if out.exists():raise ValueError('Use a new output directory; previous training runs are immutable')
    out.mkdir(parents=True);(out/'data').mkdir();(out/'reports').mkdir()
    shutil.copy2(ROOT/'data/deidentified_monthly.csv',out/'data/deidentified_monthly.csv')
    shutil.copy2(ROOT/'reports/patient_split_manifest.json',out/'reports/patient_split_manifest.json')
    manifest=json.loads((ROOT/'reports/patient_split_manifest.json').read_text())
    frame=pd.read_csv(ROOT/'data/deidentified_monthly.csv',parse_dates=['observed_at'],float_precision='round_trip')
    if frame.duplicated(['patient_id','observed_at']).any():raise ValueError('Duplicate patient/date rows')
    assert_feature_contract(list(feature_frame(frame).columns));partition_indices(frame,manifest)
    run_id=datetime.now(timezone.utc).strftime('RENAL-PACKAGED-%Y%m%dT%H%M%SZ')
    summary={'run_id':run_id,'created_at':datetime.now(timezone.utc).isoformat(),'source_rows':len(frame),
             'source_patients':int(frame.patient_id.nunique()),'new_independent_test_set':False,
             'environment':{'python':platform.python_version(),**{p:importlib.metadata.version(p) for p in ['numpy','pandas','scikit-learn','xgboost','lightgbm','shap','joblib','scipy','matplotlib','Django']}},
             'dataset_sha256':sha256(ROOT/'data/deidentified_monthly.csv'),
             'split_manifest_sha256':sha256(ROOT/'reports/patient_split_manifest.json'),
             'limitations':RESEARCH_LIMITATIONS,'models':{}}
    for target in ('hb','urr'):summary['models'][target]=train_numeric(target,frame,manifest,out,run_id)
    previous_root=hyperkalemia.ROOT
    try:hyperkalemia.ROOT=out;hyperkalemia.main()
    finally:hyperkalemia.ROOT=previous_root
    directory=out/'artifacts/hyperkalemia-risk';meta=json.loads((directory/'metadata.json').read_text());metrics=json.loads((directory/'metrics.json').read_text())
    train=metrics['metrics']['train'];val=metrics['metrics']['validation'];test=metrics['metrics']['test']
    val_rows=pd.read_csv(out/'reports/hyperkalemia-risk/validation_predictions.csv')
    constant=classification_metrics(val_rows.target_hyperkalemia_ge_5_5,np.full(len(val_rows),train['Prevalence']))
    passes=bool(val['ROC_AUC']>=.5 and val['BrierScore']<constant['BrierScore'])
    meta.update(training_run_id=run_id,selection_uses_test=False,test_set_is_new=False,
        accepted_for_experimental_forecast=passes,validation_baseline=constant,
        split_manifest_sha256=summary['split_manifest_sha256'])
    meta['limitations']=RESEARCH_LIMITATIONS+meta['limitations'];write_json(directory/'metadata.json',meta)
    summary['models']['hyperkalemia']={'candidate':'LogisticRegression','gate_passed':passes,
        'validation':val,'test':test,'validation_prevalence_baseline':constant,'partitions':meta['partitions'],
        'artifact_sha256':meta['artifact_sha256']}
    summary['promotion']={}
    for key,folder in [('hb','hb-risk'),('urr','urr-risk'),('hyperkalemia','hyperkalemia-risk')]:
        passing=summary['models'][key]['gate_passed']
        if promote and passing:
            shutil.copytree(out/'artifacts'/folder,ROOT/'artifacts'/folder,dirs_exist_ok=True)
            summary['promotion'][key]='UPDATED_RESEARCH_ARTIFACT'
        else:summary['promotion'][key]='RETAINED_EXISTING_BASELINE_OR_ARTIFACT' if promote else 'STAGED_ONLY'
    summary['untrainable']={'cardiovascular':'No labeled cardiovascular outcomes are supplied.',
        'renal_deterioration':'No adjudicated future deterioration/AKI labels are supplied; existing clinical rules retained.',
        'dry_weight':'Required patient identifiers, dates and longitudinal current-weight targets absent.',
        'idh':'No valid session/event cohort; previously documented target leakage remains unresolved.'}
    write_json(out/'training_run_summary.json',summary)
    print(json.dumps(summary,indent=2),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',required=True);parser.add_argument('--promote',action='store_true')
    args=parser.parse_args();main(args.output,args.promote)
