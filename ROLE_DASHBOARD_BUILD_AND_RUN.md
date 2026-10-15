# Role Intelligence Dashboard — Build and Run

## Requirements

- Node.js 22 or newer
- npm 10 or newer
- Java JDK 21 (a JRE alone is insufficient)
- Maven 3.9+ on PATH (the supplied launchers use installed Maven)
- PostgreSQL reachable through `spring-api/.env`

## Clean build

```bash
npm ci
npm run build
./spring-api/mvnw -f spring-api/pom.xml test
```

On Windows:

```cmd
npm ci
npm run build
spring-api\mvnw.cmd -f spring-api\pom.xml test
```

The existing compatibility command also builds the backend:

```bash
npm run spring:build
```

## Database upgrade

1. Back up PostgreSQL.
2. Confirm `FLYWAY_ENABLED=true`.
3. Start the Spring Boot service.
4. Verify Flyway applies V31 and V32 once.
5. Confirm the `flyway_schema_history` row is successful before enabling users.

Do not edit or re-run an already applied Flyway migration manually. If V31 has been applied in any environment, make later changes in V32 or above.

## Run locally

```bash
npm run dev:full
```

Expected endpoints:

- Frontend: the URL printed by the launcher, normally `http://127.0.0.1:5300`
- Spring API: `http://127.0.0.1:4002`
- Health: `http://127.0.0.1:4002/actuator/health`
- Dashboard: `http://127.0.0.1:4002/api/dashboard/intelligence`

For the current role fix, account setup and verification, use ACCESS_ROLE_BUILD_INSTRUCTIONS.md.

## Dashboard verification

1. Create or select one account for every database role using the existing Super Admin staff-management flow.
2. Assign a hospital to all staff roles and a department where department scoping is required.
3. Link `patient_id` for a patient account.
4. Log in independently as each role and confirm `/` or `/portal` selects the expected dashboard.
5. Use browser developer tools to confirm one dashboard aggregation request and no client-supplied role parameter.
6. Attempt a different `hospitalId` as non-Super Admin and confirm HTTP 403.
7. Confirm Doctor worklists contain only assigned/ordered patients.
8. Confirm Patient worklists contain only the linked patient's released records.
9. Confirm Guardian, Finance, unsupported nursing workflow, and telemetry gaps display Data unavailable rather than zero.
10. Test 375, 768, 1366, and 1920 CSS pixel viewports with browser zoom at 100%.

## Automated checks

```bash
npm run test:dashboard
npm run test:startup
npm run build
./spring-api/mvnw -f spring-api/pom.xml test
```

`npm run test:dashboard` checks requested role coverage, additive role migration, server-side scope markers, unavailable-source contracts, translations, lazy chart loading, and accessible chart fallback.

## Production notes

- Use a unique high-entropy `JWT_SECRET` and production PostgreSQL credentials.
- Terminate TLS at the approved reverse proxy and restrict CORS to deployed frontend origins.
- Do not seed production with demonstration credentials.
- Add database monitoring for slow dashboard queries after representative data volumes are loaded.
- Historical availability/API latency requires an approved telemetry store before those widgets can be enabled.
