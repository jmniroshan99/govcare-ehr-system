# GovCare V41 Windows startup correction — 2026-10-10

The screenshot shows the renal launcher selected in File Explorer, without a terminal error. The original setup and startup batch files exited without pausing. Missing dependencies or a failed command could therefore close a double-clicked window before its message could be read. The screenshot does not identify which prerequisite or service failed on the user's machine.

## Apply to an existing extracted project

Extract `GovCare_Windows_Startup_Fix.zip` directly into the existing `GovCare_EHR_Modern_Clinical_Intelligence` folder. Replace `start-renal-fullstack-windows.bat`, `setup-renal-ml-windows.bat` and `RUN_SRI_LANKAN_RENAL.md` when prompted. The patch also includes this note. Keep your existing `.env` files, database, dependencies and model artifacts.

Alternatively, extract the updated full project ZIP into a new folder and follow its normal setup instructions. Local dependencies and credentials are intentionally absent from that ZIP.

## Start GovCare

1. In File Explorer, open the project folder, click the address bar, type `cmd`, and press Enter.
2. Run `npm ci` and wait for it to finish successfully.
3. Run `setup-renal-ml-windows.bat`. It needs Node and Python 3.12+ with the Windows `py` launcher. Wait for successful setup, then press a key to return to Command Prompt.
4. Configure PostgreSQL and a suitable independent application `JWT_SECRET` in `spring-api\.env`. Start PostgreSQL. Java 21 and Maven 3.9+ must be available on PATH.
5. Run `start-renal-fullstack-windows.bat`. Keep the terminal open and allow the first Maven build to finish.
6. Open the **Frontend** URL printed by the launcher in your browser, normally `http://127.0.0.1:5300`.

If it stops, copy the first error and the final exit code from that window. Frontend loading and successful database/API startup are separate readiness conditions; database and application errors remain visible in the terminal.

## Correction and fresh evidence

- Both batch files now pause before every normal or failure exit. The startup wrapper saves the npm exit code before displaying messages or pausing.
- Startup checks Node/npm, a supported Node version, frontend dependencies, the prepared Python interpreter, both local configuration files, Java and Maven. A configured `GOVCARE_RENAL_PYTHON` override is respected.
- Setup checks Node and the Windows Python launcher before preparing the environment and keeps success/failure messages visible. It retains the existing credential configuration command and mismatch protection.
- Both batch files use CRLF line endings. Static checks confirm every exit follows a pause and every `goto` target exists.
- Fresh affected regression command: `node --test scripts/run-spring.test.mjs scripts/run-full-stack.test.cjs scripts/api-port.test.cjs` — **22 passed, 0 failed, 0 skipped**, exit 0. These exercise the existing Node launchers, exit propagation and port coordination on Linux; they do not execute Windows CMD.
- All 779 payload hashes in the previous complete package were verified. All **54** `ml-training` files remain byte-identical; no training, clinical or API behavior was changed.

**Windows CMD execution is unverified:** this verification environment has no Windows command interpreter. The user's exact machine-specific startup error still needs its terminal output. Previous build, API, browser, database-compatible and model-evaluation evidence remains retained evidence, rather than newly repeated testing. Clinical-validation and dataset-permission statuses remain unchanged.
