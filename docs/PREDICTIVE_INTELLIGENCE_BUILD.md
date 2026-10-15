# Build and local verification

## Requirements

Use Java 21, Maven 3.9+, PostgreSQL with the existing GovCare schema/migrations, and Node 24 (the version used for this verification). Use the committed package-lock.json for frontend dependencies. Existing application deployment instructions remain applicable.

No production database was modified during this delivery. Review and apply the additive V35 migration through the existing Flyway startup on a backed-up test installation before deployment. Configure your own DB and JWT secrets; no credentials are supplied by this upgrade.

## Frontend

```sh
npm ci
npm run build
npm run dev
```

If required, configure `VITE_API_BASE_URL` for your Spring API before starting/building Vite. The current default is `http://127.0.0.1:4002`.

For the local complete stack, use `npm run dev:full` from the project root. The launcher selects available frontend/API ports and supplies the matching API URL automatically. `dev:open` uses the same port selection for its detached processes. See `STARTUP_PORT_CONFLICT_FIX.md` for explicit port settings and the occupied-port correction.

## Backend

```sh
cd spring-api
mvn clean test
mvn spring-boot:run
```

Set the existing `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET` and CORS configuration for your installation. Flyway adds V35 after the existing migrations. Do not disable authentication or substitute local demo data to bypass an unavailable API.

## Repeatable checks

From the source root with JAVA_HOME pointing to Java 21:

```sh
npm run test:predictive
npm run test:roles
npm run test:dashboard
npm run test:theme
npm run test:patient-registration
npm run test:doctor-workspace
npm run test:superadmin
npm run test:java:syntax
npm run test:startup
```

`test:predictive` compiles/runs the real dependency-free Java domain engine, tests the frontend role boundary and applies the actual migration chain in ephemeral PGlite with pgcrypto. It checks new SQL queries/writes, tenant constraints, review locking, idempotency constraints and append-only history. It does not replace a full Maven/Spring/PostgreSQL integration run.

`test:startup` covers local port selection and launcher configuration with actual TCP listeners and a controlled external Maven executable. The supplied Windows log separately confirms the real Java build, 72 Maven tests and V35 migration success.

## Live browser and screenshots

Install Playwright and Chromium in your local test tool environment. Supply a private JSON account array through `GOVCARE_VISUAL_ACCOUNTS`, containing enabled accounts with `{role,email,password,patientId,forbiddenPatientId?}`. Use disposable test accounts/patients and complete temporary-password changes first. Include at least Super Admin, Doctor and Patient; include all other roles to extend the login/access exercise.

Set `GOVCARE_VISUAL_URL`, `GOVCARE_VISUAL_API`, and optionally `GOVCARE_PLAYWRIGHT_MODULE` to a locally installed Playwright module file. Then run:

```sh
npm run test:predictive:browser
```

The helper signs in normally, verifies backend access/denial, tests unassigned-patient denial when configured, switches dark/light at 375/768/1366/1920, captures screenshots, checks page overflow/clipped headings/runtime errors and verifies that chart/theme controls do not refetch clinical history. It opens/closes review dialogs without saving clinical decisions. No mocked patient responses or authentication bypass are used.

Screenshots are written to `verification/predictive-screenshots` by default and can contain the test patient's details. Keep private account files, tokens and patient-containing output outside your source repository. No live screenshots were captured in the delivery environment; see the testing report for the concrete blockers.
