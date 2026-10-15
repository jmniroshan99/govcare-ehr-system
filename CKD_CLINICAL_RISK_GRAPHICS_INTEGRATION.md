# CKD Clinical Risk Graphics Integration

## Scope

This revision applies the CKD-related clinical-risk infographic concept to the existing GovCare Predictive Clinical Intelligence workflow without replacing the current Spring Boot, PostgreSQL, FHIR, authorization or Sri Lankan renal ML architecture.

## Implemented UI

The patient-scoped Sri Lankan renal panel now contains a responsive visual map with four research/monitoring modules:

- Anemia / Hb deterioration — measured Hb sparkline plus governed next-period Hb research forecast when available.
- Hyperkalemia monitoring — measured pre-dialysis potassium sparkline and direction-of-change display; no invented future probability.
- Dialysis adequacy / URR — measured/server-derived URR sparkline and governed next-period URR research forecast when available.
- Renal clinical deterioration — a composite direction-of-change view across creatinine, urea, potassium, hemoglobin, albumin and URR. It deliberately does not declare a diagnosis.

The centre of the map preserves the backend-provided current renal status, including G5D only when the existing service has verified chronic maintenance hemodialysis.

A five-step research workflow is displayed below the visual map: Sri Lankan longitudinal data -> clinical data validation -> predictive intelligence -> explainable AI -> clinician review.

## Conceptual Infographic

The generated infographic is packaged under `public/research/ckd-risk-predictive-intelligence-dashboard.png` and is available through a disclosure control. It is explicitly labelled as conceptual and not patient-specific so its illustrative charts cannot be confused with live patient measurements.

## Safety and Governance

- No fabricated disease probabilities were added.
- Existing Hb and URR predictions remain governed research estimates with clinician review.
- Hyperkalemia in this visual is a monitoring/trend view, not an autonomous diagnosis.
- The renal deterioration card reports data coverage and direction-of-change only.
- Existing clinical-validation and dataset-permission warnings are retained.
- Existing patient authorization and hospital scoping are unchanged.

## Validation

`npm run test:renal:graphics` verifies the four modules, patient-data bindings, non-diagnostic language, packaged infographic and responsive layout rules.

Full frontend dependency installation may require network access to npm. If dependencies are not already installed, run `npm install` before `npm run build`.
