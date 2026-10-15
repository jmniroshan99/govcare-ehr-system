# Build and apply the GovCare theme update

Use a new extracted source directory or back up the existing project before replacing its source. Keep the existing PostgreSQL database and your current backend configuration. This update requires no additional migration or demo-data load.

## Requirements and normal checks

The verification environment used Node 24.19.0, npm 11.9.0, JDK 21 and Maven 3.9.11. The original project lockfile and runtime dependencies are preserved. Installed core frontend dependencies matched the lockfile.

From the extracted project root:

```sh
npm ci
npm run build
npm run test:roles
npm run test:dashboard
npm run test:theme
npm run test:startup
npm run test:java:syntax
npm run test:superadmin
cd spring-api
mvn clean test
```

Set `JAVA_HOME` to a full JDK 21 installation and put Maven on PATH. The syntax checker uses the actual Java compiler parser; the focused service test compiles application services with isolated framework and SQL/JSON adapter doubles. Neither is a substitute for `mvn clean test`.

For Windows PowerShell, run the frontend checks from the project root, then:

```powershell
Push-Location spring-api
mvn clean test
Pop-Location
npm run dev:full
```

Keep the existing `spring-api/.env` settings. Use the included original full-stack/Windows launchers, or `npm run dev:full`; the launcher prints the frontend URL. The normal frontend configuration is http://127.0.0.1:5300 and the API is http://127.0.0.1:4002. Refresh the browser after rebuilding.

If your installed copy still reports dashboard semicolon errors, confirm that its `DashboardIntelligenceService.java` matches this archive. The supplied file already contains the prior extra-parenthesis correction. Do not rewrite SQL, alter applied Flyway migrations or downgrade Spring Boot to bypass an unavailable dependency download.

## Actual role login and screenshots

Use an isolated local test installation with representative PostgreSQL records and enabled role accounts whose required password changes are completed. Copy the existing role-credentials JSON to a private file and set its current passwords. The script does not reset passwords or bypass authentication.

Install an optional browser test dependency without modifying the project lockfile:

```sh
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
```

Configure and run on Windows PowerShell:

```powershell
$env:GOVCARE_VISUAL_URL = "http://127.0.0.1:5300"
$env:GOVCARE_VISUAL_ACCOUNTS = "C:\GovCareTest\private-role-credentials.json"
npm run test:theme:browser
```

Or on macOS/Linux:

```sh
GOVCARE_VISUAL_URL=http://127.0.0.1:5300 GOVCARE_VISUAL_ACCOUNTS=/private/role-credentials.json npm run test:theme:browser
```

The private JSON is an array of `{ "role": "...", "email": "...", "password": "..." }`. Supply Super Admin, Doctor and Patient at minimum; supply one account for every requested role for the complete role/viewport pass. Use your actual test credentials and keep the private file outside source control.

The verifier signs in through the UI, checks the role returned by the live dashboard API and its displayed title, tests both modes at all four widths, rejects horizontal viewport overflow and selected clipped headings, checks for browser runtime errors and dashboard refetches during theme changes, and captures full-page PNGs. It writes `verification/screenshots/browser-report.json` and `<role>-<theme>-<width>.png`. It uses no mocked API data or fabricated patient names.

For example the required views become `super_admin-dark-1366.png`, `super_admin-light-1366.png`, `doctor-dark-1366.png`, `doctor-light-1366.png`, `patient-dark-1366.png` and `patient-light-1366.png`, with additional files for the other widths and supplied roles. These filenames describe outputs of the verifier; they are not included as screenshots in this delivery because no browser run completed here.

The existing `npm run verify:roles` also validates live role selection, temporary-password gates, cross-hospital denial and staff-administration denial. Follow [ACCESS_ROLE_BUILD_INSTRUCTIONS.md](ACCESS_ROLE_BUILD_INSTRUCTIONS.md) to set its private credentials path.
