# Validation — Atomic Inpatient Admission Workflow

## Completed static checks

- TypeScript/TSX parser checked 152 source files: **0 syntax errors**.
- Targeted TypeScript semantic check reported **no diagnostics in the changed admission, ward, patient profile, patient search, nurse, route, access-control, or service files**. External package declarations were stubbed because package downloads are unavailable in the repair environment.
- `AdmissionDtos`, `AdmissionService`, and `AdmissionController` compiled with Java 21 against dependency-contract stubs: **PASS**.
- Updated `WardDtos` and `WardBedService` compiled with Java 21 against dependency-contract stubs: **PASS**.
- JSON, XML, YAML, local TypeScript imports, expected workflow markers and Flyway sequence validation: **PASS**.
- Flyway migration sequence is continuous from **V1 through V14**.
- Nurse Module scan confirmed that the previous sample patient names are no longer present.

## Functional safeguards verified in source

- Server-issued identity confirmation is required and expires after 30 minutes.
- The same authenticated staff member must use the confirmation.
- Admission creation uses `SERIALIZABLE` transaction isolation.
- Patient, ward and bed rows are rechecked under lock.
- Duplicate active admission and bed-allocation checks are present.
- Partial unique indexes protect active patient admissions and allocations.
- Bed assignment is committed with the admission or rolled back with it.
- Discharge changes the previous bed to `CLEANING`.
- Transfer changes the old bed to `CLEANING` and atomically occupies the destination bed.
- Ward admitted-patient API reads only active admissions with active bed allocations.

## Environment limitation

A complete dependency build could not be executed inside the repair environment because the configured npm package source returned missing-package/network errors and Maven is not installed there. The user’s preceding local build confirmed that the base project compiles before these workflow additions. Run the commands below after extraction to perform the final dependency-backed build on Windows:

```cmd
npm install
npm run build
npm run spring:build
npm run dev:full
```
