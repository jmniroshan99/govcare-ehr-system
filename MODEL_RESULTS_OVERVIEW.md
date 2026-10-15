> V52: the packaged-cohort refit reproduced these metrics. See [MODEL_TRAINING_V52.md](MODEL_TRAINING_V52.md) for the executed run, validation gates, endpoint tests and unchanged clinical limitations.

# Executed model results — GovCare V41

All values below come from newly executed evaluation of the supplied data. No original notebook metric is promoted as new validation. Clinical validation is NOT_COMPLETED; source permission and source precleaning provenance are UNVERIFIED. Test partitions contain nine real source subjects per target, not operational application fixtures.

## Cohort and partitions

Canonical cohort: **42 patients / 386 deduplicated monthly rows**, January–December 2024. Original URR spreadsheet: 391 rows including five exact duplicates. Master demographic file: 45 subjects; alternate monthly spreadsheet: 387 rows / 42 patients, audited separately rather than concatenated.

| Cohort | Train patients | Validation patients | Test patients | Total |
|---|---:|---:|---:|---:|
| Before target filtering | 24 | 9 | 9 | 42 |
| Hb eligible targets | 23 | 9 | 9 | 41 |
| URR eligible targets | 23 | 9 | 9 | 41 |

Patient-disjoint split uses GroupShuffleSplit seeds 42/43; no patient overlaps. Three-fold GroupKFold evaluates training patients only. Features have 84 ordered fields derived causally from nine measured predictors. The label is the immediate next same-patient observation within 14–62 days. No future interpolation is performed by the new pipeline. One training subject has no eligible next-observation pair.

## Numeric forecasting comparisons

| Target | Algorithm | Validation MAE | Test MAE | Test RMSE | Test R² | Test median absolute error |
|---|---|---:|---:|---:|---:|---:|
| HB | Ridge | 1.1283 | 0.9450 | 1.2343 | 0.5791 | 0.7766 |
| HB | RandomForest | 1.0494 | 0.9102 | 1.1476 | 0.6362 | 0.7450 |
| HB | XGBoost | 1.0432 | 0.9101 | 1.1492 | 0.6351 | 0.6754 |
| HB | LightGBM | 1.0832 | 0.9031 | 1.1488 | 0.6354 | 0.7488 |
| HB | Persistence baseline | 0.9792 | 0.8709 | 1.1164 | 0.6556 | 0.7000 |
| HB | RollingMean3 baseline | 1.1260 | 1.0561 | 1.3613 | 0.4880 | 0.7667 |
| HB | TrainingMean baseline | 1.6320 | 1.6871 | 2.0012 | -0.1065 | 1.6589 |
| URR | Ridge | 9.9061 | 11.3089 | 14.4905 | -0.0245 | 8.3465 |
| URR | RandomForest | 9.4037 | 10.5725 | 13.8605 | 0.0626 | 8.1479 |
| URR | XGBoost | 9.3497 | 11.0023 | 14.4578 | -0.0199 | 9.3629 |
| URR | LightGBM | 9.6103 | 11.6847 | 15.0798 | -0.1095 | 11.4418 |
| URR | Persistence baseline | 11.1114 | 12.1215 | 16.9661 | -0.4045 | 8.8601 |
| URR | RollingMean3 baseline | 11.6289 | 10.5283 | 14.8853 | -0.0811 | 6.7648 |
| URR | TrainingMean baseline | 9.6423 | 11.4336 | 14.3566 | -0.0057 | 8.8136 |

Hb errors are g/dL; URR errors are percentage points. Baselines are last observation carried forward (persistence), causal rolling mean of three observations, and training-outcome mean.

**Selection:** XGBoost had the lowest validation MAE for both targets. The rule was fixed before evaluation: at least 5% validation MAE improvement over persistence and better than rolling/training-mean baselines. Test data were not used to choose algorithms or thresholds. Hb failed the gate, so the UI/API serves **PERSISTENCE_BASELINE**, not an accepted learned Hb model. URR passed the validation gate and is served only as **RESEARCH_MODEL**. Its held-out R² is negative and its MAE remains about 11 percentage points; superiority/generalizability is not established.

## Uncertainty and temporal experiment

| Target | Candidate test MAE patient bootstrap 95% CI | Baseline minus candidate MAE 95% CI | Temporal candidate MAE | Temporal persistence MAE |
|---|---|---|---:|---:|
| HB | [0.6990, 1.1558] | [-0.1201, 0.0547] | 0.9011 | 0.9481 |
| URR | [8.2109, 14.1587] | [-1.9661, 3.6060] | 9.0345 | 10.4407 |

Patient-cluster bootstrap uses 500 resamples of the nine held-out patients. Both improvement intervals include zero. They are exploratory small-cohort intervals, not statistical proof of benefit. The displayed forecast band is the empirical 95th percentile of absolute validation residuals, not a clinically calibrated patient interval.

Temporal evaluation trains on outcomes through 2024-09-01 and tests feature origins from 2024-09-01 onward. This is a separate same-cohort temporal experiment with expected patient overlap, not an external/patient-disjoint evaluation. Hb has 234 train / 107 test rows; URR 232 / 108.

## Exploratory classification comparisons

Labels are the original notebook conventions: next Hb outside 10–12 g/dL and next URR below 65%. These cutoffs lack a supplied approved clinical research protocol. The classifiers are evaluated and saved for research, **not served as risk probabilities**. Selection uses validation Brier score: Hb RandomForest, URR XGBoost.

| Target | Algorithm | Test accuracy | Balanced accuracy | Precision | Recall | Specificity | F1 | ROC-AUC | PR-AUC (AP) | Brier | Confusion matrix [TN FP; FN TP] |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| HB | LogisticRegression | 0.5316 | 0.4354 | 0.6333 | 0.7170 | 0.1538 | 0.6726 | 0.5174 | 0.7200 | 0.2656 | [4 22; 15 38] |
| HB | RandomForest | 0.6709 | 0.5588 | 0.7015 | 0.8868 | 0.2308 | 0.7833 | 0.5668 | 0.7358 | 0.2278 | [6 20; 6 47] |
| HB | XGBoost | 0.6582 | 0.5396 | 0.6912 | 0.8868 | 0.1923 | 0.7769 | 0.5936 | 0.7495 | 0.2226 | [5 21; 6 47] |
| HB | LightGBM | 0.6835 | 0.5780 | 0.7121 | 0.8868 | 0.2692 | 0.7899 | 0.6350 | 0.7594 | 0.2137 | [7 19; 6 47] |
| HB | TrainingPrevalence | 0.6709 | 0.5000 | 0.6709 | 1.0000 | 0.0000 | 0.8030 | 0.5000 | 0.6709 | 0.2244 | [0 26; 0 53] |
| URR | LogisticRegression | 0.6835 | 0.5462 | 0.4167 | 0.2174 | 0.8750 | 0.2857 | 0.6281 | 0.3990 | 0.2193 | [49 7; 18 5] |
| URR | RandomForest | 0.7468 | 0.5780 | 0.8000 | 0.1739 | 0.9821 | 0.2857 | 0.6444 | 0.5371 | 0.1920 | [55 1; 19 4] |
| URR | XGBoost | 0.7089 | 0.5128 | 0.5000 | 0.0435 | 0.9821 | 0.0800 | 0.5932 | 0.4278 | 0.2003 | [55 1; 22 1] |
| URR | LightGBM | 0.7089 | 0.5000 | 0.0000 | 0.0000 | 1.0000 | 0.0000 | 0.6188 | 0.4653 | 0.1988 | [56 0; 23 0] |
| URR | TrainingPrevalence | 0.7089 | 0.5000 | 0.0000 | 0.0000 | 1.0000 | 0.0000 | 0.5000 | 0.2911 | 0.2072 | [56 0; 23 0] |

Confusion matrices, positive/negative counts, validation metrics and calibration curves are included in target metrics JSON and research plots. Sensitivity equals the displayed Recall. The prevalence baseline also supplies the majority-class prediction at a 0.5 decision cutoff. A high overall accuracy with zero recall in an imbalanced outcome is explicitly retained in the table.

## Explainability

Global SHAP plots and top-feature CSVs explain each validation-selected numeric research candidate. Hb associations are dominated by current Hb (mean |SHAP| 0.7504), recent maximum Hb (0.3534), Hb slope (0.1493), and recent mean Hb (0.1397). URR associations are led by current URR (2.7332), sodium slope (1.1868), recent maximum post-HD creatinine (0.7196), and recent mean albumin (0.6611). These are model associations, not causes or clinical treatment instructions.

URR inference returns actual individual SHAP contributions. The served Hb baseline returns a measured current Hb rule, a null contribution, and an explicit baseline explanation. SHAP is not falsely attached to the served Hb baseline.

## Dry weight and IDH

Dry-weight export contains 763 rows but lacks patient IDs, dates, and current dry weight. Legacy-export MAE 0.4228 kg / RMSE 0.9756 kg / R² 0.9951 is descriptive only. Post-HD weight proxy MAE 0.4471 / RMSE 0.9294 / R² 0.9956 is not next-period persistence. Genuine next-current/rolling/LOCF baselines and grouped validation cannot be reconstructed; no dry-weight ML model is accepted.

IDH source session/event data are missing. The original MLP notebooks derive the target from SYS ≤90 while leaving SYS in predictors, a direct target leak, and use row-level splits. Positive/negative event counts cannot be recovered reliably. Status: **INSUFFICIENT_DATA_FOR_RELIABLE_MODEL**.

## Material limitations

- Original preprocessing notebooks contain bidirectional interpolation before splitting; the precleaning raw files are absent. The new causal pipeline cannot establish whether supplied values already used future information.
- One small retrospective hemodialysis cohort with a nine-patient target test set; no independent hospital, prospective or clinical impact validation.
- Absolute source urea units are absent and uric-acid values conflict with the stated unit. They are excluded from predictors. Paired-source URR assumes equal pre/post units; this is explicitly unverified.
- Demographic DOB, diagnosis and survival outcome are audited but excluded from prediction artifacts. No claim of early CKD classification or stage progression is supported.
- Clinical validation is NOT_COMPLETED; dataset secondary-use permission is UNVERIFIED. Do not promote these outputs as clinically validated.

## Artifact and report locations

`ml-training/artifacts/{hb-risk,urr-risk}` contains newly fitted complete imputer/scaler/model pipelines, separate preprocessing pipelines, exploratory classifier pipelines, source/artifact hashes, versions, feature contracts, selection rules and test metrics. `dry-weight/metadata.json` records its unavailable status.

`ml-training/reproduce_packaged_evaluation.py` independently refits all 16 candidate pipelines from the included pseudonymous CSV and fixed patient manifest. It reproduced their saved validation/test metrics with the pinned versions and round-trip float parsing; the private key is not required.

`ml-training/reports` contains the audit, pseudonymous patient manifests/cohort summary, missingness and quality flags, feature definitions, all comparisons, patient-wise test errors, temporal metrics, ROC/PR/calibration/SHAP plots and the full training/leakage reports.


## Hyperkalemia next-period research model (V43)

The V43 extension adds `LK-RENAL-HYPERK-1.0`, a pre-specified LogisticRegression research model for the next same-patient pre-dialysis potassium measurement >=5.5 mmol/L within 14–62 days. It reuses the packaged patient-disjoint split manifest and current/past-only longitudinal feature engine. Eligible observations were 192 train / 72 validation / 79 held-out test, from 23 / 9 / 9 patients respectively.

| Metric | Validation | Held-out test |
|---|---:|---:|
| ROC-AUC | 0.7636 | 0.6617 |
| PR-AUC (average precision) | 0.5248 | 0.2623 |
| Balanced accuracy | 0.5082 | 0.6337 |
| Recall / sensitivity | 0.1364 | 0.4167 |
| Specificity | 0.8800 | 0.8507 |
| F1 | 0.1935 | 0.3704 |
| Brier score | 0.2021 | 0.1840 |

Held-out performance is modest and calibration is not established. The API therefore returns `prediction=null` and exposes the bounded value only as `RESEARCH_RISK_SCORE`. It is not a clinically calibrated probability and does not replace the current-potassium safety gate or clinician review. Clinical validation remains `NOT_COMPLETED`; dataset secondary-use permission remains `UNVERIFIED`.

The complete pipeline and metadata are in `ml-training/artifacts/hyperkalemia-risk/`; row-level split predictions and association summaries are in `ml-training/reports/hyperkalemia-risk/`.
