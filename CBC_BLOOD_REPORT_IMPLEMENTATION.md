# GovCare EHR - CBC Blood Report Module

## Added

A structured **Laboratory -> Blood Reports** workflow for Complete Blood Count (CBC) reporting.

### Frontend
- New route: `/laboratory/blood-reports`
- Patient search by the existing GovCare patient API
- Optional link to an existing CBC/FBC laboratory request
- CBC entry table grouped into CBC, differential leucocyte count, absolute leucocyte count, RBC indices and platelet indices
- Configured reference ranges shown beside every parameter
- Automatic N/L/H/C flag calculation
- Automatic absolute leucocyte calculations using `WBC x differential % / 100`
- Manual override option for absolute counts
- Draft save, complete, verify and release workflow
- Search/status/date filters
- A4 PDF download and printing
- Released CBC reports appear in the patient **My Reports** page

### Backend
New endpoints:
- `GET /api/laboratory/blood-reports`
- `GET /api/laboratory/blood-reports/{id}`
- `POST /api/laboratory/blood-reports`
- `PUT /api/laboratory/blood-reports/{id}`
- `POST /api/laboratory/blood-reports/{id}/complete`
- `POST /api/laboratory/blood-reports/{id}/verify`
- `POST /api/laboratory/blood-reports/{id}/release`
- `GET /api/laboratory/blood-reports/{id}/pdf`
- `GET /api/laboratory/reference-ranges/cbc`

### Database migration
`spring-api/src/main/resources/db/migration/V18__cbc_blood_reports.sql`

Adds:
- `lab_blood_reports`
- `lab_blood_report_results`
- `lab_test_reference_ranges`
- `cbc_report_number_seq`
- `LAB_RESULT_RELEASE` permission
- Default configurable CBC reference ranges

### Security
- Lab technicians/managers/pathologists use the existing `LAB_RESULT_CREATE` permission to enter results.
- Lab managers/pathologists use the existing `LAB_RESULT_VERIFY` permission to verify.
- Lab managers/pathologists and super admins receive the new `LAB_RESULT_RELEASE` permission.
- Doctors/nurses can only retrieve released structured CBC reports.
- Patients can only retrieve their own released CBC reports.
- PDF downloads continue to require `REPORT_DOWNLOAD`.

### Existing laboratory integration
If a CBC report is linked to a `lab_request`, completing/verifying/releasing it also synchronizes the existing `lab_results` and `lab_requests` workflow. This keeps the Doctor Command Center and existing laboratory workflow compatible.

### Patient timeline
Released CBC reports are added to the existing patient timeline as `LABORATORY_CBC_RELEASED` events.

## Run

```cmd
npm install
npm run build
npm run postgres:build
npm run dev:full
```

Flyway automatically applies `V18__cbc_blood_reports.sql` when the Spring Boot API starts.

## Validation performed in this package
- Modified TypeScript/TSX files passed TypeScript syntax/transpile validation.
- Project TypeScript no-emit check completed successfully before the local dependency installation became incomplete.
- Java source files were syntax-checked with `javac`; a full Maven compile could not run in this environment because Maven 3.9+ is not installed.
- The original existing GovCare modules were preserved rather than replaced.
