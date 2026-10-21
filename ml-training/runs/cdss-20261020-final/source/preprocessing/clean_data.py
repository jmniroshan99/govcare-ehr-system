from pathlib import Path
import hashlib
import hmac
import pandas as pd
import numpy as np
from .load_data import SOURCE_COLUMNS
from .normalize_units import RANGES, calculate_urr

def pseudonym(identifier, secret):
    if len(secret) < 32: raise ValueError('Pseudonymization key must contain at least 32 bytes')
    return 'LK_' + hmac.new(secret, str(identifier).strip().upper().encode(), hashlib.sha256).hexdigest()[:24]

def clean_monthly(path, secret):
    frame = pd.read_excel(path)
    flags = []
    frame['patient_id'] = frame['Subject_ID'].map(lambda x:pseudonym(x,secret))
    frame['source_row'] = np.arange(2,len(frame)+2)
    def flag(row, variable, problem, action):
        flags.append({'patient_id': row.patient_id, 'source_file': 'HeatMap/urr_data.xlsx',
                      'source_row': int(row.source_row), 'variable': variable, 'problem': problem, 'action': action})
    duplicate = frame.duplicated(subset=[c for c in frame if c != 'source_row'])
    for _,row in frame[duplicate].iterrows(): flag(row,'record','EXACT_DUPLICATE','EXCLUDED_DUPLICATE_WITH_JOURNAL')
    frame = frame[~duplicate].copy()
    frame['observed_at'] = pd.to_datetime(frame.Month,errors='coerce')
    for _,row in frame[frame.observed_at.isna()].iterrows(): flag(row,'date','INVALID_DATE','EXCLUDED_UNORDERABLE_RECORD')
    frame = frame[frame.observed_at.notna()].copy()
    conflict = frame.duplicated(['patient_id','observed_at'],keep=False)
    for _,row in frame[conflict].iterrows(): flag(row,'record','CONFLICTING_SAME_PATIENT_DATE','EXCLUDED_AMBIGUOUS_RECORDS')
    frame = frame[~conflict].copy()
    for source_col, key in SOURCE_COLUMNS.items():
        frame[key] = pd.to_numeric(frame[source_col],errors='coerce')
        for _,row in frame[frame[key].isna() & frame[source_col].notna()].iterrows():
            flag(row,key,'INVALID_NUMERIC_STRING','SET_MISSING_NO_FUTURE_FILL')
        # Source urea units and UA units are not verified, so do not apply guessed unit conversion.
        if key in RANGES and not key.startswith('urea') and key != 'urr_source':
            low,high = RANGES[key]
            invalid = frame[key].notna() & (~np.isfinite(frame[key]) | (frame[key]<low) | (frame[key]>high))
            for _,row in frame[invalid].iterrows(): flag(row,key,'OUTSIDE_WIDE_PLAUSIBILITY_RANGE','SET_MISSING_RETAIN_RECORD')
            frame.loc[invalid,key]=np.nan
    for _,row in frame.iterrows():
        if row.potassium_pre > 8: flag(row,'potassium_pre','EXTREME_VALUE_REQUIRES_SOURCE_REVIEW','RETAIN_WITH_FLAG')
        if row.urea_pre > 50: flag(row,'urea_pre','UNIT_UNVERIFIED_EXTREME_SOURCE_VALUE','EXCLUDE_ABSOLUTE_UREA_PREDICTOR')
    urr = []
    for _,row in frame.iterrows():
        value,problem = calculate_urr(row.urea_pre,row.urea_post)
        if problem: flag(row,'urr',problem,'SET_MISSING_NO_CLAMP')
        elif pd.notna(row.urr_source) and abs(value-row.urr_source)>0.05:
            flag(row,'urr','SOURCE_DERIVED_VALUE_MISMATCH','RECALCULATE_FROM_PAIRED_SOURCE_VALUES')
        urr.append(value)
    frame['urr'] = urr
    frame = frame.sort_values(['patient_id','observed_at']).reset_index(drop=True)
    keep = ['patient_id','source_row','observed_at']+list(SOURCE_COLUMNS.values())+['urr']
    return frame[keep], pd.DataFrame(flags,columns=['patient_id','source_file','source_row','variable','problem','action'])
