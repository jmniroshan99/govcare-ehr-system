# GovCare EHR PostgreSQL Migration Plan

This project currently uses Firebase Firestore as the main database. To change GovCare EHR to PostgreSQL safely, do not connect React directly to PostgreSQL. Use a backend API layer.

## Recommended Architecture

```text
React + Vite frontend
        |
        | HTTPS / JSON API
        v
Node.js Express API
        |
        | pg connection pool / transactions
        v
PostgreSQL database
```

Recommended backend split:

- Spring Boot + PostgreSQL for documents, images, reports, uploads, and clinical APIs.
- PostgreSQL for users, patients, OPD, consultations, pharmacy, lab, radiology, admissions, notifications, and audit logs.
- Firebase Authentication may be kept temporarily for login during migration, but production can also move auth to Spring Security/JWT.
- Firebase Storage should be replaced by the Spring media API if all documents/images must be managed by Spring Boot + PostgreSQL.

PostgreSQL should become the source of truth for:

- users and roles
- patients and guardians
- visits and OPD queues
- consultations
- prescriptions and pharmacy stock
- laboratory requests/results
- radiology requests/reports
- admissions, wards, beds
- appointments
- notifications
- audit logs
- login activity reports

## Files Added

- `database/postgresql/schema.sql` - full relational database schema.
- `database/postgresql/seed.sql` - sample hospital, departments, and wards.
- `server/` - starter Node.js + Express + PostgreSQL API.
- `server/.env.example` - PostgreSQL API environment variables.

## Windows Setup

1. Install PostgreSQL.
2. Create database:

```powershell
createdb govcare_ehr
```

3. Apply schema:

```powershell
cd "C:\wamp64\www\wholesale vegetable\govcare-ehr-system"
psql "postgres://postgres:postgres@localhost:5432/govcare_ehr" -f database/postgresql/schema.sql
psql "postgres://postgres:postgres@localhost:5432/govcare_ehr" -f database/postgresql/seed.sql
```

4. Install backend dependencies:

```powershell
cd "C:\wamp64\www\wholesale vegetable\govcare-ehr-system\server"
npm install
copy .env.example .env
npm run dev
```

5. Run frontend:

```powershell
cd "C:\wamp64\www\wholesale vegetable\govcare-ehr-system"
npm run dev -- --host 127.0.0.1
```

## Migration Steps

1. Keep the current Firebase app working.
2. Create PostgreSQL tables using `schema.sql`.
3. Export Firestore collections to JSON.
4. Write import scripts collection-by-collection:
   - hospitals
   - departments
   - users
   - guardians
   - patients
   - visits
   - prescriptions
   - lab/radiology
   - admissions/wards/beds
   - audit logs
5. Replace direct Firestore service calls with API calls one module at a time.
6. Start with Patient Management, OPD, Doctor Consultation, and Pharmacy.
7. Keep Firebase Storage until PostgreSQL-backed object storage is added.
8. Run permission tests before production.

## Media and Documents

All uploads should move to the Spring Boot service:

```text
React Media Center -> Spring Boot /api/media -> PostgreSQL global_media metadata -> managed file storage folder
```

See:

`docs/SPRING_BOOT_POSTGRESQL_MEDIA.md`

## Important Differences

Firestore is document-based. PostgreSQL is relational.

Firestore document:

```json
{
  "patientId": "PT-000001",
  "hospitalId": "hosp-colombo-national",
  "allergies": ["Penicillin"]
}
```

PostgreSQL row:

```sql
insert into patients (hospital_id, patient_no, full_name, date_of_birth, allergies)
values ('...', 'PT-000001', 'Patient Name', '1990-01-01', '["Penicillin"]');
```

## Security Model

Firestore rules must be replaced by backend authorization middleware and PostgreSQL constraints.

Required checks:

- User must be authenticated.
- User role must be allowed for the endpoint.
- User hospitalId must match the requested data.
- Patient users can only access their own released records.
- Every create/update/delete/export must write audit logs.

## Recommended First Modules To Convert

1. Patient registration and search.
2. OPD queue.
3. Doctor consultation.
4. Prescription-to-pharmacy workflow.
5. Laboratory and radiology orders.
6. Admissions and ward management.
7. Reports and analytics.

## Notes

The included `server` folder is a starter backend. It has:

- Express API
- PostgreSQL connection pool
- JWT middleware
- patient list and create endpoints
- audit logging example
- duplicate NIC prevention example

The current frontend is not fully switched to PostgreSQL yet. The next development step is to add a frontend API client and replace Firebase service methods gradually.
