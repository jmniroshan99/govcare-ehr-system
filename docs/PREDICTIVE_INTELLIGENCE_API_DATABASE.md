# API and database changes

## APIs

All new endpoints use the existing Spring JWT authentication and patient/hospital boundary. UUIDs are required; client hospital/role values never authorize access. Responses use `Cache-Control: no-store`.

| Method | Endpoint | Contract |
| --- | --- | --- |
| GET | `/api/ai-cdss/ckd/patients/{patientId}/intelligence` | Aggregate patient identity, trends/windows/observations, quality, categories, renal safety, reviewed findings, model capabilities and latest clinical activity. |
| POST | `/api/ai-cdss/ckd/patients/{patientId}/observations` | Record a verified measurement. Body: requestId, metric, value, unit, observedAt, referenceLow?, referenceHigh?, sourceNote, sourceVerified=true. Requires assigned clinical write access. |
| POST | `/api/ai-cdss/ckd/patients/{patientId}/forecast` | Body: requestId and horizonMonths (3/6/12). Records an unavailable/suppressed/insufficient capability check; no projected values. Requires clinical read access. |
| POST | `/api/ai-cdss/ckd/recommendations/{recommendationId}/review` | Body: patientId, requestId, expectedVersion, evidenceFingerprint, action, reason, modifiedRecommendation?. Requires assigned clinical write access. |

The aggregate replaces frontend fan-out for timeline/trends/risks/explanations/care gaps; separate section endpoints are not added in this slice. Existing patient-directory, CKD prediction, report, FHIR and other API contracts remain supported.

## Validation and conflict behavior

- Supported measurements: egfr, creatinine, acr, systolic, diastolic, hba1c, potassium, hemoglobin.
- Units must be safely normalizable; value/time plausibility is checked by the same engine used for the timeline. Measurement time is explicit and cannot be future-dated.
- A source note of 1–2000 characters and source confirmation are required for verified entry. No record is generated from missing fields or default numeric values.
- Every review requires a reason of 1–2000 characters. Modify requires 1–4000 characters of revised text; other actions cannot carry revised recommendations.
- Changed evidence or a stale review version returns 409 and requires refreshing the current findings. No client-supplied arbitrary recommendation text can replace the server's evidence identity.
- Request UUID retries return a saved matching result; reusing a request UUID for a different payload is rejected. Database uniqueness also prevents duplicate journals.
- Unauthorized patients return the existing 403/404 boundary without exposing their clinical records.
- Missing measurements/categories/probabilities are omitted/null according to the existing Jackson configuration. The frontend handles both as unavailable, never substituting zero.

## Additive V35 migration

| New table | Purpose |
| --- | --- |
| `predictive_model_registry` | Disabled model/version/purpose/input-contract/validation metadata. |
| `predictive_recommendations` | Evidence-specific finding snapshot and versioned latest review state. |
| `predictive_clinician_feedback` | Immutable action, reason, actor, request UUID, evidence fingerprint and review version. |
| `predictive_prediction_snapshots` | Immutable inputs, quality, safety, model/version/horizon and unavailable output state. |
| `predictive_observation_entries` | Immutable source-verification journal and idempotent request link to clinical observations. |
| `predictive_audit_events` | Immutable patient-scoped reads and explicit AI/clinical workspace actions. |

Composite foreign keys bind hospital/patient and recommendation/observation identity. New indexes support patient-scoped observation, feedback, prediction and audit access. Triggers reject UPDATE/DELETE on feedback, forecast snapshots, observation journals and audit history. Latest recommendation state is mutable only through versioned service updates; its event history is immutable.

V35 does not delete/rewrite existing clinical rows, backfill dates, seed patients/hospitals or activate medical models. Hard deletion of records linked to the new immutable clinical history is restricted by these foreign keys; application soft-delete workflows remain unchanged.

## Existing persistence changes

`CkdPredictionService` now retains a usable explicit `sources[feature].clinicalDate` when recording a new manual measurement. No change to coefficients, imputation rules, scoring or stage business logic is made.

`ClinicalPersistenceService` retains explicit observation `clinicalDate` metadata when available and constructs new FHIR Observation JSON through the existing serializer, including that date. Ambiguous/date-only/future metadata remains undated. No existing record receives an invented timestamp.

FHIR resources from new reviews/results are stored in the existing `fhir_resource` table with the same authorized patient/hospital. Failure to store required audit/provenance rolls back the Spring transaction. Full live Spring/FHIR transaction testing remains pending because Maven dependencies could not be resolved in this environment.
