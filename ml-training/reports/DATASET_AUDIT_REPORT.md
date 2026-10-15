# Dataset audit

Source: user-supplied e19 renal-care repository. Its README attributes the cohort to Teaching Hospital Peradeniya; independent source verification and secondary-use permission are not supplied.

**DATASET_PERMISSION_STATUS = UNVERIFIED**. No clinical or prospective validation is established.

## File and sheet inventory

| File | Sheet | Rows | Patients | Exact duplicates | Period |
|---|---|---:|---:|---:|---|
| HeatMap/cleaned_monthly_investigations_alive.xlsx | Sheet1 | 387 | 42 | 0 | 2024-01-01 – 2024-12-01 |
| HeatMap/urr_data.xlsx | Sheet1 | 391 | 42 | 5 | 2024-01-01 – 2024-12-01 |
| ML_Model/code/Hb_analysis/model_evaluation_metrics.xlsx | Sheet1 | 3 | Not recoverable | 0 | Unavailable |
| ML_Model/code/dry_weight_predict/dry_weight_predictions.xlsx | Sheet1 | 763 | Not recoverable | 0 | Unavailable |
| Software_Component/backend/data-import/patient-data.xlsx | Patient Data | 45 | 45 | 0 | Unavailable |

## HeatMap/cleaned_monthly_investigations_alive.xlsx

SHA-256: `1ee30c3abba60bef5a6eb6a3383432370386dba1da15fab2cabfc428d46b5990`

Sheet: Sheet1

| Variable | Missing n | Missing % | Invalid numeric n | Observed range |
|---|---:|---:|---:|---|
| Subject_ID | 0 | 0.0 | — | Categorical/date/identifier |
| Month | 0 | 0.0 | — | Categorical/date/identifier |
| Albumin (g/L) | 0 | 0.0 | 0 | {'min': 21.0, 'max': 53.0} |
| BU - post HD | 0 | 0.0 | 0 | {'min': 0.02, 'max': 20.81} |
| BU - pre HD | 0 | 0.0 | 0 | {'min': 3.32, 'max': 129.0} |
| Hb (g/dL) | 0 | 0.0 | 0 | {'min': 6.3, 'max': 17.8} |
| S Ca (mmol/L) | 0 | 0.0 | 0 | {'min': 1.08, 'max': 2.98} |
| SCR- post HD (µmol/L) | 0 | 0.0 | 0 | {'min': 11.1, 'max': 925.0} |
| SCR- pre HD (µmol/L) | 0 | 0.0 | 0 | {'min': 279.0, 'max': 1460.0} |
| Serum K Post-HD (mmol/L) | 0 | 0.0 | 0 | {'min': 2.1, 'max': 5.5} |
| Serum K Pre-HD (mmol/L) | 0 | 0.0 | 0 | {'min': 2.14, 'max': 12.3} |
| Serum Na Pre-HD (mmol/L) | 0 | 0.0 | 0 | {'min': 115.8, 'max': 149.0} |
| UA (mg/dL) | 0 | 0.0 | 0 | {'min': 63.0, 'max': 648.0} |

Observation counts per patient: {"count": 42.0, "mean": 9.214285714285714, "std": 3.6794466331409676, "min": 1.0, "25%": 7.0, "50%": 11.0, "75%": 12.0, "max": 12.0}
Patient/date duplicate count: 0
Categorical counts: {}
DOB source-type profile: {}
Direct identifier fields detected: []

## HeatMap/urr_data.xlsx

SHA-256: `92a69fe7a438b25670a27898ebba3761d9fa7852e01823193eec0634ef4cd0f8`

Sheet: Sheet1

| Variable | Missing n | Missing % | Invalid numeric n | Observed range |
|---|---:|---:|---:|---|
| Subject_ID | 0 | 0.0 | — | Categorical/date/identifier |
| Month | 0 | 0.0 | — | Categorical/date/identifier |
| Albumin (g/L) | 0 | 0.0 | 0 | {'min': 21.0, 'max': 53.0} |
| BU - post HD | 0 | 0.0 | 0 | {'min': 0.02, 'max': 20.81} |
| BU - pre HD | 0 | 0.0 | 0 | {'min': 3.32, 'max': 129.0} |
| Hb (g/dL) | 0 | 0.0 | 1 | {'min': 6.3, 'max': 17.8} |
| S Ca (mmol/L) | 0 | 0.0 | 0 | {'min': 1.08, 'max': 2.98} |
| SCR- post HD (µmol/L) | 0 | 0.0 | 1 | {'min': 11.1, 'max': 925.0} |
| SCR- pre HD (µmol/L) | 0 | 0.0 | 0 | {'min': 279.0, 'max': 1460.0} |
| Serum K Post-HD (mmol/L) | 0 | 0.0 | 0 | {'min': 2.1, 'max': 5.5} |
| Serum K Pre-HD (mmol/L) | 0 | 0.0 | 0 | {'min': 2.14, 'max': 12.3} |
| Serum Na Pre-HD (mmol/L) | 0 | 0.0 | 0 | {'min': 115.8, 'max': 149.0} |
| UA (mg/dL) | 0 | 0.0 | 0 | {'min': 63.0, 'max': 648.0} |
| URR (%) | 0 | 0.0 | 0 | {'min': -233.433734939759, 'max': 99.85} |

Observation counts per patient: {"count": 42.0, "mean": 9.30952380952381, "std": 3.6525173092733225, "min": 2.0, "25%": 7.25, "50%": 11.0, "75%": 12.0, "max": 13.0}
Patient/date duplicate count: 5
Categorical counts: {}
DOB source-type profile: {}
Direct identifier fields detected: []

## ML_Model/code/Hb_analysis/model_evaluation_metrics.xlsx

SHA-256: `02fd8e8773b84af3d3088ddf1e32edf2f1beb42156f3e8b8ef94d8d22a69284c`

Sheet: Sheet1

| Variable | Missing n | Missing % | Invalid numeric n | Observed range |
|---|---:|---:|---:|---|
| Model | 0 | 0.0 | — | Categorical/date/identifier |
| Accuracy(Macro) | 0 | 0.0 | 0 | {'min': 0.59, 'max': 0.66} |
| Precision(Macro) | 0 | 0.0 | 0 | {'min': 0.59, 'max': 0.66} |
| Recall(Macro) | 0 | 0.0 | 0 | {'min': 0.59, 'max': 0.66} |
| F1(Macro) | 0 | 0.0 | 0 | {'min': 0.59, 'max': 0.66} |
| ROC-AUC | 0 | 0.0 | 0 | {'min': 0.54, 'max': 0.7} |
| Recall (Class 0) | 0 | 0.0 | 0 | {'min': 0.6, 'max': 0.67} |
| Recall (Class 1) | 0 | 0.0 | 0 | {'min': 0.58, 'max': 0.71} |

Observation counts per patient: {}
Patient/date duplicate count: Unavailable
Categorical counts: {"Model": {"XGB + LGBM Ensemble": 1, "BalancedBagging + LGBM": 1, "EasyEnsembleClassifier": 1}}
DOB source-type profile: {}
Direct identifier fields detected: []

## ML_Model/code/dry_weight_predict/dry_weight_predictions.xlsx

SHA-256: `2d66049730e2ce549689958ea0d645ce4171f71ab5f79932fa9f9a8fed399f10`

Sheet: Sheet1

| Variable | Missing n | Missing % | Invalid numeric n | Observed range |
|---|---:|---:|---:|---|
| AP (mmHg) | 0 | 0.0 | 0 | {'min': -274.0, 'max': 132.0} |
| AUF (ml) | 0 | 0.0 | 0 | {'min': 100.0, 'max': 5700.0} |
| BFR (ml/min) | 0 | 0.0 | 0 | {'min': 20.0, 'max': 370.0} |
| HD duration (h) | 0 | 0.0 | 0 | {'min': 1.0, 'max': 5.0} |
| PUF (ml) | 0 | 0.0 | 0 | {'min': 200.0, 'max': 6000.0} |
| Post HD weight (kg) | 0 | 0.0 | 0 | {'min': 30.0, 'max': 102.5} |
| Pre HD weight (kg) | 0 | 0.0 | 0 | {'min': 30.5, 'max': 107.2} |
| TMP (mmHg) | 0 | 0.0 | 0 | {'min': 4.0, 'max': 250.0} |
| VP (mmHg) | 0 | 0.0 | 0 | {'min': 14.0, 'max': 265.0} |
| Weight gain (kg) | 0 | 0.0 | 0 | {'min': -3.4, 'max': 5.7} |
| SYS (mmHg) | 0 | 0.0 | 0 | {'min': 84.0, 'max': 273.0} |
| DIA (mmHg) | 0 | 0.0 | 0 | {'min': 48.0, 'max': 140.0} |
| True_Dry_Weight | 0 | 0.0 | 0 | {'min': 30.0, 'max': 101.5} |
| Predicted_Dry_Weight | 0 | 0.0 | 0 | {'min': 30.25800000000001, 'max': 101.485} |

Observation counts per patient: {}
Patient/date duplicate count: Unavailable
Categorical counts: {}
DOB source-type profile: {}
Direct identifier fields detected: []

## ML_Server/db.sqlite3

SHA-256: `4f7314827745279b129a824582aaf76ea039dea2e6e24b97a430c69dd52d7f40`

[{"name": "django_migrations", "rows": 18}, {"name": "sqlite_sequence", "rows": 6}, {"name": "auth_group_permissions", "rows": 0}, {"name": "auth_user_groups", "rows": 0}, {"name": "auth_user_user_permissions", "rows": 0}, {"name": "django_admin_log", "rows": 0}, {"name": "django_content_type", "rows": 6}, {"name": "auth_permission", "rows": 24}, {"name": "auth_group", "rows": 0}, {"name": "auth_user", "rows": 0}, {"name": "django_session", "rows": 0}]

Empty Django service/authentication database; not clinical training data

## Software_Component/backend/data-import/patient-data.xlsx

SHA-256: `e35abb02e87231c1ed78bec8ffc72d7b92a96bbb61c51b6c6e388be9c0ef16f0`

Sheet: Patient Data

| Variable | Missing n | Missing % | Invalid numeric n | Observed range |
|---|---:|---:|---:|---|
| Subject ID | 0 | 0.0 | — | Categorical/date/identifier |
| DOB | 3 | 6.667 | — | Categorical/date/identifier |
| Sex | 0 | 0.0 | — | Categorical/date/identifier |
| Primary renal diagnosis | 0 | 0.0 | — | Categorical/date/identifier |
| Dialysis access | 0 | 0.0 | — | Categorical/date/identifier |
| Outcome | 0 | 0.0 | — | Categorical/date/identifier |

Observation counts per patient: {"count": 45.0, "mean": 1.0, "std": 0.0, "min": 1.0, "25%": 1.0, "50%": 1.0, "75%": 1.0, "max": 1.0}
Patient/date duplicate count: Unavailable
Categorical counts: {"Sex": {"M": 29, "F": 16}, "Primary renal diagnosis": {"Diabetic kidney disease": 13, "?": 8, "ESKD secondary to DKD": 3, "FSGS": 2, "Crescentic Glomerular Nephritis": 2, "Diabetic kidney disease secondary to type 2 diabetes mellitus": 1, "CIN+B/L Dysplastic Kidney": 1, "Diabetic kidney disease, Hypertension": 1, "ANCA negative crescentic GN-ESKD": 1, "Hypertension ": 1, "Secondary to PCKD": 1, "ESRF secondary to diabetic kidney disease": 1, "FSGS (Background chronic hypertension)": 1, "Obstructive uropathy": 1, "Neurogenic bladder": 1, "Diabetic kidney dieseae, Hypertension": 1, "Anti GBM disease": 1, "Obstructive uropathy+urosepsis": 1, "CKD": 1, "Chronic interstitial nephritis": 1, "Hypertension+Obstructive uropathy": 1, "Diabetic kidney disease + Hypertension": 1}, "Dialysis access": {"Fistula(AVF)": 25, "Permcath": 13, "IJC, Fistula(AVF)": 3, "IJC": 3, "Permcath, Fistula(AVF)": 1}, "Outcome": {"Alive": 44, "Dead": 1}}
DOB source-type profile: {"str": 21, "datetime": 21, "missing": 3}
Direct identifier fields detected: []

## Scope and quality decisions

- This is predominantly maintenance hemodialysis monitoring, not an early-CKD/non-CKD population. No CKD-vs-non-CKD or G1→G5 progression model is trained.
- Master demographics contain 45 subjects. Monthly files cover 42. The master outcome is 44 Alive / 1 Dead; this does not define a dated death or IDH outcome.
- Canonical monthly input: `HeatMap/urr_data.xlsx` (391 rows). Exact duplicate rows are excluded with a journal; source-preserved invalid numeric cells become missing.
- The alternate `cleaned_monthly_investigations_alive.xlsx` has 387 rows and different patient/month keys. It is audited, never appended as an independent cohort or substituted for invalid values.
- Hb has a nonnumeric `SS` cell and post-HD creatinine a nonnumeric `S` cell. These are not zero values.
- The supplied URR includes a negative value. URR is recomputed from positive pre-urea and nonnegative post-urea; post greater than pre is flagged and excluded from URR targets without clamping.
- Urea units are absent from the source headers. Absolute urea and urea difference are excluded as predictors. Paired urea ratio assumes pre/post measurements share units; this remains an upstream verification limitation.
- UA is labelled mg/dL but ranges 63–648. The unit may be incorrect; no guessed conversion is applied and this predictor is excluded.
- Extreme valid measurements, including potassium 12.3 mmol/L, remain with review flags; plausibility boundaries are data checks, not treatment thresholds.
- The original monthly cleaning notebook interpolates both directions within a patient before splitting. Raw pre-cleaning files referenced by notebooks are absent. Upstream future-value contamination cannot be ruled out; internal numbers are exploratory and cannot establish leakage-free clinical performance.
- Dry-weight export has 763 rows, true/predicted dry weight, but no patient/date/current dry-weight field. Model-vs-post-weight comparison is descriptive only; next-period persistence and rolling-mean baselines cannot be reconstructed.
- IDH notebooks reference absent raw session files; two MLP notebooks define target from SYS ≤90 and retain SYS in X (direct target leakage). Row-random splits also occur. Legacy accuracy/ROC claims are not reused.
- Source-supplied pickle files are inventoried but never executed. No model provenance/split manifest verifies their metrics.
- Patient subject identifiers are pseudonymized using HMAC-SHA256 with a separately held secret. DOB, renal diagnosis and outcome are excluded from model artifacts. No direct identifiers are present in fitted artifacts or feature manifests.
- Remaining categorical inconsistencies include trailing spaces, diagnosis spelling variation and `?` unknown renal diagnosis. These categories/outcome are excluded from predictors; sex is audited but excluded to avoid joining DOB/clinical outcome proxies.
- Missingness reported above describes supplied files, not the unavailable raw data. Zero reported missingness does not prove complete original measurements.

Detailed per-record decisions: `quality_flags.csv`. Files absent from the archive are not invented.
