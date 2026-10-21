# Five-year learned-model readiness

Current status: **INSUFFICIENT_LONG_TERM_OUTCOME_DATA**. All seven candidates are `BLOCKED_MISSING_ENDPOINT`; none was trained or evaluated on clinical five-year outcomes. Five-year metrics and learned probabilities are null. Software fixture fitting does not change these statuses.

The preserved monthly CSV has 386 measurements from 42 patients, from 1 January to 1 December 2024. Median and maximum within-patient observation spans are 335 days. These spans do not establish verified outcome ascertainment. The historical cohort concerns maintenance hemodialysis, whose patients are ineligible for a first-future-KRT initiation model. The CSV lacks dated kidney-failure/death events, verified follow-up end, censoring information and nondialysis eligibility. It also lacks age, sex, eGFR and urine ACR; serum albumin cannot supply ACR.

`ml-training/reports/cdss/survival/readiness.json` contains the precise missing fields and each candidate's blocker. `data_contracts/survival_endpoint.json` is the executable data-collection specification. `configs/tasks/survival.json` contains conservative engineering thresholds; they are not universal sample-size recommendations or clinical-validation criteria.

| Concept | Required definition |
|---|---|
| Population | Adults with stable, confirmed nondialysis CKD G3–G5; no prior maintenance dialysis or kidney transplant |
| Origin | One prespecified eligible clinic assessment per patient, with actual index date |
| Endpoint | First initiation of maintenance dialysis or kidney transplant, adjudicated as chronic KRT; exclude temporary acute dialysis |
| Evidence | Event flag, exact event date, event type and source reference; outcome collection must be independent of predictions |
| Predictors | Verified age/sex, eGFR and urine ACR with explicit units; all dated at/before origin and within the documented freshness policy |
| Follow-up | Last date under verified kidney-failure and mortality ascertainment; explicit completeness declarations for both |
| Censoring | Administrative end or loss to follow-up; a person censored early is not a known five-year non-event |
| Competing event | Death before first KRT; exact date. A death after KRT is not a competing first event |
| Horizons | Two years = 730.5 days; five years = 1826.25 days; only estimate/evaluate where development, validation and test follow-up/censoring support passes |

Collect all fields listed under `required_fields` in the JSON contract, retain their original source/evidence links, and provide a prespecified patient split manifest. One record per patient avoids overlapping index risk periods. Do not substitute historical master-file Alive/Dead categories without dates, imputed outcomes, repeated monthly predictions or KFRE estimates for observed outcomes.

Individual follow-up may be shorter than five years. Cohort events, patients at risk around the requested horizon, adequate censoring survival, and event support in each development fold/partition are nevertheless required. Model fitting is blocked before optional estimator imports if endpoint fields are absent. Grouped tuning cannot rescue a cohort lacking endpoints.

The default research estimand is **real-world cumulative incidence (CIF)**. The pipeline fits separate cause-specific kidney-failure and death models, then numerically integrates their hazards on a daily grid. Analytic constant-hazard software tests check this integration. This is a research implementation, not an externally validated adaptation or an approved clinical probability. The alternative `net` setting reports net kidney-failure risk under removal of competing death; it is never labelled real-world incidence. Results carry their estimand and cannot share a leaderboard across estimands.

Cox adapters estimate baseline survival. Forests return survival functions rather than mislabelling ranking scores as probabilities. XGBoost AFT uses event `[t,t]` and right-censoring `[t,+inf]` bounds and records its distribution/scale. LogisticHazard is a documented penalized pooled logistic implementation, with event-quantile time bins fitted only on fitting patients; censored partial intervals are omitted. It is non-neural. A neural configuration has an additional patient/event gate and is not silently substituted.

Evaluation reports IPCW Brier, time-dependent AUC and IPCW calibration bins at supported horizons. CIF metrics treat competing death as a known control, not as loss to follow-up. Cause-specific net IPCW concordance is explicitly labelled as a different ranking estimand. Patient resampling estimates exploratory uncertainty. Weak censoring support or too few cases produces an explicit unavailable metric/blocker. Validation selects by five-year Brier against an Aalen–Johansen baseline (KM for net) before test evaluation. Parametric extrapolation beyond follow-up is rejected.

No approved learned-outlook serving artifact exists. Django's authenticated readiness endpoint and Spring's packaged snapshot conclusion fail closed. Future deployment needs provenance/permission verification, formal sample-size planning, external calibration/evaluation, eligibility/units/version review and an explicitly reviewed serving integration. An offline trained artifact alone is not deployment authorization.

Published KFRE remains outside the dataset-trained model count. Its adult G3–G5 eligibility, quantified urine ACR, source dates, clinician confirmation and separate two-/five-year values are preserved. No annual/monthly event curve or future eGFR trajectory is fabricated.

Implementation references: [scikit-survival evaluation](https://scikit-survival.readthedocs.io/en/v0.27.0/user_guide/evaluating-survival-models.html), [Cox baseline survival](https://scikit-survival.readthedocs.io/en/stable/api/generated/sksurv.linear_model.CoxnetSurvivalAnalysis.html), [XGBoost AFT bounds/distribution](https://xgboost.readthedocs.io/en/latest/tutorials/aft_survival_analysis.html). These document mathematical interfaces, not local clinical validity.
