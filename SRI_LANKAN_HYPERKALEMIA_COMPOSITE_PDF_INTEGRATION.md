# GovCare V43 — Sri Lankan Hyperkalemia, Renal Deterioration Composite and CKD PDF Integration

## Scope

This update extends the existing Sri Lankan renal/hemodialysis research intelligence without replacing the current CKD clinical workflow, rule-based acute safety checks, authorization, clinician review, FHIR provenance, or the previously packaged Hb/URR models.

Three capabilities are added:

1. a research-only next-period hyperkalemia risk model trained on the packaged Sri Lankan longitudinal hemodialysis cohort;
2. a transparent renal-deterioration directional composite based on verified longitudinal observations; and
3. automatic inclusion of the four renal intelligence outputs — Hb/anemia, hyperkalemia, dialysis adequacy/URR, and renal deterioration — in the generated CKD PDF report with compact graphics.

## Hyperkalemia research model

Model identifier: `LK-RENAL-HYPERK-1.0`

Research target: the next chronological pre-dialysis potassium measurement is **>= 5.5 mmol/L** for the same patient, where the next observation occurs **14–62 days** after the current observation. The displayed horizon anchor is +30 days.

The packaged de-identified cohort contains 42 patients and 386 monthly rows. The fixed patient-disjoint split manifest is reused. Eligible target rows were:

- train: 23 patients, 192 observations, 40 positive events;
- validation: 9 patients, 72 observations, 22 positive events;
- held-out test: 9 patients, 79 observations, 12 positive events.

The installed research model is a pre-specified interpretable `LogisticRegression` pipeline using the same current/past-only longitudinal feature engine as the renal research package. Held-out test data were not used to select the model.

### Internal retrospective evaluation

| Metric | Validation | Held-out test |
|---|---:|---:|
| ROC-AUC | 0.7636 | 0.6617 |
| PR-AUC / Average Precision | 0.5248 | 0.2623 |
| Balanced accuracy | 0.5082 | 0.6337 |
| Recall / sensitivity | 0.1364 | 0.4167 |
| Specificity | 0.8800 | 0.8507 |
| F1 | 0.1935 | 0.3704 |
| Brier score | 0.2021 | 0.1840 |

The held-out discrimination is modest and calibration has not been established. The returned value is therefore labelled `RESEARCH_RISK_SCORE`, not a clinical probability. It is never used as an autonomous diagnosis, medication decision, dialysis prescription, or replacement for the existing current-potassium safety gate.

Governance remains:

- `validation_status = INTERNAL_RESEARCH_EVALUATION`
- `clinical_validation = NOT_COMPLETED`
- `dataset_permission_status = UNVERIFIED`
- `requires_clinician_review = true`

## Renal deterioration directional composite

The composite is deliberately not an ML disease-probability model. It compares the two latest valid measurements in six domains:

| Domain | Predefined adverse direction |
|---|---|
| Pre-dialysis creatinine | Rising |
| Pre-dialysis urea | Rising |
| Pre-dialysis potassium | Rising |
| Hemoglobin | Falling |
| Albumin | Falling |
| URR | Falling |

A change within 1% is treated as `STABLE` as a display heuristic. At least three evaluable domains are required. The score is the percentage of evaluable domains currently moving in the predefined adverse direction. Equal weights are used.

Status mapping:

- no adverse domains: `NO_ADVERSE_DIRECTION_DETECTED`
- some adverse domains with score <50%: `MIXED_TRAJECTORY`
- score >=50%: `MULTIDOMAIN_WORSENING_SIGNAL`
- fewer than three evaluable domains: `INSUFFICIENT_DATA`

The composite is explicitly labelled `HEURISTIC_DIRECTIONAL_COMPOSITE` and `NOT_CLINICALLY_VALIDATED`. It does not account for magnitude, reference ranges, dialysis timing, medications, acute illness or measurement uncertainty and must be interpreted by a clinician.

## CKD PDF integration

CKD PDF generation now loads verified renal observations and the latest persisted renal prediction snapshot per model. **PDF export does not rerun inference.**

When renal data exist, a dedicated page titled `CKD-RELATED CLINICAL RISKS & PREDICTIVE INTELLIGENCE` is automatically included. It contains:

- Anemia / Hb deterioration — measured Hb sparkline and stored next-period Hb forecast when available;
- Hyperkalemia monitoring — pre-HD potassium sparkline and stored research risk score when available;
- Dialysis adequacy / URR — URR sparkline, stored next-period URR forecast and formula context;
- Renal clinical deterioration — directional composite score bar and component directions;
- a workflow strip from Sri Lankan longitudinal data through validation, predictive intelligence, explainability and clinician review;
- research-governance warnings that the hyperkalemia risk score is not clinically calibrated and the composite is not a disease probability.

The detailed renal prediction appendix remains in the report and records model version, method, algorithm, research validation status, clinician review state, FHIR RiskAssessment reference, explanation factors and limitations.

## FHIR and audit behavior

The hyperkalemia research classifier is stored as a FHIR R4 `RiskAssessment` with a research-probability extension and provenance. The model probability is not stored as a measured `Observation`. Clinician review remains represented separately through the existing `ClinicalImpression` / provenance workflow.

Report generation reads persisted observations and prediction snapshots, records a report-overview audit event, and does not create a new model prediction merely because a PDF is exported.

## Reproducibility

Retrain the packaged research model from the included de-identified matrix and fixed patient split:

```bash
npm run renal:train:hyperkalemia
```

Equivalent direct command:

```bash
python ml-training/train_hyperkalemia_from_packaged.py
```

Artifacts are written to `ml-training/artifacts/hyperkalemia-risk/`; evaluation rows and association summaries are written to `ml-training/reports/hyperkalemia-risk/`.

## Clinical limitations

This feature is research/CDSS support only. The cohort is small, retrospective, maintenance-hemodialysis specific, single-country/single-source, and lacks important confounders such as medication exposure, dialysis prescription, diet, residual kidney function and acute illness. No prospective, external, clinical-impact or calibration validation has been completed.
