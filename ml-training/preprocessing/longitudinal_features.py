"""Features use only the current and earlier rows; targets use the immediate next row."""
import numpy as np
import pandas as pd

PREDICTORS = ['hb','urr','albumin','calcium','sodium','potassium_pre','potassium_post','creatinine_pre','creatinine_post']

def feature_frame(frame):
    frame = frame.sort_values(['patient_id','observed_at']).reset_index(drop=True).copy()
    features = pd.DataFrame(index=frame.index)
    for key in PREDICTORS:
        grouped = frame.groupby('patient_id',sort=False)[key]
        features[key] = frame[key]
        features[key+'_previous'] = grouped.shift(1)
        features[key+'_difference'] = features[key]-features[key+'_previous']
        features[key+'_pct_change'] = (features[key+'_difference']/features[key+'_previous'].replace(0,np.nan))*100
        features[key+'_mean3'] = grouped.transform(lambda x:x.rolling(3,min_periods=1).mean())
        features[key+'_sd3'] = grouped.transform(lambda x:x.rolling(3,min_periods=2).std())
        features[key+'_min3'] = grouped.transform(lambda x:x.rolling(3,min_periods=1).min())
        features[key+'_max3'] = grouped.transform(lambda x:x.rolling(3,min_periods=1).max())
        # A past-only slope against actual elapsed days, not equal-spaced row indices.
        slopes = np.full(len(frame),np.nan)
        for _,g in frame.groupby('patient_id',sort=False):
            for j in range(len(g)):
                sub=g.iloc[max(0,j-2):j+1]; valid=sub[key].notna()
                if valid.sum()>=2:
                    days=(sub.loc[valid,'observed_at']-sub.loc[valid,'observed_at'].iloc[0]).dt.total_seconds().to_numpy()/86400
                    if np.ptp(days)>0: slopes[sub.index[-1]]=float(np.polyfit(days,sub.loc[valid,key].to_numpy(),1)[0])
        features[key+'_slope_per_day']=slopes
    features['days_since_previous'] = frame.groupby('patient_id')['observed_at'].diff().dt.total_seconds()/86400
    features['potassium_reduction'] = frame.potassium_pre-frame.potassium_post
    features['creatinine_reduction'] = frame.creatinine_pre-frame.creatinine_post
    return features.replace([np.inf,-np.inf],np.nan)

def create_targets(frame, target):
    ordered=frame.sort_values(['patient_id','observed_at']).reset_index(drop=True)
    values=ordered.groupby('patient_id')[target].shift(-1)
    date=ordered.groupby('patient_id')['observed_at'].shift(-1)
    days=(date-ordered.observed_at).dt.total_seconds()/86400
    # Do not jump across invalid next outcomes or silently call distant observations next-month targets.
    valid=values.notna() & ordered[target].notna() & days.between(14,62)
    return ordered,feature_frame(ordered),values,date,valid
