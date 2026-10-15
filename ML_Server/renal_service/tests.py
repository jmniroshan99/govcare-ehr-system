"""Operational fixtures are not clinical validation subjects."""
import copy
import json
import os
import time
import uuid
import unittest
from datetime import datetime,timezone,timedelta
from unittest.mock import patch
import jwt
from django.test import SimpleTestCase,override_settings
from .inference import predict,InvalidInput,parse_history,registry

SECRET='operational-test-key-only-0000000000000000000000000000000'

def token(**overrides):
    now=int(time.time());claims={'sub':str(uuid.uuid4()),'hospital_id':str(uuid.uuid4()),'patient_id':str(uuid.uuid4()),
        'jti':str(uuid.uuid4()),'role':'doctor','scopes':['renal:predict'],'iss':'govcare-spring','aud':'govcare-renal-ml',
        'iat':now,'nbf':now-1,'exp':now+55}
    claims.update(overrides)
    return jwt.encode(claims,SECRET,algorithm='HS256')

def history():
    dates=[datetime.now(timezone.utc)-timedelta(days=31),datetime.now(timezone.utc)-timedelta(days=1)]
    rows=[]
    for d,h in zip(dates,[10.2,10.5]):
        m={'hb':h,'albumin':38.0,'calcium':2.2,'sodium':138.0,'potassium_pre':4.7,'potassium_post':3.4,
           'creatinine_pre':700.0,'creatinine_post':300.0,'urea_pre':20.0,'urea_post':7.0,'dry_weight':60.0}
        u={'hb':'g/dL','albumin':'g/L','calcium':'mmol/L','sodium':'mmol/L','potassium_pre':'mmol/L','potassium_post':'mmol/L',
            'creatinine_pre':'umol/L','creatinine_post':'umol/L','urea_pre':'mmol/L','urea_post':'mmol/L','dry_weight':'kg'}
        rows.append({'observed_at':d.isoformat(),'measurements':m,'units':u})
    return {'history':rows,'maintenance_hemodialysis_verified':True}

@override_settings(ALLOWED_HOSTS=['testserver'])
class AuthAndInferenceTests(SimpleTestCase):
    def setUp(self):
        self.env=patch.dict(os.environ,{'GOVCARE_RENAL_JWT_SECRET':SECRET});self.env.start();self.addCleanup(self.env.stop)
    def post(self,key='hb',payload=None,auth=None):
        return self.client.post(f'/api/ml/predict/{key}/',data=json.dumps(history() if payload is None else payload),
            content_type='application/json',HTTP_AUTHORIZATION='Bearer '+(token() if auth is None else auth))
    def test_only_exact_health_paths_are_public(self):
        self.assertEqual(self.client.get('/health/').status_code,200)
        self.assertEqual(self.client.get('/api/ml/health/').status_code,200)
        for url in ['/health/anything','/api/ml/models/','/api/ml/predict/hb/']:
            self.assertEqual(self.client.get(url).status_code,401)
    def test_missing_service_key_fails_closed(self):
        with patch.dict(os.environ,{'GOVCARE_RENAL_JWT_SECRET':''}):self.assertEqual(self.post().status_code,503)
    def test_expiry_signature_audience_issuer_and_required_claims(self):
        now=int(time.time())
        invalid=[token(exp=now-20,iat=now-60),token(aud='wrong'),token(iss='wrong'),token(exp=now+600),token(patient_id='not-a-uuid')]
        wrong_secret=jwt.encode({'exp':now+55},'invalid-operational-key-00000000000000',algorithm='HS256');invalid.append(wrong_secret)
        for bearer in invalid:self.assertEqual(self.post(auth=bearer).status_code,401)
        missing=jwt.decode(token(),SECRET,algorithms=['HS256'],audience='govcare-renal-ml');missing.pop('exp')
        self.assertEqual(self.post(auth=jwt.encode(missing,SECRET,algorithm='HS256')).status_code,401)
        claims=jwt.decode(token(),SECRET,algorithms=['HS256'],audience='govcare-renal-ml')
        self.assertEqual(self.post(auth=jwt.encode(claims,'',algorithm='none')).status_code,401)
    def test_role_and_scope(self):
        for claims in [{'role':'patient'},{'role':'nurse'},{'scopes':[]}]:self.assertEqual(self.post(auth=token(**claims)).status_code,403)
    def test_registry_requires_auth_and_metadata_is_honest(self):
        r=self.client.get('/api/ml/models/',HTTP_AUTHORIZATION='Bearer '+token());self.assertEqual(r.status_code,200)
        d=r.json();self.assertEqual(len(d['models']),4)
        self.assertTrue(all(x['clinical_validation']=='NOT_COMPLETED' for x in d['models']))
    def test_hb_persistence_and_urr_model_inference(self):
        hb=self.post();self.assertEqual(hb.status_code,200)
        out=hb.json();self.assertEqual(out['status'],'AVAILABLE');self.assertEqual(out['method'],'PERSISTENCE_BASELINE')
        self.assertAlmostEqual(out['prediction'],10.5);self.assertIsNone(out['probability'])
        self.assertIsNone(out['explanation']['top_factors'][0]['contribution'])
        urr=self.post('urr');self.assertEqual(urr.status_code,200);u=urr.json()
        self.assertEqual(u['status'],'AVAILABLE');self.assertEqual(u['explanation']['method'],'SHAP')
        self.assertGreater(len(u['explanation']['top_factors']),0);self.assertTrue(u['requires_clinician_review'])
        self.assertEqual(u['model'],'LK-RENAL-URR-1.0');self.assertTrue(any('R2=' in x for x in u['explanation']['limitations']))
    def test_hyperkalemia_research_probability_is_explicitly_nonclinical(self):
        response=self.post('hyperkalemia');self.assertEqual(response.status_code,200)
        out=response.json();self.assertEqual(out['status'],'AVAILABLE')
        self.assertEqual(out['model'],'LK-RENAL-HYPERK-1.0');self.assertEqual(out['method'],'RESEARCH_MODEL')
        self.assertIsNone(out['prediction']);self.assertIsInstance(out['probability'],float)
        self.assertGreaterEqual(out['probability'],0.0);self.assertLessEqual(out['probability'],1.0)
        self.assertEqual(out['risk_category'],'RESEARCH_RISK_SCORE')
        self.assertEqual(out['clinical_validation'],'NOT_COMPLETED');self.assertTrue(out['requires_clinician_review'])
        self.assertTrue(any('not clinically calibrated' in x.lower() for x in out['explanation']['limitations']))
        self.assertGreater(len(out['explanation']['top_factors']),0)

    def test_extreme_current_potassium_blocks_research_score(self):
        h=history();h['history'][-1]['measurements']['potassium_pre']=8.5
        response=self.post('hyperkalemia',h);self.assertEqual(response.status_code,200)
        out=response.json();self.assertEqual(out['status'],'INSUFFICIENT_DATA');self.assertIsNone(out['probability'])
        self.assertIn('EXTREME_POTASSIUM_REQUIRES_SOURCE_REVIEW',out['data_quality']['flags'])

    def test_numeric_strings_questions_negatives_and_invalid_urr_denominator_are_rejected(self):
        for field,value in [('hb','?'),('hb','10.5'),('hb',-1),('urea_pre',0),('urea_post',-2)]:
            h=history();h['history'][-1]['measurements'][field]=value
            self.assertEqual(self.post('hyperkalemia',h).status_code,422)

    def test_dry_weight_is_not_manufactured(self):
        out=self.post('dry-weight').json();self.assertEqual(out['status'],'NOT_AVAILABLE');self.assertIsNone(out['prediction'])
    def test_missing_and_stale_inputs_are_suppressed(self):
        h=history();h['history']=h['history'][:1]
        self.assertEqual(self.post(payload=h).json()['status'],'INSUFFICIENT_DATA')
        h=history();h['history'][0]['observed_at']=(datetime.now(timezone.utc)-timedelta(days=2)).isoformat()
        out=self.post(payload=h).json();self.assertEqual(out['status'],'INSUFFICIENT_DATA')
        self.assertIn('LATEST_LAB_INTERVAL_OUTSIDE_MONTHLY_TRAINING_SUPPORT',out['data_quality']['flags'])
        h=history()
        for row in h['history']:row['observed_at']='2024-01-01' if row==h['history'][0] else '2024-02-01'
        self.assertEqual(self.post(payload=h).json()['status'],'INSUFFICIENT_DATA')
    def test_invalid_input_does_not_echo_sensitive_values(self):
        h=history();h['patient_name']='SECRET_PERSON_NAME'
        r=self.post(payload=h);self.assertEqual(r.status_code,422);self.assertNotIn('SECRET_PERSON_NAME',r.content.decode())
        h=history();h['history'][1]['measurements']['hb']='not-a-number'
        self.assertEqual(self.post(payload=h).status_code,422)
        self.assertEqual(self.post('unknown').status_code,404)
    def test_chronology_future_date_units_and_nonfinite_values(self):
        variants=[]
        h=history();h['history'].reverse();variants.append(h)
        h=history();h['history'][1]['observed_at']=h['history'][0]['observed_at'];variants.append(h)
        h=history();h['history'][1]['observed_at']=(datetime.now(timezone.utc)+timedelta(days=1)).isoformat();variants.append(h)
        h=history();h['history'][1]['units']['urea_post']='mg/dL';variants.append(h)
        h=history();h['history'][1]['units']['hb']='unknown';variants.append(h)
        h=history();h['maintenance_hemodialysis_verified']=False;variants.append(h)
        h=history();h['history'][1]['measurements']['hb']=float('nan');variants.append(h)
        for h in variants:self.assertEqual(self.post(payload=h).status_code,422)
    def test_invalid_urr_not_clamped_and_missingness_reported(self):
        h=history();h['history'][1]['measurements']['urea_post']=30
        out=self.post('urr',h).json();self.assertEqual(out['status'],'INSUFFICIENT_DATA')
        self.assertIn('INVALID_URR_POST_EXCEEDS_PRE',out['data_quality']['flags'])
    def test_measured_unit_conversion_matches_training_contract(self):
        h=history()
        for row in h['history']:
            row['measurements']['hb']*=10;row['units']['hb']='g/L'
            row['measurements']['creatinine_pre']/=88.4;row['units']['creatinine_pre']='mg/dL'
        self.assertAlmostEqual(self.post(payload=h).json()['prediction'],10.5)

    def test_serving_contract_is_exposed_and_matches_actual_artifact_features(self):
        output=self.post('hyperkalemia').json()
        contract=output['serving_input_contract']
        self.assertEqual(contract['minimumObservations'],2)
        self.assertEqual(contract['minimumCurrentPredictors'],5)
        self.assertTrue(set(contract['predictors']).issubset(set(output['feature_names'])))
        self.assertIn('potassium_pre',output['required_measurements'])

    def test_persistence_forecast_needs_current_hb_not_a_previous_hb_trend(self):
        h=history();del h['history'][0]['measurements']['hb']
        output=self.post('hb',h).json()
        self.assertEqual(output['status'],'AVAILABLE');self.assertEqual(output['method'],'PERSISTENCE_BASELINE')
        self.assertAlmostEqual(output['prediction'],10.5)

if __name__=='__main__':unittest.main()
