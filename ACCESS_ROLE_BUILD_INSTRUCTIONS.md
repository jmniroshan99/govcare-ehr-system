# Build and apply the GovCare role fix

## Requirements

- Node.js 22+ and npm 10+
- Java **JDK 21**
- Apache Maven 3.9+ on PATH (the included launchers use installed Maven)
- PostgreSQL with `pgcrypto`

## Build and tests

From the project root:

```sh
npm ci
npm run test:roles
npm run test:dashboard
npm run test:startup
npm run build
cd spring-api
mvn test
```

Configure `spring-api/.env` from its example with your PostgreSQL connection and JWT secret.
Start the API with `npm run spring:api` or the supplied Windows backend launcher.
Flyway applies V31 and V32 once; keep already-applied migration files unchanged.

## Local account setup

After V32 has completed on a local database:

```sh
npm run accounts:local
```

Windows users can run `setup-role-logins-windows.bat`.
The script reads `spring-api/.env`, accepts process environment overrides, detects the Windows PostgreSQL installation,
and rejects a non-loopback database. See `LOCAL_ROLE_CREDENTIALS.md` for all logins.

Optional settings: `GOVCARE_LOCAL_HOSPITAL_CODE`, `GOVCARE_LOCAL_PATIENT_NO`,
`GOVCARE_LOCAL_WARD_DEPARTMENT`, `GOVCARE_PSQL_PATH`.
It creates no hospital, patient, clinical or queue records and never changes an existing password.

## Login verification

Sign in as each local role at `/login` and change its temporary password.
Copy `database/postgresql/local-role-credentials.json` to a private file and replace its passwords with the
new passwords you chose. Do not commit that private file.

Point `GOVCARE_ROLE_CREDENTIALS` to it, then run:

```sh
npm run verify:roles
```

The verifier checks role selection, the temporary-password gate, cross-hospital rejection and staff-administration
rejection. It deliberately returns a nonzero status while any dashboard still requires a password change.
Its default API URL is `http://127.0.0.1:4002`; `GOVCARE_TEST_API_URL` can select another local port.

Test the actual dashboard at 375, 768, 1366 and 1920 CSS pixels with representative PostgreSQL data.
Validate doctor assignments, patient's released records and missing-source states before deployment.

## Production setup

Create real staff through Staff Management with their actual hospital/department assignments and unique passwords.
The local account SQL and credential files are test aids and must not be run in a production database.
