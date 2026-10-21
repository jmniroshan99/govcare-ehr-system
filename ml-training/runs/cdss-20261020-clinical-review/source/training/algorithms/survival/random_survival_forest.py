def build(parameters):
    from sksurv.ensemble import RandomSurvivalForest
    from .common import SkSurvival
    return SkSurvival(RandomSurvivalForest(random_state=42,n_jobs=1,**parameters))
