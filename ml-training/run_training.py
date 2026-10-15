#!/usr/bin/env python3
"""Run: python run_training.py --source PATH --key-file PRIVATE_KEY_PATH."""
import argparse
import copy
import hashlib
import importlib.metadata
import json
import platform
from datetime import datetime,timezone
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import Ridge,LogisticRegression
from sklearn.ensemble import RandomForestRegressor,RandomForestClassifier
from sklearn.model_selection import GroupShuffleSplit,GroupKFold
from sklearn.calibration import calibration_curve
from sklearn.metrics import roc_curve,precision_recall_curve,ConfusionMatrixDisplay
from xgboost import XGBRegressor,XGBClassifier
from lightgbm import LGBMRegressor,LGBMClassifier
from preprocessing.load_data import audit_source,write_audit,file_hash
from preprocessing.clean_data import clean_monthly
from preprocessing.longitudinal_features import create_targets,feature_frame
from preprocessing.validate_data import assert_patient_split,assert_feature_contract
from evaluation.metrics import regression_metrics,classification_metrics,patient_bootstrap
from explainability.xai import write_global_xai

ROOT=Path(__file__).resolve().parent
SEED=42

def write_json(path,value):
    def sanitize(item):
        if isinstance(item,dict): return {k:sanitize(v) for k,v in item.items()}
        if isinstance(item,(list,tuple)): return [sanitize(v) for v in item]
        if isinstance(item,(float,np.floating)) and not np.isfinite(item): return None
        if hasattr(item,'item'): return item.item()
        return item
    Path(path).write_text(json.dumps(sanitize(value),indent=2,allow_nan=False,default=str)+'\n',encoding='utf-8')

def pipeline(model):
    return Pipeline([('imputer',SimpleImputer(strategy='median',add_indicator=False,keep_empty_features=True)),
                     ('scaler',StandardScaler()),('model',model)])

def reg_models():
    return {
        'Ridge':pipeline(Ridge(alpha=100)),
        'RandomForest':pipeline(RandomForestRegressor(n_estimators=120,max_depth=5,min_samples_leaf=6,max_features=.6,random_state=SEED,n_jobs=1)),
        'XGBoost':pipeline(XGBRegressor(n_estimators=120,max_depth=2,learning_rate=.04,subsample=.8,colsample_bytree=.7,reg_lambda=10,random_state=SEED,n_jobs=1)),
        'LightGBM':pipeline(LGBMRegressor(n_estimators=120,num_leaves=7,max_depth=3,learning_rate=.04,min_child_samples=15,reg_lambda=10,verbosity=-1,random_state=SEED,n_jobs=1)),
    }

def class_models():
    return {
        'LogisticRegression':pipeline(LogisticRegression(C=.1,max_iter=3000,random_state=SEED)),
        'RandomForest':pipeline(RandomForestClassifier(n_estimators=120,max_depth=5,min_samples_leaf=6,max_features=.6,random_state=SEED,n_jobs=1)),
        'XGBoost':pipeline(XGBClassifier(n_estimators=120,max_depth=2,learning_rate=.04,reg_lambda=10,subsample=.8,colsample_bytree=.7,random_state=SEED,n_jobs=1,eval_metric='logloss')),
        'LightGBM':pipeline(LGBMClassifier(n_estimators=120,num_leaves=7,max_depth=3,learning_rate=.04,min_child_samples=15,reg_lambda=10,verbosity=-1,random_state=SEED,n_jobs=1)),
    }

def evaluate_classifier_plots(y,proba,out,title):
    fig,axes=plt.subplots(2,2,figsize=(10,8))
    ConfusionMatrixDisplay.from_predictions(y,proba>=.5,labels=[0,1],ax=axes[0,0],colorbar=False)
    if len(np.unique(y))==2:
        fpr,tpr,_=roc_curve(y,proba);axes[0,1].plot(fpr,tpr);axes[0,1].plot([0,1],[0,1],'--');axes[0,1].set(xlabel='False positive rate',ylabel='Sensitivity',title='ROC')
        precision,recall,_=precision_recall_curve(y,proba);axes[1,0].plot(recall,precision);axes[1,0].axhline(np.mean(y),linestyle='--');axes[1,0].set(xlabel='Recall',ylabel='Precision',title='Precision–recall')
    observed,predicted=calibration_curve(y,proba,n_bins=5,strategy='quantile')
    axes[1,1].plot(predicted,observed,'o-');axes[1,1].plot([0,1],[0,1],'--');axes[1,1].set(xlabel='Mean predicted probability',ylabel='Observed fraction',title='Exploratory calibration')
    fig.suptitle(title+'; source-protocol research label, not a clinical threshold');fig.tight_layout();fig.savefig(out,dpi=170);plt.close(fig)

def main(source,key_file):
    reports=ROOT/'reports';artifacts=ROOT/'artifacts';data=ROOT/'data'
    for d in (reports,artifacts,data): d.mkdir(exist_ok=True)
    audit=audit_source(source);write_audit(audit,reports)
    sourcefile=Path(source)/'HeatMap/urr_data.xlsx'
    frame,flags=clean_monthly(sourcefile,Path(key_file).read_bytes())
    flags.to_csv(reports/'quality_flags.csv',index=False)
    frame.to_csv(data/'deidentified_monthly.csv',index=False,date_format='%Y-%m-%d')
    cohort=frame.groupby('patient_id').agg(observations=('observed_at','size'),first=('observed_at','min'),last=('observed_at','max'))
    cohort.to_csv(reports/'patient_cohort.csv',date_format='%Y-%m-%d')
    # Partition patients before outcome filtering; a fixed seed is not searched for attractive metrics.
    trainval,test=next(GroupShuffleSplit(n_splits=1,test_size=.2,random_state=SEED).split(frame,groups=frame.patient_id))
    train_rel,val_rel=next(GroupShuffleSplit(n_splits=1,test_size=.25,random_state=SEED+1).split(frame.iloc[trainval],groups=frame.iloc[trainval].patient_id))
    split={'train':trainval[train_rel],'validation':trainval[val_rel],'test':test}
    assert_patient_split(frame,split)
    group_sets={k:set(frame.iloc[v].patient_id) for k,v in split.items()}
    manifest={k:{'patients':sorted(v),'patient_count':len(v),'source_rows':len(split[k])} for k,v in group_sets.items()}
    write_json(reports/'patient_split_manifest.json',manifest)
    feature_names=list(feature_frame(frame).columns);assert_feature_contract(feature_names)
    write_json(reports/'feature_definitions.json',{'features':feature_names,'numeric_units':{'hb':'g/dL','albumin':'g/L','calcium':'mmol/L','sodium':'mmol/L','potassium':'mmol/L','creatinine':'umol/L','urr':'%'},
        'previous':'Immediately preceding source observation, not future filled','difference':'Current minus previous','pct_change':'100*difference/previous; zero denominator -> missing',
        'mean3/sd3/min3/max3':'Up to three observations through current index, grouped within patient',
        'slope_per_day':'OLS slope over up to three historical/current valid values using actual elapsed days',
        'urea/uric_acid':'Absolute values excluded because source units unverified'})
    summaries={}; comparisons=[]; classifications=[]
    for target in ['hb','urr']:
        ordered,X,y,next_date,valid=create_targets(frame,target)
        eligible=ordered.loc[valid].copy();eligible['target_date']=next_date[valid];eligible['target_value']=y[valid]
        X=X.loc[valid].reset_index(drop=True);y=y.loc[valid].reset_index(drop=True);eligible=eligible.reset_index(drop=True)
        indices={k:np.flatnonzero(eligible.patient_id.isin(groups)) for k,groups in group_sets.items()}
        assert_patient_split(eligible,indices)
        partitions={k:{'patients':int(eligible.iloc[v].patient_id.nunique()),'observations':len(v)} for k,v in indices.items()}
        train=indices['train'];val=indices['validation'];testidx=indices['test']
        targetdir=artifacts/(target+'-risk');targetdir.mkdir(exist_ok=True)
        metric_record={};fitted={};cv={}
        for name,p in reg_models().items():
            cv_results=[]
            for tr,te in GroupKFold(n_splits=3).split(X.iloc[train],groups=eligible.iloc[train].patient_id):
                cp=copy.deepcopy(p);cp.fit(X.iloc[train[tr]],y.iloc[train[tr]])
                cv_results.append(regression_metrics(y.iloc[train[te]],cp.predict(X.iloc[train[te]])))
            cv[name]=cv_results
            p.fit(X.iloc[train],y.iloc[train]);fitted[name]=p
            metric_record[name]={k:regression_metrics(y.iloc[idx],p.predict(X.iloc[idx])) for k,idx in indices.items() if k!='train'}
            comparisons.append({'target':target,'algorithm':name,**{'validation_'+k:v for k,v in metric_record[name]['validation'].items()},**{'test_'+k:v for k,v in metric_record[name]['test'].items()}})
        baseline_predictions={
            'Persistence':eligible[target].to_numpy(),
            'RollingMean3':X[target+'_mean3'].to_numpy(),
            'TrainingMean':np.full(len(y),float(y.iloc[train].mean())),
        }
        baselines={name:{k:regression_metrics(y.iloc[idx],p[idx]) for k,idx in indices.items() if k!='train'} for name,p in baseline_predictions.items()}
        for name,m in baselines.items(): comparisons.append({'target':target,'algorithm':name,**{'validation_'+k:v for k,v in m['validation'].items()},**{'test_'+k:v for k,v in m['test'].items()}})
        best=min(metric_record,key=lambda n:metric_record[n]['validation']['MAE'])
        best_baseline=min(baselines,key=lambda n:baselines[n]['validation']['MAE'])
        improvement=1-metric_record[best]['validation']['MAE']/baselines['Persistence']['validation']['MAE']
        # Deployment of experimental numeric forecast uses validation only; the sealed test is never a selection criterion.
        retain=improvement>=.05 and metric_record[best]['validation']['MAE']<baselines[best_baseline]['validation']['MAE']
        method='RESEARCH_MODEL' if retain else 'PERSISTENCE_BASELINE'
        served=fitted[best].predict(X) if retain else baseline_predictions['Persistence']
        residual=np.abs(y.iloc[val].to_numpy()-served[val])
        halfwidth=float(np.quantile(residual,.95,method='higher'))
        meta={
            'model_key':target,'model':f'LK-RENAL-{target.upper()}-1.0','model_version':'1.0.0','algorithm':best,
            'served_method':method,'accepted_for_experimental_forecast':retain,
            'selection_reason':'Best validation MAE among fixed candidates; >=5% better than persistence and better than other simple baselines' if retain else 'ML did not meet the prespecified baseline-improvement gate; persistence is served explicitly',
            'feature_names':feature_names,'feature_order':feature_names,'target':f'Next chronological {target} of same patient within 14–62 days',
            'horizon_days':30,'horizon_definition':'Next observed measurement 14–62 days; display anchor +30 days',
            'unit':'g/dL' if target=='hb' else '%','probability':None,'threshold':None,
            'population':'Sri Lankan maintenance-hemodialysis cohort (source README attribution)',
            'country':'Sri Lanka','validation_status':'INTERNAL_RESEARCH_EVALUATION','status':'RESEARCH_MODEL',
            'clinical_validation':'NOT_COMPLETED','dataset_permission_status':'UNVERIFIED','requires_clinician_review':True,
            'source_dataset_sha256':file_hash(sourcefile),'training_date':datetime.now(timezone.utc).isoformat(),
            'cleaned_observation_count':len(frame),'eligible_observation_count':len(eligible),'cohort_patient_count':int(frame.patient_id.nunique()),
            'partitions':partitions,'group_split_seed':SEED,'validation_seed':SEED+1,
            'selection_uses_test':False,'interval_half_width':halfwidth,'interval_level':.95,
            'interval_method':'EMPIRICAL_VALIDATION_ABSOLUTE_RESIDUAL_NOT_CLINICALLY_CALIBRATED',
            'validation_improvement_vs_persistence':float(improvement),
            'hyperparameters':{name:p[-1].get_params() for name,p in fitted.items()},
            'required_measurements':['hb','urea_pre','urea_post','albumin','calcium','sodium','potassium_pre','potassium_post','creatinine_pre','creatinine_post'],
            'limitations':['Small, single supplied cohort; no external/prospective clinical validation',
                'Original raw data absent; source notebook uses bidirectional interpolation and upstream leakage cannot be ruled out',
                'Secondary research-use permission UNVERIFIED',
                'Urea source units unverified; paired ratio assumes shared pre/post units',
                'Source uric acid unit inconsistent; excluded from predictors',
                'Empirical residual band does not establish individual or clinical coverage',
                'No dialysis dose, medication, ferritin/iron or management response confounders are available'],
            'versions':{p:importlib.metadata.version(p) for p in ['numpy','pandas','scikit-learn','xgboost','lightgbm','shap','joblib']},
        }
        model=fitted[best]
        joblib.dump(model,targetdir/'model.joblib',compress=3)
        joblib.dump(model[:-1],targetdir/'preprocessor.joblib',compress=3)
        assert np.allclose(joblib.load(targetdir/'model.joblib').predict(X.iloc[testidx]),model.predict(X.iloc[testidx]))
        xai=write_global_xai(model,X.iloc[testidx],feature_names,reports/(target+'-risk'))
        if xai['max_prediction_reconstruction_error']>1e-3: raise AssertionError('SHAP failed to reconstruct model output')
        meta['xai']=xai
        meta['artifact_sha256']=file_hash(targetdir/'model.joblib')
        metric_record['baselines']=baselines;metric_record['group_kfold_train_only']=cv
        metric_record['selected_candidate']=best;metric_record['served_method']=method
        metric_record['served_test']=regression_metrics(y.iloc[testidx],served[testidx])
        meta['research_test_metrics']=metric_record[best]['test']
        meta['persistence_test_metrics']=baselines['Persistence']['test']
        if metric_record[best]['test']['R2'] is not None and metric_record[best]['test']['R2']<=0:
            meta['limitations'].insert(0,f"Weak held-out performance: candidate R2={metric_record[best]['test']['R2']:.4f}; test MAE={metric_record[best]['test']['MAE']:.4f} {meta['unit']}, persistence MAE={baselines['Persistence']['test']['MAE']:.4f}. Numerical output is experimental, not a reliable clinical recommendation.")
        metric_record['selected_candidate_test_cluster_bootstrap']=patient_bootstrap(y.iloc[testidx],model.predict(X.iloc[testidx]),eligible.iloc[testidx].patient_id,baseline_predictions['Persistence'][testidx])
        # Additional temporal experiment deliberately uses the same cohort with strictly purged dates, reported separately from disjoint-patient test.
        cutoff=pd.Timestamp('2024-09-01')
        temporal_train=np.flatnonzero(eligible.target_date<=cutoff)
        temporal_test=np.flatnonzero(eligible.observed_at>=cutoff)
        temporal=copy.deepcopy(reg_models()[best]);temporal.fit(X.iloc[temporal_train],y.iloc[temporal_train])
        metric_record['temporal']={'cutoff':'2024-09-01','strategy':'Same-cohort temporal, training target dates <=cutoff; test feature dates >=cutoff, no future training outcomes',
            'train_rows':len(temporal_train),'test_rows':len(temporal_test),'patient_overlap_expected':True,
            'model':regression_metrics(y.iloc[temporal_test],temporal.predict(X.iloc[temporal_test])),
            'persistence':regression_metrics(y.iloc[temporal_test],baseline_predictions['Persistence'][temporal_test])}
        # Risk classifiers are exploratory labels defined in supplied notebooks, not clinician-approved treatment thresholds.
        yc=((y<10)|(y>12)).astype(int) if target=='hb' else (y<65).astype(int)
        cls={};cls_fitted={}
        if yc.iloc[train].nunique()==2:
            for name,p in class_models().items():
                p.fit(X.iloc[train],yc.iloc[train]);cls_fitted[name]=p
                cls[name]={k:classification_metrics(yc.iloc[idx],p.predict_proba(X.iloc[idx])[:,1]) for k,idx in indices.items() if k!='train'}
                classifications.append({'target':target,'algorithm':name,**cls[name]['test']})
            prevalence=float(yc.iloc[train].mean())
            cls['TrainingPrevalence']={k:classification_metrics(yc.iloc[idx],np.full(len(idx),prevalence)) for k,idx in indices.items() if k!='train'}
            best_cls=min(cls_fitted,key=lambda n:cls[n]['validation']['BrierScore'])
            joblib.dump(cls_fitted[best_cls],targetdir/'research_classifier.joblib',compress=3)
            evaluate_classifier_plots(yc.iloc[testidx],cls_fitted[best_cls].predict_proba(X.iloc[testidx])[:,1],reports/(target+'-risk')/'classification_curves.png',target.upper())
            cls['selected_by_validation_brier']=best_cls
        cls['definition']='Next Hb outside 10–12 g/dL (source notebook protocol)' if target=='hb' else 'Next URR <65% (source notebook protocol)'
        cls['deployment_status']='NOT_SERVED: protocol approval and calibration/external validation absent; numerical regression only'
        metric_record['exploratory_classification']=cls
        write_json(targetdir/'metadata.json',meta);write_json(targetdir/'metrics.json',metric_record)
        for partition,idx in indices.items():
            rows=eligible.iloc[idx][['patient_id','observed_at','target_date','target_value']].copy()
            rows['candidate_prediction']=model.predict(X.iloc[idx]);rows['persistence']=baseline_predictions['Persistence'][idx]
            rows['served_prediction']=served[idx];rows['split']=partition
            rows.to_csv(reports/(target+'-risk')/(partition+'_predictions.csv'),index=False,date_format='%Y-%m-%d')
        patient_rows=[]
        for patient,g in eligible.iloc[testidx].groupby('patient_id'):
            ids=g.index.to_numpy();patient_rows.append({'patient_id':patient,'rows':len(ids),**regression_metrics(y.iloc[ids],model.predict(X.iloc[ids])),'persistence_MAE':regression_metrics(y.iloc[ids],baseline_predictions['Persistence'][ids])['MAE']})
        pd.DataFrame(patient_rows).to_csv(reports/(target+'-risk')/'patientwise_test_metrics.csv',index=False)
        summaries[target]={'metadata':meta,'metrics':metric_record}
        print(target.upper(),partitions,'selected',best,'served',method,'candidate test',metric_record[best]['test'],'persistence test',baselines['Persistence']['test'],flush=True)
    # Legacy dry-weight predictions allow a descriptive paired benchmark, not patient-aware validation.
    dry=pd.read_excel(Path(source)/'ML_Model/code/dry_weight_predict/dry_weight_predictions.xlsx')
    dry_report={'status':'INSUFFICIENT_DATA_FOR_RELIABLE_MODEL','rows':len(dry),'unique_patients':None,
        'missing_required_fields':['patient_id','date','current_dry_weight'],
        'legacy_prediction_export_descriptive_metrics':regression_metrics(dry.True_Dry_Weight,dry.Predicted_Dry_Weight),
        'post_hd_weight_proxy_descriptive_metrics':regression_metrics(dry.True_Dry_Weight,dry['Post HD weight (kg)']),
        'interpretation':'Exported errors are descriptive, not a freshly grouped validation. Post-HD weight is a proxy, NOT next-dry-weight persistence. True persistence/rolling/LOCF cannot be reconstructed; legacy model not promoted.'}
    dr=artifacts/'dry-weight';dr.mkdir(exist_ok=True);write_json(dr/'metadata.json',{'model_key':'dry-weight','model':'LK-RENAL-DRYWEIGHT-1.0','model_version':'1.0.0','status':'INSUFFICIENT_DATA_FOR_RELIABLE_MODEL','clinical_validation':'NOT_COMPLETED','dataset_permission_status':'UNVERIFIED',**dry_report})
    write_json(reports/'dry_weight_audit.json',dry_report)
    write_json(reports/'idh_audit.json',{'status':'INSUFFICIENT_DATA_FOR_RELIABLE_MODEL','positive_events':None,'negative_events':None,
        'raw_sessions':'Absent from supplied archive','patient_id_and_event_timing':'Unavailable in exported dry-weight file',
        'direct_target_leakage':'Two MLP notebooks use SYS <=90 as target and retain SYS in X',
        'patient_leakage':'IDH row-random splits appear in notebooks; cannot verify grouped performance',
        'legacy_metrics_reused':False})
    pd.DataFrame(comparisons).to_csv(reports/'model_comparison.csv',index=False)
    pd.DataFrame(classifications).to_csv(reports/'classification_comparison.csv',index=False)
    write_json(reports/'training_summary.json',summaries)
    report=['# Sri Lankan renal model training report','',f'Training completed: {datetime.now(timezone.utc).isoformat()}','',
        'This is an executed retrospective research evaluation. It is not clinical validation. Original raw data and secondary-use permission were not supplied.',
        '',f'Canonical input: 391 supplied rows → {len(frame)} unique chronological rows, {frame.patient_id.nunique()} patients, 2024-01-01 through 2024-12-01.',
        'Master demographics: 45 subjects. Alternate monthly matrix: 387 rows / 42 patients; not added to the cohort.',
        '',f'Patient partitions (before target filtering): '+json.dumps({k:v['patient_count'] for k,v in manifest.items()}),
        '', 'Patient-disjoint GroupShuffleSplit; fixed seeds 42/43, approximately 60/20/20. Median imputation and standardization fit inside each training fold only. Three-fold GroupKFold uses training patients only.',
        '', 'Features and targets use shared preprocessing; target is the immediate next chronological record of the same patient, restricted to 14–62 days. No replacement/interpolation of missing outcomes. Unknown absolute urea and uric acid units are excluded.',
        '', 'Candidate hyperparameters are fixed before evaluation and saved in metadata. Numeric model selection uses validation MAE only. Prespecified gate: at least 5% better than persistence and better than the other simple baselines. Test performance does not select the model.',
        '', '| Target | Candidate | Served method | Eligible pairs | Train patients/rows | Validation patients/rows | Test patients/rows | Candidate test MAE | Persistence test MAE |', '|---|---|---|---:|---|---|---|---:|---:|']
    for t,s in summaries.items():
        m=s['metadata'];v=s['metrics'];p=m['partitions'];report.append(f"| {t.upper()} | {m['algorithm']} | {m['served_method']} | {m['eligible_observation_count']} | {p['train']['patients']}/{p['train']['observations']} | {p['validation']['patients']}/{p['validation']['observations']} | {p['test']['patients']}/{p['test']['observations']} | {v[m['algorithm']]['test']['MAE']:.4f} | {v['baselines']['Persistence']['test']['MAE']:.4f} |")
    for t,s in summaries.items():
        report+=['','## '+t.upper(),'','```json',json.dumps(s['metrics'],indent=2),'```','',
            'Top SHAP associations: '+json.dumps(s['metadata']['xai']['top_features']),
            '', 'Measured and predicted values are stored separately. SHAP explains the selected research candidate; when persistence is preferred the served explanation is a baseline rule, not SHAP evidence for an accepted ML output.']
    report+=['','## Dry weight','',json.dumps(dry_report,indent=2),'','## IDH','',
        'INSUFFICIENT_DATA_FOR_RELIABLE_MODEL. Original session/event data missing; SYS-derived target leakage in MLP notebooks and row-level random splitting invalidate reuse of reported legacy accuracy.',
        '', '## Limitations and deployment','',
        'Dataset permission: UNVERIFIED. Clinical validation: NOT_COMPLETED. Source precleaning provenance: UNVERIFIED. Internal patient-disjoint evaluation cannot undo interpolation already present in the supplied source.',
        'Single-cohort and small patient test sets, no hospital external validation, no randomized or prospective impact evaluation. Test metrics and bootstrap CIs are exploratory, not a claim of population/clinical benefit.',
        'Exploratory classifiers use source notebook labels (Hb outside 10–12, URR <65). They are fitted and plotted but not served as clinical risk probabilities; protocol approval and independent calibration are absent.',
        'Temporal validation is a distinct same-cohort experiment: targets through 2024-09-01 train, origins from 2024-09-01 test. It is not a new patient/hospital test.',
        'Artifacts contain the full imputation/scaling/model pipeline, ordered feature contract, source/artifact hashes, package versions, thresholds, selection reason and exact partition counts. No source-supplied pickle is executed.',
        'Operational integration serves numeric forecasts through authenticated Django → Spring clinical authorization → patient EHR UI; snapshots/reviews/FHIR/provenance are auditable. Research source rows are not imported as real EHR patient observations.',
        '', '## Reproduction','', '`python run_training.py --source /path/to/extracted/e19-repository --key-file /private/pseudonym.key`',
        'Reuse the same private HMAC key and locked package versions for the same split manifest. The key and original subject IDs are deliberately not packaged.']
    (reports/'SRI_LANKAN_RENAL_MODEL_TRAINING_REPORT.md').write_text('\n'.join(report)+'\n',encoding='utf-8')
    (reports/'LEAKAGE_AUDIT_REPORT.md').write_text('''# Leakage audit

## Newly implemented pipeline
- PASS: Training/validation/test patient sets are disjoint and saved in the manifest.
- PASS: Identifiers, source row, target and future date are excluded from feature order.
- PASS: Rolling features end at the current row; lag/differences use earlier rows only.
- PASS: Numeric target is the immediate subsequent observation of the same patient, with a 14–62 day interval.
- PASS: Median imputer and scaler fit on train only; grouped CV fits preprocessing independently inside each fold.
- PASS: Model selection uses validation only; no test-set threshold/model tuning.
- PASS: Temporal experiment purges training outcomes after its cutoff; test origins begin at cutoff.
- PASS: No legacy pickle is loaded. No outcome/diagnosis/subject numeric proxy is used.

## Unresolved upstream source limitation
UNVERIFIED: The original monthly preprocessing notebook performs bidirectional interpolation before splitting. Pre-cleaning raw files are absent. The supplied matrices may already contain future-derived values; no new algorithm can establish their original measurement provenance. Therefore a claim of completely leakage-free clinical validation would be false. All outputs are research only and carry this limitation.

## Legacy IDH/dry-weight findings
IDH MLP targets derived from SYS <=90 retain SYS in inputs. IDH and dry-weight notebooks contain row-random splits and missing source files. Those fitted legacy artifacts and metrics are not accepted.
''',encoding='utf-8')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--source',required=True);parser.add_argument('--key-file',required=True)
    args=parser.parse_args();main(args.source,args.key_file)
