# GovCare EHR — PostgreSQL Edition

GovCare EHR is a React + TypeScript electronic health record system for Sri Lankan hospital workflows. This corrected edition uses an Express/TypeScript REST API and PostgreSQL as the authoritative source for authentication, account administration, audit/login activity, patient lookup, and cross-module search.

## Corrected in this edition

- Removed legacy cloud SDK configuration, hosting folders, service workers, and related browser caches.
- Removed local/demo fallback suggestions from the shared search component.
- Connected the header and module search bars to `GET /api/search/suggestions`.
- Added scoped PostgreSQL search for patients, guardians, users/doctors, OPD visits, appointments, prescriptions, medicines, laboratory requests, radiology requests, admissions, wards, notifications, and reports.
- Added PostgreSQL user-account listing, filtering, creation, selection, inspection, and updating.
- Added linked account record totals for logins, audit actions, visits, appointments, prescriptions, lab requests, radiology requests, and admissions.
- Added selected-account activity history from `login_activities` and `audit_logs`.
- Added PostgreSQL password verification with `pgcrypto`, JWT sessions, patient registration, and login activity recording.
- Added hospital isolation and role checks in backend queries.
- Added a single fresh-install database file: `database/postgresql/govcare_ehr_complete.sql`.

## Project architecture

```text
React 19 + Vite + TypeScript
             |
             | HTTP / JWT
             v
Express 5 + TypeScript API (port 4001)
             |
             v
PostgreSQL database: govcare_ehr
```

The optional `spring-api/` service can be used later for large media/document storage. The main application and the corrected search/account workflows run with the Express API on port `4001`.

## Requirements

Install these first:

1. Node.js 22 LTS or Node.js 24.
2. PostgreSQL 15 or newer, including Command Line Tools (`psql`, `createdb`, and `dropdb`).
3. npm, installed with Node.js.

## Windows setup using CMD

### 1. Extract and enter the project

```cmd
cd /d "C:\wamp64\www\wholesale vegetable\govcare-ehr-postgresql-corrected"
```

Use the actual folder where you extracted the ZIP.

### 2. Configure the PostgreSQL password

Open `server\.env` and update this line to match your PostgreSQL username, password, port, and database:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/govcare_ehr
```

For example, when your PostgreSQL password is `652920`:

```env
DATABASE_URL=postgres://postgres:652920@localhost:5432/govcare_ehr
```

Keep the frontend API values in `.env` as:

```env
VITE_API_BASE_URL=http://127.0.0.1:4001
VITE_MEDIA_API_BASE_URL=http://127.0.0.1:4001
```

### 3. Create and seed a fresh database

The following commands reset the `govcare_ehr` database. Do not run them against a database containing records you need to preserve.

```cmd
dropdb --if-exists -U postgres govcare_ehr
createdb -U postgres govcare_ehr
psql -U postgres -d govcare_ehr -v ON_ERROR_STOP=1 -f database\postgresql\govcare_ehr_complete.sql
```

PostgreSQL will ask for the password when required. You can also run:

```cmd
setup-database-windows.bat
```

The batch file asks for the PostgreSQL username and confirms before resetting the local database.

### 4. Install dependencies

```cmd
npm install
npm --prefix server install
```

### 5. Run frontend and API together

```cmd
npm run dev:full
```

Or double-click/run:

```cmd
run-windows.bat
```

Open:

```text
http://127.0.0.1:5300/login
```

API health check:

```text
http://127.0.0.1:4001/health
```

## Demo login accounts

All seeded accounts use this initial password:

```text
GovCare@123
```

Useful accounts:

| Role | Email |
|---|---|
| Super Admin | `superadmin@govcare.gov.lk` |
| Hospital Admin | `admin@govcare.gov.lk` |
| Doctor | `doctor@govcare.gov.lk` |
| Nurse | `nurse@govcare.gov.lk` |
| Pharmacist | `pharmacist@govcare.gov.lk` |
| Laboratory Technician | `lab@govcare.gov.lk` |
| Radiologist | `radiology@govcare.gov.lk` |
| Receptionist | `reception@govcare.gov.lk` |
| Records Officer | `records@govcare.gov.lk` |
| ICT Admin | `ict@govcare.gov.lk` |
| Patient | `patient@govcare.gov.lk` |

Use the Super Admin or Hospital Admin account to open **Administration → User Management**. Search an account, select it, view its linked records and activity, modify the account, and click **Save selected account**.

New staff accounts created from User Management receive the initial database password `GovCare@123` and should remain `pending` until reviewed. Change this behavior before production deployment.

## Search behavior

The shared search component requires at least two characters and calls the PostgreSQL API. Search results are restricted by hospital and user role.

Supported scopes:

- Patients and guardians
- Staff accounts and doctors
- OPD visits and appointments
- Prescriptions and medicines
- Laboratory and radiology requests
- Admissions, wards, and beds
- Notifications and uploaded report metadata

Patient and guardian portal searches are limited to clinical-provider accounts to avoid exposing unrelated staff or patient records.

## Database files

- `database/postgresql/schema.sql` — PostgreSQL schema.
- `database/postgresql/seed.sql` — connected Sri Lankan demonstration records.
- `database/postgresql/govcare_ehr_complete.sql` — schema and seed combined for a fresh install.
- `database/postgresql/seed-production-sri-lanka.sql` — source copy of the connected seed data.

## Build checks

```cmd
npm run build
npm run postgres:build
```

## Production notes

Before real hospital use:

- Replace the default JWT secret in `server/.env`.
- Replace all initial passwords and add a password-reset flow.
- Enforce HTTPS, secure cookies or hardened token storage, MFA, and rate limiting.
- Add database migrations instead of resetting with the complete SQL file.
- Back up PostgreSQL before schema changes.
- Complete API conversion for any remaining presentation-only dashboard widgets before treating them as live clinical records.
- Perform security, authorization, audit, data-retention, and clinical-safety testing.
