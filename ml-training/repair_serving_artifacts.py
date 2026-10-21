"""Explicit offline repair of unreadable packaged artifacts using a gated legacy replay.

Preserves originals in the replay directory. Does not promote new benchmark families,
change API contract versions, change Hb persistence, or replace hyperkalemia.
"""
import argparse,json,shutil
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from preprocessing.longitudinal_features import create_targets
from preprocessing.normalize_units import CANONICAL_UNITS
from training.common import ROOT,sha256,write_json,environment

def package_manifests(directory):
    """Describe every legacy replay object, including unserved band classifiers."""
    directory=Path(directory);meta=json.loads((directory/'metadata.json').read_text());metrics=json.loads((directory/'metrics.json').read_text())
    task=meta['model_key'];units={}
    for feature in meta['feature_names']:
        if feature=='days_since_previous':units[feature]='days'
        elif feature=='potassium_reduction':units[feature]='mmol/L'
        elif feature=='creatinine_reduction':units[feature]='umol/L'
        else:
            base=next(key for key in CANONICAL_UNITS if feature==key or feature.startswith(key+'_'))
            units[feature]='%' if feature.endswith('_pct_change') else CANONICAL_UNITS[base]+('/day' if feature.endswith('_slope_per_day') else '')
    for path in directory.glob('*.joblib'):
        classifier=path.name=='research_classifier.joblib';component=path.name=='preprocessor.joblib'
        served=directory.resolve()==(ROOT/'artifacts/urr-risk').resolve() and path.name=='model.joblib'
        model=metrics.get('exploratory_classification',{}).get('selected_by_validation_brier') if classifier else meta['algorithm']
        endpoint=('Next Hb outside 10–12 g/dL; legacy protocol band, not a validated disease probability' if task=='hb' else 'Next URR <65%; legacy protocol band, not a validated disease probability') if classifier else meta.get('target_definition')
        value={'schema_version':'CDSS-LEGACY-ARTIFACT-1','algorithm_id':model,'task':task,'artifact_role':'preprocessor' if component else 'legacy_band_classifier' if classifier else 'primary_candidate',
            'population':meta.get('population'),'endpoint':endpoint,'model_version':meta['model_version'],'artifact_revision':meta.get('artifact_revision'),
            'training_run_id':meta.get('training_run_id'),'dataset_sha256':meta.get('source_dataset_sha256'),'split_manifest_sha256':meta.get('split_manifest_sha256'),
            'feature_order':meta['feature_names'],'feature_units':units,'seed':42,'preprocessing':'Training-only median and scaling; shared causal feature_frame',
            'supported_horizon':'Next observed measurement 14–62 days; +30-day display anchor',
            'output_unit':'feature transform' if component else 'probability' if classifier else meta['unit'],
            'validation':None if component else metrics.get('exploratory_classification') if classifier else metrics.get(meta['algorithm'],{}).get('validation',metrics.get('metrics',{}).get('validation')),
            'selection':meta.get('promotion_decision','Staged replay only; not copied into clinical serving'),
            'artifact_sha256':sha256(path),'environment':environment(),'clinical_validation':'NOT_COMPLETED','dataset_permission_status':'UNVERIFIED',
            'limitations':meta.get('limitations',[]),'served':served,'status':'NOT_SERVED_STANDALONE' if classifier or component else 'RESEARCH_SERVING_APPROVED' if served else 'TRAINED_RESEARCH_ONLY',
            'configured_served_method':meta['served_method'],'calibration':'No clinical calibration established','uncertainty':meta.get('interval_method','See replay metrics; not an individual clinical interval')}
        write_json(path.with_name(path.name+'.manifest.json'),value)

def main(run):
    run=Path(run).resolve();summary=json.loads((run/'training_run_summary.json').read_text())
    if summary['dataset_sha256']!=sha256(ROOT/'data/deidentified_monthly.csv'):raise ValueError('Replay dataset mismatch')
    if not summary['models']['urr']['gate_passed']:raise ValueError('URR replay failed prespecified validation gate; do not promote')
    if (run/'original-artifacts').exists():raise ValueError('Repair already recorded; original evidence must not be overwritten')
    frame=pd.read_csv(ROOT/'data/deidentified_monthly.csv',parse_dates=['observed_at'])
    validated=[]
    for task in ['hb','urr']:
        folder=task+'-risk';source=run/'artifacts'/folder;old=ROOT/'artifacts'/folder
        before=json.loads((old/'metadata.json').read_text());meta=json.loads((source/'metadata.json').read_text())
        for field in ['model_key','model','model_version','feature_names','feature_order','unit','served_method']:
            if meta.get(field)!=before.get(field):raise ValueError('Repair changes serving contract: '+field)
        if sha256(source/'model.joblib')!=meta['artifact_sha256']:raise ValueError('Replay digest mismatch')
        candidate=joblib.load(source/'model.joblib');_,X,_,_,valid=create_targets(frame,task)
        if not np.isfinite(candidate.predict(X.loc[valid].tail(3))).all():raise ValueError('Invalid replay predictions')
        validated.append((task,folder,source,old,meta,before))
    decisions={}
    for task,folder,source,old,meta,before in validated:
        shutil.copytree(old,run/'original-artifacts'/folder)
        meta.update(artifact_revision=summary['run_id']+'-SERIALIZATION-REPAIR',versions={k:v for k,v in environment().items() if k not in {'python','platform'}},
            repair_reason='Original hash-matching XGBoost pickle raises input stream corrupted in both original Python 3.14 and isolated Python 3.12 environments. Refit using retained legacy specification and split.',
            previous_artifact_sha256=before['artifact_sha256'],promotion_decision='SAME_METHOD_SERIALIZATION_REPAIR; Hb persistence retained; URR passed existing validation gate')
        write_json(source/'metadata.json',meta)
        write_json(source/'manifest.json',{'algorithm_id':meta['algorithm'],'task':task,'population':meta.get('population'),
            'endpoint':meta.get('target_definition'),'model_version':meta['model_version'],'artifact_revision':meta['artifact_revision'],
            'training_run_id':summary['run_id'],'dataset_sha256':summary['dataset_sha256'],'split_manifest_sha256':summary['split_manifest_sha256'],
            'feature_order':meta['feature_names'],'output_unit':meta['unit'],'preprocessing':'Training-only median/scaling; shared causal feature_frame',
            'supported_horizon':'Immediate next observation 14–62 days; +30-day display anchor','validation':summary['models'][task]['validation'],
            'artifact_sha256':meta['artifact_sha256'],'clinical_validation':'NOT_COMPLETED','dataset_permission_status':'UNVERIFIED',
            'decision':meta['promotion_decision'],'limitations':meta['limitations']})
        shutil.copytree(source,old,dirs_exist_ok=True)
        package_manifests(source);package_manifests(old)
        decisions[task]={'status':'BASELINE_SELECTED' if task=='hb' else 'RESEARCH_SERVING_APPROVED',
            'method':meta['served_method'],'algorithm':meta['algorithm'],'old_sha256':before['artifact_sha256'],
            'new_sha256':meta['artifact_sha256'],'artifact_revision':meta['artifact_revision'],'reason':meta['repair_reason']}
    write_json(run/'serving_repair.json',decisions);print(json.dumps(decisions,indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--run');p.add_argument('--manifests-only',type=Path)
    args=p.parse_args()
    if args.manifests_only:package_manifests(args.manifests_only)
    elif args.run:main(args.run)
    else:p.error('Supply --run or --manifests-only DIRECTORY')
