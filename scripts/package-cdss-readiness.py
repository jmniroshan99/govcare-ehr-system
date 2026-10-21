"""Offline packaging of the current-file audit and fail-closed long-term conclusion."""
import json
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'ml-training'))
from preprocessing.audit_packaged import audit
from training.tasks.survival import run_survival
from training.common import write_json

def main():
    source=ROOT/'ml-training/data/deidentified_monthly.csv'
    audit(source,ROOT/'ml-training/reports/cdss')
    result=run_survival(source,ROOT/'ml-training/reports/cdss/survival')
    if result['status']!='INSUFFICIENT_LONG_TERM_OUTCOME_DATA':raise ValueError('A changed endpoint conclusion requires implementation and deployment review')
    packaged={k:result[k] for k in ['schema_version','status','missing_fields','reasons','dataset_sha256','clinical_validation','candidates']}
    write_json(ROOT/'ml-training/data_contracts/current_five_year_readiness.json',packaged)
    write_json(ROOT/'spring-api/src/main/resources/cdss/current_five_year_readiness.json',packaged)
    print(json.dumps({'status':result['status'],'missing_fields':result['missing_fields'],'sha256':result['dataset_sha256']},indent=2))

if __name__=='__main__':main()
