# GovCare CKD Assessment Constraint Compatibility Fix (V39)

## Symptom
The CKD page returned:

`CKD assessment could not be completed. The database rejected a workflow value.`

This is the UI message for PostgreSQL SQLSTATE `23514` (CHECK constraint violation).

## Why V38 was not sufficient for every upgraded database
V38 repaired the strict V36 disease-probability JSON null-shape rule. Databases created or upgraded from different GovCare archives can still retain CHECK constraints with legacy/automatically-generated definitions and names. A generic 23514 after V38 therefore means the live database still rejected one of the CKD prediction row invariants.

## V39
`V39__normalize_ckd_assessment_constraints.sql` performs an additive, data-preserving normalization:

1. Removes legacy CHECK constraints on `ai_ckd_predictions` that govern probability, risk category, or the disease probability snapshot.
2. Re-adds a stable probability range constraint (`0..1`).
3. Re-adds the supported risk categories (`LOW`, `MODERATE`, `HIGH`, `URGENT_REVIEW`).
4. Replaces the brittle rich-JSON CHECK with `govcare_valid_disease_probability_snapshot_v2`, which preserves durable invariants but accepts both an omitted `probability` property and explicit JSON `null` for unavailable future models.
5. Leaves the application-level `DiseaseProbabilitySnapshot.Entry` validation in place for rich metadata safety.

No patient data, assessments, observations, FHIR resources, or model outputs are deleted or rewritten.

## Improved diagnostics
`GlobalExceptionHandler` now returns the PostgreSQL constraint name when one is available. This makes any remaining database mismatch visible in the UI/API response and in the Spring log.

## Expected startup
After extracting this package and starting the backend with Flyway enabled, the database should advance to V39. Look for Flyway startup output indicating the schema is at version 39.

## Optional read-only database verification
Run `database/diagnostics/ckd_assessment_schema_status.sql` in PostgreSQL. The expected active CKD checks include:

- `ck_ai_ckd_probability_range`
- `ck_ai_ckd_risk_category`
- `ck_ckd_disease_probability_snapshot_v2`

The Flyway history should show V36, V37, V38 and V39 as successful where those migrations were applicable to the database's history.
