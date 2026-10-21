"""Endpoint validation and labels. No monthly values are extrapolated."""
import json
import numpy as np
import pandas as pd
from training.common import ROOT

def contract():
    return json.loads((ROOT/'data_contracts/survival_endpoint.json').read_text(encoding='utf-8'))

def endpoint_records(frame):
    spec=contract(); missing=sorted(set(spec['required_fields'])-set(frame.columns))
    if missing: raise ValueError('Missing endpoint fields: '+', '.join(missing))
    d=frame.copy()
    if d.patient_id.isna().any() or d.patient_id.duplicated().any():raise ValueError('Exactly one index record per identified patient required')
    for k in ['index_date','predictors_observed_at','kidney_failure_date','death_date','followup_end_date']:
        raw=d[k];d[k]=pd.to_datetime(raw,utc=True,errors='coerce')
        if (raw.notna() & raw.astype(str).str.strip().ne('') & d[k].isna()).any():raise ValueError('Invalid date: '+k)
    if d[['index_date','predictors_observed_at','followup_end_date']].isna().any().any():raise ValueError('Index, predictor and verified follow-up dates required')
    for k in ['ckd_confirmed','clinically_stable','maintenance_dialysis_at_index','prior_krt','kidney_failure_event','kidney_failure_ascertainment_complete','mortality_ascertainment_complete']:
        mapped=d[k].map(lambda v: str(v).strip().lower()).map({'true':True,'false':False,'1':True,'0':False})
        if mapped.isna().any():raise ValueError('Explicit boolean required: '+k)
        d[k]=mapped.astype(bool)
    if (~d.kidney_failure_ascertainment_complete|~d.mortality_ascertainment_complete).any():raise ValueError('Both kidney-failure and mortality ascertainment must be verified through follow-up end')
    if (d.maintenance_dialysis_at_index|d.prior_krt|~d.ckd_confirmed|~d.clinically_stable).any():raise ValueError('Cohort includes ineligible prior KRT, dialysis, unconfirmed CKD or unstable context')
    for k in ['age','egfr','urine_acr_mg_g']:d[k]=pd.to_numeric(d[k],errors='coerce')
    if (~d.age.between(18,120)|~d.egfr.between(.01,59.999)|~d.urine_acr_mg_g.between(.001,100000)).any():raise ValueError('Invalid adult age, G3–G5 eGFR or positive urine ACR')
    if (~d.sex.isin(['MALE','FEMALE'])).any():raise ValueError('Verified sex variable required')
    if (d.predictors_observed_at>d.index_date).any():raise ValueError('Future predictor leakage')
    if ((d.index_date-d.predictors_observed_at).dt.total_seconds()>90*86400).any():raise ValueError('Predictor evidence older than 90 days')
    if (~d.censoring_reason.isin(spec['allowed_censoring_reasons'])).any():raise ValueError('Explicit censoring/ascertainment reason required')
    if (d.kidney_failure_event!=d.kidney_failure_date.notna()).any():raise ValueError('Event flag/date conflict')
    observed=d.kidney_failure_event
    if (~d.loc[observed,'kidney_failure_type'].isin(['maintenance_dialysis','kidney_transplant'])).any():raise ValueError('Endpoint must be first adjudicated maintenance KRT')
    if d.loc[observed,'event_source_id'].fillna('').str.strip().eq('').any():raise ValueError('Event source evidence required')
    for k in ['kidney_failure_date','death_date']:
        if ((d[k]<=d.index_date)|(d[k]>d.followup_end_date)).any():raise ValueError('Event outside eligible ascertainment period: '+k)
    if (d.followup_end_date<=d.index_date).any():raise ValueError('Nonpositive follow-up')
    if (d.death_date.notna()&d.kidney_failure_date.notna()&(d.death_date<=d.kidney_failure_date)).any():raise ValueError('Kidney failure cannot follow competing death')
    # The first event ends the risk interval; later death following KRT is not a competing event.
    end=d[['kidney_failure_date','death_date','followup_end_date']].min(axis=1)
    d['time']=(end-d.index_date).dt.total_seconds()/86400
    d['cause']=np.where(d.kidney_failure_date.eq(end),1,np.where(d.death_date.eq(end),2,0))
    expected=np.where(d.cause.eq(1),'kidney_failure',np.where(d.cause.eq(2),'death',d.censoring_reason))
    if (d.censoring_reason!=expected).any():raise ValueError('Censoring reason does not match first observed event')
    if (d.cause.eq(0)&~d.censoring_reason.isin(['administrative','lost_to_followup'])).any():raise ValueError('Censored observations need administrative/lost-to-follow-up reasons')
    d['sex_male']=d.sex.eq('MALE').astype(float)
    return d

def readiness(frame, partitions=None, config=None):
    config=config or json.loads((ROOT/'configs/tasks/survival.json').read_text())
    missing=sorted(set(contract()['required_fields'])-set(frame.columns))
    out={'status':'INSUFFICIENT_LONG_TERM_OUTCOME_DATA','ready':False,'missing_fields':missing,
         'reasons':[],'endpoint':contract()['endpoint'],'estimand':config['estimand'],'five_year_metrics':None,
         'policy':config,'evidence':{'observations':len(frame),'endpoint_fields_present':not missing}}
    if missing:
        out['reasons']=['No genuine adjudicated first-KRT and competing-death/follow-up contract in this file.',
            'Laboratory observation span is not verified outcome ascertainment. Serum albumin is not urine ACR.',
            'Historical source cohort is maintenance dialysis, ineligible for first-future-KRT initiation.']
        out['candidate_status']='BLOCKED_MISSING_ENDPOINT';return out
    try:d=endpoint_records(frame)
    except ValueError as e:
        out.update(candidate_status='BLOCKED_INVALID_ENDPOINT',reasons=[str(e)]);return out
    out['evidence'].update(patients=len(d),kidney_events=int(d.cause.eq(1).sum()),competing_deaths=int(d.cause.eq(2).sum()),max_followup_days=float(d.time.max()))
    if partitions is None:
        out.update(candidate_status='BLOCKED_MISSING_SPLIT',reasons=['Supply a prespecified patient split manifest; no split is searched for attractive results.']);return out
    if len(d)<config['minimum_patients']:out['reasons'].append('Cohort below minimum patient gate')
    horizon=max(config['horizons_days'])
    from evaluation.survival import censoring_survival
    for p,idx in partitions.items():
        sub=d.iloc[idx];events=int(sub.cause.eq(1).sum());deaths=int(sub.cause.eq(2).sum())
        if p=='train' and events<config['minimum_training_kidney_events']:out['reasons'].append('Training kidney events below minimum')
        if events<config['minimum_partition_kidney_events']:out['reasons'].append(p+': insufficient kidney events')
        if config['estimand']=='cif' and p=='train' and deaths<config['minimum_training_death_events_for_cif']:out['reasons'].append('Training competing deaths below minimum for paired cause-specific adaptation')
        if int(sub.time.ge(horizon).sum())<config['minimum_at_risk_per_partition_at_horizon']:out['reasons'].append(p+': inadequate five-year follow-up support')
        censor_cause=sub.cause.to_numpy().copy()
        if config['estimand']=='net':censor_cause[censor_cause==2]=0
        if censoring_survival(sub.time.to_numpy(),censor_cause,np.array([horizon]))[0]<config['minimum_censoring_survival_at_horizon']:out['reasons'].append(p+': insufficient censoring support at five years')
    if out['reasons']:
        out['candidate_status']='BLOCKED_UNSUPPORTED_HORIZON' if any('support' in r for r in out['reasons']) else 'BLOCKED_INSUFFICIENT_EVENTS'
    else:out.update(status='READY_FOR_RESEARCH_TRAINING',ready=True,candidate_status='REGISTERED')
    return out
