"""Seven-family benchmark. Never imports legacy scripts or modifies served artifacts."""
import copy
import json
import traceback
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.impute import SimpleImputer
from sklearn.model_selection import GroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from preprocessing.longitudinal_features import create_targets
from preprocessing.normalize_units import CANONICAL_UNITS
from training.algorithm_registry import SHORT_HORIZON, short_estimator
from training.baselines import regression_baselines, classification_baselines
from training.common import ROOT, LIMITATIONS, SEED, sha256, write_json, environment
from evaluation.benchmark import metrics, uncertainty, selection

def partition_indices(frame, manifest):
    if set(manifest) != {'train','validation','test'}: raise ValueError('Exact historical partitions required')
    patients={k:set(v['patients']) for k,v in manifest.items()}
    if any(patients[a]&patients[b] for a,b in [('train','validation'),('train','test'),('validation','test')]):
        raise ValueError('Patient overlap in split manifest')
    if set(frame.patient_id) - set.union(*patients.values()): raise ValueError('Unassigned patients')
    result={k:np.flatnonzero(frame.patient_id.isin(v)) for k,v in patients.items()}
    if any(len(v)==0 for v in result.values()): raise ValueError('An eligible partition is empty')
    return result

def grouped_splits(groups, y=None, classification=False):
    splits=list(GroupKFold(3).split(np.zeros(len(groups)), groups=groups))
    if classification and any(len(np.unique(np.asarray(y)[i]))<2 for pair in splits for i in pair):
        raise ValueError('Grouped fitting/calibration fold lacks both classes')
    return splits

def build_model(algorithm, kind, parameters, groups, y):
    pipe=Pipeline([('imputer',SimpleImputer(strategy='median',keep_empty_features=True)),
                   ('scaler',StandardScaler()),('model',short_estimator(algorithm,kind,parameters,SEED))])
    if algorithm=='support_vector' and kind=='classification':
        pipe=CalibratedClassifierCV(pipe,method='sigmoid',cv=grouped_splits(groups,y,True),ensemble=True,n_jobs=1)
    return pipe

def run_task(task, spec, frame, historical, output, run_id, fingerprints, config):
    directory=output/'short_horizon'/task; directory.mkdir(parents=True)
    ordered,X,y,dates,valid=create_targets(frame,spec['source'])
    eligible=ordered.loc[valid].reset_index(drop=True)
    target_dates=dates.loc[valid].reset_index(drop=True)
    X=X.loc[valid].reset_index(drop=True); y=y.loc[valid].reset_index(drop=True)
    kind=spec['kind']
    if kind=='classification': y=(y>=spec['threshold_mmol_l']).astype(int)
    indices=partition_indices(eligible,historical); train,val,test=(indices[k] for k in ('train','validation','test'))
    groups=eligible.patient_id.to_numpy(); folds=grouped_splits(groups[train],y.iloc[train],kind=='classification')
    split_detail={p:{'observations':len(idx),'patients':int(eligible.iloc[idx].patient_id.nunique()),
        'positive_labels':int(y.iloc[idx].sum()) if kind=='classification' else None} for p,idx in indices.items()}
    derived=pd.concat([eligible[['patient_id','observed_at']],target_dates.rename('target_date'),y.rename('target'),X],axis=1)
    derived['partition']=''
    for p,idx in indices.items():derived.loc[idx,'partition']=p
    derived.to_csv(directory/'derived.csv',index=False)
    write_json(directory/'transformations.json',{'source_sha256':fingerprints['dataset_sha256'], 'derived_sha256':sha256(directory/'derived.csv'),
        'source_unchanged':True,'feature_builder':'preprocessing.longitudinal_features.feature_frame',
        'target':config['target'],'no_interpolation':True,'fitting':'Training-only median/scaling in every fold',
        'folds': [{'training_patients':sorted(set(groups[train[a]])), 'held_out_patients':sorted(set(groups[train[b]]))} for a,b in folds]})
    predictions=regression_baselines(y.iloc[train],eligible[spec['source']]) if kind=='regression' else classification_baselines(y.iloc[train],len(y))
    baseline_metrics={name:{p:metrics(kind,y.iloc[idx],pred[idx]) for p,idx in indices.items() if p!='train'} for name,pred in predictions.items()}
    results={}; fitted={}; configured=json.loads((ROOT/'configs/algorithms/short_horizon.json').read_text())
    key='MAE' if kind=='regression' else 'BrierScore'
    for algorithm in SHORT_HORIZON:
        entry={'registered':True,'training_status':'REGISTERED','evaluated':False,'served':False}
        results[algorithm]=entry
        folder=directory/algorithm;folder.mkdir()
        params=configured[algorithm]
        grid=params.get(kind,[{**params.get('shared',{}),**p} for p in params.get('search',[])])
        trials=[]
        try:
            for setting in grid:
                scores=[]
                for tr,te in folds:
                    a,b=train[tr],train[te]
                    estimator=build_model(algorithm,kind,setting,groups[a],y.iloc[a])
                    estimator.fit(X.iloc[a],y.iloc[a])
                    pred=estimator.predict(X.iloc[b]) if kind=='regression' else estimator.predict_proba(X.iloc[b])[:,1]
                    scores.append(metrics(kind,y.iloc[b],pred)[key])
                trials.append({'parameters':setting,'fold_scores':scores,'mean':float(np.mean(scores))})
            best=min(trials,key=lambda v:v['mean'])
            estimator=build_model(algorithm,kind,best['parameters'],groups[train],y.iloc[train])
            estimator.fit(X.iloc[train],y.iloc[train])
            pred=estimator.predict(X.iloc[val]) if kind=='regression' else estimator.predict_proba(X.iloc[val])[:,1]
            entry.update(training_status='TRAINED_RESEARCH_ONLY',parameters=best['parameters'],tuning=trials,validation=metrics(kind,y.iloc[val],pred))
            joblib.dump(estimator,folder/'model.joblib',compress=3)
            fitted[algorithm]=estimator
        except Exception as exc:
            entry.update(training_status='FAILED_TRAINING',reason=f'{type(exc).__name__}: {exc}',tuning=trials)
            (folder/'failure.log').write_text(traceback.format_exc(),encoding='utf-8')
        write_json(folder/'training_status.json',entry)
        print(f'{task}/{algorithm}: {entry["training_status"]}',flush=True)
    winner=min(fitted,key=lambda a:results[a]['validation'][key]) if fitted else None
    passes,improvement=selection(kind,results[winner]['validation'],{k:v['validation'] for k,v in baseline_metrics.items()}) if winner else (False,None)
    selected=winner if passes else ('persistence' if kind=='regression' else 'training_prevalence')
    decision={'selected_method':selected,'best_candidate':winner,'gate_passed':passes,'improvement':improvement,
        'selection_uses_test':False,'criterion':config['selection'][kind],'frozen_before_test':True,
        'status':'TRAINED_RESEARCH_ONLY' if passes else 'BASELINE_SELECTED','served':False,
        'deployment_reason':'Staged benchmark only; existing approved serving location is retained.'}
    write_json(directory/'selection_before_test.json',decision)
    write_json(directory/'baselines.json',{'task':task,**fingerprints,'run_id':run_id,'schema_version':'CDSS-BASELINE-1',
        'output_unit':spec['unit'],'target':config['target'],'selection':decision,'served':False,
        'methods':{'persistence':'Current observed target value','training_mean':float(y.iloc[train].mean()),
            'training_median':float(y.iloc[train].median())} if kind=='regression' else
            {'training_prevalence':float(y.iloc[train].mean()),'majority_class':int(y.iloc[train].mean()>=.5)},
        'limitations':LIMITATIONS,'clinical_validation':'NOT_COMPLETED','dataset_permission_status':'UNVERIFIED'})
    anchor=predictions['persistence' if kind=='regression' else 'training_prevalence']
    for algorithm,estimator in fitted.items():
        entry=results[algorithm]; folder=directory/algorithm
        pred=estimator.predict(X.iloc[test]) if kind=='regression' else estimator.predict_proba(X.iloc[test])[:,1]
        if not np.isfinite(pred).all() or (kind=='classification' and ((pred<0)|(pred>1)).any()): raise ValueError('Invalid prediction')
        entry.update(evaluated=True,test=metrics(kind,y.iloc[test],pred),
            patient_uncertainty=uncertainty(kind,y.iloc[test],pred,groups[test],anchor[test]),
            passed_validation_gate=selection(kind,entry['validation'],{k:v['validation'] for k,v in baseline_metrics.items()})[0])
        entry['patient_test_metrics']={p:metrics(kind,y.iloc[test][groups[test]==p],pred[groups[test]==p]) for p in np.unique(groups[test])}
        report=eligible.iloc[test][['patient_id','observed_at']].copy()
        report['target_date']=target_dates.iloc[test].to_numpy();report['actual']=y.iloc[test].to_numpy();report['prediction']=pred
        report.to_csv(folder/'test_predictions.csv',index=False)
        restored=joblib.load(folder/'model.joblib')
        replay=restored.predict(X.iloc[test]) if kind=='regression' else restored.predict_proba(X.iloc[test])[:,1]
        np.testing.assert_allclose(replay,pred,rtol=1e-10,atol=1e-10)
        manifest={'schema_version':'CDSS-ARTIFACT-1','model_version':run_id,'run_id':run_id,'algorithm_id':algorithm,'task':task,
            'population':config['population'],'seed':SEED,'endpoint':config['target']+(' potassium_pre >=5.5 mmol/L' if kind=='classification' else ' '+task),
            **fingerprints,'feature_names':list(X.columns),'feature_order':list(X.columns),
            'feature_units':{c:('days' if c=='days_since_previous' else 'mmol/L' if c=='potassium_reduction' else 'umol/L' if c=='creatinine_reduction' else
                next((CANONICAL_UNITS[p]+('/day' if c.endswith('_slope_per_day') else '') if not c.endswith('_pct_change') else '%' for p in CANONICAL_UNITS if c==p or c.startswith(p+'_')),'UNKNOWN')) for c in X},
            'preprocessing':{'imputation':'training median; keep_empty_features','scaling':'training StandardScaler','feature_selection':'none'},
            'target_definition':config['target'],'supported_horizons_days':{'min':14,'max':62,'display_anchor':30},'output_unit':spec['unit'],
            'validation':entry['validation'],'selection':decision,'calibration':config['svc_calibration'] if algorithm=='support_vector' and kind=='classification' else 'Native estimator; descriptive calibration assessed, no claimed clinical calibration',
            'uncertainty':entry['patient_uncertainty'],'artifact_sha256':sha256(folder/'model.joblib'),
            'environment':environment(),'clinical_validation':'NOT_COMPLETED','dataset_permission_status':'UNVERIFIED','limitations':LIMITATIONS,
            'eligibility_rules':['Verified maintenance HD','Dated current/past measurements','No clinical deployment from this candidate directory'],
            'status':'TRAINED_RESEARCH_ONLY','served':False}
        write_json(folder/'manifest.json',manifest);write_json(folder/'metrics.json',entry);write_json(folder/'training_status.json',entry)
        (folder/'MODEL_CARD.md').write_text(f'# {algorithm}: {task}\n\nStatus: TRAINED_RESEARCH_ONLY. Evaluated: yes. Served: no.\n\nValidation {key}: {entry["validation"][key]:.6f}; reused test {key}: {entry["test"][key]:.6f} {spec["unit"]}.\n\nSelected method: {selected}; validation gate passed: {entry["passed_validation_gate"]}. See manifest.json and metrics.json for configuration, uncertainty and provenance.\n\n'+'\n'.join(LIMITATIONS)+'\n',encoding='utf-8')
    selected_predictions=anchor if selected not in fitted else (fitted[selected].predict(X) if kind=='regression' else fitted[selected].predict_proba(X)[:,1])
    summary={'task':task,'kind':kind,'unit':spec['unit'],'partitions':split_detail,'candidates':results,'baselines':baseline_metrics,'selection':decision,
        'selected_test':metrics(kind,y.iloc[test],selected_predictions[test]),
        'selected_uncertainty':uncertainty(kind,y.iloc[test],selected_predictions[test],groups[test],anchor[test])}
    write_json(directory/'results.json',summary)
    return summary
