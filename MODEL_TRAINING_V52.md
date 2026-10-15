# GovCare V52 - executed renal model training

Run: `RENAL-PACKAGED-20261015T025637Z`. Training completed: 2026-10-15T02:56:37.473401+00:00.

The existing CKD clinical dashboard, patient/hospital authorization, clinical rules, PDF summary and ML endpoint contracts are retained. The supplied cleaned research cohort was used to refit 17 fixed candidate pipelines: eight numeric candidates, eight exploratory protocol classifiers and one hyperkalemia classifier. Numeric candidates also used training-only, three-fold grouped cross-validation.

This run reproduced the existing metrics and model-weight digests. It establishes reproducibility of this packaged cohort evaluation, **not a new independent test, improved accuracy, or clinical validation**.

## Data and evaluation

- 386 deduplicated monthly records from 42 pseudonymous patients; January-December 2024.
- Existing patient split retained: 24 train / 9 validation / 9 test patients before outcome filtering. Eligible training sets contain 23 patients.
- Hb: 190 train / 72 validation / 79 test pairs; URR: 191 / 70 / 79; hyperkalemia: 192 / 72 / 79.
- Original raw spreadsheets and the private source-key files are absent. Training used `ml-training/data/deidentified_monthly.csv` with round-trip float parsing and the saved patient split manifest.
- Features contain the same 84 current/past-only fields. Identifiers, future targets and future dates are excluded. All imputation/scaling is fitted only inside training folds.
- Fixed candidate settings, seeds and thresholds were reused. Validation metrics determine model selection; reported test results do not select candidates or change decision thresholds.
- Prior source preprocessing may already contain bidirectional interpolation. Current causal features cannot undo or exclude that upstream limitation.

## Training decisions

| Model | Validation result | Test result | Active application behavior |
| --- | --- | --- | --- |
| Hb / XGBoost candidate | MAE 1.0432 vs persistence 0.9792 g/dL; gate failed | Candidate MAE 0.9101 vs persistence 0.8709 g/dL | Existing persistence baseline retained; candidate stored for research |
| URR / XGBoost | MAE 9.3497 vs persistence 11.1114 percentage points; 15.85% validation improvement | MAE 11.0023 pp; RMSE 14.4578 pp; R² -0.0199 | Refit research artifact and metadata saved; clinical validation remains incomplete |
| Hyperkalemia / LogisticRegression | ROC-AUC 0.7636; Brier 0.2021 vs training-prevalence baseline 0.2216 | ROC-AUC 0.6617; PR-AUC 0.2623; Brier 0.1840 | Research score artifact retained/refitted; no clinical probability or autonomous diagnosis claim |

The numeric release gate remains: at least 5% validation MAE improvement over persistence and lower validation MAE than every listed simple baseline. Hyperkalemia passed the explicit research gate of validation AUC >=0.5 and better validation Brier than the training-prevalence constant. These gates support retrospective research use only.

### Material performance limits

URR has negative test R², and the patient-cluster 95% interval for persistence-minus-candidate MAE spans zero: [-1.966102616298798, 3.606023203161745]. This does not establish reliable superiority. Its candidate MAE 95% interval is [8.210893617116051, 14.158732931252842] pp, based on only nine test patients.

At the fixed 0.5 hyperkalemia threshold, sensitivity is **41.67%**, specificity 85.07%, precision 33.33%, F1 0.3704 and accuracy 78.48%. The confusion matrix (actual rows, predicted columns) is:

| Actual / predicted | Negative | Positive |
| --- | ---: | ---: |
| Negative | 57 | 10 |
| Positive | 7 | 5 |

Thus 7 of 12 positive test pairs are missed. An always-negative classifier would have 84.81% accuracy, so accuracy alone would be misleading. The fair training-prevalence constant has test Brier **0.1320**, better than the model's 0.1840. Discrimination is modest and probability calibration/generalizability are not established. Test prevalence fell from 30.56% in validation to 15.19%, which helps explain the evaluation difficulty. The test threshold was not adjusted after inspecting these results.

Existing current-potassium safety rules remain separate from the research score. The service still requires verified maintenance-HD context, fresh dated history, an adequate measurement set, clinician review and authenticated access; extreme current potassium suppresses inference.

## Targets that cannot be trained from this archive

| Target | Missing prerequisite | Retained behavior |
| --- | --- | --- |
| Cardiovascular event risk | Labeled cardiovascular outcomes, event dates and adequate covariates | Recorded-factor surveillance; no event probability |
| Future renal deterioration / AKI | Adjudicated outcome labels with dates and longitudinal clinical context | Existing measured creatinine/clinical monitoring rules |
| Dry weight | Valid patient/date-linked current and future dry-weight cohort | Explicit unavailable model status |
| Intradialytic hypotension | Valid session/event records; prior notebook target leakage remains unresolved | No unvalidated IDH model promotion |

Hb-outside-10-12 and URR-below-65 classifiers were refitted as exploratory protocol labels only. They are not served as disease probabilities. Missing ferritin/iron profile, PCV/RBC and confirmed diabetes status are not fabricated.

## Files

- `ml-training/train_packaged_models.py`: new reproducible training entry point, staged output and validation gates.
- `ml-training/runs/v52/`: immutable candidate artifacts, exact metrics, per-split predictions, SHAP plots, classifier curves and training summary.
- `ml-training/artifacts/urr-risk/` and `hyperkalemia-risk/`: research artifact/metadata updates; Hb active artifacts are unchanged.
- `verification/model-training-v52/`: test logs, hashes and preservation evidence.
- `CKD_CLINICAL_RISKS_DASHBOARD_V51.md`: retained dashboard and PDF instructions.

## Reproduce

Use Python 3.12+ in an isolated environment with the existing locked `ml-training/requirements.txt` (which includes `ML_Server/requirements.txt`). Activate that environment before running:

```bash
python -m pip install -r ml-training/requirements.txt
python ml-training/train_packaged_models.py --output ml-training/runs/my-new-run
```

Every run needs a new output directory. Inspect its summary, then use `--promote` on an authorized new run to copy passing research artifacts into the existing model directories. The npm alias is `npm run renal:train:packaged -- --output ml-training/runs/my-new-run`. No private pseudonym key is required for this packaged-cohort mode.

Restart the existing Django renal ML service to clear its artifact cache after replacing model files. Keep the current local `.env` and database configuration. Research rows are not imported as real EHR patient observations.

## Verification performed

- 16 preprocessing/training-gate tests passed.
- 17 Django authentication/inference tests passed, including serialization/hash loading, baseline behavior, research labels, safety gates, units and permission checks.
- Artifact SHA-256 values match their metadata; exact patient split, source dataset, serving contract and active Hb baseline are unchanged.
- All 470 recovered V51 frontend and Java source files are byte-identical, retaining the dashboard, PDF renderer and patient workflow.
- This verifies the local inference boundary. It is not a new live hospital database test or prospective clinical validation.

Package versions used:

```json
{
  "python": "3.12.14",
  "numpy": "2.3.5",
  "pandas": "2.2.3",
  "scikit-learn": "1.8.0",
  "xgboost": "3.4.1",
  "lightgbm": "4.7.0",
  "shap": "0.52.0",
  "joblib": "1.5.3",
  "scipy": "1.17.0",
  "matplotlib": "3.10.8",
  "Django": "6.1.2"
}
```
