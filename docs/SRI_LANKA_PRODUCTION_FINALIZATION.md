# GovCare EHR Sri Lanka Production Finalization

This guide finalizes the project for Sri Lankan government and private hospital demonstrations using PostgreSQL + Spring Boot/Node API integration.

## What Was Finalized

- Multi-hospital data model with `hospital_id` isolation.
- Government and private hospital sample records.
- Sinhala, Tamil, and English-ready system settings.
- Adult and pediatric patient examples.
- Guardian-linked child patient examples.
- Hospital-local doctors, nurses, pharmacists, lab technicians, radiologists, receptionists, and ICT users.
- OPD, consultation, pharmacy, laboratory, radiology, admission, ward, notification, audit, login, media, and settings workflows.
- At least 10 rows for every table in `database/postgresql/schema.sql`.

## Seed File

Use this plain SQL seed file:

```text
database/postgresql/seed-production-sri-lanka.sql
```

The older `database/postgresql/seed.sql` file is a binary PostgreSQL dump and is not intended as the readable learner/developer seed.

## Load Order

```powershell
createdb govcare_ehr
psql "postgres://postgres:postgres@localhost:5432/govcare_ehr" -f database/postgresql/schema.sql
psql "postgres://postgres:postgres@localhost:5432/govcare_ehr" -f database/postgresql/seed-production-sri-lanka.sql
```

## Verify Row Counts

Run this after loading the seed:

```sql
select table_name, row_count from (
  select 'hospitals' table_name, count(*) row_count from hospitals union all
  select 'departments', count(*) from departments union all
  select 'app_users', count(*) from app_users union all
  select 'guardians', count(*) from guardians union all
  select 'patients', count(*) from patients union all
  select 'visits', count(*) from visits union all
  select 'opd_queue', count(*) from opd_queue union all
  select 'consultations', count(*) from consultations union all
  select 'prescriptions', count(*) from prescriptions union all
  select 'prescription_items', count(*) from prescription_items union all
  select 'medicines', count(*) from medicines union all
  select 'pharmacy_stock', count(*) from pharmacy_stock union all
  select 'pharmacy_receipts', count(*) from pharmacy_receipts union all
  select 'lab_requests', count(*) from lab_requests union all
  select 'lab_results', count(*) from lab_results union all
  select 'radiology_requests', count(*) from radiology_requests union all
  select 'radiology_reports', count(*) from radiology_reports union all
  select 'wards', count(*) from wards union all
  select 'beds', count(*) from beds union all
  select 'admissions', count(*) from admissions union all
  select 'appointments', count(*) from appointments union all
  select 'notifications', count(*) from notifications union all
  select 'audit_logs', count(*) from audit_logs union all
  select 'login_activities', count(*) from login_activities union all
  select 'global_media', count(*) from global_media union all
  select 'system_settings', count(*) from system_settings
) counts
order by table_name;
```

Every listed table should show at least `10` rows. `app_users` will show more than 10 because the seed adds hospital-local clinical staff for safer tenant-isolated workflows.

## Final Production Notes

- Keep `hospital_id` on every operational record.
- Patients should only see released records through the Patient Portal.
- Clinical staff should only access records inside their own hospital and role scope.
- Use the `global_media` table for metadata and Spring Boot media storage for files.
- Keep audit logging enabled for create, update, approve, dispense, upload, download, login, and logout actions.
- Before real deployment, test role isolation, IDOR prevention, report release rules, and unauthorized media access.
