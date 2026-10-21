"""Synthetic software tests only. These records never enter clinical evaluation."""
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import numpy as np
import pandas as pd

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from preprocessing.longitudinal_features import feature_frame,feature_names,PREDICTORS,create_targets
from preprocessing.survival import endpoint_records,readiness
from training.algorithm_registry import SHORT_HORIZON,SURVIVAL,survival_estimator
from training.tasks.short_horizon import partition_indices,build_model,grouped_splits
from training.tasks.survival import run_survival
from training.algorithms.survival.common import cumulative_incidence,validate_survival
from evaluation.benchmark import selection
from evaluation.survival import weights_at,nonparametric_risk,horizon_metrics

def endpoint_fixture(n=60):
    rng=np.random.default_rng(22)
    d=pd.DataFrame({'patient_id':['SYNTHETIC-'+str(i) for i in range(n)],'index_date':'2015-01-01',
        'predictors_observed_at':'2015-01-01','age':rng.integers(35,75,n),'sex':'MALE','egfr':rng.uniform(15,55,n),
        'urine_acr_mg_g':rng.uniform(10,1000,n),'ckd_confirmed':True,'clinically_stable':True,
        'maintenance_dialysis_at_index':False,'prior_krt':False,'kidney_failure_event':True,
        'kidney_failure_date':[(pd.Timestamp('2015-01-01')+pd.Timedelta(days=100+(i*37)%1600)).strftime('%Y-%m-%d') for i in range(n)],
        'kidney_failure_type':'maintenance_dialysis','event_source_id':'SYNTHETIC-ADJUDICATION',
        'death_date':None,'followup_end_date':'2024-01-01','censoring_reason':'kidney_failure',
        'kidney_failure_ascertainment_complete':True,'mortality_ascertainment_complete':True})
    d['sex']=np.where(np.arange(n)%2,'FEMALE','MALE')
    for i in range(n):
        if i%3==0:d.loc[i,['kidney_failure_event','kidney_failure_date','censoring_reason']]=[False,None,'administrative']
        if i%3==1:
            d.loc[i,['kidney_failure_event','kidney_failure_date','censoring_reason']]=[False,None,'death']
            d.loc[i,'death_date']=(pd.Timestamp('2015-01-01')+pd.Timedelta(days=150+(i*23)%1500)).strftime('%Y-%m-%d')
    return d

class CDSSProtocolTests(unittest.TestCase):
    def test_required_families_in_each_registry(self):
        self.assertGreaterEqual(len(SHORT_HORIZON),8);self.assertIn("decision_tree",SHORT_HORIZON);self.assertEqual(len(SURVIVAL),7)
        self.assertNotIn('kfre',SURVIVAL)
        for modules,folder in [(SHORT_HORIZON,'short_horizon'),(SURVIVAL,'survival')]:
            for module in modules.values():self.assertTrue((ROOT/f'training/algorithms/{folder}/{module}.py').is_file())
    def test_fixed_split_rejects_overlap_unassigned_and_empty_partitions(self):
        d=pd.DataFrame({'patient_id':['a','b','c']});manifest={k:{'patients':[p]} for k,p in zip(['train','validation','test'],'abc')}
        indices=partition_indices(d,manifest);self.assertEqual(indices['test'].tolist(),[2])
        manifest['test']['patients']=['a']
        with self.assertRaises(ValueError):partition_indices(d,manifest)
    def test_causal_features_and_exact_target_timing(self):
        d=pd.DataFrame({'patient_id':['a']*4,'observed_at':pd.to_datetime(['2020-01-01','2020-01-15','2020-03-17','2020-05-19'])})
        for p in PREDICTORS:d[p]=np.arange(4)+10.
        before=feature_frame(d);d.loc[2:,PREDICTORS]=999
        pd.testing.assert_frame_equal(before.iloc[:2],feature_frame(d).iloc[:2]);self.assertEqual(list(before),feature_names())
        self.assertEqual(create_targets(d,'hb')[-1].tolist(),[True,True,False,False])
    def test_svc_calibration_and_preprocessing_are_patient_grouped(self):
        groups=np.repeat(np.arange(9),4);X=pd.DataFrame({'x':np.arange(36,dtype=float),'empty':np.nan});y=np.tile([0,1,0,1],9)
        model=build_model('support_vector','classification',{'C':.1},groups,y)
        splits=list(model.cv)
        for a,b in splits:self.assertFalse(set(groups[a])&set(groups[b]))
        model.fit(X,y)
        for calibrated,(a,b) in zip(model.calibrated_classifiers_,splits):
            np.testing.assert_allclose(calibrated.estimator['imputer'].statistics_,[np.median(X.iloc[a].x),0])
        probabilities=model.predict_proba(pd.DataFrame({'x':[1e10],'empty':[np.nan]}))[:,1]
        self.assertTrue(((probabilities>=0)&(probabilities<=1)).all())
    def test_baseline_gate_requires_measured_improvement(self):
        self.assertFalse(selection('regression',{'MAE':1},{'persistence':{'MAE':1},'training_mean':{'MAE':2}})[0])
        self.assertTrue(selection('regression',{'MAE':.9},{'persistence':{'MAE':1},'training_mean':{'MAE':2}})[0])
        self.assertFalse(selection('classification',{'BrierScore':.1,'ROC_AUC':None},{'training_prevalence':{'BrierScore':.2},'majority_class':{'BrierScore':.3}})[0])
    def test_absent_endpoint_blocks_before_fitting_all_candidates(self):
        with tempfile.TemporaryDirectory() as tmp,patch('training.tasks.survival.survival_estimator',side_effect=AssertionError('Fitting forbidden')):
            result=run_survival(ROOT/'data/deidentified_monthly.csv',tmp)
            self.assertEqual(result['status'],'INSUFFICIENT_LONG_TERM_OUTCOME_DATA');self.assertIsNone(result['five_year_metrics'])
            self.assertEqual(len(result['candidates']),len(SURVIVAL))
            self.assertTrue(all(e['status']=='BLOCKED_MISSING_ENDPOINT' and not e['trained'] and e['reason'] for e in result['candidates'].values()))
    def test_endpoint_rules_reject_ineligible_future_and_conflicting_records(self):
        d=endpoint_fixture();records=endpoint_records(d)
        self.assertTrue(set(records.cause)=={0,1,2});self.assertTrue((records.time>0).all())
        for key,value in [('prior_krt',True),('maintenance_dialysis_at_index',True),('predictors_observed_at','2016-01-01'),('kidney_failure_date','2014-01-01')]:
            altered=d.copy();altered.loc[2,key]=value
            with self.assertRaises(ValueError,msg=key):endpoint_records(altered)
    def test_censoring_before_horizon_is_not_a_known_nonevent(self):
        train=pd.DataFrame({'time':[100.,200.,300.,400.],'cause':[0,1,2,0]})
        evaluation=pd.DataFrame({'time':[50.,150.,300.,400.],'cause':[0,1,2,0]})
        labels,weights=weights_at(train,evaluation,350)
        self.assertEqual(weights[0],0);self.assertEqual(labels.tolist(),[0,1,0,0]);self.assertGreater(weights[2],0)
        metric=horizon_metrics(train,evaluation,np.array([.2,.4,.3,.1]),350)
        self.assertTrue(np.isfinite(metric['IPCW_Brier']))
    def test_cif_matches_constant_hazard_analytic_solution(self):
        t=np.linspace(1,2000,2000);kidney=.0004;death=.0006
        cif=cumulative_incidence(np.exp(-kidney*t)[None,:],np.exp(-death*t)[None,:])
        np.testing.assert_allclose(cif[0],kidney/(kidney+death)*(1-np.exp(-(kidney+death)*t)),atol=1e-10)
        self.assertTrue((np.diff(cif)>=0).all());self.assertLess(cif[0,-1],1-np.exp(-kidney*t[-1]))
        with self.assertRaises(ValueError):validate_survival([[.5,.6]])
    def test_aalen_johansen_baseline_accounts_for_death(self):
        d=pd.DataFrame({'time':[1,2,3,4],'cause':[2,1,0,0]})
        cif=nonparametric_risk(d,[4],'cif')[0];net=nonparametric_risk(d,[4],'net')[0]
        self.assertAlmostEqual(cif,.25);self.assertAlmostEqual(net,1/3)
    def test_all_survival_adapters_fit_and_return_monotone_probabilities_on_software_fixture(self):
        d=endpoint_records(endpoint_fixture());X=d[['age','sex_male','egfr','urine_acr_mg_g']]
        for algorithm in SURVIVAL:
            with self.subTest(algorithm=algorithm):
                settings=json.loads((ROOT/'configs/algorithms/survival.json').read_text())[algorithm][0]
                model=survival_estimator(algorithm,settings).fit(X,d.cause.eq(1),d.time)
                survival=validate_survival(model.survival(X.iloc[:3],[30.,365.,1826.25]))
                self.assertEqual(survival.shape,(3,3))
                if algorithm=='xgboost_aft':
                    self.assertTrue(np.isinf(model.upper_[~d.cause.eq(1)]).all())
                    np.testing.assert_allclose(model.upper_[d.cause.eq(1)],model.lower_[d.cause.eq(1)])
                if algorithm=='logistic_hazard':
                    for i,b,event in model.periods_:
                        if not d.cause.eq(1).iloc[i]:self.assertLessEqual(model.edges_[b+1],d.time.iloc[i])

    def test_future_survival_orchestration_with_software_only_records(self):
        d=endpoint_fixture(180);config=json.loads((ROOT/'configs/tasks/survival.json').read_text())
        config.update(minimum_training_kidney_events=6,minimum_training_death_events_for_cif=6,minimum_at_risk_per_partition_at_horizon=4)
        manifest={p:{'patients':d.iloc[idx].patient_id.tolist()} for p,idx in {'train':range(108),'validation':range(108,144),'test':range(144,180)}.items()}
        with tempfile.TemporaryDirectory(prefix='SYNTHETIC-SOFTWARE-ONLY-') as tmp:
            tmp=Path(tmp);d.to_csv(tmp/'synthetic.csv',index=False);(tmp/'split.json').write_text(json.dumps(manifest))
            result=run_survival(tmp/'synthetic.csv',tmp/'output',tmp/'split.json',config)
            self.assertEqual(result['status'],'READY_FOR_RESEARCH_TRAINING')
            for algorithm,entry in result['candidates'].items():
                self.assertTrue(entry['trained'],str(entry));self.assertTrue(entry['evaluated'],str(entry));self.assertFalse(entry['served'])
                self.assertTrue((tmp/'output'/algorithm/'manifest.json').exists())
            self.assertFalse(result['selection']['selection_uses_test'])
            self.assertEqual(result['estimand'],'cif')

if __name__=='__main__':unittest.main()
