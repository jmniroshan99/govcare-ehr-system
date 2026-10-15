# GovCare EHR – Role Data Synchronization Fix

## Confirmed architecture

- Frontend: React + TypeScript + Vite.
- API: Spring Boot REST API.
- Persistence: PostgreSQL with Flyway migrations.
- Authentication: API-issued bearer token stored in the browser and a persisted profile session.
- Role enforcement: frontend route guards plus backend `GovCarePrincipal`/service authorization.

## Root causes addressed

1. React Query was configured with `offlineFirst`, a one-minute stale window, and disabled window-focus refetching. A role could therefore continue displaying stale records after another role changed them.
2. Successful API mutations did not publish a common invalidation signal. Mounted role views using React Query had no reliable way to refresh after writes from another module.
3. API reads did not explicitly request non-cacheable responses, leaving an avoidable intermediary/browser-cache risk for shared clinical data.
4. Authentication/profile changes in another browser tab were not synchronized with the current tab.

## Changes

- `src/services/apiClient.ts`
  - Adds `Cache-Control: no-store` and `Pragma: no-cache` to API requests.
  - Adds a per-request ID for tracing duplicate/retry problems.
  - Emits `govcare:data-mutated` after every successful non-read API operation.
- `src/app/providers.tsx`
  - Uses online-first query behavior, zero stale time, focus/reconnect refresh, and a bounded 30-second active-query refresh.
  - Invalidates mounted derived queries after any successful API mutation.
- `src/stores/authStore.ts`
  - Synchronizes session, role, hospital, and profile override changes across browser tabs.

## Security boundary

The invalidation mechanism never grants access and never merges data locally. The backend remains the source of truth for hospital, department, patient, and role authorization. Frontend refreshes only re-request data using the current bearer token.

## Verification status

- ZIP extraction and source audit: completed.
- Source changes: applied.
- Build: not completed in this environment because the uploaded project omitted `node_modules`; `npm ci` was started but the environment stopped the follow-up verification process due to its usage/approval limit.
- Recommended verification: `npm ci && npm run build`, followed by the role workflow tests described in `ROLE_PERMISSION_TEST_CHECKLIST.md`.
