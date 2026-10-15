# Model and prediction-horizon audit — V54

V54 adds a separate published risk equation and clinical workflow. It performs no new model training. Existing weights, research evaluations, training data, serving contracts and supported horizons are preserved byte for byte from V53.

## Existing methods

| Method / target | Population and follow-up | Supported output | Validation evidence / limitation |
| --- | --- | --- | --- |
| `GOVCARE-CKD-LOGISTIC-1.0` in `CkdPredictionService` | Existing snapshot classifier with 17 supplied clinical features; no time-to-event follow-up demonstrated in this package | Existing CKD class score at the assessment, without a defined future event horizon | Fixed coefficients and existing interpretation retained. No five-year calibration or outcome validation inferred from a classification score. |
| eGFR-based CKD G-category coding assistance | Recorded current eGFR | Current category suggestion; chronicity/diagnosis requires clinician confirmation | Clinical coding rule, not a future-stage model or a diagnosis from one measurement. |
| Hb `LK-RENAL-HB-1.0` | Supplied Sri Lankan maintenance-HD research cohort; January–December 2024 | Next observed Hb 14–62 days later; +30-day display anchor. Active serving method is persistence baseline. | XGBoost research candidate failed validation improvement gate; test candidate MAE 0.9101 vs persistence 0.8709 g/dL. No five-year anemia outcome model. |
| URR `LK-RENAL-URR-1.0` | Same maintenance-HD cohort and next-observation design | Next observed URR 14–62 days later; +30-day display anchor, research XGBoost | Test MAE 11.0023 percentage points and R² −0.0199. Internal retrospective research only; superiority and clinical coverage not established. |
| Hyperkalemia `LK-RENAL-HYPERK-1.0` | Same maintenance-HD cohort | Research score for next pre-HD K ≥5.5 mmol/L within 14–62 days; +30-day display anchor | Logistic regression; test ROC-AUC 0.6617, sensitivity 41.67%, Brier 0.1840. Calibration/generalizability not established. Current-potassium safety rules remain separate. |
| Exploratory Hb-outside-10–12 / URR-below-65 classifiers | Same next-observation pairs | Protocol-label research experiments, not served disease probabilities | Candidate artifacts/reports retained; no claim of five-year complication risk. |
| `trend-linear-2.0` eGFR trajectory | Patient's own ≥2 valid observations spanning ≥90 days; safety gates apply | Separate statistical OLS extrapolation at 3, 6 or 12 months only | No clinically validated outcome model. Approximate Student-t 95% prediction interval only when calculable and within guardrails. No 60-month extension. |
| Anemia, potassium, AKI/creatinine, URR, renal trajectory and cardiovascular monitoring | Verified patient records and dated measurements | Current rule-based review, paired-session calculations, observed change or factor surveillance | Neither confirmed disease diagnoses nor future-event probabilities. Existing sources, contraindications and missing-data gates retained. |
| Dry weight `LK-RENAL-DRYWEIGHT-1.0` | Legacy export has 763 rows but lacks valid patient/date-linked current/future dry weight | `INSUFFICIENT_DATA_FOR_RELIABLE_MODEL` | Legacy descriptive errors cannot substitute for grouped outcome validation. |
| Intradialytic hypotension | Raw sessions, patient-linked event timing and adequate labels absent | No promoted outcome model | Prior notebooks include target leakage and row-random splitting; metrics not reused as valid performance. |
| Cardiovascular, hospitalization, future AKI and other Python predictive adapters | No reviewed outcome-specific artifact installed in the scaffold | Explicit unavailable responses | No invented event probabilities. The scaffold remains separate from the installed short-term Django renal service. |
| Automatic generic KFRE adapter | No clinician confirmation contract on that legacy route | Remains inactive and directs users to 5-Year CKD Outlook | V54 activates the equation only in the explicit, patient-authorized confirmation workflow below. |

The cleaned monthly cohort has 386 deduplicated rows from 42 pseudonymous patients. Patient partitions remain 24/9/9 before target filtering; eligible training data contain 23 patients. There are only 79 test pairs for each installed numeric/hyperkalemia target. No five-year events, censoring data, dialysis-initiation follow-up or survival outcomes are supplied. Upstream interpolation cannot be ruled out because the original precleaning inputs are absent. Clinical validation is not completed; dataset research-use permission remains unverified as already recorded in the existing metadata.

Exact preserved artifacts and metadata are enumerated by SHA-256 in `verification/ckd-outlook-v54/model-horizon-audit.json`. Existing detailed evaluation remains in `MODEL_TRAINING_V52.md` and `ml-training/runs/v52`.

## Added four-variable KFRE

Version: `KFRE4-NNA-2016-GOVCARE-1.0`.

With age in years, male = 1/female = 0 for the clinician-confirmed equation variable, eGFR in mL/min/1.73 m² and quantified urine ACR in mg/g:

```text
L = -0.2201 × (age/10 − 7.036)
    +0.2467 × (male − 0.5642)
    −0.5567 × (eGFR/5 − 7.222)
    +0.4510 × (ln(ACR) − 5.137)

2-year risk = 1 − 0.9832 ^ exp(L)
5-year risk = 1 − 0.9365 ^ exp(L)
```

This selects the published non-North American recalibration, not a hospital-specific Sri Lankan calibration. The Java implementation uses `-expm1(log(S0) × exp(L))` for numerical stability. Fractions in [0,1] are stored; percentages are presentation only. ACR mg/mmol is multiplied by 8.84. Zero/censored ACR is not replaced by an arbitrary positive value. Urine ACR and serum albumin are different inputs.

Outcome: kidney failure requiring dialysis or transplantation **within** two/five years. It does not specify the date of dialysis, future eGFR, stage transition, life expectancy, cardiovascular outcome or any individual certainty. Two- and five-year probabilities are separate published outputs; annual rates are not interpolated. Established maintenance dialysis switches to follow-up planning with no kidney-failure-initiation estimate. There is no installed long-term dialysis-outcome model.

Eligibility and source policy are documented in `CKD_FIVE_YEAR_OUTLOOK_V54.md`. The 90-day freshness and 30-day input alignment checks are GovCare policies, not claimed as original equation coefficients or population-validation criteria.

### Independent arithmetic reference cases

These expected results came from executing the authors' reference calculator arithmetic separately from the Java implementation. Synthetic software cases are not a clinical validation cohort. The test also checks mg/g versus mg/mmol equivalence, invalid values, population boundaries and both supported horizons.

| Equation variable | Age | eGFR | ACR mg/g | 2-year probability | 5-year probability |
| --- | ---: | ---: | ---: | ---: | ---: |
| Male | 65 | 25 | 300 | 0.09011469495037816 | 0.30627437347101205 |
| Female | 45 | 45 | 30 | 0.004366566051095977 | 0.016802516319022964 |
| Male | 70 | 15 | 1000 | 0.35809252027149474 | 0.8203227801893902 |
| Female | 18 | 59 | 1 | 0.0003597140970682533 | 0.0013921688073675886 |
| Female | 80 | 10 | 5000 | 0.6329567467873181 | 0.9793702405233475 |

Primary references checked for this implementation:

- Authors' calculator and arithmetic: https://kidneyfailurerisk.com/ and https://kidneyfailurerisk.com/assets/js/kidney-app.js
- Published supplementary equation details: https://doi.org/10.1371/journal.pmed.1002955.s008 (parent article https://journals.plos.org/plosmedicine/article?id=10.1371/journal.pmed.1002955).
- KDIGO 2024 risk-assessment practice points 2.2.1–2.2.3: https://kdigo.org/wp-content/uploads/2024/03/KDIGO-2024-CKD-Guideline.pdf

Published multinational validation is not GovCare population validation. Local calibration, discrimination, competing mortality and clinical impact remain untested. No individual interval is fabricated and the result is not labeled AI confidence.

## Requirements for a genuine five-year trained model

Use a separately governed, outcome-specific dataset with patient identifiers suitable for grouping, a pre-specified index date, eligibility at that date, predictor timestamps at/before the index, adjudicated event definitions and event dates, last follow-up, loss to follow-up and competing death. Include dialysis modality/transplant context and relevant treatment/clinical information. Merely having five calendar years of observations does not establish five-year labels.

Define prediction estimands before training. Prevent future leakage through patient-separated development/validation and training-only preprocessing. Evaluate actual two/five-year discrimination and calibration with appropriate censoring and competing-risk methods; report follow-up distributions, event counts, uncertainty and subgroup performance. Reserve temporal/external validation and assess calibration locally before clinical use.

Current extension points are the existing predictive adapter interface and model registry. They stay unavailable until a suitable artifact, input contract, population/horizon documentation and validation evidence exist. V54 creates neither a fabricated five-year training run nor a recursive monthly forecast.
