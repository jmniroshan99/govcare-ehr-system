# CKD Assessment Database Constraint Fix

## Symptom
The CKD page accepted the clinical inputs but returned:

`CKD assessment could not be completed. The database rejected a workflow value.`

PostgreSQL SQLSTATE `23514` means a CHECK constraint rejected an inserted row.

## Root cause
`V36__ckd_disease_probability_snapshots.sql` requires every unavailable related-disease entry to contain a JSON `probability: null` value.

The Spring application globally uses:

`spring.jackson.default-property-inclusion: non_null`

Therefore Jackson omitted the `probability` property for `NOT_AVAILABLE` entries. The in-memory snapshot was valid, but the database function interpreted the missing property as violating the V36 CHECK constraint `ck_ckd_disease_probability_snapshot`.

## Fix
1. `DiseaseProbabilitySnapshot.Entry` now explicitly uses `@JsonInclude(ALWAYS)` so null probability is preserved in the assessment snapshot.
2. Flyway migration `V38__repair_ckd_disease_probability_snapshot_null_shape.sql` safely repairs existing databases and accepts either an omitted or explicit-null unavailable probability while remaining strict for AVAILABLE model outputs.
3. `GlobalExceptionHandler` now logs the PostgreSQL constraint name and gives a specific safe message when this CKD snapshot constraint fails.
4. Added a regression test for NON_NULL Jackson configuration.

## Existing data
No existing clinical data is deleted or rewritten.

## Run
Start the project normally. Flyway should apply V38 automatically:

`run-windows.bat`

If Flyway is disabled, enable it and restart the API before rerunning the CKD assessment.
