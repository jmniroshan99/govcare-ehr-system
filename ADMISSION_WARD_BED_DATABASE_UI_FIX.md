# Admission ward/bed database + UI integration fix

This build fixes the admission screen state where only `W-01` with `Total 1 / 0 available` was returned.

## Database

- Flyway V18 runs even when V16/V17 are already in schema history.
- Creates the inpatient department reference rows used by the ward selector.
- Upserts W-01 through W-10 for NHSL.
- Ensures canonical bed numbers 01 through 25 for every ward (250 canonical beds).
- Preserves an existing occupied legacy W-01 bed by converting it to canonical bed 01 when possible.
- Existing bed occupancy/status is not reset during normal upsert.
- `WardCatalogBootstrap` verifies and repairs the same catalog on every Spring API startup.

## API

- Ward availability counts now count only beds that are really allocatable (AVAILABLE, no current patient/admission, no active reservation pointer).
- Available-bed queries use the same allocation-ready conditions.

## Admission UI

- Entering Select Ward refreshes `/api/wards` from PostgreSQL.
- Ward filters are reset when entering the step, so a previous OPD filter cannot hide inpatient wards.
- A Refresh wards control is available on the page.
- Dynamic API reads use `cache: no-store` to prevent stale ward/bed responses.
- After a ward card is selected, the UI loads `/api/wards/{wardId}/available-beds` and advances to Select Bed when beds are available.
