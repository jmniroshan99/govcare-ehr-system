# GovCare dashboard compilation correction

Date: 2026-10-01 UTC.

## Problem and correction

The supplied Windows `npm run dev:full` log shows 25 `';' expected` errors in
`DashboardIntelligenceService.java`. Chart and worklist statements contained one extra closing
parenthesis. All 25 statements were corrected. A real Java 21 compiler parser reproduced every
reported error location in the previously delivered file, then accepted all 136 corrected Java sources.

## Modified code

| File | Change |
| --- | --- |
| spring-api/src/main/java/lk/gov/health/govcare/dashboard/DashboardIntelligenceService.java | Remove the extra closing parenthesis in each of the 25 affected statements |
| spring-api/pom.xml | Load Mockito explicitly in the test JVM; quote its resolved dependency path so paths containing spaces work |
| spring-api/src/test/java/lk/gov/health/govcare/dashboard/DashboardServiceTest.java | Validate the admin calendar-day calculation and explicitly reject doctor access to hospital aggregates |

Mockito test setup follows the [Mockito 5.17.0 Java 21 instructions](https://javadoc.io/static/org.mockito/mockito-core/5.17.0/org.mockito/org/mockito/Mockito.html#0.3).
The agent is configured for Maven Surefire tests only. The Spring Boot application launch command,
runtime dependencies, API contracts, migrations, role grants, account credentials, CKD and FHIR code
are preserved by this correction.

## Apply the small patch to the existing Windows project

1. Stop the running application with Ctrl+C.
2. Place `GovCare_Dashboard_Compile_Fix.zip` in your existing project folder.
3. Open PowerShell in that project folder and run:

```powershell
Expand-Archive -LiteralPath .\GovCare_Dashboard_Compile_Fix.zip -DestinationPath . -Force
npm run dev:full
```

The patch contains the three files listed above and this guide, with their project-relative paths.
It preserves your existing `.env`, PostgreSQL data, installed frontend dependencies and account setup.
The launcher already runs `clean spring-boot:run`, so it rebuilds the corrected source.

## Use the complete source package

Extract `GovCare_EHR_Access_Roles_COMPILE_FIXED_FULL_SOURCE.zip` into a new folder.
Copy your existing backend configuration to `spring-api/.env`, then run:

```powershell
npm ci
npm run build
Push-Location spring-api
mvn clean test
Pop-Location
npm run dev:full
```

## Verification

| Check | Result |
| --- | --- |
| Frontend TypeScript/Vite production build | PASS |
| Frontend role, dashboard and launcher checks | 63 passed |
| Clean Java 21 backend compilation | 132 application files and 4 test files compiled |
| Maven backend tests | 65 passed; zero failures, errors or skipped tests |
| Test agent dependency path containing spaces | PASS in the final Maven run |

See `ACCESS_ROLE_TESTING_REPORT.md` for verification scope. Live PostgreSQL startup, actual role logins,
Flyway execution and browser viewport rendering have not been verified in this correction.
