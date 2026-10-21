def build(parameters):
    from sksurv.ensemble import ExtraSurvivalTrees
    from .common import SkSurvival
    return SkSurvival(ExtraSurvivalTrees(random_state=42,n_jobs=1,**parameters))
