# Operational dashboard: data contract and verification

This archive is based on the full-source ZIP supplied for the dashboard task. It also includes the previously delivered Super Admin recovery script and the account access fixes described in `ACCOUNT_ACCESS_RECOVERY.md`.

The `/` dashboard now calls `GET /api/dashboard/overview`. The endpoint uses the authenticated Spring Boot principal and PostgreSQL. It returns one hospital at a time, never a national aggregate. Staff cannot request a different hospital; Super Admin may select an active hospital. Patients and guardians receive HTTP 403. Each metric is separately gated by its relevant permission, and names in the queue additionally require `PATIENT_VIEW`. A doctor's queue is limited to their assigned tokens or department. The endpoint sends `Cache-Control: no-store`.

| Card | Source and definition | Required authority |
| --- | --- | --- |
| OPD patients today | Distinct patient IDs in `opd_queue` created during the Sri Lanka calendar day | `QUEUE_VIEW` |
| Active admissions | `admissions` with active status and no discharge | `ADMISSION_VIEW` or `WARD_PATIENT_LIST` |
| Emergency triage | Unavailable: no persisted emergency triage encounter/status model exists | — |
| Lab pending | `lab_requests` in ordered, received, sample collected, in progress, result entered, or verified workflow status, excluding cancelled/deleted | `LAB_REQUEST_VIEW` |
| Low stock medicines | Active `medicines` with a positive reorder level whose unexpired, active hospital stock sums below that level | `PRESCRIPTION_VIEW` |
| Critical alerts | Unavailable: notifications do not constitute a verified, acknowledged clinical alert workflow | — |

The chart counts **OPD queue registrations per hour**, not the admissions census or the distinct-patient KPI. Its time window is `[00:00, next 00:00)` in `Asia/Colombo`. The priority queue contains at most eight open tokens, ordered by clinical priority then check-in time. “Elapsed” is time since queue creation, including time after a token is called; it is not an estimated wait. Queue names are omitted from the API response when `PATIENT_VIEW` is absent.

Migration V30 adds hospital/date and active-stock indexes for these read queries. It does not modify clinical records.

The client refreshes when the user presses **Refresh data**. TanStack Query also refetches stale data on window focus; its stale threshold is 60 seconds. It does not poll. The successful response timestamp is displayed, and a failed refetch marks retained data as potentially stale. Dashboard responses have no persistent browser storage, and the query cache is partitioned by account and hospital and cleared after unmount. Super Admin's hospital selector uses the existing active-hospital search endpoint (50 results per search); enter a name or code and press Search to find a hospital beyond the initial list.

Database read failures are reported per metric, chart, or queue so other sections remain usable. Each SQL read is independent; the cards represent a short collection window around the displayed timestamp rather than one transactionally atomic snapshot.

## Verification on a machine with the project toolchain

1. Install frontend dependencies according to the project's package manifest, then run `npm run build` and `npm run test:startup`.
2. Use JDK 21 and the project's Maven wrapper to run `cd spring-api && ./mvnw test` (or `mvnw.cmd test` on Windows). The new service tests check cross-hospital denial, patient denial, Colombo day bounds, doctor queue scope, and partial database failures.
3. Against an actual migrated PostgreSQL database, compare the four supported cards with the underlying tables and verify 0, absent data, API failure, and a hospital switch. Check the dashboard at 375, 768, 1366, and 1920 pixels in both themes.

No historical seed or demo dashboard values are used as live measurements. This source archive does not contain a running database, so live counts and SQL execution must be verified in the target environment.

Older builds automatically populated the shared navigation badge with example clinical notifications. The dashboard update prevents automatic seeding and filters those known example IDs from displayed notification counts; it does not convert the separate notification center into a server-backed clinical alert service. Explicit notification test actions in that module remain tests and do not feed the dashboard's critical-alert card.
