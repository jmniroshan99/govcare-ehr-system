"""Audit every tabular file without exposing direct patient identifiers."""
from pathlib import Path
import hashlib
import json
import re
import sqlite3
import pandas as pd

SOURCE_COLUMNS = {
    'Hb (g/dL)': 'hb', 'Albumin (g/L)': 'albumin', 'S Ca (mmol/L)': 'calcium',
    'Serum Na Pre-HD (mmol/L)': 'sodium', 'Serum K Pre-HD (mmol/L)': 'potassium_pre',
    'Serum K Post-HD (mmol/L)': 'potassium_post', 'SCR- pre HD (µmol/L)': 'creatinine_pre',
    'SCR- post HD (µmol/L)': 'creatinine_post', 'BU - pre HD': 'urea_pre',
    'BU - post HD': 'urea_post', 'UA (mg/dL)': 'uric_acid_source', 'URR (%)': 'urr_source',
}

def file_hash(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def audit_source(source):
    source = Path(source)
    reports = []
    for path in sorted(source.rglob('*')):
        if not path.is_file() or path.suffix.lower() not in ('.xlsx', '.xls', '.csv', '.tsv', '.sqlite3'):
            continue
        common = {'filename': str(path.relative_to(source)), 'type': path.suffix,
                  'sha256': file_hash(path), 'size_bytes': path.stat().st_size}
        if path.suffix == '.sqlite3':
            with sqlite3.connect(f'file:{path}?mode=ro', uri=True) as db:
                names = [r[0] for r in db.execute("select name from sqlite_master where type='table'")]
                common['tables'] = [{'name': n, 'rows': db.execute('select count(*) from "' + n.replace('"','""') + '"').fetchone()[0]} for n in names]
            common['scope'] = 'Empty Django service/authentication database; not clinical training data'
            reports.append(common)
            continue
        sheets = pd.read_excel(path, sheet_name=None) if path.suffix in ('.xls', '.xlsx') else {'data': pd.read_csv(path, sep='\t' if path.suffix == '.tsv' else ',')}
        common['sheets'] = []
        for name, frame in sheets.items():
            sid = next((c for c in frame if 'subject' in str(c).lower()), None)
            datecol = next((c for c in frame if str(c) in ('Month', 'Date')), None)
            item = {'name': str(name), 'rows': len(frame), 'columns': list(map(str, frame.columns)),
                    'missing_counts': {str(c): int(v) for c,v in frame.isna().sum().items()},
                    'missing_percent': {str(c): round(float(v)*100/len(frame),3) for c,v in frame.isna().sum().items()},
                    'duplicates_exact': int(frame.duplicated().sum()), 'unique_patients': int(frame[sid].nunique()) if sid else None,
                    'numeric_ranges': {}, 'invalid_numeric_counts': {}, 'categorical_counts': {}}
            if sid:
                counts = frame.groupby(sid).size()
                item['observations_per_patient'] = {k:float(v) for k,v in counts.describe().items()}
                clean_ids = frame[sid].astype(str).str.strip().str.upper()
                item['identifier_normalization_changes'] = int((frame[sid].astype(str) != clean_ids).sum())
                item['identifier_normalization_collisions'] = int(frame[sid].nunique() - clean_ids.nunique())
            if datecol:
                dates = pd.to_datetime(frame[datecol], errors='coerce')
                item['date_range'] = [str(dates.min().date()), str(dates.max().date())]
                item['invalid_dates'] = int(dates.isna().sum())
                item['date_types'] = frame[datecol].map(lambda v:type(v).__name__).value_counts().to_dict()
                if sid: item['duplicate_patient_date'] = int(frame.duplicated([sid,datecol]).sum())
            for c in frame:
                if c == sid or c == datecol: continue
                if str(c) in ('DOB', 'Sex', 'Outcome', 'Primary renal diagnosis', 'Dialysis access', 'Model'):
                    if c == 'DOB':
                        item['dob_types'] = frame[c].map(lambda v:'missing' if pd.isna(v) else type(v).__name__).value_counts().to_dict()
                    else: item['categorical_counts'][str(c)] = {str(k):int(v) for k,v in frame[c].value_counts().items()}
                    continue
                num = pd.to_numeric(frame[c], errors='coerce')
                item['invalid_numeric_counts'][str(c)] = int((frame[c].notna() & num.isna()).sum())
                item['numeric_ranges'][str(c)] = {'min': float(num.min()) if num.notna().any() else None,
                                                  'max': float(num.max()) if num.notna().any() else None}
            item['direct_identifier_columns'] = [str(c) for c in frame if re.search(r'(?i)name|nic|phone|address|national|email',str(c))]
            common['sheets'].append(item)
        reports.append(common)
    return reports

def write_audit(reports, out):
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    (out/'dataset_audit.json').write_text(json.dumps(reports, indent=2), encoding='utf-8')
    text = ['# Dataset audit', '', 'Source: user-supplied e19 renal-care repository. Its README attributes the cohort to Teaching Hospital Peradeniya; independent source verification and secondary-use permission are not supplied.', '',
            '**DATASET_PERMISSION_STATUS = UNVERIFIED**. No clinical or prospective validation is established.', '',
            '## File and sheet inventory', '', '| File | Sheet | Rows | Patients | Exact duplicates | Period |', '|---|---|---:|---:|---:|---|']
    for f in reports:
        for s in f.get('sheets', []):
            text.append(f"| {f['filename']} | {s['name']} | {s['rows']} | {s['unique_patients'] or 'Not recoverable'} | {s['duplicates_exact']} | {' – '.join(s.get('date_range',[])) or 'Unavailable'} |")
    for f in reports:
        text += ['', '## ' + f['filename'], '', 'SHA-256: `' + f['sha256'] + '`']
        if 'tables' in f:
            text += ['', json.dumps(f['tables']), '', f['scope']]; continue
        for s in f['sheets']:
            text += ['', 'Sheet: '+s['name'], '', '| Variable | Missing n | Missing % | Invalid numeric n | Observed range |', '|---|---:|---:|---:|---|']
            for c in s['columns']:
                ranges = s['numeric_ranges'].get(c)
                text.append(f"| {c} | {s['missing_counts'][c]} | {s['missing_percent'][c]} | {s['invalid_numeric_counts'].get(c,'—')} | {str(ranges) if ranges else 'Categorical/date/identifier'} |")
            text += ['', 'Observation counts per patient: '+json.dumps(s.get('observations_per_patient',{})),
                     'Patient/date duplicate count: '+str(s.get('duplicate_patient_date','Unavailable')),
                     'Categorical counts: '+json.dumps(s['categorical_counts']),
                     'DOB source-type profile: '+json.dumps(s.get('dob_types',{})),
                     'Direct identifier fields detected: '+json.dumps(s['direct_identifier_columns'])]
    text += ['', '## Scope and quality decisions', '',
             '- This is predominantly maintenance hemodialysis monitoring, not an early-CKD/non-CKD population. No CKD-vs-non-CKD or G1→G5 progression model is trained.',
             '- Master demographics contain 45 subjects. Monthly files cover 42. The master outcome is 44 Alive / 1 Dead; this does not define a dated death or IDH outcome.',
             '- Canonical monthly input: `HeatMap/urr_data.xlsx` (391 rows). Exact duplicate rows are excluded with a journal; source-preserved invalid numeric cells become missing.',
             '- The alternate `cleaned_monthly_investigations_alive.xlsx` has 387 rows and different patient/month keys. It is audited, never appended as an independent cohort or substituted for invalid values.',
             '- Hb has a nonnumeric `SS` cell and post-HD creatinine a nonnumeric `S` cell. These are not zero values.',
             '- The supplied URR includes a negative value. URR is recomputed from positive pre-urea and nonnegative post-urea; post greater than pre is flagged and excluded from URR targets without clamping.',
             '- Urea units are absent from the source headers. Absolute urea and urea difference are excluded as predictors. Paired urea ratio assumes pre/post measurements share units; this remains an upstream verification limitation.',
             '- UA is labelled mg/dL but ranges 63–648. The unit may be incorrect; no guessed conversion is applied and this predictor is excluded.',
             '- Extreme valid measurements, including potassium 12.3 mmol/L, remain with review flags; plausibility boundaries are data checks, not treatment thresholds.',
             '- The original monthly cleaning notebook interpolates both directions within a patient before splitting. Raw pre-cleaning files referenced by notebooks are absent. Upstream future-value contamination cannot be ruled out; internal numbers are exploratory and cannot establish leakage-free clinical performance.',
             '- Dry-weight export has 763 rows, true/predicted dry weight, but no patient/date/current dry-weight field. Model-vs-post-weight comparison is descriptive only; next-period persistence and rolling-mean baselines cannot be reconstructed.',
             '- IDH notebooks reference absent raw session files; two MLP notebooks define target from SYS ≤90 and retain SYS in X (direct target leakage). Row-random splits also occur. Legacy accuracy/ROC claims are not reused.',
             '- Source-supplied pickle files are inventoried but never executed. No model provenance/split manifest verifies their metrics.',
             '- Patient subject identifiers are pseudonymized using HMAC-SHA256 with a separately held secret. DOB, renal diagnosis and outcome are excluded from model artifacts. No direct identifiers are present in fitted artifacts or feature manifests.',
             '- Remaining categorical inconsistencies include trailing spaces, diagnosis spelling variation and `?` unknown renal diagnosis. These categories/outcome are excluded from predictors; sex is audited but excluded to avoid joining DOB/clinical outcome proxies.',
             '- Missingness reported above describes supplied files, not the unavailable raw data. Zero reported missingness does not prove complete original measurements.',
             '', 'Detailed per-record decisions: `quality_flags.csv`. Files absent from the archive are not invented.']
    (out/'DATASET_AUDIT_REPORT.md').write_text('\n'.join(text)+'\n', encoding='utf-8')
