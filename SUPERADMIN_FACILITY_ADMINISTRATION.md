# Super Admin facility administration

Updated: 2026-10-04

## Result

Super Admin has a dedicated **Hospital Setup** command center at `/admin/facilities`. The dashboard quick action, governance menu and route guard all lead to the same workflow:

1. Create a hospital.
2. Optionally provision OPD, Emergency, Inpatient, Laboratory, Radiology and Pharmacy departments in the same transaction.
3. Select the hospital and department, then create a ward.
4. Select the new ward and create 1–200 beds in a server-generated batch.

Every total displayed on the page is read from PostgreSQL. The feature creates only master data explicitly submitted by Super Admin. It does not create patients, admissions, staff, dashboard totals or clinical records.

## Access and security

| Layer | Enforcement |
| --- | --- |
| Frontend route | `super_admin` role plus `HOSPITAL_MANAGE` |
| Hospital API | `hasRole('SUPER_ADMIN')` and `hasAuthority('HOSPITAL_MANAGE')` |
| Ward creation | `WARD_MANAGE` plus validated hospital scope |
| Bed creation | `BED_MANAGE` plus validated ward/hospital scope |
| Department link | Must be active and belong to the selected hospital |
| Room link | Must belong to the selected ward |
| Bulk size | 1–200 beds |
| Identifiers | Database uniqueness for ward bed numbers and hospital bed codes |
| Room capacity | Batch is rejected if it exceeds `maximum_beds` |
| Audit | `HOSPITAL_CREATED`, `WARD_CREATED`, and `BEDS_BULK_CREATED` |

Flyway `V33__superadmin_facility_administration.sql` adds `HOSPITAL_MANAGE`, grants it to Super Admin and restores all current permissions for that network-owner role. Other roles receive no hospital-creation permission. Hospital Admin and Ward Manager retain their existing hospital-scoped ward/bed capabilities. Patient and guardian self-service routes remain identity-scoped.

## API changes

| Method and path | Purpose | Permission |
| --- | --- | --- |
| `GET /api/admin/facilities` | Network hospitals and live department/ward/bed counts | Super Admin + HOSPITAL_MANAGE |
| `POST /api/admin/facilities/hospitals` | Create one hospital and optional core departments | Super Admin + HOSPITAL_MANAGE |
| `POST /api/wards` | Existing ward creation; now validates department ownership | WARD_MANAGE |
| `POST /api/wards/{wardId}/beds/bulk` | Create a validated numbered bed range | BED_MANAGE |
| `GET /api/wards?hospitalId=...` | Load wards for the selected hospital | WARD_VIEW |
| `GET /api/wards/{wardId}/rooms` | Load optional room targets and capacity | WARD_VIEW |

Example bulk request:

```json
{
  "numberPrefix": "B",
  "codePrefix": "MED-01-B",
  "startNumber": 1,
  "count": 20,
  "padding": 3,
  "bedType": "STANDARD",
  "genderRestriction": "ANY",
  "ageRestriction": "ANY",
  "oxygenSupport": false,
  "ventilatorSupport": false,
  "monitorSupport": false,
  "isolationSupport": false,
  "electricBed": false,
  "accessibleBed": false
}
```

This creates `B001` through `B020`. The server derives a code prefix from the ward when `codePrefix` is omitted.

## PostgreSQL 18 dashboard correction

The supplied runtime log showed three failures at `::date day` in patient growth, department heatmap and system activity queries. Every dashboard CTE that used the unquoted `day` alias now uses `activity_day`; joins use `activity_day`, and `:today::date` is written as `cast(:today as date)`. This also protects the same date-axis pattern used by Doctor, Radiology, Front Desk, Emergency, Quality and Hospital Admin dashboards.

## Installation and use

1. Extract the source and retain the existing `.env` files and PostgreSQL database.
2. Run `npm ci` and `npm run build`.
3. Run `cd spring-api` followed by `mvn clean test`.
4. Start the complete stack with `npm run dev:full`. Flyway applies V33 automatically.
5. Sign out and sign in as Super Admin to refresh permissions.
6. Open **Governance → Hospital Setup**.

No manual SQL execution is required. Existing hospitals, wards, beds, RBAC grants, FHIR resources and CKD AI-CDSS records are preserved.
