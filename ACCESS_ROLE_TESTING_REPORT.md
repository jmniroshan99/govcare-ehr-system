# Access role validation report

Date: 2026-10-01 UTC.

Updated after reproducing and correcting the 25 Java compilation errors in the supplied Windows startup log.
Backend verification used OpenJDK 21.0.12 and Apache Maven 3.9.11. The test run also used a Maven repository
path containing spaces to verify quoting of the Mockito agent argument.

| Check | Result | Evidence / scope |
| --- | --- | --- |
| `npm ci --no-audit --no-fund` | PASS | 161 locked dependencies installed |
| `npm run build` | PASS | TypeScript and Vite production build |
| `npm run test:roles` | PASS: 44/44 | Executes the actual TypeScript access policy and account setup configuration |
| `npm run test:dashboard` | PASS: 7/7 | Dashboard role/data contracts, translations, lazy charts and responsive source rules |
| `npm run test:startup` | PASS: 12/12 | Existing launch, port, environment and failure propagation checks |
| Original Java source reproduction | CONFIRMED | Real Java 21 compiler parser reports the same 25 error locations as the supplied log |
| Corrected Java syntax | PASS | All 136 application/test Java sources parsed successfully |
| `mvn clean test` in `spring-api` | PASS: 65/65 | Clean compilation of 132 application and 4 test files; zero failures, errors or skipped tests |
| Live login / dashboard for 24 roles | BLOCKED | `npm run verify:roles` attempted all 24; API requests failed because the API/PostgreSQL stack is not running |
| Flyway V31/V32 and account SQL execution | NOT EXECUTED | PostgreSQL client/server unavailable |
| 375 / 768 / 1366 / 1920 pixel browser rendering | NOT EXECUTED | Playwright module exists but Chromium binary is not installed |
| ZIP integrity and source manifest | PASS | Archive verified after packaging |

## Executed access checks

All 24 supported roles were tested for permitted landing pages and shared profile access.
Workflow checks cover API-granted permission removal, unknown routes, path lookalikes,
suspended accounts, patient/guardian and nonclinical restrictions, stale default routes,
cache context changes and local-only account provisioning.

These checks validate frontend access decisions; they do not substitute for real login or database authorization tests.

## Executed backend tests

| Test class | Executions | Result |
| --- | --- | --- |
| DashboardIntelligenceServiceTest | 7 | PASS |
| DashboardRoleAccessTest | 51 | PASS |
| DashboardServiceTest | 5 | PASS |
| UserRoleTest | 2 | PASS |

Tests cover all 24 role-to-dashboard selections, all 23 non-super-admin cross-hospital denials,
revoked clinical/inventory permissions, inactive and temporary-password accounts,
doctor/patient identity predicates, patient release conditions, unavailable nursing/finance sources,
admin calendar-day boundaries and denial of clinical access to the legacy hospital overview.
SQL collaborators are mocked: these unit tests do not execute PostgreSQL or real authentication.

The first Maven test attempt compiled the backend but failed because Mockito could not attach its
agent in this environment. An explicit test JVM agent fixed that setup. The subsequent run identified
an outdated test that expected a doctor to read hospital-wide aggregates. That test was updated to the
intended administrator-only contract, with a separate doctor-denial test. The final clean run passed.
The laboratory-failure test intentionally logs a simulated DataAccessResourceFailureException.

## Required deployment acceptance

1. Execute `mvn test` with JDK 21; resolve any failures before deploying.
2. Run Flyway on a database copy and confirm V31/V32 success.
3. Provision local test accounts, change their first-login passwords and run `npm run verify:roles`.
4. Verify real doctor and patient identities; attempt cross-hospital and unauthorized module requests.
5. Inspect all four viewport sizes, keyboard navigation and Data unavailable states against the live API.
