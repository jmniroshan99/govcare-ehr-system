def build(parameters):
    from sksurv.linear_model import CoxnetSurvivalAnalysis
    from .common import SkSurvival
    return SkSurvival(CoxnetSurvivalAnalysis(fit_baseline_model=True,max_iter=100000,**parameters))
