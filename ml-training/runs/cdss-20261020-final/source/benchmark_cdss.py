#!/usr/bin/env python3
"""Run the current-data audit, seven-family benchmark and long-term readiness gate."""
import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
import pandas as pd
from preprocessing.audit_packaged import audit
from training.common import ROOT, LIMITATIONS, sha256, write_json, environment
from training.tasks.short_horizon import run_task
from training.tasks.survival import run_survival

def main(output):
    output=Path(output).resolve()
    if output.exists():raise ValueError('Use a new run directory; historical runs are retained')
    output.mkdir(parents=True)
    run_id=output.name
    source=ROOT/'data/deidentified_monthly.csv'; split=ROOT/'reports/patient_split_manifest.json'
    fingerprints={'dataset_sha256':sha256(source),'split_manifest_sha256':sha256(split),
        'source_fingerprints':{str(p.relative_to(ROOT)):sha256(p) for folder in ['preprocessing','training','evaluation'] for p in (ROOT/folder).rglob('*.py')},
        'entry_point_sha256':sha256(__file__)}
    audit_result=audit(source,output/'audit')
    if audit_result['duplicate_patient_date_rows']:raise ValueError('Resolve duplicate observations before training')
    shutil.copy2(split,output/'patient_split_manifest.json')
    shutil.copytree(ROOT/'configs',output/'configs')
    for folder in ['preprocessing','training','evaluation']:
        shutil.copytree(ROOT/folder,output/'source'/folder,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
    shutil.copy2(__file__,output/'source/benchmark_cdss.py')
    config=json.loads((ROOT/'configs/tasks/short_horizon.json').read_text(encoding='utf-8'))
    historical=json.loads(split.read_text()); frame=pd.read_csv(source,parse_dates=['observed_at'],float_precision='round_trip')
    summary={'run_id':run_id,'created_at':datetime.now(timezone.utc).isoformat(),**fingerprints,'environment':environment(),
        'limitations':LIMITATIONS,'tasks':{},'new_independent_test_set':False}
    write_json(output/'run_started.json',summary)
    for task,spec in config['tasks'].items():summary['tasks'][task]=run_task(task,spec,frame,historical,output,run_id,fingerprints,config)
    summary['survival']=run_survival(source,output/'survival',None)
    summary['source_preserved']=sha256(source)==fingerprints['dataset_sha256']
    if not summary['source_preserved']:raise RuntimeError('Source checksum changed')
    write_json(output/'summary.json',summary)
    rows=['# Seven-family benchmark results','','Internal retrospective research only. Historical test patients reused. No automatic deployment.','',
        '| Task | Algorithm | Trained | Evaluated | Validation metric | Test metric | Gate passed | Served |','|---|---|---|---|---:|---:|---|---|']
    for task,result in summary['tasks'].items():
        metric='MAE' if result['kind']=='regression' else 'BrierScore'
        for a,e in result['candidates'].items():rows.append(f"| {task} | {a} | {e['training_status']} | {e['evaluated']} | {e.get('validation',{}).get(metric)} | {e.get('test',{}).get(metric)} | {e.get('passed_validation_gate',False)} | no |")
        for b,e in result['baselines'].items():rows.append(f"| {task} | {b} (baseline) | no fit | yes | {e['validation'][metric]} | {e['test'][metric]} | selected: {result['selection']['selected_method']==b} | see deployed registry |")
    (output/'COMPARISON.md').write_text('\n'.join(rows)+'\n',encoding='utf-8')
    print(json.dumps({'run_id':run_id,'source_preserved':True,'selected':{k:v['selection'] for k,v in summary['tasks'].items()},'survival':summary['survival']['status']},indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',required=True)
    main(parser.parse_args().output)
