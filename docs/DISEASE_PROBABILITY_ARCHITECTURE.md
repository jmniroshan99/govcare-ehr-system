# Related disease probability architecture

Date: 2026-10-06. Scope: the CKD assessment result at `/ai-cdss/ckd`, its existing saved PDF report and browser Print output.

## Clinical contract

The source has one running CKD classifier, `GOVCARE-CKD-LOGISTIC-1.0`. Its features, coefficients, scaling, output probability, confidence and risk thresholds are unchanged. The related adapters registered by V35 are not installed. An association with CKD, an abnormal laboratory value, a measured safety finding or confidence is not a substitute for a patient-level disease probability.

| Outcome | Current source | Display in this release |
| --- | --- | --- |
| Current CKD model | Existing CKD classifier result | Model probability, distinct from confidence |
| CKD progression | Registered progression adapter, not installed | Data unavailable |
| Kidney failure | Registered KFRE adapter, not installed | Data unavailable |
| Acute kidney injury | Registered future-risk adapter, not installed | Data unavailable; current laboratory safety rules remain separate |
| Cardiovascular disease | Registered cardiovascular adapter, not installed | Data unavailable |
| Hyperkalemia | Registered future-risk adapter, not installed | Data unavailable |
| Anemia | Registered future-risk adapter, not installed | Data unavailable |

No new model, calculator, diagnosis, treatment recommendation or future eGFR projection is introduced. The existing Predictive Clinical Intelligence view, measured trends, care-gap reviews and renal safety behavior remain intact.

## Assessment snapshot

`DiseaseProbabilitySnapshot.capture` uses the existing CKD probability and one bounded registry query for the six related keys. The response and the database insert use the same immutable snapshot. There is no separate patient-history request, per-card API call or polling loop.

The optional API property is `diseaseProbabilities`:

| Field | Meaning |
| --- | --- |
| `schemaVersion` | `1` |
| `capturedAt` | Assessment-time UTC timestamp; null only in the derived legacy fallback |
| `entries` | Current CKD model plus six related outcomes; unique supported keys |
| Entry `key`, `label` | Outcome identity and display label |
| Entry `status` | `AVAILABLE`, `NOT_AVAILABLE`, `NOT_CAPTURED`, `INSUFFICIENT_DATA` or `SUPPRESSED` |
| Entry `probability` | A model-produced fraction in `[0,1]`; null for unavailable/suppressed/insufficient/uncaptured outputs |
| Entry `modelVersion`, `horizon` | Model identity and explicit time horizon; unavailable/uncaptured states are named |
| Entry `validationStatus` | `EXISTING_MODEL` for the preserved CKD model, `NOT_INSTALLED` for current related adapters; a future available related output requires `VALIDATED` |
| Entry `reason`, `purpose` | Why the output is available/unavailable and what the model is intended to estimate |

The current probability is not claimed to be a locally calibrated future disease risk. Future-related outputs are accepted by the contract only with a valid fraction, model version, horizon and validation metadata. **This release has no runtime that produces those related outputs.** Merely changing registry status cannot activate an adapter or synthesize percentages.

## Database and API changes

V36 adds `ai_ckd_predictions.disease_probability_snapshot jsonb`, initially null for existing assessments. A check function validates the snapshot shape, supported/unique outcomes, finite-range numeric outputs, unavailable nulls, model metadata and agreement with the existing CKD score (allowing the column's six-decimal numeric rounding). An update trigger prevents replacing the snapshot, including backfilling old nulls. A new assessment is required to capture new results.

Existing migrations are unchanged. No hospitals, patient records, accounts or roles are seeded by V36. No new dashboard metric, patient list endpoint or clinical-data browser storage is introduced.

| Existing endpoint | Additive change |
| --- | --- |
| `POST /api/ai-cdss/ckd/predict` | Captures and returns `diseaseProbabilities`; request shape unchanged |
| `GET /api/ai-cdss/ckd/patients/{id}/predictions` | Returns the stored snapshot as an additional property; old rows retain null |
| Existing internal assessment lookup | Returns the stored snapshot as an additional property |
| `POST /api/ai-cdss/ckd/assessments/{id}/report` | Renders the saved snapshot; does not recompute clinical risks or consult today's registry |
| Existing report download/list endpoints | Routes, patient scope and storage unchanged |

The client validates the new property before rendering. Missing, malformed, duplicate, version-mismatched or score-mismatched snapshots fail closed to a legacy availability state. Valid existing CKD scores are retained. Null is never converted to zero, an invalid value is never clamped into a plausible percentage, and confidence is never repurposed as probability.

## UI and printing

`DiseaseProbabilityPanel` uses existing healthcare tokens and buttons. It provides a clear current-model summary, six related-outcome cards, outcome-specific status, accessible meters only for available predictions, time horizons and native keyboard-accessible model disclosures. All colors are semantic variables. Grid columns: one below 768 px, two from 768 px, three from 1280 px. Long metadata wraps and cards use `min-width: 0`. Entry motion respects reduced-motion preferences.

Screen filters affect only the card list. The separate print table always renders all seven saved entries. Theme generation now creates a scoped light palette for `.ckd-result-print`; paper output is independent of the display theme. No controls or screen-only filters are printed.

`CkdAssessmentReportService` adds a **RELATED DISEASE PROBABILITIES** table to the existing report. It includes outcome, percentage/unavailable state, horizon, model status/reason and captured time. The PDF table repeats its header and supports split rows/page flow. Existing patient details, coding, inputs, factors, recommendations, clinician-review section, storage, checksum, patient-document visibility and FHIR DocumentReference are preserved.

Earlier assessments generate reports with their existing CKD score and related `NOT_CAPTURED` states. Their historical model availability is not silently replaced with today's registry. Fresh reports from one assessment continue to use that assessment's snapshot.

PDF export has an in-flight guard, visible loading/error state, AbortSignal propagation and a patient/assessment association check before download. Result components are keyed by prediction ID; changing patient, auth context or assessment disposes old work. Aborting a client request does not promise to cancel a transaction already accepted by the server.

## Permissions and privacy

| Operation | Existing boundary retained |
| --- | --- |
| Select patient | Authorized patient directory; hospital network access only where previously authorized |
| Assess CKD | Existing clinical write scope for the selected patient |
| Read assessment/history | Existing clinical patient and hospital scope |
| Generate saved PDF | Existing assessment scope and clinical write check |
| Download saved PDF | Report identity resolves the patient; clinical scope is checked before storage access |
| Browser Print | Current authorized result in memory |
| Predictive clinical intelligence tab | Existing clinical-role and permission restrictions |

No role gains a permission through this change. Server `ClinicalPatientAccess`, frontend `roleAccess`, RBAC and authorization-context source are byte-identical to the preceding ZIP. No patient details are placed in localStorage. Unavailable predictions do not become FHIR RiskAssessment predictions or confirmed FHIR Conditions; the original CKD/FHIR behavior is retained.

## Adding a real related-disease adapter later

A future adapter must produce a reviewed, population-eligible model output using verified inputs and its validated time horizon. Capture its exact version, fraction, eligibility/data/safety outcome and validation evidence during the assessment transaction. Persist that output in the same snapshot rather than calculating it at report time. Do not enable a percentage simply by editing the model registry. A new outcome or schema version requires a reviewed contract/migration change.

Testing and clinical validation are different activities. The included synthetic boundary fixtures test formatting, null handling and consistency; they are not clinical validation of any disease model.
