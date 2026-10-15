# GovCare predictive intelligence: source audit and implementation contract

Audit baseline: the supplied V39 source archive, before the V40 implementation. This report supersedes previous completion claims for the forecasting module. It is a software audit, not a clinical validation report.

## Project identification and existing architecture

GovCare is a multi-hospital EHR for registration, outpatient consultations, ward/admission/bed workflows, laboratory and radiology requests, pharmacy, documents, clinical coding, reporting and governed clinical decision support. Clinicians and authorized network Super Admin users access CKD patient workspaces; other administrative roles do not gain clinical access merely by seeing a dashboard.

| Layer | Existing implementation and boundaries |
|---|---|
| Web application | React 19, TypeScript 6, Vite 8, Tailwind 4, React Router 7. Shared AppRouter/AppShell, permission guards, theme tokens, cards, buttons, dialogs and patient selector. Recharts renders clinical history; motion respects reduced-motion preferences. |
| CKD workflow | `/ai-cdss/ckd` hosts `CkdClinicalWorkspace`, one authorized patient selector and tabs for assessment/intelligence. The dedicated predictive route redirects into this workspace with a validated patient UUID. Assessment drafts must survive tab changes; patient changes must clear results and cancel outstanding reads. |
| Client services | `apiClient` handles JWT and API errors; `predictiveIntelligenceService.ts` owns longitudinal API requests. Existing local prediction and report services remain separate. |
| API | Java 21, Spring Boot 3.5.3, Spring Security, Bean Validation, JPA/Hibernate and named-parameter JDBC through `SqlSupport`. Controllers delegate to domain/services; Flyway controls schema changes. |
| Security | JWT filter reloads active users, permissions and credential version. `ClinicalPatientAccess` checks stored patient ownership and clinician relationship, then scopes queries to the patient's hospital. Network access is an explicit Super Admin exception. Frontend patient/hospital/role values are not authorization. |
| Clinical data | PostgreSQL patients, visits, consultations, admissions, lab_requests/results, prescriptions/items, clinical_reports/observations and HAPI FHIR R4 resources. Predictive reads merge dated FINAL observations, verified numeric lab results and final/amended/corrected FHIR observations. Upload time must never replace measurement time. |
| CKD assessment | Embedded `GOVCARE-CKD-LOGISTIC-1.0` is a cross-sectional classifier with fixed coefficients. It is not a future disease model, has no Sri Lankan longitudinal validation in this archive, and its score must remain separate from new trend forecasts. |
| Predictive foundation | `ClinicalIntelligenceEngine`, `CkdProgressionForecastService`, a KFRE placeholder, `PredictiveIntelligenceService`, and existing secured controller routes. Seven-metric completeness and eight-metric history exist. |
| Persistence | Migrations V35–V39 provide registry, immutable prediction snapshots, recommendation state, append-only clinician feedback, audit events and verified measurement provenance. Composite hospital/patient keys protect ownership. No duplicate canonical prediction tables are needed. |
| Reporting/FHIR | OpenPDF builds CKD reports and stores documents/generated_reports. HAPI R4/resources persist observations, ClinicalImpressions, RiskAssessments, DocumentReferences and Provenance. Existing forecast RiskAssessment lacks structured projected values. |
| Python service | Token-protected FastAPI placeholder returns NOT_INSTALLED and null probabilities. It is optional and must not be required for Java trend/rule operation. |
| Deployment | npm/Vite frontend, Java/Maven Spring API and PostgreSQL. Existing Windows/Linux launchers, environment examples, backup script and Flyway startup remain the deployment path. No replacement application or cloud deployment is planned. |

## Verified gaps and root causes

1. **Safety bypass:** forecast calculator only checks POSSIBLE_AKI, ignoring `forecastSuppressed` from stale renal results, conflicts, missing age and insufficient history. Risk availability independently uses a point count. The three decisions can disagree.
2. **Statistical overconfidence:** small-sample regression uses 1.96 rather than a Student-t critical value; perfect fits produce a zero-width purported prediction interval; clipped point estimates distort intervals. Forecast dates and baseline are not explicit.
3. **Registry bypass:** runtime availability is not enforced before executing the installed trend engine. A retired model can still calculate.
4. **Incomplete monitoring:** potassium/hemoglobin checks need source reference limits, do not gate stale results, omit requested categories and medication context, and can report a reassuring status from inadequate evidence.
5. **Missing clinical features:** glucose, urea/BUN, weight/BMI and lipids are absent. Provenance/unit/patient mismatch exclusions need visible reasons. Conflicting active source results must not quietly fall back to older values.
6. **Audit/provenance gaps:** trend, quality and individual risk reads are not audited; unavailable/safety outcomes have incomplete version provenance; no operational model metrics exist. Review reason codes and separate clinical notes are missing.
7. **Report gap:** current CKD PDF contains the assessment and related-model availability, but no real longitudinal history, forecasting chart, quality or predictive clinician review appendix.
8. **FHIR gap:** projected output is text-only; method, version, projected range, target date, input/snapshot reference and review state need explicit representation without creating laboratory Observations.
9. **UI contract gap:** minimal string statuses do not expose required inputs, category, freshness, evidence, local validation and model reference. The chart's rectangular endpoint range is misleading. Loading/selection cancellation patterns should be retained.

## Target architecture and invariants

Stored patient identity → authorized longitudinal retrieval → unit/date/provenance quality checks → shared renal safety gate → registry-controlled trend/rule/adapter calculation → immutable provenance-bearing snapshot → explanation/recommendations → explicit clinician review → audited PDF/FHIR.

- No fabricated probability or synthetic patient value in runtime code. KFRE, cardiovascular and future hospitalization adapters remain NOT_INSTALLED until a reviewed implementation is supplied.
- Future statistical projections are labelled projected and cannot create a future CKD diagnosis or a real lab Observation. Two dated eGFR values can support only low-reliability point extrapolation after chronic-history/safety checks; intervals require residual information.
- All renal safety gates apply server-side. Adult eligibility, unresolved renal data, freshness, abrupt change and bounded retrieval limits fail closed. Missing medication/context is visible and never interpreted as absence of exposure.
- Rule category thresholds are sourced or clearly identified as conservative review policy. They are not calibrated disease probabilities. Missing/stale results never become LOW/NORMAL.
- Preserve all existing V1–V39 migration bytes, records, patient workflow, permissions, routes and immutable history. Add V40 only. Do not auto-prescribe, stop medication or issue referrals.

## Ordered implementation plan

1. Add V40 registry/provenance/monitoring/review fields without data deletion.
2. Extend longitudinal metrics/quality and implement one authoritative renal gate.
3. Correct 3/6/12-month projection mathematics and expose model availability through adapters; implement potassium/anemia review rules.
4. Connect strict backend/client contracts and update the existing dashboard/components.
5. Extend reason-coded clinician feedback with optimistic concurrency/idempotency.
6. Integrate structured FHIR, current-history PDF appendix and audit/monitoring.
7. Verify regression, calculation edge cases, hospital access, migrations (clean and V39 upgrade), PDF extraction/rendering, client build, Java tests/package and FastAPI authentication/unavailability. Distinguish test fixtures from clinical validation.

## Acceptance evidence required

Fresh commands and results will be recorded in `PREDICTIVE_V40_VERIFICATION.md`, including failures or environment limitations. Test fixtures prove software behavior only; neither a successful build nor synthetic scenarios establish clinical accuracy, calibration, deployment readiness or Sri Lankan validation.
