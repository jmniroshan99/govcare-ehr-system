import numpy as np
from scipy.special import ndtr, expit
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler

class XGBoostAFT:
    def __init__(self,parameters):self.parameters=parameters
    def fit(self,X,event,time):
        import xgboost as xgb
        self.imputer=SimpleImputer(strategy='median',keep_empty_features=True);self.scaler=StandardScaler()
        values=self.scaler.fit_transform(self.imputer.fit_transform(X));event=np.asarray(event,dtype=bool);time=np.asarray(time,dtype=float)
        if (time<=0).any():raise ValueError('AFT times must be positive')
        d=xgb.DMatrix(values)
        self.lower_=time;self.upper_=np.where(event,time,np.inf)
        d.set_float_info('label_lower_bound',self.lower_);d.set_float_info('label_upper_bound',self.upper_)
        self.params={'objective':'survival:aft','eval_metric':'aft-nloglik','tree_method':'hist','nthread':1,'seed':42,
            'learning_rate':.05,'aft_loss_distribution':'normal','aft_loss_distribution_scale':1.2,**self.parameters}
        self.estimator=xgb.train(self.params,d,num_boost_round=80)
        return self
    def survival(self,X,times):
        import xgboost as xgb
        mu=self.estimator.predict(xgb.DMatrix(self.scaler.transform(self.imputer.transform(X))),output_margin=True)
        z=(np.log(np.asarray(times))[None,:]-mu[:,None])/self.params['aft_loss_distribution_scale']
        distribution=self.params['aft_loss_distribution']
        if distribution=='normal':return ndtr(-z)
        if distribution=='logistic':return expit(-z)
        if distribution=='extreme':return np.exp(-np.exp(np.clip(z,-700,700)))
        raise ValueError('Unsupported AFT distribution')

def build(parameters):return XGBoostAFT(parameters)
