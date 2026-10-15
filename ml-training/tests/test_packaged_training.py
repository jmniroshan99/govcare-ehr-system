import sys
import unittest
from pathlib import Path
import pandas as pd
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from train_packaged_models import forecast_gate,partition_indices

class PackagedTrainingGateTests(unittest.TestCase):
    def baselines(self,persistence=10,rolling=11,mean=12):
        return {name:{'validation':{'MAE':value}} for name,value in [('Persistence',persistence),('RollingMean3',rolling),('TrainingMean',mean)]}
    def test_small_improvement_does_not_replace_persistence(self):
        passed,_=forecast_gate({'MAE':9.6},self.baselines());self.assertFalse(passed)
    def test_candidate_must_beat_other_simple_baselines(self):
        passed,_=forecast_gate({'MAE':9.0},self.baselines(10,8,12));self.assertFalse(passed)
    def test_validation_improvement_passes_independently_of_test_metrics(self):
        passed,improvement=forecast_gate({'MAE':8.0},self.baselines());self.assertTrue(passed);self.assertAlmostEqual(improvement,.2)
    def test_perfect_persistence_is_retained(self):
        self.assertFalse(forecast_gate({'MAE':0.0},self.baselines(0,1,2))[0])
    def test_overlapping_patient_manifests_are_rejected(self):
        frame=pd.DataFrame({'patient_id':['a','b','c']});manifest={p:{'patients':ids} for p,ids in [('train',['a']),('validation',['a','b']),('test',['c'])]}
        with self.assertRaisesRegex(ValueError,'overlap'):partition_indices(frame,manifest)
    def test_unlisted_patient_cannot_enter_a_partition(self):
        frame=pd.DataFrame({'patient_id':['a','b','c','unknown']});manifest={p:{'patients':[key]} for p,key in [('train','a'),('validation','b'),('test','c')]}
        with self.assertRaisesRegex(ValueError,'missing'):partition_indices(frame,manifest)

if __name__=='__main__':unittest.main()
