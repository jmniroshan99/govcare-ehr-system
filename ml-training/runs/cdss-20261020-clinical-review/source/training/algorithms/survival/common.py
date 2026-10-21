import numpy as np
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler

class SkSurvival:
    def __init__(self, estimator):self.estimator=estimator
    def fit(self,X,event,time):
        from sksurv.util import Surv
        self.imputer=SimpleImputer(strategy='median',keep_empty_features=True)
        self.scaler=StandardScaler()
        values=self.scaler.fit_transform(self.imputer.fit_transform(X))
        self.estimator.fit(values,Surv.from_arrays(np.asarray(event,dtype=bool),np.asarray(time,dtype=float)))
        return self
    def survival(self,X,times):
        values=self.scaler.transform(self.imputer.transform(X))
        funcs=self.estimator.predict_survival_function(values)
        return np.asarray([[f(float(t)) for t in times] for f in funcs])

def validate_survival(values):
    a=np.asarray(values)
    if not np.isfinite(a).all() or ((a<0)|(a>1)).any() or (np.diff(a,axis=1)>1e-8).any():raise ValueError('Invalid survival probabilities')
    return a

def cumulative_incidence(kidney_survival, death_survival):
    """Piecewise constant paired cause-specific hazards, evaluated on a daily grid.

    Each interval allocates total event mass according to its integrated hazards.
    Refining the integration grid reduces approximation error for smooth AFT models.
    """
    sk=validate_survival(kidney_survival);sd=validate_survival(death_survival)
    if sk.shape!=sd.shape:raise ValueError('Cause-specific grid mismatch')
    hk=-np.log(np.clip(sk,1e-15,1));hd=-np.log(np.clip(sd,1e-15,1))
    dk=np.diff(hk,axis=1,prepend=np.zeros((len(sk),1)));dd=np.diff(hd,axis=1,prepend=np.zeros((len(sd),1)))
    total=np.maximum(0,dk+dd);previous=np.exp(-(hk+hd-total))
    fraction=np.divide(dk,total,out=np.zeros_like(total),where=total>0)
    cif=np.cumsum(previous*(-np.expm1(-total))*fraction,axis=1)
    return np.clip(cif,0,1)
