# Super Admin facility testing report

Current delivery: 2026-10-04

## Verification results

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run build` | PASS | TypeScript and Vite completed; facility page emitted as a lazy chunk |
| `npm run test:roles` | PASS — 45 | Facility access follows role plus permission and revocation |
| `npm run test:dashboard` | PASS — 7 | All requested role dashboards remain mapped |
| `npm run test:facilities` | PASS — 6 | API guard, migration, transaction, bulk limits, UI sequence and SQL alias contracts |
| `npm run test:theme` | PASS — 10 | Light/dark contrast and theme state |
| `npm run test:startup` | PASS — 12 | Full-stack launcher behavior |
| `npm run test:superadmin` | PASS — 11 Node + 20 Java | Network clinical access plus facility service compilation and hospital-creation scope |
| `npm run test:java:syntax` | PASS — 140 sources | Real Java 21 parser, zero syntax errors |
| PostgreSQL semantic execution | PASS | 30 `activity_day` rows and B001–B010 bulk insert/returning |
| `mvn clean test` | BLOCKED | Maven Central hostname could not resolve before source compilation |
| Live local Super Admin create flow | REQUIRES LOCAL RERUN | Needs the user's PostgreSQL data and authenticated browser |

The supplied Windows log established that the previous project compiled and started with Java 21, Spring Boot 3.5.3, PostgreSQL 18.4 and 32 Flyway migrations. It then recorded three `syntax error at or near "day"` failures. The current source fixes that SQL, but the supplied log predates the facility code and cannot certify the current Maven build.

Current `DashboardIntelligenceService.java` SHA-256:

`36a5f0dc44a90790636122ad10addbe95719f77582477641d70257eaaadffd4f`

## Security evidence

- The hospital endpoint rejects every role except `super_admin`, even if another role holds unrelated administrative permissions.
- Removing `HOSPITAL_MANAGE` denies the frontend route and Spring method.
- Ward and bed APIs keep their independent `WARD_MANAGE` and `BED_MANAGE` checks.
- A department from another hospital is rejected before ward insertion.
- A room from another ward is rejected before bed insertion.
- Duplicate bed numbers/codes, unsupported types, an oversized batch and room-capacity overflow are rejected.
- Super Admin document routes still require `DOCUMENT_VIEW`; patient self-service scope is unchanged.

## Remaining local acceptance test

Run these steps on the machine represented by the supplied log:

1. Stop the old frontend and Spring processes.
2. Replace the source, then run `npm ci` and `npm run build`.
3. Run `cd spring-api` and `mvn clean test` with working Maven Central access.
4. Start `npm run dev:full` and confirm Flyway reports schema version 33.
5. Sign in again as Super Admin and open `/admin/facilities`.
6. Create a disposable test hospital, one ward and a small bed range.
7. Refresh and confirm counts, ward linkage, unique bed codes and audit events.
8. Confirm a Hospital Admin receives HTTP 403 from the hospital-creation endpoint.
9. Reopen the Super Admin dashboard and confirm daily registrations, heatmap and system activity no longer log SQL grammar warnings.

The source is build-clean under TypeScript and syntax/type checked under Java 21. Production certification remains dependent on the blocked Maven suite and the local authenticated PostgreSQL acceptance test.
