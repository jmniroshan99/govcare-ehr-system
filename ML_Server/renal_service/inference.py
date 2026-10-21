import hashlib
import json
import math
import sys
from datetime import datetime,timezone,timedelta
from functools import lru_cache
from pathlib import Path
import joblib
import numpy as np
import pandas as pd

TRAINING=Path(__file__).resolve().parents[2]/'ml-training'
sys.path.insert(0,str(TRAINING))
from preprocessing.normalize_units import normalize_value,calculate_urr,CANONICAL_UNITS
from preprocessing.longitudinal_features import feature_frame,feature_names,PREDICTORS
from explainability.xai import explain_pipeline
from .artifact_contract import validate_metadata

KEYS={'hb':'hb-risk','urr':'urr-risk','hyperkalemia':'hyperkalemia-risk','dry-weight':'dry-weight'}

class InvalidInput(ValueError): pass

@lru_cache(maxsize=1)
def serving_contract():
    contract=json.loads((TRAINING/'serving_input_contract.json').read_text(encoding='utf-8'))
    if contract.get('predictors')!=PREDICTORS or contract.get('minimumObservations')!=2:
        raise RuntimeError('Serving input contract is incompatible with reviewed preprocessing')
    return contract

@lru_cache(maxsize=4)
def load_artifact(key):
    if key not in KEYS: raise KeyError('Unknown model')
    directory=TRAINING/'artifacts'/KEYS[key]
    meta=json.loads((directory/'metadata.json').read_text(encoding='utf-8'))
    if key=='dry-weight': return meta,None
    validate_metadata(meta,key,feature_names())
    path=directory/'model.joblib'
    if hashlib.sha256(path.read_bytes()).hexdigest()!=meta['artifact_sha256']:
        raise RuntimeError('Artifact digest mismatch')
    # Only newly fitted, locally packaged, hash-checked pipelines are executed.
    if meta.get("served_method")=="PERSISTENCE_BASELINE": return meta,None
    try:return meta,joblib.load(path)
    except Exception as error:raise RuntimeError('Trusted artifact could not be deserialized') from error

def registry():
    entries=[]
    for key in KEYS:
        try:
            meta,model=load_artifact(key)
            entry={k:meta.get(k) for k in ['model_key','model','model_version','status','algorithm','served_method','unit','partitions',
                'clinical_validation','dataset_permission_status','validation_status','selection_reason','source_dataset_sha256','artifact_sha256','artifact_revision','training_run_id','feature_names','target_definition','training_date','population','limitations']}
            entry['serving_input_contract']=serving_contract()
            entry['required_measurements']=meta.get('required_measurements',[])
            entries.append(entry)
        except (OSError,KeyError,ValueError,RuntimeError,ImportError):
            entries.append({'model_key':key,'status':'NOT_AVAILABLE','clinical_validation':'NOT_COMPLETED','reason':'Reviewed artifact unavailable'})
    return entries

def parse_history(payload):
    contract=serving_contract()
    if not isinstance(payload,dict) or set(payload)-{'history','maintenance_hemodialysis_verified'}:
        raise InvalidInput('Only verified history and maintenance dialysis context are accepted')
    if payload.get('maintenance_hemodialysis_verified') is not True:
        raise InvalidInput('Verified maintenance hemodialysis context is required')
    history=payload.get('history')
    if not isinstance(history,list) or not 1<=len(history)<=200:
        raise InvalidInput('One to 200 dated observations are required')
    rows=[];flags=[];last_date=None
    for item in history:
        if not isinstance(item,dict) or set(item)-{'observed_at','measurements','units'}:
            raise InvalidInput('Unrecognized observation fields')
        try:
            date=pd.Timestamp(item['observed_at'])
            if date.tzinfo is None: date=date.tz_localize('UTC')
            else: date=date.tz_convert('UTC')
            if pd.isna(date) or date>pd.Timestamp.now(tz='UTC')+pd.Timedelta(minutes=5): raise ValueError()
        except (ValueError,TypeError,KeyError,OverflowError): raise InvalidInput('A valid nonfuture observation date is required') from None
        if last_date is not None and date<=last_date:
            raise InvalidInput('Observations must be strictly chronological without duplicated timestamps')
        last_date=date
        measurements=item.get('measurements');units=item.get('units')
        if not isinstance(measurements,dict) or not isinstance(units,dict) or not measurements:
            raise InvalidInput('Numeric measurements and explicit units are required')
        if set(measurements)-set(CANONICAL_UNITS) or set(units)-set(CANONICAL_UNITS):
            raise InvalidInput('Unsupported clinical variable')
        if ('urea_pre' in measurements and 'urea_post' in measurements and units.get('urea_pre')!=units.get('urea_post')):
            raise InvalidInput('Pre/post urea must have the same explicit source unit')
        row={'patient_id':'inference-patient','observed_at':date}
        for key,value in measurements.items():
            try: row[key]=normalize_value(key,value,units.get(key))
            except ValueError as e: raise InvalidInput(str(e)) from None
        # Source-supplied URR does not override measured paired urea.
        row['urr'],problem=calculate_urr(row.get('urea_pre'),row.get('urea_post'))
        if problem: flags.append(problem)
        for key in PREDICTORS: row.setdefault(key,np.nan)
        if row['potassium_pre']>8: flags.append('EXTREME_POTASSIUM_REQUIRES_SOURCE_REVIEW')
        rows.append(row)
    frame=pd.DataFrame(rows)
    if (pd.Timestamp.now(tz='UTC')-frame.observed_at.iloc[-1]).days>contract['maximumLatestAgeDays']:
        flags.append('STALE_LATEST_OBSERVATION_OVER_62_DAYS')
    if len(frame)>=2:
        gap=(frame.observed_at.iloc[-1]-frame.observed_at.iloc[-2]).total_seconds()/86400
        if not contract['minimumIntervalDays']<=gap<=contract['maximumIntervalDays']: flags.append('LATEST_LAB_INTERVAL_OUTSIDE_MONTHLY_TRAINING_SUPPORT')
    return frame,sorted(set(flags))

def predict(key,payload):
    contract=serving_contract()
    meta,model=load_artifact(key)
    frame,flags=parse_history(payload)
    origin=frame.observed_at.iloc[-1]
    base={'event_probability':None,'calibration_status':'NOT_ESTABLISHED','status':'INSUFFICIENT_DATA','model_key':key,'model':meta['model'],'model_version':meta['model_version'],
          'method':meta.get('served_method','RESEARCH_MODEL'),
          'algorithm':'LAST_OBSERVATION_CARRIED_FORWARD' if meta.get('served_method')=='PERSISTENCE_BASELINE' else meta.get('algorithm','NOT_EXECUTED'),
          'research_candidate_algorithm':meta.get('algorithm','NOT_EXECUTED'),
          'prediction':None,'probability':None,'unit':meta.get('unit','kg'),'risk_category':'UNAVAILABLE','interval':None,
          'validation_status':'INTERNAL_RESEARCH_EVALUATION','clinical_validation':'NOT_COMPLETED',
          'dataset_permission_status':'UNVERIFIED','requires_clinician_review':True,
          'source_dataset_sha256':meta.get('source_dataset_sha256'),'artifact_sha256':meta.get('artifact_sha256'),
          'artifact_revision':meta.get('artifact_revision'),'training_run_id':meta.get('training_run_id'),
          'training_date':meta.get('training_date'),'training_population':meta.get('population'),
          'feature_names':meta.get('feature_names',[]),'target_definition':meta.get('target_definition'),
          'serving_input_contract':contract,'required_measurements':meta.get('required_measurements',[]),
          'research_test_metrics':meta.get('research_test_metrics'),'persistence_test_metrics':meta.get('persistence_test_metrics'),
          'forecast_origin_date':origin.isoformat(),'forecast_date':(origin+pd.Timedelta(days=30)).isoformat(),'horizon_days':30,
          'horizon_definition':'Next observed measurement 14–62 days; display anchor +30 days',
          'data_quality':{'flags':flags,'missing_fields':[],'observation_count':len(frame)},
          'explanation':{'method':'BASELINE','top_factors':[],'trends':[],'limitations':list(meta.get('limitations',[]))}}
    if key=='dry-weight':
        base['status']='NOT_AVAILABLE'
        base['explanation']['limitations']=['INSUFFICIENT_DATA_FOR_RELIABLE_MODEL: source dry-weight export lacks patient IDs, dates and current dry weight. No reviewed longitudinal model is installed.']
        return base
    current=frame.iloc[-1]
    missing=[k for k in PREDICTORS if pd.isna(current[k])]
    base['data_quality']['missing_fields']=missing
    outcome_key='potassium_pre' if key=='hyperkalemia' else key
    if len(frame)<contract['minimumObservations'] or pd.isna(current[outcome_key]) or len(PREDICTORS)-len(missing)<contract['minimumCurrentPredictors'] or any(f in flags for f in ('STALE_LATEST_OBSERVATION_OVER_62_DAYS','LATEST_LAB_INTERVAL_OUTSIDE_MONTHLY_TRAINING_SUPPORT')):
        base['explanation']['limitations']+=['At least two fresh, verified chronological observations 14–62 days apart, the current outcome value and five model predictor values are required. This monthly-cohort model is not a per-session prediction model.']
        return base
    X=feature_frame(frame)[meta['feature_names']].iloc[[-1]]
    base['data_quality']['imputed_features']=[name for name in meta['feature_names'] if pd.isna(X.iloc[0][name])]
    base['event_probability']=None
    base['calibration_status']='NOT_ESTABLISHED_FOR_CLINICAL_PROBABILITY'
    method=meta['served_method']
    if not pd.isna(current['potassium_pre']) and (current['potassium_pre']<2.5 or current['potassium_pre']>=6.5):
        base['explanation']['limitations'].append('Recorded severe low/high potassium requires prompt source/date verification and clinical review; research inference is blocked. The abnormal-value finding is retained by clinical monitoring.')
        return base
    if key=='hyperkalemia':
        probability=float(model.predict_proba(X)[0,1])
        if not math.isfinite(probability) or not 0<=probability<=1: raise RuntimeError('Nonfinite probability')
        base.update(status='AVAILABLE',prediction=None,probability=probability,risk_category='RESEARCH_RISK_SCORE')
        base.update(output_type='RESEARCH_MODEL_SCORE',research_score=probability)
        base['explanation']['contribution_unit']='log odds of the model research outcome'
        base['explanation']['method']='SHAP'
        explanation,_=explain_pipeline(model,X,meta['feature_names'])
        vals=explanation.values[0];top=np.argsort(np.abs(vals))[-8:][::-1]
        base['explanation']['top_factors']=[{'feature':meta['feature_names'][int(i)],
            'value':None if pd.isna(X.iloc[0,int(i)]) else float(X.iloc[0,int(i)]),
            'imputed':bool(pd.isna(X.iloc[0,int(i)])),'contribution':float(vals[i]),'direction':'INCREASES_RESEARCH_LOG_ODDS' if vals[i]>0 else 'DECREASES_RESEARCH_LOG_ODDS'} for i in top]
        for variable in ('potassium_pre','potassium_post','creatinine_pre','hb'):
            actual=frame[variable].dropna().tail(3)
            if len(actual)>=2:
                change=float(actual.iloc[-1]-actual.iloc[0])
                base['explanation']['trends'].append(f'{variable}: measured change {change:+.3f} across the latest {len(actual)} available observations; associated context, not a causal claim.')
        if missing: base['explanation']['limitations'].append('Missing predictors used training-only median values; see data-quality fields.')
        base['explanation']['limitations'].append('Research probability is not clinically calibrated and does not replace the current-potassium safety gate or clinician review.')
        return base
    value=float(model.predict(X)[0]) if method=='RESEARCH_MODEL' else float(current[key])
    if not math.isfinite(value): raise RuntimeError('Nonfinite prediction')
    # Never clamp clinically impossible forecasts and disguise them as confident valid output.
    if (key=='urr' and not 0<=value<=100) or (key=='hb' and not 1<=value<=25):
        base['explanation']['limitations']+=['Model generated an out-of-range forecast; clinical output suppressed.']
        return base
    base.update(status='AVAILABLE',prediction=value,risk_category='RESEARCH_FORECAST')
    base['output_type']='PREDICTED_VALUE'
    base['explanation']['contribution_unit']=meta.get('unit') if method=='RESEARCH_MODEL' else None
    width=meta['interval_half_width']
    base['interval']={'low':value-width,'high':value+width,'level':.95,'method':meta['interval_method']}
    base['explanation']['method']='SHAP' if method=='RESEARCH_MODEL' else 'BASELINE'
    if method=='RESEARCH_MODEL':
        explanation,_=explain_pipeline(model,X,meta['feature_names'])
        vals=explanation.values[0];top=np.argsort(np.abs(vals))[-8:][::-1]
        base['explanation']['top_factors']=[{'feature':meta['feature_names'][int(i)],
            'value':None if pd.isna(X.iloc[0,int(i)]) else float(X.iloc[0,int(i)]),
            'imputed':bool(pd.isna(X.iloc[0,int(i)])),'contribution':float(vals[i]),'direction':'INCREASES_FORECAST' if vals[i]>0 else 'DECREASES_FORECAST'} for i in top]
    else:
        base['explanation']['top_factors']=[{'feature':key,'value':value,'contribution':None,'direction':'LAST_OBSERVATION_CARRIED_FORWARD'}]
        base['explanation']['limitations']+=[meta['selection_reason']]
    for variable in ('hb','urr','albumin','potassium_pre'):
        actual=frame[variable].dropna().tail(3)
        if len(actual)>=2:
            change=float(actual.iloc[-1]-actual.iloc[0])
            base['explanation']['trends'].append(f'{variable}: measured change {change:+.3f} across the latest {len(actual)} available observations; associated context, not a causal claim.')
    if missing: base['explanation']['limitations'].append('Missing predictors used training-only median values; see data-quality fields.')
    return base
