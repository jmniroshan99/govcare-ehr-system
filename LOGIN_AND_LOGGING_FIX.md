# Login and logging repair

This release repairs the authentication and login-activity problems found in the ward/bed build.

## Fixed authentication problems

- The login screen defaulted to `doctor@govcare.gov.lk`, but Flyway seeded only the super administrator.
- The patient demo button referenced `patient@govcare.gov.lk`, which also did not exist.
- Migration `V12__repair_login_accounts_and_audit_sessions.sql` now creates both advertised demo accounts without replacing existing accounts.
- A stale JWT is removed before every new local sign-in attempt.

## Fixed login-activity problems

- Spring Boot and the browser previously created two different audit rows for one successful login.
- The browser now stores the exact `sessionId` returned by Spring Boot.
- Logout and timeout operations close the correct database audit row.
- Failed email/password attempts are written by Spring Boot in an independent transaction, even when authentication is rejected.
- Historical active rows left by the previous duplicate-session implementation are safely marked `timed_out` during V12 migration.
- The browser login-activity endpoint now requires JWT authentication and uses the authenticated user identity instead of trusting a submitted email.

## Fixed runtime logging

- Replaced raw `printStackTrace()` output with structured SLF4J error logging.
- Every unexpected API error returns a short `errorId` that can be searched in the backend log.
- Added rolling file logs at `spring-api/logs/govcare-spring-api.log` by default.
- Log files rotate at 10 MB and retain up to 14 history files, capped at 200 MB.

## Demo accounts

- Super Admin: `superadmin@govcare.gov.lk` / `GovCare@123`
- Doctor: `doctor@govcare.gov.lk` / `GovCare@123`
- Patient: `patient@govcare.gov.lk` / `GovCare@123`

Change all demo passwords before production use.
