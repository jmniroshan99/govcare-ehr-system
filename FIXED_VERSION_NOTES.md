# GovCare EHR Spring Boot RBAC — Fixed Full Version

This package includes the fixes identified during local build and login testing.

## Included fixes

1. Fixed the TypeScript `HeadersInit` error in `src/services/springMediaService.ts`.
2. Removed the PostgreSQL JDBC `runtime` scope so `PSQLException` is available during compilation.
3. Fixed the ambiguous `JdbcTemplate.execute(...)` overload in `SequenceService.java`.
4. Fixed the OpenPDF `List` import conflict in `PdfReportService.java`.
5. Added authenticated profile endpoint `GET /api/auth/me`.
6. Updated the frontend authentication service to load the logged-in profile through `/api/auth/me`.
7. Disabled Spring Boot's generated development user because the application uses JWT authentication.
8. Pinned `react-router-dom` to `7.11.0` to preserve the known working dependency set in the included lockfile.

## Setup

From the project root:

```cmd
copy spring-api\.env.example spring-api\.env
npm install
npm run build
npm run spring:build
npm run dev:full
```

Open:

- Frontend: `http://127.0.0.1:5300`
- Spring API: `http://127.0.0.1:4001`
- Health: `http://127.0.0.1:4001/actuator/health`

## Login cache reset

If the browser still shows an old authentication error, open DevTools Console and run:

```js
localStorage.removeItem("govcare-api-token");
localStorage.removeItem("govcare-local-auth-user");
localStorage.removeItem("govcare-auth-session");
sessionStorage.clear();
location.reload();
```
