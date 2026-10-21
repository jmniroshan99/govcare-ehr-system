# GovCare CDSS research enhancement

Start with [the CDSS handover](docs/cdss/README.md) for the dataset audit, seven-family benchmark, algorithm documentation, five-year readiness and reproduction commands. The source dataset is preserved; learned five-year training is blocked by absent outcome/follow-up data, while eligible published KFRE remains available. [Verification evidence](verification/cdss-enhancement/VERIFICATION_REPORT.md) distinguishes passed checks from the remaining live-browser PDF export limitation.

# GovCare V55 - established evidence and synthetic research cases

The CKD intelligence dashboard now has source-confirmed dated-pair entry, verified diabetes context, useful historical trends when a separate snapshot is undated, and an optional Super Admin workflow that creates two new labeled synthetic patients. Monitoring coverage is **% available** in the UI and PDF, with prediction eligibility kept separate.

Start with [V55 usage and upgrade instructions](CKD_EVIDENCE_ESTABLISHED_V55.md) and [verification evidence](verification/ckd-evidence-v55/VERIFICATION_REPORT.md). The existing CKD workflow, trained renal models, five-year outlook, port selection, authorization, patient pipeline and reports are preserved. V47 is additive. Native browser and target Windows/PostgreSQL checks remain unverified.

Earlier release notes follow unchanged.

# GovCare V54 — 5-Year CKD Outlook

A new patient-authorized **5-year outlook** tab adds published two-/five-year KFRE estimates for eligible clinically confirmed patients, measured kidney history, hypothetical input comparisons, clinician review/plans and a stored-evidence PDF appendix. Existing CKD workflows, ML artifacts, data pipeline and V53 port selection are preserved.

Start with [feature and upgrade instructions](CKD_FIVE_YEAR_OUTLOOK_V54.md), [model/horizon audit](MODEL_HORIZON_AUDIT_V54.md) and [fresh verification and limitations](verification/ckd-outlook-v54/VERIFICATION_REPORT.md). Flyway V46 is additive. Local clinical validation is not completed. Browser visual/focus QA and native Windows/live hospital PostgreSQL verification remain pending; the supplied browser suite is reproducible on a supported workstation.

Earlier release notes follow unchanged.

# V50 — CKD submission audit persistence fix

V50 fixes the V49 feature-capture audit insert that could roll back CKD submissions with HTTP 500 / SQLSTATE 42703. It uses the existing audit columns, required module and PostgreSQL enum cast; all current clinical workflows and the unified feature layer are retained.

Fresh verification: 201 Spring tests including five real JDBC persistence/rollback checks, 95 client/startup tests and 31 feature migration checks passed. See [diagnosis, modified files, restart instructions and repeatable QA](V50_CKD_SUBMISSION_AUDIT_FIX.md). No new migration is needed. Native Windows/PostgreSQL and the exact screenshot error-ID match still require target-machine evidence.

# V49 — unified CKD clinical feature integration

Saved CKD assessment values now populate the existing renal monitoring cards, current-value summary, dated charts and PDF. Flyway V45 adds and backfills immutable, tenant-scoped `clinical_prediction_features`; existing workflows and research model gates are retained.

See `V49_CLINICAL_FEATURE_LAYER_IMPLEMENTATION.md` for modified files, clinical mapping, database/API changes, target upgrade instructions and fresh verification. Monitoring bands and clinical data completeness are separate from longitudinal research forecasting. No new model is trained or new disease probability invented.

Fresh results: Spring 196, Django 17, Node 95, feature migration 31, responsive UI 27 and legacy UI 21 checks passed. Native Windows/PostgreSQL and an authenticated private-patient session still require target execution.

# GovCare EHR V48 - renal data readiness and clinical workflow

The six patient-scoped cards now explain exact missing data, independent trend/forecast readiness and useful entry actions. Source-confirmed dialysis context can be recorded without a lab value. The accessible review drawer, ISO dates, technical-error states and PDF semantics are updated. Flyway V44 is additive. See [implementation, test evidence, screenshots and Windows instructions](V48_RENAL_READINESS_IMPLEMENTATION.md). Earlier release sections below are retained history.

# GovCare EHR V47 — Spring startup route correction

V47 fixes the ambiguous patient `predictive-intelligence` GET mapping reported in the Windows startup log. The six-module snapshot owns that endpoint; the clinical overview client uses the existing `intelligence` endpoint. A new integration test initializes all 46 production controller mappings with the real Spring MVC registry and production security chain. All 140 Spring tests, 83 affected frontend/startup tests, and the production frontend build pass. See [startup fix, evidence and exact Windows instructions](V47_SPRING_STARTUP_ROUTE_FIX.md). The V46 six modules, database migration, ML artifacts, reviews, FHIR and PDF work are retained.

# GovCare EHR V46 — six renal intelligence modules

The assessment outcome grid and clinical overview now use the six patient-scoped renal modules. See [implementation, test results, limitations and Windows startup](V46_RENAL_SIX_MODULE_IMPLEMENTATION.md) and [changed files](MODIFIED_FILES_V46_RENAL_SIX_MODULES.txt). Flyway V43 is additive. The existing V45 research illustration is retained below the clinical results.

# GovCare EHR V45 - CKD research infographic integration

V45 applies the requested modern kidney-centred research infographic to the existing **AI CDSS -> CKD -> Predictive Clinical Intelligence -> Overview** workspace. Select an authorized patient to open the Sri Lankan renal panel. The new visible research overview provides full-size PNG viewing, a widescreen presentation PDF download, keyboard collapse controls, and readable descriptions of all four modules.

- [Architecture, changes, verification and Windows instructions](V45_RESEARCH_INFOGRAPHIC_INTEGRATION.md)
- [Modified and added files](MODIFIED_FILES_V45_RESEARCH_INFOGRAPHIC.txt)
- PNG: `public/research/ckd-risk-predictive-intelligence-v45.png`
- Presentation PDF: `public/research/ckd-risk-predictive-intelligence-v45.pdf`

The presentation graphic contains illustrative research trends. Existing patient-specific cards, stored research snapshots, clinician reviews, FHIR provenance and the CKD assessment PDF remain in their established workflow. V45 does not require a new database migration. The production frontend build is included in `dist/`; it does not replace the Spring/PostgreSQL/ML services.

# GovCare EHR V43 — Sri Lankan renal predictive intelligence

The current integrated renal update, installation instructions, model results and verification evidence are documented in [RUN_SRI_LANKAN_RENAL.md](RUN_SRI_LANKAN_RENAL.md), [MODEL_RESULTS_OVERVIEW.md](MODEL_RESULTS_OVERVIEW.md), [SRI_LANKAN_HYPERKALEMIA_COMPOSITE_PDF_INTEGRATION.md](SRI_LANKAN_HYPERKALEMIA_COMPOSITE_PDF_INTEGRATION.md) and [V43_VALIDATION_REPORT.md](V43_VALIDATION_REPORT.md). V43 adds the Sri Lankan longitudinal hyperkalemia research score, a transparent renal-deterioration directional composite, and automatic four-panel graphics in the CKD PDF report. Earlier sections below are retained project history; their older build limitations do not describe the current V43 checks.

# GovCare EHR — Super Admin facility command center

Super Admin now has one protected workflow for creating a hospital, selecting its department, creating wards and adding up to 200 validated beds per batch. Open **Governance → Hospital Setup**, or use **Add hospitals, wards and beds** on the Super Admin dashboard.

- [Facility architecture, security and operating instructions](SUPERADMIN_FACILITY_ADMINISTRATION.md)
- [Current build and testing evidence](SUPERADMIN_FACILITY_TESTING_REPORT.md)
- [Files changed in this update](CHANGED_FILES_SUPERADMIN_FACILITY.txt)
- [Updated role and permission matrix](ROLE_DASHBOARD_PERMISSION_MATRIX.md)

Restart the complete application after updating. Flyway V33 grants `HOSPITAL_MANAGE` to Super Admin, and the corrected dashboard SQL removes the PostgreSQL 18 `day` alias failure visible in the supplied log. Sign out and sign in after the migration so the current permission profile is loaded.

# GovCare EHR — healthcare theme and Java audit baseline

The frontend uses shared light/dark design tokens, readable dashboard heroes, cards, controls, CKD results and live chart colors. The theme-only baseline preserved the backend; the current source includes the later facility administration and PostgreSQL query corrections documented above.

- [Theme architecture and tokens](THEME_SYSTEM_DOCUMENTATION.md)
- [Build, apply and live screenshot instructions](THEME_BUILD_INSTRUCTIONS.md)
- [Current verification results and blocked checks](THEME_VERIFICATION_REPORT.md)
- [Complete modified and added files](CHANGED_FILES_THEME_FIX.txt)

Frontend build and automated checks pass. The supplied Java source has no syntax errors and the dashboard service passes focused Java 21 compilation. Full Maven tests and live browser screenshots remain unverified because of the environment limitations recorded in the current report. Earlier reports below are retained as project history.

# GovCare EHR — Super Admin network patients and AI access

Super Admin can browse registered patients across hospitals, filter by hospital and ward,
open patient details and documents, and load the selected patient into AI risk assessment.
Assessments and related clinical/FHIR records use the patient's hospital while retaining the
authenticated operator. Other roles retain their hospital and clinical relationship restrictions.

- [Fix, API changes, permission rules and build instructions](SUPERADMIN_NETWORK_ACCESS_FIX.md)
- [Current testing results and remaining deployment checks](SUPERADMIN_NETWORK_ACCESS_TESTING.md)
- [Files changed in this update](CHANGED_FILES_SUPERADMIN_NETWORK.txt)

Rebuild and restart **both** the frontend and Spring API, then sign out and sign back in.
This update does not require a new database migration or a repeat of the demo loader.

# GovCare EHR — ten-hospital demo dataset

This edition adds **10 separate demo hospitals**, each with **400 patients, 100 doctors and 100 wards**.
Extract the ZIP, complete the existing backend setup, then run `setup-demo-network-windows.bat`
or `npm run demo:seed` followed by `npm run demo:verify`.

- [Demo setup, counts, linked records and login instructions](DEMO_NETWORK_SETUP.md)
- [Demo verification and build results](DEMO_NETWORK_TESTING_REPORT.md)
- [Demo changes](CHANGED_FILES_DEMO_NETWORK.txt)
- [1,060 hospital-specific initial login credentials](database/postgresql/demo-network-credentials.csv)

The loader is an explicit local development/QA command. Start Spring Boot once so Flyway V32
has completed before loading it. Existing hospital records and accounts are preserved.

# GovCare EHR — access role fix

This package updates the uploaded source with consistent role routing, governed role-specific dashboards,
Flyway V31/V32 and optional local test logins. Start with [ACCESS_ROLE_BUILD_INSTRUCTIONS.md](ACCESS_ROLE_BUILD_INSTRUCTIONS.md).

- [October 1 dashboard compilation correction and quick patch instructions](DASHBOARD_COMPILE_FIX.md)
- [Initial local role credentials](LOCAL_ROLE_CREDENTIALS.md)
- [Fix report and API/database changes](ACCESS_ROLE_FIX_REPORT.md)
- [Role permission matrix](ROLE_DASHBOARD_PERMISSION_MATRIX.md)
- [Architecture](ROLE_INTELLIGENCE_DASHBOARD_ARCHITECTURE.md)
- [Testing report and unverified checks](ACCESS_ROLE_TESTING_REPORT.md)
- [Modified files](CHANGED_FILES_ACCESS_ROLE_FIX.txt)

# GovCare EHR — React + Spring Boot + PostgreSQL

GovCare EHR is a hospital Electronic Health Record application with a React/TypeScript frontend and a Spring Boot REST API.

For the September 2026 "Unable to find a suitable main class" startup fix,
see [MAIN_CLASS_STARTUP_FIX.md](MAIN_CLASS_STARTUP_FIX.md). The supplied launchers
now clean and recompile the backend before starting it.

## Active architecture

- Frontend: React, TypeScript, Tailwind CSS, Vite
- Backend: Spring Boot, Spring Web, Spring Security, JWT
- Data access: Spring Data JPA/Hibernate plus Spring JDBC for workflow queries
- Database: PostgreSQL with Flyway migrations
- API: `http://127.0.0.1:4002`
- Frontend: `http://127.0.0.1:5300` when available; the full-stack launcher prints the selected URL

The former Express/TypeScript backend is not used by the run scripts in this migrated edition.

## Main backend folder

```text
spring-api/
├─ pom.xml
├─ src/main/java/lk/gov/health/govcare/
│  ├─ auth/
│  ├─ config/
│  ├─ security/
│  ├─ patient/
│  ├─ user/
│  ├─ workflow/
│  ├─ audit/
│  ├─ media/
│  └─ pdf/
└─ src/main/resources/
   ├─ application.yml
   └─ db/migration/
```

## Requirements

Install these before running the application:

1. Node.js 22 or newer
2. Java 21
3. Apache Maven 3.9 or newer
4. PostgreSQL

## 1. Create the database

Using pgAdmin or `psql`, create an empty database:

```sql
CREATE DATABASE govcare_ehr_v2;
```

Do not manually run the schema files for a new database. Flyway applies the migrations automatically when Spring Boot starts.

## 2. Configure the backend

Windows:

```cmd
copy spring-api\.env.example spring-api\.env
```

Linux/macOS:

```bash
cp spring-api/.env.example spring-api/.env
```

Edit `spring-api/.env`:

```env
PORT=4002
DB_URL=jdbc:postgresql://localhost:5432/govcare_ehr_v2
DB_USERNAME=postgres
DB_PASSWORD=YOUR_POSTGRES_PASSWORD
JWT_SECRET=replace-with-a-long-random-secret-at-least-32-characters
JWT_EXPIRATION_MINUTES=480
CORS_ORIGIN=http://127.0.0.1:5300,http://localhost:5300
STORAGE_ROOT=./govcare-storage
LOG_FILE=logs/govcare-spring-api.log
FLYWAY_ENABLED=true
```

Keep `.env` private. Commit only `.env.example`.

## 3. Configure the frontend

Windows:

```cmd
copy .env.example .env
```

The default frontend environment points to the Spring Boot API on port `4002`.

If the login screen shows “Network error”, start the complete stack with `npm run dev:full` (or `run-windows.bat` / `run-linux.sh`). Do not start Vite alone: the Spring Boot API and PostgreSQL database must also be running. The included `.env.example` files provide the local defaults.

## 4. Install and build

```cmd
npm install
npm run build
npm run spring:build
```

Compatibility command:

```cmd
npm run postgres:build
```

This command now builds the Spring Boot API.

## 5. Run the full application

```cmd
npm run dev:full
```

Expected services:

```text
Frontend: http://127.0.0.1:5300 (or the fallback URL printed at startup)
Spring API: http://127.0.0.1:4002 (or the API URL printed at startup)
Health: <selected API URL>/actuator/health
```

On Windows, port `5300` can be reserved by the OS even when `netstat` shows no
listening process. `npm run dev:full` probes loopback ports and prints the URL it
actually uses. The selected local origin is also added to the Spring API CORS
list for this run, including when `spring-api/.env` specifies `CORS_ORIGIN`.
If all suggested ports are unavailable, set `GOVCARE_FRONTEND_PORT` to a permitted
port and retry (PowerShell: `$env:GOVCARE_FRONTEND_PORT='18080'`; CMD:
`set GOVCARE_FRONTEND_PORT=18080`). To inspect Windows reservations, run
`netsh interface ipv4 show excludedportrange protocol=tcp` from a command prompt.
Do not terminate other processes or alter Windows reserved ranges to run this app.

The full-stack and detached launchers also probe the configured Spring API port.
When it is occupied, they select an available fallback and pass that exact URL
to Vite and Spring. An existing backend `PORT=4002` entry cannot override the
coordinated selection. For an explicit free port, set `GOVCARE_API_PORT` before
launch; explicit occupied ports fail clearly. See
[the port-conflict fix guide](STARTUP_PORT_CONFLICT_FIX.md).

The renal launcher (`npm run dev:renal` / `start-renal-fullstack-windows.bat`)
also checks the local ML port, normally 8001, and shares any fallback address
with Django and Spring after their `.env` files load. Use the printed ML health
URL. Set `GOVCARE_RENAL_ML_PORT` in the terminal to pin a permitted ML port;
explicit unavailable ports fail before services start. See
[the Renal ML port fix guide](WINDOWS_RENAL_PORT_FIX_V53.md).

## Local demonstration accounts and staff roles

On a newly initialized database, Flyway creates three demonstration accounts:

| Role | Email | Initial password |
| --- | --- | --- |
| Super Admin | `superadmin@govcare.gov.lk` | `GovCare@123` |
| Doctor | `doctor@govcare.gov.lk` | `GovCare@123` |
| Patient | `patient@govcare.gov.lk` | `GovCare@123` |

These inserts are conditional and never overwrite existing accounts. The initial password is **not** valid after an account has been reset or changed. In particular, a Super Admin recovered with `recover-superadmin-mfa.ps1` uses the one-time password printed by that recovery, until it is changed; the source cannot reveal its current password. The login form no longer autofills or displays passwords.

Super Admin and Hospital Admin can create the other staff roles in `/admin/staff`, where a distinct temporary password is shown once. See `ACCOUNT_ACCESS_RECOVERY.md` for all roles and the approved recovery procedures. Change every demonstration password before production use.

## Role-based access control

Roles and permissions are stored in PostgreSQL tables:

```text
roles
permissions
role_permissions
app_users.role_id
```

The JWT contains the authenticated user identity, role, hospital, department, patient link and permissions. The React client hides unauthorized navigation, while Spring Security remains the authoritative enforcement layer.

Examples:

- Records Officer: patient registration, patient search and demographic profiles only
- Laboratory Technician: laboratory requests, samples and result entry
- Pathologist: laboratory verification
- Pharmacist: prescription verification and dispensing
- Doctor: queue, consultation, prescription and investigation requests
- Patient: only their own released records

See `ROLE_PERMISSION_TEST_CHECKLIST.md`.

## API authentication

Login endpoint:

```http
POST /api/auth/local-login
Content-Type: application/json

{
  "email": "superadmin@govcare.gov.lk",
  "password": "YOUR_CURRENT_PASSWORD"
}
```

Use the returned token:

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

## Database migration behavior

- New empty database: Flyway applies all migrations from `V1` onward.
- Existing GovCare database: Flyway baseline version `3` allows RBAC and later migrations to be applied without recreating existing records.
- Back up an existing database before the first migration.

## Important commands

```cmd
npm run spring:api
npm run spring:build
npm run dev:full
npm run build
```

The legacy aliases below are retained so older instructions still work:

```cmd
npm run postgres:api
npm run postgres:build
```


## Login activity and backend logs

Spring Boot is the authoritative writer for local email/password login attempts. The returned `sessionId` is stored by the browser and reused when logout or timeout closes the session, preventing duplicate or permanently active audit rows.

Unexpected API errors return an `errorId`. Search that ID in:

```text
spring-api/logs/govcare-spring-api.log
```

The log rotates at 10 MB, keeps up to 14 history files and uses a 200 MB total cap. See `LOGIN_AND_LOGGING_FIX.md`.

## Staff Management

Super Admin and Hospital Admin users can manage staff from `/admin/staff`. See `STAFF_MANAGEMENT_IMPLEMENTATION.md` and `STAFF_MANAGEMENT_TEST_CHECKLIST.md` for the implementation and verification steps.

## Inter-department patient documents and PDFs

This version includes a centralized, hospital-scoped patient document registry for clinical and administrative PDFs. Authorized users can open the patient document center at:

```text
/patients/{patientId}/documents
```

Department document views are available at:

```text
/laboratory/documents
/radiology/documents
/pharmacy/documents
/doctor/documents
/ward/documents
```

The Spring Boot API enforces JWT, hospital scope, department scope, role permissions, document status and patient-release rules. PDF preview, download and print use authenticated Blob requests. Document access, verification, release and sharing actions are audited. Flyway migration `V9__inter_department_patient_documents.sql` creates the central document, department-access and access-log tables.

Implementation details and a manual verification checklist are included in:

```text
INTER_DEPARTMENT_DOCUMENT_SHARING_IMPLEMENTATION.md
INTER_DEPARTMENT_DOCUMENT_SHARING_TEST_CHECKLIST.md
VALIDATION_INTER_DEPARTMENT_DOCUMENTS.md
```


## Ward, bed allocation and patient transfers

The application includes an integrated inpatient-operations module for ward and room configuration, live bed status, reservation and allocation, internal transfers, inter-hospital transfers, movement history and authenticated transfer-package PDFs.

See:

- `WARD_BED_TRANSFER_IMPLEMENTATION.md`
- `WARD_BED_TRANSFER_TEST_CHECKLIST.md`
- `CHANGED_FILES_WARD_BED_TRANSFERS.txt`
