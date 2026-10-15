# GovCare EHR Atomic Inpatient Admission Workflow

## Implemented flow

`Identify patient → Confirm identity → Admission details → Select ward → Select bed → Review → Confirm admission`

The new route is `/admissions/new`. It can be opened from Admissions Management, Patient Search, and Patient Profile. A `patientId` query parameter preloads the selected patient while still requiring an explicit identity-confirmation step.

## Transaction and concurrency safety

`AdmissionService.create` runs with Spring `@Transactional(isolation = Isolation.SERIALIZABLE)` and performs the following in one transaction:

1. Locks and validates the patient.
2. Validates an unexpired server-side identity-confirmation proof belonging to the same staff member.
3. Rejects duplicate active admissions.
4. Locks the selected ward and bed.
5. Rechecks hospital, ward, department, gender, age and isolation compatibility.
6. Rechecks active patient/bed allocations.
7. Creates the admission and bed allocation.
8. Changes the bed to `OCCUPIED`.
9. Records movement and audit history.
10. Notifies the nursing role.
11. Consumes the identity-confirmation proof.

Any exception rolls back the transaction. Database partial unique indexes also prevent multiple active admissions or active bed allocations for the same patient and multiple active allocations for one bed.

## Ward and bed behaviour

Only active wards can be selected. Full or incompatible wards are disabled in the UI. Only `AVAILABLE` beds with no current patient/admission are returned by the available-bed API. The user can filter by bed type and accessibility.

Discharge ends the active allocation, completes the admission and changes the former bed to `CLEANING`. Transfer ends the old allocation, moves the old bed to `CLEANING`, and atomically occupies the destination bed.

## Nurse Module

The previous hard-coded patient list was removed. The Nurse Module now:

- Loads active wards from PostgreSQL.
- Loads only actively admitted patients with active bed allocations in the selected ward.
- Displays patient ID, age, gender, ward, bed, allergies, risk and vital status.
- Verifies patient + ward + bed + active admission through the backend.

## New backend endpoints

- `GET /api/admissions/reference`
- `GET /api/admissions`
- `GET /api/admissions/{admissionId}`
- `GET /api/patients/{patientIdentifier}/active-admission`
- `POST /api/patients/confirm-identity`
- `POST /api/admissions`
- `POST /api/admissions/{admissionId}/assign-bed`
- `POST /api/admissions/{admissionId}/transfer`
- `POST /api/admissions/{admissionId}/discharge`
- `GET /api/wards/{wardId}/available-beds`
- `GET /api/wards/{wardId}/admitted-patients`

## Migration

`V14__atomic_inpatient_admission_workflow.sql` is additive. It adds admission metadata, server-side identity-confirmation records, safe admission-number generation, role permissions, indexes and deterministic repair for contradictory legacy active rows without deleting history.
