# Patient Registration Verification Report

Date: 2026-10-04 (UTC)

Scope: Quick Registration UI, Doctor Workspace profile behavior, modern e-Prescribing workflow, validation, duplicate protection, PostgreSQL migration, theme compatibility, existing RBAC, dashboard contracts, startup scripts, Super Admin facility/clinical authorization, and Java syntax.

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run build` | PASS | TypeScript project build and Vite 8.3.1 production build completed; 3,413 modules transformed |
| `npm run test:patient-registration` | PASS | 8/8 workflow and security contract tests passed |
| `npm run test:doctor-workspace` | PASS | 5/5 profile-collapse, safety-strip, note-focus, patient-change, guided e-Prescription, and live medication-safety tests passed |
| `npm run test:searchable-select` | PASS | 3/3 viewport collision, static/API selector placement, scroll/resize recalculation, and bounded-list tests passed |
| PostgreSQL migration simulation | PASS | `walk_in` default, explicit `emergency`, invalid-value rejection, and partial index creation verified with PGlite/PostgreSQL semantics |
| Executable patient schema cases | PASS | 6/6: valid NIC, invalid NIC, future DOB, province/district mismatch, passport, birth certificate |
| `npm run test:roles` | PASS | 45/45 RBAC and route-isolation tests passed |
| `npm run test:dashboard` | PASS | 7/7 role-dashboard contract tests passed |
| `npm run test:theme` | PASS | 10/10 light/dark contrast, chart, persistence, and print-colour tests passed |
| `npm run test:startup` | PASS | 12/12 Spring/full-stack launcher tests passed |
| `npm run test:facilities` | PASS | 6/6 hospital, ward, bed, permission, audit, and PostgreSQL date-axis tests passed |
| `npm run test:superadmin` | PASS | 11/11 navigation/facility/network tests and 20/20 isolated Java production-service checks passed |
| `npm run test:java:syntax` | PASS | All 140 Java source files parsed; 0 syntax errors |
| `mvn -B -ntp clean test` | ENVIRONMENT BLOCKED | Maven could not resolve the Spring Boot 3.5.3 parent because `repo.maven.apache.org` DNS/network access is unavailable in this execution environment |

## Maven limitation

The requested Maven command was executed from `spring-api` with Java 21 and Maven 3.9.11. It stopped while reading the POM, before compiling project code:

```text
Non-resolvable parent POM ... spring-boot-starter-parent:pom:3.5.3
Unknown host repo.maven.apache.org: Temporary failure in name resolution
```

This is a dependency-download limitation, not a Java compiler failure. To retain meaningful backend evidence despite that external block:

- Every Java source was parsed successfully.
- The existing isolated Java 21 harness compiled the dashboard and clinical service set with framework/SQL/JSON adapters.
- Twenty authorization, hospital-isolation, patient-selection, FHIR/AI tenant, and document-access scenarios passed.
- The V34 SQL migration was executed against a PostgreSQL-compatible engine and its default, constraint, and index were asserted.

Run `mvn clean test` once from an environment with Maven Central access before deployment. The next run should download the absent parent and dependencies into the local Maven repository.

## Responsive and accessibility verification

The production CSS and registration contract tests assert:

- 1 column below 768 px.
- 2 columns from 768 px through 1439 px.
- 3 columns from 1440 px upward, including 1920 px.
- No four-column registration rule.
- Whole-row `:focus-within` styling.
- Visible required text badges and ARIA-required state.
- Icon-plus-text errors and first-invalid-field focus.
- Sticky actions that stack on narrow screens.
- Semantic theme tokens for light/dark surfaces, borders, focus, errors, and glass treatment.

The Doctor Workspace additionally uses a responsive one/two/three-column e-Prescription entry layout, never the previous four-column input wall. Required medicine details have text badges and ARIA state, live readiness feedback uses text plus icons, and medication review cards wrap without page-level horizontal overflow.

Authenticated end-to-end browser screenshots were not fabricated because the Spring Boot login/API could not be started without the missing Maven dependencies. The included production build and automated layout/theme contracts are the reproducible evidence available in this environment.

## Deployment gate

Before production rollout:

1. Run `mvn clean test` with Maven Central or the hospital's approved artifact mirror available.
2. Start the full stack against a staging PostgreSQL backup.
3. Log in with Super Admin, Hospital Admin, Receptionist, OPD Officer, and Records Officer accounts that have or lack `PATIENT_CREATE` and confirm the central policy grants/denies access correctly.
4. Register a test patient in each supported identification mode and verify duplicate blocking inside the same hospital.
5. Verify that the same identifier in an inaccessible hospital is not disclosed.
6. Perform final visual checks at 375, 768, 1366, and 1920 px in both light and dark mode.
