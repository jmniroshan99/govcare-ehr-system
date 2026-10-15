# GovCare ten-hospital demo dataset

The supplied project adds ten clearly labelled synthetic hospitals. The requested patient,
doctor and ward counts apply **to each hospital**, not to the network total. The original
NHSL hospital and its accounts are kept; a clean installation therefore has eleven hospitals
including NHSL.

| Hospital code | Synthetic location | Patients | Doctors | Wards | Beds |
| --- | --- | ---: | ---: | ---: | ---: |
| DEMO-HOSP-01 | Colombo | 400 | 100 | 100 | 800 |
| DEMO-HOSP-02 | Kandy | 400 | 100 | 100 | 800 |
| DEMO-HOSP-03 | Galle | 400 | 100 | 100 | 800 |
| DEMO-HOSP-04 | Jaffna | 400 | 100 | 100 | 800 |
| DEMO-HOSP-05 | Trincomalee | 400 | 100 | 100 | 800 |
| DEMO-HOSP-06 | Kurunegala | 400 | 100 | 100 | 800 |
| DEMO-HOSP-07 | Anuradhapura | 400 | 100 | 100 | 800 |
| DEMO-HOSP-08 | Badulla | 400 | 100 | 100 | 800 |
| DEMO-HOSP-09 | Ratnapura | 400 | 100 | 100 | 800 |
| DEMO-HOSP-10 | Gampaha | 400 | 100 | 100 | 800 |
| **New demo totals** | | **4,000** | **1,000** | **1,000** | **8,000** |

## Load the records on your computer

1. Extract the full ZIP to a folder. Install Node.js 22+, Java 21, Maven 3.9+ and PostgreSQL
   with its `psql` command-line tools. Run `npm ci` from the extracted project folder.
2. Complete [ACCESS_ROLE_BUILD_INSTRUCTIONS.md](ACCESS_ROLE_BUILD_INSTRUCTIONS.md), including
   the PostgreSQL database and `spring-api/.env`. The loader reads `DB_URL`, `DB_USERNAME`
   and `DB_PASSWORD` from that file; existing process environment variables take precedence.
   Use a local development or QA database.
3. Start the updated Spring API once with `npm run spring:api`. Wait for startup to finish:
   Flyway must have applied V32 successfully. Keep the API running, or stop it before loading.
4. On Windows, double-click **`setup-demo-network-windows.bat`** from the extracted folder.
   It loads the records and immediately verifies their counts and relationships. Alternatively,
   on any supported platform run these commands from the project folder:

   ```bash
   npm run demo:seed
   npm run demo:verify
   ```

5. Start the frontend with `npm run dev`, or use the existing full-stack launcher. Sign out
   of an existing NHSL account. Open `database/postgresql/demo-network-credentials.csv`,
   select an account for the desired demo hospital, sign in, and change its initial password.

Windows PostgreSQL installations in `C:\Program Files\PostgreSQL` are detected automatically.
If `psql` is elsewhere, set `GOVCARE_PSQL_PATH` to the executable's full path. The loader
refuses remote PostgreSQL URLs and production profiles. It runs the complete fixture and
relationship checks in one transaction; a failure rolls back the load.

## Where patients are linked

Each hospital has 106 departments: administration, reception, OPD, laboratory, radiology,
pharmacy and a separate department for each of its 100 wards. Each ward has a responsible
doctor, one room and eight beds. On the first load, two beds per ward are occupied.

| Record | Per hospital | Network total |
| --- | ---: | ---: |
| Patient visits | 400 | 4,000 |
| Initial active inpatient admissions | 200 | 2,000 |
| Active bed assignments on first load | 200 | 2,000 |
| Outpatient appointments | 200 | 2,000 |
| OPD queue entries | 200 | 2,000 |
| Login accounts | 106 | 1,060 |
| Linked guardians | 1 | 10 |

Doctor 001 is linked to patients 0001–0004, doctor 002 to patients 0005–0008, and so on.
Every doctor has two inpatient and two outpatient assignments. Visits use the actual
doctor foreign key, so the existing clinical-access query can find the assigned patients.
The hospital's nurse and ward manager are assigned to ward department 001. The patient
and guardian portal accounts both link to patient 0001, a synthetic child linked to that guardian.

Patient numbers are `PAT-NET-H01-0001` through `PAT-NET-H01-0400` in hospital 01;
replace `H01` with `H02`…`H10` for the other hospitals. Names, addresses, identifiers and
email domains clearly mark the records as synthetic. Clinical histories are empty defaults:
the fixture does not invent CKD predictions, diagnoses, vital observations, lab results or prescriptions.
Analytics continue to read database/API records; unavailable clinical metrics stay unavailable.

## Login account patterns

Each row of `demo-network-credentials.csv` contains the hospital, role, name, username,
**unique initial password**, department and dashboard. The 1,060 passwords are unique,
precomputed bcrypt hashes are stored in PostgreSQL, and first-login password change is required.

| Role | Accounts per hospital | Hospital 01 username pattern |
| --- | ---: | --- |
| Doctor | 100 | `doctor.h01.001@govcare.test` … `doctor.h01.100@govcare.test` |
| Hospital Admin | 1 | `admin.h01@govcare.test` |
| Front Desk / Receptionist | 1 | `reception.h01@govcare.test` |
| Nurse | 1 | `nurse.h01@govcare.test` |
| Ward Manager | 1 | `wardmanager.h01@govcare.test` |
| Patient | 1 | `patient.h01@govcare.test` |
| Guardian | 1 | `guardian.h01@govcare.test` |

Replace `h01` with `h02`…`h10` for the other hospitals. Existing superadmin and other local
role accounts remain as documented in [LOCAL_ROLE_CREDENTIALS.md](LOCAL_ROLE_CREDENTIALS.md).
If those optional accounts have not yet been provisioned, use the existing `npm run accounts:local`.
Their CSV/password list is separate from the new hospital-specific accounts.

Existing NHSL users retain their original hospital. A hospital-specific demo login is needed
to view that demo hospital's registered patients; the loader does not change existing tenant
membership or broaden role permissions. Search by the patient number when an existing
screen limits the number of displayed patients.

## Repeatability and API/database changes

The seed is outside Flyway and never runs automatically at API startup. No Spring API,
authentication, RBAC, FHIR or CKD module code changes are included in this dataset update.
No new database tables or migrations are required. The seed inserts into existing tables:
`hospitals`, `departments`, `guardians`, `patients`, `app_users`, `wards`, `ward_rooms`,
`beds`, `appointments`, `visits`, `opd_queue`, `admissions` and `patient_bed_assignments`.

Re-running `npm run demo:seed` uses stable identifiers to avoid duplicate records. It keeps
edited patient details, ward names, changed passwords, completed queue entries and discharged
admissions/bed states. Initial credentials in the CSV stop working after a password change;
loading again does not reset them. If a reserved demo hospital/account identifier belongs to
unrelated data, the loader stops rather than adopting it.

The local test suite runs the full uploaded PostgreSQL schema and fixture without needing
a PostgreSQL server: `npm run test:demo`. See the separate testing report for results and limits.
