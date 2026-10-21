"""Read a packaged, immutable audit conclusion; never infer labels from labs."""
import json
from pathlib import Path

def current_readiness():
    source=Path(__file__).resolve().parents[3]/'ml-training/data_contracts/current_five_year_readiness.json'
    try:
        value=json.loads(source.read_text(encoding='utf-8'))
        if value.get('schema_version')!='CDSS-SURVIVAL-1' or value.get('status')!='INSUFFICIENT_LONG_TERM_OUTCOME_DATA':raise ValueError('Unreviewed readiness state')
        return {**value,'prediction':None,'probability':None,'curve':None,'method':'NOT_INSTALLED',
            'model_version':None,'endpoint':'First maintenance kidney replacement therapy','horizon_years':5,
            'unit':'probability','validation_status':'NOT_COMPLETED','served':False}
    except (OSError,ValueError,TypeError):
        return {'status':'NOT_AVAILABLE','prediction':None,'probability':None,'curve':None,'method':'NOT_INSTALLED',
            'reason':'Reviewed five-year readiness evidence unavailable','validation_status':'NOT_COMPLETED','served':False}
