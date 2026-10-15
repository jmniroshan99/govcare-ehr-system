# GovCare Predictive Clinical Intelligence — pre-implementation audit

Audit date: 2026-10-05. Baseline: current patient-registration/doctor-workspace source. This audit precedes implementation. No existing database or production installation is modified by this source delivery.

## Current architecture

- React 19 + TypeScript + Vite; existing lazy routes, React Query, Recharts, lucide icons, semantic dark/light tokens under `src/theme`.
- Java 21 + Spring Boot 3.5.3; Spring Security JWT, PostgreSQL, Flyway, HAPI FHIR R4. Existing API interfaces remain supported.
- 136 Java production sources, four Java test sources, 59 frontend pages; migrations currently end at V34.
- Existing patient selection uses `AuthorizedPatientSelect` and real UUIDs through the authorized directory API. Super Admin has an explicitly authorized cross-hospital directory. Assigned clinicians are restricted by `ClinicalPatientAccess` relationships and server-side permission checks.
- CKD: `CkdPredictionService` implements the embedded GOVCARE-CKD-LOGISTIC-1.0 equation, stores assessment/input/factor snapshots and emits RiskAssessment/ClinicalImpression resources. Its coefficient provenance, calibration and external evaluation are absent from the delivered source. The separate FastAPI predictor is a placeholder. Neither will be described as a validated future-risk model.

## Existing data and reusable boundaries

| Existing surface | Reuse / limitation |
| --- | --- |
| `clinical_observations` | Numeric values, original units, reference limits, effective_at, source and override metadata. Many legacy records omit effective_at; upload time is not specimen time. |
| `clinical_reports` | Report/document provenance and specimen/result dates; historical values must use an explicit clinical date. |
| `fhir_resource` | Patient-associated R4 JSONB; normalize supported Observation quantities and BP components. Preserve codes, resource IDs and original units. |
| `lab_results` / `lab_requests` | Structured or numeric results; select finalized/verified results, use sample/result clinical timestamps. Never interpret unstructured text as numeric truth. |
| `consultations`, `prescriptions`, `prescription_items`, `admissions` | Real encounter/medication context and timeline; a prescription is not proof of current ingestion. |
| `ai_ckd_predictions`, `ai_assessments` | Existing history remains intact; experimental current-classifier outputs are not future probabilities. |
| `ClinicalPatientAccess`, `GovCarePrincipal` | Authoritative patient/hospital authorization; no client-supplied tenant can grant access. |
| theme tokens, authorized selector, chart tooltip, Button | Reuse and retain keyboard support and light/dark contrast. |

## Gaps and root causes

1. No longitudinal trend aggregation, canonical-unit quality gate or observation-date validation.
2. The current stage helper uses a single eGFR; it does not independently establish chronicity or albuminuria.
3. No reviewed registry for horizon-specific models or calibrated uncertainty. Future CKD, KFRE and cardiovascular probabilities cannot be invented.
4. No deterministic AKI signal gate ahead of long-term forecasts.
5. No persistent recommendation fingerprints, versioned clinician feedback or non-repeating review status.
6. Current AI UI emphasizes model inputs and PDFs rather than a scannable longitudinal review.
7. Existing general audit writer catches failures; this module needs fail-closed transactional audit for AI actions.

## Target architecture and acceptance contract

Authorized patient UUID → scoped PostgreSQL/FHIR retrieval → unit/date normalization → deduplicated observations → backend trends → chronicity-aware G/A categories + renal safety gate → deterministic review findings and care gaps → registered risk-model capability state → clinician review → append-only feedback/audit + FHIR Provenance/ClinicalImpression.

New route: `/ai-cdss/ckd/predictive-intelligence`. Default view: overview, historical trends, six independently labeled risk-capability cards, provenance, care gaps and clinical timeline. Charts are lazy-loaded. A single aggregated GET supplies the view; theme, chart metric and historical date-window changes do not refetch it.

### Implemented slice (post-audit delivery annotation)

- Phase 1 foundation: real clinical history; normalized trends; G1–G5/A1–A3 measurement categories; chronicity evidence, stale/missing/conflicting data; KDIGO-based creatinine change signals; care-gap findings; audited Accept/Modify/Dismiss/Defer; module-specific model registry and immutable review events.
- Minimal verified-result entry: explicit measurement time and source confirmation, retained original value/units, immutable source journal and FHIR Observation/Provenance. No default measurement or date is inferred.
- Safe Phase 2/3 seams: forecast-run requests with 3/6/12 month horizons, input snapshots, model/version, data-quality state and explicit `NOT_AVAILABLE`/`SUPPRESSED`/`INSUFFICIENT_DATA` outcomes. No unsupported risk score, projected eGFR, confidence or uncertainty interval is fabricated. No medical model is activated by a migration.
- Clearly distinguish historical measured values, deterministic rules, and unavailable predictive models. A future clinician-governed, externally evaluated model adapter is required to enable probabilistic forecasting.

### Not claimed by this slice

Training a medical ML model, clinical validation, all population analytics, full SMART/FHIR conformance, automatic prescribing/referrals, and replacing global authentication are outside the UI/foundation delivery. They remain documented extensions; an attractive interface does not establish clinical validity.

## Planned write surfaces

New: predictive domain engines/DTOs/service/controller, V35 additive migration, frontend service/page/lazy chart/scoped stylesheet, domain/security/migration/browser tests, architecture/build/test/modified-file documentation.

Modify: route/route policy/preloader; Clinical Intelligence sidebar/search links; CKD page integration; clinical-date persistence; package test scripts. No broad theme rewrite or existing API removal.

## Migration and security implications

V35 adds model, forecast-run, review recommendation, feedback, verified-observation journal and audit tables and indexes. It does not rewrite/delete old clinical data, backfill made-up dates, seed patients, or activate medical models. Foreign keys tie new records to the stored patient/hospital. Normal endpoints cannot mutate feedback/audit rows. Database triggers block UPDATE/DELETE on these append-only tables. Optimistic locking protects concurrent clinician reviews; changed evidence generates a new fingerprint and requires new review. All reads and writes call existing assigned-clinician/authorized-network checks. Reading does not create orders or clinical diagnoses. FHIR write-back occurs for documented clinician review or an explicitly verified measurement and retains provenance.

## Verification plan

Pure Java/domain checks: units, implausibility, unknown/future dates, duplicates/conflicts, regression slope, G/A boundaries, chronicity, stale measurements, AKI thresholds, care gaps and unavailable forecasts. Security tests: own tenant/assigned patient, unrelated patient, other hospital and allowed network Super Admin. PGlite migration checks: constraints, idempotent indexes, append-only protections. Frontend build and existing role/theme/dashboard/registration tests. Browser checks: dark/light at 375/768/1366/1920; keyboard/dialog focus, patient-switch cancellation, failures and unavailable states. Record actual Maven clean-test outcome separately from syntax/domain checks.

Clinical rules references: KDIGO 2024 CKD guideline, https://kdigo.org/wp-content/uploads/2024/03/KDIGO-2024-CKD-Guideline.pdf ; KDIGO 2012 published AKI criteria, https://kdigo.org/wp-content/uploads/2016/10/KDIGO-2012-AKI-Guideline-English.pdf . The 2026 AKI public-review draft is not substituted for a finalized policy. Local clinical governance must approve deployment rules and freshness policy.
