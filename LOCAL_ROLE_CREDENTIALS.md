# GovCare local role login table

These are **prepared local test accounts**, created only after `npm run accounts:local`.
They are not existing production passwords. The script keeps existing accounts and passwords.
Every newly created account requires a password change on its first login.

## Setup

1. Install PostgreSQL command-line tools and configure `spring-api/.env` for your **local** database.
2. Start the updated backend once so Flyway V31 and V32 finish.
3. Run `npm run accounts:local` from the project root. On Windows, `setup-role-logins-windows.bat` runs the same command.
4. Sign in at `/login` with a row below, change the temporary password, and continue to its dashboard.
5. Patient data appears only after a trusted patient identity is linked. No clinical data is invented by this setup.

Default hospital code: `NHSL`. Set `GOVCARE_LOCAL_HOSPITAL_CODE` for another existing active hospital.
Optionally set `GOVCARE_LOCAL_PATIENT_NO` to an existing patient number in that hospital and
`GOVCARE_LOCAL_WARD_DEPARTMENT` to an existing department code. An invalid supplied link rolls back setup.
Guardian data remains unavailable until a trusted guardian relationship source is implemented.

| Role | Username (email) | Initial temporary password | Dashboard |
| --- | --- | --- | --- |
| Super Admin | superadmin.local@govcare.test | `Gc1!55r1yqsr4o7jXQ` | /super-admin |
| Hospital Admin | hospitaladmin.local@govcare.test | `Gc1!lZI1hH0wtiLDYg` | / |
| Doctor | doctor.local@govcare.test | `Gc1!UHwb3JruS1LgUA` | / |
| Nurse | nurse.local@govcare.test | `Gc1!qxcQQbsBKpmMkg` | / |
| Front Desk Officer | receptionist.local@govcare.test | `Gc1!zadczfQ_YSr-DQ` | / |
| OPD Officer | opdofficer.local@govcare.test | `Gc1!RkbSR0rBjP3zEQ` | / |
| Ward Manager | wardmanager.local@govcare.test | `Gc1!6Z6fDOc69uhc-Q` | / |
| Laboratory Technician | labtechnician.local@govcare.test | `Gc1!t0DT1FakFOPOHQ` | / |
| Radiology Technician | radiologytechnician.local@govcare.test | `Gc1!Ne1gd2jFvFeb_Q` | / |
| Pharmacist | pharmacist.local@govcare.test | `Gc1!dAqqoMhZunVpWQ` | / |
| Inventory Officer | inventoryofficer.local@govcare.test | `Gc1!5FX0ZqW9_Za8fA` | / |
| Finance Officer | financeofficer.local@govcare.test | `Gc1!pFbDRtgEL_gsng` | / |
| Records Officer | recordsofficer.local@govcare.test | `Gc1!XFYZsf-BYhOo-Q` | / |
| Patient | patient.local@govcare.test | `Gc1!4H3GLgBXypVHUg` | /portal |
| Guardian | guardian.local@govcare.test | `Gc1!GY603apkLvPW9A` | /portal |
| Emergency Staff | emergencystaff.local@govcare.test | `Gc1!95ib1j_uqVuocA` | / |
| Quality Officer | qualityofficer.local@govcare.test | `Gc1!GSY_VhWcGF7DGQ` | / |
| IT Administrator | ictadmin.local@govcare.test | `Gc1!ZTDNLMDA9ifV8A` | / |
| Surgeon | surgeon.local@govcare.test | `Gc1!LeHvQZT5UV14ZQ` | / |
| Anesthetist | anesthetist.local@govcare.test | `Gc1!VYZ2yRuvaDi4RQ` | / |
| Laboratory Manager | labmanager.local@govcare.test | `Gc1!8AN8WEze5WMpmw` | / |
| Pathologist | pathologist.local@govcare.test | `Gc1!kHScmjqRD75PXg` | / |
| Radiologist | radiologist.local@govcare.test | `Gc1!tmwVHgWTl8jU4g` | / |
| Mortuary Officer | mortuaryofficer.local@govcare.test | `Gc1!abTXyT2kdBFJIQ` | / |

## Original source-seeded accounts

The uploaded source contains only these three seed logins. Their initial password is
`GovCare@123` **only if it has not been changed**. Flyway inserts them only when absent.

| Role | Username | Source initial password |
| --- | --- | --- |
| Super Admin | superadmin@govcare.gov.lk | GovCare@123 |
| Doctor | doctor@govcare.gov.lk | GovCare@123 |
| Patient | patient@govcare.gov.lk | GovCare@123 |

Existing passwords cannot be read from PostgreSQL password hashes. For existing staff, use
Staff Management's Reset Password action to issue a new temporary password.
For an account blocked by the legacy MFA flag, the supplied `ACCOUNT_ACCESS_RECOVERY.md`
describes the explicit local recovery scripts. This patch does not disable existing MFA.

## Production accounts

Use Staff Management to create real staff with unique temporary passwords and the correct hospital and department.
Keep the local credential files out of a production installation. They are never executed by Flyway or application startup.
