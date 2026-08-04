# GovCare EHR — React + Spring Boot + PostgreSQL

GovCare EHR is a hospital Electronic Health Record application with a React/TypeScript frontend and a Spring Boot REST API.

## Active architecture

- Frontend: React, TypeScript, Tailwind CSS, Vite
- Backend: Spring Boot, Spring Web, Spring Security, JWT
- Data access: Spring Data JPA/Hibernate plus Spring JDBC for workflow queries
- Database: PostgreSQL with Flyway migrations
- API: `http://127.0.0.1:4001`
- Frontend: `http://127.0.0.1:5300`

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
PORT=4001
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

The default frontend environment points to the Spring Boot API on port `4001`.

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
Frontend: http://127.0.0.1:5300
Spring API: http://127.0.0.1:4001
Health: http://127.0.0.1:4001/actuator/health
```

## Local demonstration accounts

Flyway creates these local demonstration accounts only when the email does not already exist:

```text
Super Admin: superadmin@govcare.gov.lk / GovCare@123
Doctor:      doctor@govcare.gov.lk     / GovCare@123
Patient:     patient@govcare.gov.lk    / GovCare@123
```

Migration `V12__repair_login_accounts_and_audit_sessions.sql` adds the doctor and patient accounts required by the login screen. It does not overwrite an existing account or password. Change every demonstration password before production use.

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
  "password": "GovCare@123"
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
