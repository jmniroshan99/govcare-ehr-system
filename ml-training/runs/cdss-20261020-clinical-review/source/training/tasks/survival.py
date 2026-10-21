"""Offline future endpoint pipeline: gates precede imports/fitting; no fake labels."""
import argparse
import json
import traceback
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from training.algorithm_registry import SURVIVAL,survival_estimator
from training.common import ROOT,write_json,sha256,environment
from training.tasks.short_horizon import partition_indices,grouped_splits
from preprocessing.survival import readiness,endpoint_records,contract
from evaluation.survival import evaluate,nonparametric_risk
from training.algorithms.survival.common import cumulative_incidence,validate_survival

FEATURES=['age','sex_male','egfr','urine_acr_mg_g']

class CauseSpecificModel:
    def __init__(self,algorithm,parameters,estimand):self.algorithm=algorithm;self.parameters=parameters;self.estimand=estimand
    def fit(self,records):
        self.kidney=survival_estimator(self.algorithm,self.parameters).fit(records[FEATURES],records.cause.eq(1),records.time)
        self.death=None
        if self.estimand=='cif':self.death=survival_estimator(self.algorithm,self.parameters).fit(records[FEATURES],records.cause.eq(2),records.time)
        self.maximum_time=float(records.time.max())
        return self
    def predict(self,records,horizons):
        if min(horizons)<=0 or max(horizons)>=self.maximum_time:raise ValueError('Horizon beyond development follow-up support')
        # Include all daily steps and exact requested horizons. No extrapolated curve.
        grid=np.unique(np.r_[np.arange(1,max(horizons)+1),horizons]);grid=grid[grid<=max(horizons)]
        sk=validate_survival(self.kidney.survival(records[FEATURES],grid))
        probability=1-sk
        if self.death is not None:probability=cumulative_incidence(sk,self.death.survival(records[FEATURES],grid))
        idx=np.searchsorted(grid,horizons)
        return probability[:,idx],(1-sk)[:,idx]

def run_survival(source,output,split_path=None,config=None):
    output=Path(output);output.mkdir(parents=True,exist_ok=True)
    config=config or json.loads((ROOT/'configs/tasks/survival.json').read_text())
    frame=pd.read_csv(source);parts=None
    initial=readiness(frame,config=config)
    if not initial['missing_fields'] and split_path:
        try:parts=partition_indices(frame,json.loads(Path(split_path).read_text()))
        except ValueError as e:initial.update(candidate_status='BLOCKED_INVALID_SPLIT',reasons=[str(e)])
        else:initial=readiness(frame,parts,config)
    initial.update(dataset_sha256=sha256(source),schema_version='CDSS-SURVIVAL-1',clinical_validation='NOT_COMPLETED')
    statuses={a:{'status':initial['candidate_status'],'registered':True,'trained':False,'evaluated':False,'served':False,
        'reason':'; '.join(initial['reasons']),'module':'training/algorithms/survival/'+module+'.py'} for a,module in SURVIVAL.items()}
    initial['candidates']=statuses;write_json(output/'readiness.json',initial)
    if not initial['ready']:return initial
    data=endpoint_records(frame);tr,va,te=(parts[p] for p in ('train','validation','test'));horizons=config['horizons_days'];estimand=config['estimand']
    train=data.iloc[tr];validation=data.iloc[va];test=data.iloc[te]
    folds=grouped_splits(train.patient_id.to_numpy());settings=json.loads((ROOT/'configs/algorithms/survival.json').read_text())
    write_json(output/'split_manifest.json',json.loads(Path(split_path).read_text()));write_json(output/'configuration.json',config)
    baseline={'validation':evaluate(train,validation,np.tile(nonparametric_risk(train,horizons,estimand),(len(validation),1)),horizons,estimand)}
    fitted={};results={};metric_horizon=str(max(horizons))
    for algorithm in SURVIVAL:
        directory=output/algorithm;directory.mkdir()
        try:
            if algorithm=='logistic_hazard' and config['logistic_hazard']['neural']:
                gate=config['neural_complexity_gate']
                if len(train)<gate['minimum_training_patients'] or train.cause.eq(1).sum()<gate['minimum_training_events']:
                    statuses[algorithm].update(status='BLOCKED_INSUFFICIENT_EVENTS',reason='Neural complexity gate failed');continue
                raise ValueError('Configured implementation is non-neural; choose documented penalized LogisticHazard')
            trials=[]
            for parameters in settings[algorithm]:
                scores=[]
                for a,b in folds:
                    fitting=train.iloc[a];held=train.iloc[b]
                    if fitting.cause.eq(1).sum()<config['minimum_training_kidney_events'] or (estimand=='cif' and fitting.cause.eq(2).sum()<config['minimum_training_death_events_for_cif']):raise ValueError('Grouped survival fold lacks event support')
                    for d in (fitting,held):
                        if d.time.ge(max(horizons)).sum()<config['minimum_at_risk_per_partition_at_horizon']:raise ValueError('Grouped survival fold lacks horizon support')
                    model=CauseSpecificModel(algorithm,parameters,estimand).fit(fitting)
                    risk,net=model.predict(held,horizons)
                    scores.append(evaluate(fitting,held,risk,horizons,estimand,net[:,-1])['horizons'][metric_horizon]['IPCW_Brier'])
                trials.append({'parameters':parameters,'grouped_fold_Brier':scores,'mean':float(np.mean(scores))})
            chosen=min(trials,key=lambda p:p['mean'])
            model=CauseSpecificModel(algorithm,chosen['parameters'],estimand).fit(train)
            risk,net=model.predict(validation,horizons)
            results[algorithm]={'parameters':chosen['parameters'],'tuning':trials,'validation':evaluate(train,validation,risk,horizons,estimand,net[:,-1])}
            statuses[algorithm].update(status='TRAINED_RESEARCH_ONLY',trained=True,reason='Offline research only; prospective/external validation absent')
            joblib.dump(model,directory/'model.joblib',compress=3)
            fitted[algorithm]=model
        except Exception as e:
            statuses[algorithm].update(status='FAILED_TRAINING',reason=f'{type(e).__name__}: {e}')
            (directory/'failure.log').write_text(traceback.format_exc(),encoding='utf-8')
    winner=min(results,key=lambda a:results[a]['validation']['horizons'][metric_horizon]['IPCW_Brier']) if results else None
    reference=baseline['validation']['horizons'][metric_horizon]['IPCW_Brier']
    passes=bool(winner and results[winner]['validation']['horizons'][metric_horizon]['IPCW_Brier']<.95*reference)
    selection={'selected':winner if passes else 'Aalen-Johansen' if estimand=='cif' else 'Kaplan-Meier','baseline_gate_passed':passes,'selection_uses_test':False,'frozen_before_test':True,'estimand':estimand,'served':False}
    write_json(output/'selection_before_test.json',selection)
    baseline['test']=evaluate(train,test,np.tile(nonparametric_risk(train,horizons,estimand),(len(test),1)),horizons,estimand)
    for algorithm,model in fitted.items():
        directory=output/algorithm;risk,net=model.predict(test,horizons)
        results[algorithm]['test']=evaluate(train,test,risk,horizons,estimand,net[:,-1]);statuses[algorithm]['evaluated']=True
        rng=np.random.default_rng(314159);scores=[]
        for _ in range(200):
            ix=rng.choice(len(test),len(test),replace=True)
            try:scores.append(evaluate(train,test.iloc[ix],risk[ix],horizons,estimand,net[ix,-1])['horizons'][metric_horizon]['IPCW_Brier'])
            except ValueError:pass
        results[algorithm]['patient_bootstrap']={'iterations':200,'estimable':len(scores),'Brier_95':np.quantile(scores,[.025,.975]).tolist() if scores else None}
        restored=joblib.load(directory/'model.joblib');np.testing.assert_allclose(restored.predict(test,horizons)[0],risk)
        write_json(directory/'manifest.json',{'schema_version':'CDSS-SURVIVAL-1','algorithm_id':algorithm,'task':'first_krt_survival','seed':config['seed'],'run_id':output.parent.name,
            'model_version':output.parent.name,'dataset_sha256':sha256(source),'split_manifest_sha256':sha256(split_path),'features':contract()['features'],
            'feature_order':FEATURES,'units':contract()['features'],'endpoint':contract()['endpoint'],'population':contract()['population'],'estimand':estimand,
            'supported_horizons_days':horizons,'endpoint_contract':contract(),'configuration':results[algorithm]['parameters'],'preprocessing':'Fitting-only median and scaling',
            'calibration':'IPCW calibration bins; not a clinically validated calibration','uncertainty':'Patient bootstrap 200 replicates',
            'artifact_sha256':sha256(directory/'model.joblib'),'environment':environment(),'validation':results[algorithm]['validation'],'selection':selection,
            'status':'TRAINED_RESEARCH_ONLY','served':False,'clinical_validation':'NOT_COMPLETED','dataset_permission_status':'UNVERIFIED',
            'limitations':['Conditional independent censoring assumed','Cause-specific paired hazards integrated on daily grid for research CIF; external validation required','Parametric extrapolation is not horizon validation']})
        write_json(directory/'metrics.json',results[algorithm])
        (directory/'MODEL_CARD.md').write_text(f'# {algorithm}\n\nResearch {estimand}; never clinically validated. See manifest.json and metrics.json. Served: no.\n',encoding='utf-8')
    initial.update(results=results,selection=selection,baselines=baseline)
    write_json(output/'readiness.json',initial)
    return initial

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source',required=True);p.add_argument('--output',required=True);p.add_argument('--split')
    args=p.parse_args();out=Path(args.output)
    if out.exists():p.error('Use a new output directory')
    print(json.dumps(run_survival(args.source,out,args.split),indent=2,default=str))
