# GovCare access role fix

Target: the uploaded `GovCare_EHR_Hospital_Intelligence_Dashboard_PRODUCTION_PACKAGE(1).zip`.
Changes were applied to a separate copy of that source project.

## Repaired behavior

- Added the six missing operational roles end to end: OPD Officer, Ward Manager, Inventory Officer, Finance Officer, Emergency Staff and Quality Officer.
- Preserved the existing role codes `receptionist` and `ict_admin`, displaying them as Front Desk Officer and IT Administrator. Backend staff creation also accepts those public labels.
- Replaced separate route, navigation and dashboard-action checks with one explicit frontend route policy. Unknown paths are denied; path lookalikes cannot inherit a module's access.
- Every active role can open its own account profile and password page. Shared pages no longer exclude laboratory, pharmacy, radiology, records, admin or guardian accounts.
- Login routes every temporary-password account, including Patient and Guardian, through the password-change page.
- A stale or unauthorized database default route falls back to a route the account can access.
- Authentication profiles refresh on focus and every 60 seconds while visible. User, role, hospital, department, patient identity, status and permission changes clear clinical caches and React Query data.
- The server selects the dashboard from the authenticated principal. Role-specific data queries require the corresponding content permissions; a permission for an unrelated report cannot unlock inventory or clinical data.
- Hospital isolation, doctor assignments and patient-self/release conditions remain in server queries. Nurse and Guardian patient data remains unavailable until authoritative assignment/link sources exist.
- The legacy hospital-wide overview endpoint now requires hospital administration. Other roles cannot use it to bypass the role-specific endpoint.
- Analytics and Efficiency routes now render the role aggregation rather than hardcoded report rows.
- Staff creation options are derived from the Java role enum, preventing new roles from disappearing from a second hardcoded catalog. Hospital Admin still cannot create or modify Super Admin, Hospital Admin or IT Admin accounts.
- Removed the frontend patient-profile fallback that invented an identity when the API failed.

## Database / API upgrade

Flyway V31 adds the six operational roles, dashboard permission, role mappings and indexes.
V32 repairs mismatched `app_users.role_id` values, aligns default routes/names, and enables governed
OPD registration and emergency capacity permissions. Neither migration resets credentials,
disables MFA or changes account status.

Added: `GET /api/dashboard/intelligence?hospitalId=<optional UUID>`.
Retained: existing authentication, clinical, FHIR, CKD AI-CDSS and workflow APIs.
The legacy `GET /api/dashboard/overview` retains its response shape, with hospital-administration access.

## Credentials

See `LOCAL_ROLE_CREDENTIALS.md`. The 24 local test logins are deliberately provisioned outside Flyway
using `npm run accounts:local`; they are not automatically installed on startup.
Only existing hospitals, departments and optional patient identities are referenced.
Existing accounts are never overwritten. First login requires a password change.

The original source defines only three initial accounts. Current live passwords cannot be recovered
from bcrypt hashes, and no live PostgreSQL account list was available here.

## Validation

See `ACCESS_ROLE_TESTING_REPORT.md`. The frontend build, 63 Node checks and 65 backend tests passed.
The October 1 correction removes all 25 dashboard Java syntax errors reported in the startup log;
see `DASHBOARD_COMPILE_FIX.md` for the replacement patch and exact changes.
Live database execution, real role logins and viewport rendering remain unverified;
this delivery is not represented as a fully certified production deployment.
