"""Audit the supplied CSV without rewriting it or inferring absent outcomes."""
import json
from pathlib import Path
import pandas as pd
from preprocessing.longitudinal_features import create_targets, PREDICTORS
from preprocessing.normalize_units import CANONICAL_UNITS
from training.common import sha256, write_json

MEANINGS = {
    'patient_id': ('Pseudonymous patient grouping key', 'identifier'),
    'source_row': ('Historical workbook row reference; excluded predictor', 'row number'),
    'observed_at': ('Recorded monthly observation date; may be month anchor', 'ISO date'),
    'hb': ('Hemoglobin', 'g/dL'), 'albumin': ('Serum albumin; NOT urine ACR', 'g/L'),
    'calcium': ('Serum calcium', 'mmol/L'), 'sodium': ('Pre-HD serum sodium', 'mmol/L'),
    'potassium_pre': ('Pre-HD serum potassium', 'mmol/L'), 'potassium_post': ('Post-HD serum potassium', 'mmol/L'),
    'creatinine_pre': ('Pre-HD serum creatinine', 'umol/L'), 'creatinine_post': ('Post-HD serum creatinine', 'umol/L'),
    'urea_pre': ('Pre-HD blood urea; absolute predictor excluded', 'UNVERIFIED_SOURCE_UNIT'),
    'urea_post': ('Post-HD blood urea; absolute predictor excluded', 'UNVERIFIED_SOURCE_UNIT'),
    'uric_acid_source': ('Source UA; excluded due unit uncertainty', 'UNVERIFIED (source says mg/dL)'),
    'urr_source': ('Historical supplied URR; excluded predictor', '%'),
    'urr': ('URR recomputed from paired urea; assumes matched pre/post units', '%'),
}

def audit(path, output):
    path, output = Path(path), Path(output)
    frame = pd.read_csv(path, parse_dates=['observed_at'])
    grouped = frame.groupby('patient_id').observed_at
    followup = (grouped.max()-grouped.min()).dt.total_seconds()/86400
    duplicates = frame.duplicated(['patient_id','observed_at'], keep=False)
    conflicts = frame.loc[duplicates].groupby(['patient_id','observed_at']).nunique().gt(1).any(axis=1)
    outcomes = {}
    for task, source in [('hb','hb'),('urr','urr'),('hyperkalemia','potassium_pre')]:
        ordered, _, values, dates, valid = create_targets(frame, source)
        intervals = (dates[valid]-ordered.loc[valid,'observed_at']).dt.days
        outcomes[task] = {'eligible_observations': int(valid.sum()), 'patients': int(ordered.loc[valid,'patient_id'].nunique()),
            'actual_interval_days': intervals.describe().to_dict(), 'interval_counts': intervals.value_counts().sort_index().to_dict(),
            'definition': 'Immediate next observation 14–62 days; no skipping absent/invalid immediate targets',
            'positive_labels': int((values[valid]>=5.5).sum()) if task=='hyperkalemia' else None}
    event_fields = ['index_date','kidney_failure_event','kidney_failure_date','death_date','followup_end_date','censoring_reason','maintenance_dialysis_at_index']
    result = {'filename': str(path), 'sha256': sha256(path), 'observations':len(frame), 'unique_patients':int(frame.patient_id.nunique()),
        'observation_date_min':frame.observed_at.min(), 'observation_date_max':frame.observed_at.max(),
        'observations_per_patient':frame.groupby('patient_id').size().describe().to_dict(),
        'patient_followup_days':followup.describe().to_dict(),
        'per_patient': [{'patient_id':p,'observations':len(g),'first':g.observed_at.min(),'last':g.observed_at.max(),'followup_days':followup[p]} for p,g in frame.groupby('patient_id')],
        'columns':{key:{'meaning':MEANINGS.get(key,('Undocumented','UNKNOWN'))[0], 'unit':MEANINGS.get(key,('Undocumented','UNKNOWN'))[1],
            'missing':int(frame[key].isna().sum()),'predictor':key in PREDICTORS} for key in frame.columns},
        'exact_duplicate_rows':int(frame.duplicated().sum()),'duplicate_patient_date_rows':int(duplicates.sum()),'conflicting_patient_dates':int(conflicts.sum()),
        'outcomes':outcomes,'long_term_fields':{k:k in frame for k in event_fields},
        'long_term_status':'INSUFFICIENT_LONG_TERM_OUTCOME_DATA',
        'population':'Maintenance hemodialysis per historical source audit; individual dialysis status is absent from this CSV',
        'provenance':'Historical audit attributes data to user-supplied e19 renal-care repository/Teaching Hospital Peradeniya. Not independently verified.',
        'dataset_permission_status':'UNVERIFIED','clinical_validation':'NOT_COMPLETED',
        'preprocessing': ['Historical code removes exact duplicates, converts invalid numerics to missing, recomputes URR and pseudonymizes patients.',
            'Original raw precleaning files absent; historical bidirectional interpolation cannot be ruled out.',
            'New features use only current and previous measurements; imputation/scaling fitted within training partitions.',
            'No demographic joining, inferred ACR, synthetic event labels, interpolation or new cleaning of source CSV.'],
        'units':CANONICAL_UNITS,'unit_caution':'Canonical serving urea units do not verify source urea units.'}
    write_json(output/'dataset_audit.json', result)
    lines = ['# Current packaged dataset audit', '', f"Measured file: `{path.name}`. SHA-256: `{result['sha256']}`.", '',
        f"{len(frame)} observations from {result['unique_patients']} patients; {result['observation_date_min'].date()} to {result['observation_date_max'].date()}.",
        f"Within-patient follow-up: median {followup.median():.0f}, maximum {followup.max():.0f} days. This is observation span, not verified survival follow-up.",
        f"Exact duplicate rows: {result['exact_duplicate_rows']}; duplicate patient/date rows: {result['duplicate_patient_date_rows']}; conflicting patient/dates: {result['conflicting_patient_dates']}.", '',
        '| Column | Meaning | Physical unit | Missing |', '|---|---|---|---:|']
    lines += [f"| {k} | {v['meaning']} | {v['unit']} | {v['missing']} |" for k,v in result['columns'].items()]
    lines += ['', '| Task | Eligible observations | Patients | Actual interval min–max (days) |', '|---|---:|---:|---|']
    lines += [f"| {k} | {v['eligible_observations']} | {v['patients']} | {v['actual_interval_days']['min']:.0f}–{v['actual_interval_days']['max']:.0f} |" for k,v in outcomes.items()]
    lines += ['', 'Hyperkalemia means next pre-HD potassium ≥5.5 mmol/L. Targets are the immediate next measurement within 14–62 days; 30 days is only a display anchor.', '',
        'No first-kidney-failure event, event date, death date, index date, verified follow-up end, censoring reason or individual eligibility field is supplied. Maintenance dialysis is the historically documented cohort context; these patients cannot form a first-future-KRT initiation cohort.', '',
        result['provenance'], '', '**Permission UNVERIFIED; clinical validation NOT_COMPLETED.**', '', *result['preprocessing'], '',
        'Serum albumin is not urine ACR. Source urea and UA units remain uncertain; neither absolute measurement is a predictor. Source data are preserved byte-for-byte. Derived records and hashes are retained with each run.']
    (output/'DATASET_AUDIT.md').write_text('\n'.join(lines)+'\n', encoding='utf-8')
    return result
