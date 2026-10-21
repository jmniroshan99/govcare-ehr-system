# Current packaged dataset audit

Measured file: `deidentified_monthly.csv`. SHA-256: `683e3ce49330922c91581e3f49896c611af0bc2da52abf1f9faea9567aff3da9`.

386 observations from 42 patients; 2024-01-01 to 2024-12-01.
Within-patient follow-up: median 335, maximum 335 days. This is observation span, not verified survival follow-up.
Exact duplicate rows: 0; duplicate patient/date rows: 0; conflicting patient/dates: 0.

| Column | Meaning | Physical unit | Missing |
|---|---|---|---:|
| patient_id | Pseudonymous patient grouping key | identifier | 0 |
| source_row | Historical workbook row reference; excluded predictor | row number | 0 |
| observed_at | Recorded monthly observation date; may be month anchor | ISO date | 0 |
| hb | Hemoglobin | g/dL | 1 |
| albumin | Serum albumin; NOT urine ACR | g/L | 0 |
| calcium | Serum calcium | mmol/L | 0 |
| sodium | Pre-HD serum sodium | mmol/L | 0 |
| potassium_pre | Pre-HD serum potassium | mmol/L | 0 |
| potassium_post | Post-HD serum potassium | mmol/L | 0 |
| creatinine_pre | Pre-HD serum creatinine | umol/L | 0 |
| creatinine_post | Post-HD serum creatinine | umol/L | 1 |
| urea_pre | Pre-HD blood urea; absolute predictor excluded | UNVERIFIED_SOURCE_UNIT | 0 |
| urea_post | Post-HD blood urea; absolute predictor excluded | UNVERIFIED_SOURCE_UNIT | 0 |
| uric_acid_source | Source UA; excluded due unit uncertainty | UNVERIFIED (source says mg/dL) | 0 |
| urr_source | Historical supplied URR; excluded predictor | % | 0 |
| urr | URR recomputed from paired urea; assumes matched pre/post units | % | 2 |

| Task | Eligible observations | Patients | Actual interval min–max (days) |
|---|---:|---:|---|
| hb | 341 | 41 | 29–62 |
| urr | 340 | 41 | 29–62 |
| hyperkalemia | 343 | 41 | 29–62 |

Hyperkalemia means next pre-HD potassium ≥5.5 mmol/L. Targets are the immediate next measurement within 14–62 days; 30 days is only a display anchor.

No first-kidney-failure event, event date, death date, index date, verified follow-up end, censoring reason or individual eligibility field is supplied. Maintenance dialysis is the historically documented cohort context; these patients cannot form a first-future-KRT initiation cohort.

Historical audit attributes data to user-supplied e19 renal-care repository/Teaching Hospital Peradeniya. Not independently verified.

**Permission UNVERIFIED; clinical validation NOT_COMPLETED.**

Historical code removes exact duplicates, converts invalid numerics to missing, recomputes URR and pseudonymizes patients.
Original raw precleaning files absent; historical bidirectional interpolation cannot be ruled out.
New features use only current and previous measurements; imputation/scaling fitted within training partitions.
No demographic joining, inferred ACR, synthetic event labels, interpolation or new cleaning of source CSV.

Serum albumin is not urine ACR. Source urea and UA units remain uncertain; neither absolute measurement is a predictor. Source data are preserved byte-for-byte. Derived records and hashes are retained with each run.
