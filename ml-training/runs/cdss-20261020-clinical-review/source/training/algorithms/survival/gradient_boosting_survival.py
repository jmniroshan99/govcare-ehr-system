def build(parameters):
    from sksurv.ensemble import GradientBoostingSurvivalAnalysis
    from .common import SkSurvival
    return SkSurvival(GradientBoostingSurvivalAnalysis(random_state=42,**parameters))
