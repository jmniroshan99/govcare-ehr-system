import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler

class Weibull:
    def __init__(self,parameters):self.parameters=parameters
    def fit(self,X,event,time):
        from lifelines import WeibullAFTFitter
        self.imputer=SimpleImputer(strategy='median',keep_empty_features=True);self.scaler=StandardScaler()
        values=self.scaler.fit_transform(self.imputer.fit_transform(X));self.names=['x'+str(i) for i in range(values.shape[1])]
        frame=pd.DataFrame(values,columns=self.names);frame['duration']=np.asarray(time);frame['event']=np.asarray(event,dtype=int)
        self.estimator=WeibullAFTFitter(**self.parameters).fit(frame,duration_col='duration',event_col='event')
        return self
    def survival(self,X,times):
        frame=pd.DataFrame(self.scaler.transform(self.imputer.transform(X)),columns=self.names)
        return self.estimator.predict_survival_function(frame,times=times).to_numpy().T

def build(parameters):return Weibull(parameters)
