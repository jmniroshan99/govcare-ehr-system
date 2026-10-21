"""Penalized pooled discrete-time logistic hazard (non-neural).

Event-time quantile grid fitted only on fitting patients; interval indicators are
unpenalized conceptually but regularized here alongside clinical coefficients.
Censored partial intervals contribute no falsely known negative observation.
"""
import numpy as np
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression

class LogisticHazard:
    def __init__(self,parameters):self.parameters=parameters
    def fit(self,X,event,time):
        event=np.asarray(event,dtype=bool);time=np.asarray(time,dtype=float)
        n_bins=min(self.parameters.get('n_bins',6),int(event.sum()//5))
        if n_bins<2:raise ValueError('At least ten fitting events for two development-fitted bins required')
        # Interior boundaries depend on fitting events; final boundary on fitting follow-up.
        interior=np.unique(np.quantile(time[event],np.linspace(0,1,n_bins+1)[1:-1]))
        self.edges_=np.unique(np.r_[0,interior,np.max(time)])
        self.imputer=SimpleImputer(strategy='median',keep_empty_features=True);self.scaler=StandardScaler()
        values=self.scaler.fit_transform(self.imputer.fit_transform(X));design=[];labels=[];self.periods_=[]
        for i,(observed,t) in enumerate(zip(event,time)):
            for b,(left,right) in enumerate(zip(self.edges_[:-1],self.edges_[1:])):
                happened=observed and left<t<=right
                if happened or t>=right:
                    indicator=np.eye(len(self.edges_)-1)[b]
                    design.append(np.r_[values[i],indicator]);labels.append(int(happened));self.periods_.append((i,b,int(happened)))
                if t<=right:break
        if len(np.unique(labels))<2:raise ValueError('Insufficient observed event and completed non-event intervals')
        self.estimator=LogisticRegression(C=self.parameters.get('C',.1),max_iter=3000,random_state=42).fit(design,labels)
        return self
    def survival(self,X,times):
        values=self.scaler.transform(self.imputer.transform(X));bins=len(self.edges_)-1
        # Piecewise constant hazards within each development-fitted interval.
        hazards=np.column_stack([self.estimator.predict_proba(np.column_stack([values,np.tile(np.eye(bins)[b],(len(values),1))]))[:,1] for b in range(bins)])
        fractions=np.clip((np.asarray(times)[None,:]-self.edges_[:-1,None])/np.diff(self.edges_)[:,None],0,1)
        return np.exp(np.log1p(-np.clip(hazards,0,1-1e-12))@fractions)

def build(parameters):return LogisticHazard(parameters)
