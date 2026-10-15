# Startup fix — occupied Spring API port

Date: 2026-10-05.

## Confirmed by the supplied Windows log

- Backend package build: successful; 140 production Java files and seven test source files compiled.
- `mvn clean test`: 72 tests, zero failures, zero errors, zero skipped. The engine's 53 internal domain checks run within one of those JUnit tests.
- PostgreSQL connection: established to the existing installation.
- V35: successfully applied to that database.
- Startup stopped because port 4002 was already occupied. This was a runtime bind failure after successful compilation and migration.

The `Lab unavailable` stack trace occurred inside the test that deliberately simulates a failed laboratory read; that test passed. The PostgreSQL/Flyway compatibility warning did not prevent V35 from applying. This update changes local launchers; it does not change dependencies, Java clinical logic, authorization or SQL migrations.

## Delivered correction

`npm run dev:full`, `run-windows.bat`, `run-linux.sh` and the detached `dev:open` entry point now coordinate frontend/API ports:

1. Choose an available frontend loopback port.
2. Prefer the configured API port, normally 4002. If occupied, probe 4003, 4004, 4010, 14002 and an available automatic port.
3. Keep the API port distinct from the frontend port. API probes use wildcard binding to match Spring's default listener.
4. Pass the same selected API URL to Vite through `VITE_API_BASE_URL` and to Spring through `GOVCARE_API_PORT`.
5. Apply the selected Spring `PORT` and `SERVER_PORT` after loading the existing backend `.env`. This prevents an old `PORT=4002` entry from overriding the coordinated selection.
6. Preserve the selected frontend origin in CORS and use the selected API URL for detached-launcher readiness checks.

Existing listeners are neither terminated nor reused. The selected URLs are printed. Environment changes exist only in the launched processes; credentials and environment files are not rewritten. Production/default standalone API configuration remains unchanged.

An explicit `GOVCARE_API_PORT` must be available; an occupied explicit port fails with a clear message rather than changing the requested URL. Port probes check current availability before starting the services; another process taking that port later can still produce a bind failure. Restarting the launcher performs a new selection.

## Use on Windows

Apply the corrected source while retaining your current root `.env`, `spring-api/.env` and installed dependencies. The backend build and tests are already successful in your supplied log; no additional database migration is introduced by this fix.

From the project root:

```powershell
npm run dev:full
```

If your terminal is currently inside `spring-api`, first run `cd ..`. Open the frontend URL printed by the launcher. If 4002 is still occupied and 4003 is free, the new API will use 4003 and the frontend will connect to 4003 automatically.

To request a specific free API port in PowerShell:

```powershell
$env:GOVCARE_API_PORT = "4003"
npm run dev:full
```

Or in CMD:

```cmd
set GOVCARE_API_PORT=4003
npm run dev:full
```

Leave `GOVCARE_API_PORT` unset for automatic fallback. A separate Vite-only/standalone API deployment still needs its own matching API URL configuration. The default production frontend/API contract remains 4002 unless configured otherwise.

## Verification evidence

- Regression reproduced against the previous launcher with a real occupied TCP listener; it failed for the missing shared API-port selection.
- `npm run test:startup`: 22 passing tests. Includes real socket probes, explicit-port rejection, frontend/API separation, backend port precedence, selected-port survival after `.env` loading, Maven launch/exit behavior and the occupied-port full-stack regression.
- `VITE_API_BASE_URL=http://127.0.0.1:14002 npm run build`: passes TypeScript and Vite production compilation. All six frontend API consumers in the compiled assets contain the configured URL.
- The Maven executable is a controlled fixture in launcher tests. Those tests verify invocation/environment/exit behavior, not a live Spring boot on the newly selected port. The actual 72-test Maven success is separately documented from the user's Windows log.
- The updated launcher has not yet been run against an authenticated Windows Spring/PostgreSQL installation here. Live role/browser checks and screenshots remain pending.

Changed launch surfaces: `scripts/api-port.cjs`, `scripts/run-full-stack.cjs`, `scripts/run-spring.mjs`, `scripts/start-full-dev.cjs`, `run-windows.bat`, the startup tests and the package test command. See the modified-files report for the complete delivery inventory.
