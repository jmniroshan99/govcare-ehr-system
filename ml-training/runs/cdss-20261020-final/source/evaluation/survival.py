"""Censoring-aware research metrics. Explicitly separate net and CIF estimands."""
import numpy as np

def censoring_survival(time, cause, query, left=False):
    time=np.asarray(time);cause=np.asarray(cause);queries=np.asarray(query,dtype=float)
    unique=np.unique(time);survival=[];s=1.
    for t in unique:
        n=np.sum(time>=t);c=np.sum((time==t)&(cause==0));s*=1-c/n;survival.append(s)
    indices=np.searchsorted(unique,queries,side='left' if left else 'right')-1
    return np.where(indices>=0,np.asarray(survival)[np.maximum(0,indices)],1.)

def weights_at(train, evaluation, horizon, estimand='cif'):
    time=evaluation.time.to_numpy();cause=evaluation.cause.to_numpy()
    train_cause=train.cause.to_numpy().copy();eval_cause=cause.copy()
    if estimand=='net':
        train_cause[train_cause==2]=0;eval_cause[eval_cause==2]=0
    known_event=(time<=horizon)&(eval_cause!=0)
    surviving=time>horizon
    gt=censoring_survival(train.time.to_numpy(),train_cause,np.array([horizon]))[0]
    ge=censoring_survival(train.time.to_numpy(),train_cause,time,left=True)
    if gt<.1 or (ge[known_event]<.1).any():raise ValueError('Insufficient censoring support; metrics withheld')
    weights=np.where(known_event,1/np.maximum(ge,1e-12),np.where(surviving,1/gt,0))
    labels=((time<=horizon)&(cause==1)).astype(float)
    return labels,weights

def horizon_metrics(train, evaluation, probability, horizon, estimand='cif'):
    p=np.asarray(probability);y,w=weights_at(train,evaluation,horizon,estimand)
    if not np.isfinite(p).all() or ((p<0)|(p>1)).any():raise ValueError('Invalid event probabilities')
    case=np.flatnonzero((y==1)&(w>0));control=np.flatnonzero((y==0)&(w>0))
    auc=None
    if len(case) and len(control):
        pair=w[case,None]*w[control][None,:];scores=(p[case,None]>p[control][None,:])+.5*(p[case,None]==p[control][None,:])
        auc=float(np.sum(pair*scores)/np.sum(pair))
    calibration=[]
    for idx in np.array_split(np.argsort(p),min(5,len(p))):
        weight=w[idx]
        calibration.append({'n':len(idx),'predicted':float(np.mean(p[idx])),
            'ipcw_observed':float(np.sum(weight*y[idx])/len(idx)), 'weight_sum':float(weight.sum())})
    return {'horizon_days':horizon,'estimand':estimand,'IPCW_Brier':float(np.mean(w*(y-p)**2)),
        'time_dependent_AUC':auc,'known_kidney_cases':len(case),'known_controls':len(control),
        'calibration':calibration,'calibration_note':'Exploratory IPCW bins; small bins can be unstable and estimates may exceed one.',
        'AUC_definition':'Kidney failure by horizon vs event-free beyond horizon or competing death by horizon' if estimand=='cif' else 'Net kidney-event AUC; competing deaths treated as censored'}

def nonparametric_risk(train,times,estimand='cif'):
    s=1.;cif=0.;points=[];values=[]
    for t in np.unique(train.time):
        n=int(train.time.ge(t).sum());kidney=int((train.time.eq(t)&train.cause.eq(1)).sum())
        death=int((train.time.eq(t)&train.cause.eq(2)).sum()) if estimand=='cif' else 0
        cif+=s*kidney/n;s*=1-(kidney+death)/n
        points.append(t);values.append(cif if estimand=='cif' else 1-s)
    idx=np.searchsorted(points,times,side='right')-1
    return np.where(idx>=0,np.asarray(values)[np.maximum(0,idx)],0.)

def evaluate(train,evaluation,risk,times,estimand,kidney_net_risk=None):
    result={'estimand':estimand,'horizons':{str(t):horizon_metrics(train,evaluation,risk[:,i],t,estimand) for i,t in enumerate(times)}}
    try:
        from sksurv.util import Surv
        from sksurv.metrics import concordance_index_ipcw
        tr=Surv.from_arrays(train.cause.eq(1),train.time);te=Surv.from_arrays(evaluation.cause.eq(1),evaluation.time)
        result['cause_specific_net_IPCW_concordance']=float(concordance_index_ipcw(tr,te,kidney_net_risk if kidney_net_risk is not None else risk[:,-1],tau=max(times))[0])
        result['concordance_estimand']='Net cause-specific ranking; deaths censored. Not a concordance estimate for CIF.'
    except (ImportError,ValueError) as e:result.update(cause_specific_net_IPCW_concordance=None,concordance_reason=str(e))
    return result
