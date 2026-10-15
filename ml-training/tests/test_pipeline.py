import json
import sys
import unittest
from pathlib import Path
import tempfile
import joblib
import numpy as np
import pandas as pd

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from preprocessing.clean_data import pseudonym,clean_monthly
from preprocessing.normalize_units import normalize_value,calculate_urr
from preprocessing.longitudinal_features import feature_frame,create_targets,PREDICTORS
from preprocessing.validate_data import assert_patient_split,assert_feature_contract

class CausalPipelineTests(unittest.TestCase):
    def frame(self):
        d=pd.DataFrame({'patient_id':['a']*4+['b']*2,
            'observed_at':pd.to_datetime(['2024-01-01','2024-02-01','2024-03-01','2024-06-01','2024-01-01','2024-02-01']),
            'hb':[10,11,np.nan,13,7,8]})
        for name in PREDICTORS:
            if name not in d:d[name]=[60,61,62,63,70,71]
        return d
    def test_pseudonyms_are_stable_and_secret_dependent(self):
        a=pseudonym(' subject-01 ',b'a'*32)
        self.assertEqual(a,pseudonym('SUBJECT-01',b'a'*32));self.assertNotEqual(a,pseudonym('SUBJECT-01',b'b'*32))
        self.assertNotIn('SUBJECT',a)
    def test_prefix_features_are_invariant_to_future_changes(self):
        original=self.frame();before=feature_frame(original)
        changed=original.copy();changed.loc[2:3,'hb']=[999,999]
        after=feature_frame(changed)
        pd.testing.assert_frame_equal(before.iloc[:2],after.iloc[:2])
        self.assertAlmostEqual(before.iloc[1].hb_mean3,10.5)
    def test_targets_do_not_cross_patient_or_skip_missing_outcome(self):
        ordered,X,y,date,valid=create_targets(self.frame(),'hb')
        self.assertEqual(y.iloc[0],11);self.assertTrue(np.isnan(y.iloc[1]))
        self.assertFalse(valid.iloc[1]);self.assertFalse(valid.iloc[2]);self.assertFalse(valid.iloc[3])
        self.assertEqual(y.iloc[4],8);self.assertTrue(np.isnan(y.iloc[5]))
    def test_group_split_rejects_same_patient_across_sets(self):
        with self.assertRaises(AssertionError):assert_patient_split(self.frame(),{'train':[0],'test':[1]})
        self.assertTrue(assert_patient_split(self.frame(),{'train':[0,1,2,3],'test':[4,5]}))
    def test_feature_contract_rejects_target_and_patient_id(self):
        for names in [['patient_id'],['next_hb'],['target_hb']]:
            with self.assertRaises(AssertionError):assert_feature_contract(names)
        self.assertTrue(assert_feature_contract(feature_frame(self.frame()).columns))
    def test_urr_is_not_clamped(self):
        self.assertEqual(calculate_urr(20,7),(65.0,None))
        self.assertIsNone(calculate_urr(0,0)[0]);self.assertIsNone(calculate_urr(10,20)[0])
        self.assertEqual(calculate_urr(10,20)[1],'INVALID_URR_POST_EXCEEDS_PRE')
    def test_explicit_units_and_wrong_unit_rejection(self):
        self.assertAlmostEqual(normalize_value('hb',100,'g/L'),10)
        self.assertAlmostEqual(normalize_value('albumin',4,'g/dL'),40)
        self.assertAlmostEqual(normalize_value('creatinine_pre',10,'mg/dL'),884)
        self.assertAlmostEqual(normalize_value('urea_pre',60.06,'mg/dL'),10)
        for value,unit in [(True,'g/dL'),(float('inf'),'g/dL'),(10,'unknown')]:
            with self.assertRaises(ValueError):normalize_value('hb',value,unit)
    def test_saved_patient_manifest_has_no_overlap(self):
        manifest=json.loads((ROOT/'reports/patient_split_manifest.json').read_text())
        ids=[set(s['patients']) for s in manifest.values()]
        self.assertFalse(ids[0]&ids[1] or ids[0]&ids[2] or ids[1]&ids[2])
        self.assertEqual(sum(len(s) for s in ids),42)
    def test_serialized_full_pipeline_and_train_only_imputation(self):
        model=joblib.load(ROOT/'artifacts/hb-risk/model.joblib')
        self.assertEqual(list(model.named_steps),['imputer','scaler','model'])
        self.assertEqual(model['imputer'].statistics_.shape[0],84)
        meta=json.loads((ROOT/'artifacts/hb-risk/metadata.json').read_text())
        self.assertNotIn('patient_id',meta['feature_names']);self.assertFalse(meta['selection_uses_test'])
        X=pd.DataFrame(np.zeros((1,84)),columns=meta['feature_names'])
        self.assertTrue(np.isfinite(model.predict(X)[0]))
        # Independently reconstruct the eligible training cohort and its medians.
        # The stored imputer must agree with training rows, not all supplied rows.
        frame=pd.read_csv(ROOT/'data/deidentified_monthly.csv',parse_dates=['observed_at'])
        ordered,features,_,_,valid=create_targets(frame,'hb')
        manifest=json.loads((ROOT/'reports/patient_split_manifest.json').read_text())
        training=valid & ordered.patient_id.isin(manifest['train']['patients'])
        self.assertEqual(int(training.sum()),190)
        expected=features.loc[training,meta['feature_names']].median().to_numpy()
        np.testing.assert_allclose(model['imputer'].statistics_,expected,rtol=1e-10,atol=1e-10)
    def test_cleaning_logs_exact_duplicates_and_invalid_cells(self):
        flags=pd.read_csv(ROOT/'reports/quality_flags.csv')
        self.assertEqual((flags.problem=='EXACT_DUPLICATE').sum(),5)
        self.assertEqual((flags.problem=='INVALID_NUMERIC_STRING').sum(),2)
        self.assertGreaterEqual((flags.problem=='INVALID_URR_POST_EXCEEDS_PRE').sum(),1)
        frame=pd.read_csv(ROOT/'data/deidentified_monthly.csv')
        self.assertEqual(len(frame),386);self.assertEqual(frame.patient_id.nunique(),42)
        self.assertNotIn('Subject_ID',frame);self.assertNotIn('DOB',frame)

if __name__=='__main__':unittest.main()
