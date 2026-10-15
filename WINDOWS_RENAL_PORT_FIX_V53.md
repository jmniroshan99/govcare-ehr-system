# V53: Renal ML port permission startup fix

The supplied log stops at Django's `You don't have permission to access that port`. The previous ML launcher always bound `127.0.0.1:8001`. Its failure caused the coordinated launcher to stop the frontend and Spring API. The log does not identify which Windows reservation or policy denied that bind. It shows no Maven compilation error before shutdown.

## Apply to the existing installation

1. Extract this ZIP so its `GovCare_EHR_Modern_Clinical_Intelligence` folder merges with your existing project folder, replacing the supplied project files.
2. Keep your existing `spring-api/.env`, `ML_Server/.env`, Python `.venv`, `node_modules` and database. These local files/directories are excluded from the ZIP. Dependency versions have not changed; this fix does not require reinstalling or retraining.
3. Run `start-renal-fullstack-windows.bat` again. Keep that window open, allow Maven to finish, and open the **Frontend** URL it prints.

The combined launcher now checks all three ports before starting services. It prefers your configured local ML port (normally 8001), skips unavailable ports including `EACCES`, `EPERM` and `EADDRINUSE`, then tries 8002, 8003, 8011, 18001 and an OS-selected port. The selected ML port always differs from the selected frontend and API ports. ML remains bound to `127.0.0.1`.

Example when 8001 is unavailable and 8002 is permitted:

```text
[GovCare] Renal ML port 8001 unavailable (EACCES).
[GovCare] Renal ML: http://127.0.0.1:8002 (available local port)
[GovCare] Renal ML health: http://127.0.0.1:8002/health/
```

Spring receives that exact ML URL after loading its own `.env`. The ML launcher also applies the selection after loading its local `.env`. Your configuration files and service credentials are not rewritten. Existing processes are left running.

## Optional: pin a known permitted port

In Command Prompt, inside the project folder:

```bat
set "GOVCARE_RENAL_ML_PORT=18001"
start-renal-fullstack-windows.bat
```

A pinned port fails clearly if unavailable, before starting services. To restore automatic selection:

```bat
set "GOVCARE_RENAL_ML_PORT="
start-renal-fullstack-windows.bat
```

`GOVCARE_RENAL_ML_PORT` in `ML_Server/.env` is an optional preferred local port; the terminal override above takes precedence. Otherwise the local port in `spring-api/.env`'s `GOVCARE_RENAL_ML_URL` is preferred. The standard default remains 8001.

Use `npm run dev:renal` / the batch launcher for automatic coordination. A standalone `npm run renal:ml` uses only its configured/explicit port, since changing it cannot reconfigure an already running Spring process. When starting Spring separately, configure its `GOVCARE_RENAL_ML_URL` to match, or pass the same `GOVCARE_RENAL_ML_PORT` to both launch commands. `npm run dev:full` retains independently hosted ML service URLs when no local port override is supplied.

## Scope and verification

This change affects startup scripts, startup tests, package script aliases and instructions. The clinical dashboard, CKD workflow, patient pipeline, PDF implementation, training data, split manifest and V52 trained model artifacts are retained byte for byte. See `verification/renal-port-fix-v53/preservation.json`.

Fresh checks and their logs are in `verification/renal-port-fix-v53/`. The regression first demonstrated three failures in the prior code: a hardcoded Django port, no shared ML URL, and Spring `.env` overriding the selected address. The fixed checks cover permission-denied fallbacks, real occupied sockets, explicit-port failure, address propagation, local configuration/credential preservation and invalid inputs. A real Django startup check binds the selected fallback, returns ready health and still rejects unauthenticated model requests.

Verification runs on Linux. Windows permission-denied responses are simulated at the socket-probe boundary; native Windows execution and a live hospital PostgreSQL session are not demonstrated by these checks. A port can still be taken between probing and service startup; startup then fails visibly instead of connecting to an unrelated service. Models remain research outputs with the limitations documented in `MODEL_TRAINING_V52.md`.

To rerun the affected checks:

```bat
npm run test:startup
npm run test:renal:startup:live
```

The live check uses the prepared Python environment, or the absolute interpreter supplied by `GOVCARE_RENAL_PYTHON`, and creates only an isolated temporary test service. It skips explicitly when that environment is absent.
