# Run GovCare V41 with Sri Lankan renal research intelligence

This package contains the complete GovCare source, its existing modules, the integrated React/Spring workflow, a stateless Django inference service, newly fitted research artifacts, pseudonymized training rows, and executed evaluation reports. Installed dependencies, a hospital database, runtime `.env` secrets, verification account fixtures, the private HMAC key and the original identifiable master spreadsheet are excluded.

The renal workflow is research decision support requiring clinician review. Dataset permission is **UNVERIFIED**, clinical validation is **NOT_COMPLETED**, and upstream precleaning provenance is unverified. Hb serves a persistence baseline because its candidate failed the validation improvement gate. URR serves an explicitly labelled research forecast with poor held-out R². Dry weight and IDH have no accepted model.

## Prerequisites

- Windows 10/11, Linux, or macOS; the Windows batch launchers are included. Windows execution was not available in the verification environment.
- Node 22 LTS (22.12+) or Node 24, npm, Java 21, Maven 3.9+, and an existing PostgreSQL installation/database.
- Python 3.12+ with pip and venv. Verification used Python 3.12.14. Tested package versions are pinned in `ML_Server/requirements.txt`; training extras are in `ml-training/requirements.txt`.
- Keep PostgreSQL credentials and local secrets in `.env` files. Django binds to loopback; the combined launcher prefers port 8001 and selects a permitted fallback when necessary.

## Windows

From the extracted `GovCare_EHR_Modern_Clinical_Intelligence` directory:

```bat
npm ci
setup-renal-ml-windows.bat
```

Configure `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, and an independently generated application `JWT_SECRET` in `spring-api\.env`. The setup command preserves existing configuration and generates a separate random `GOVCARE_RENAL_JWT_SECRET` in both services. It never prints the secret. If the two existing renal secrets differ, align them deliberately; the script refuses to overwrite a mismatch.

For a fresh local database, follow the existing `setup-database-windows.bat` and `database/README.md`. For an existing GovCare database, take the usual database backup and start Spring with Flyway enabled. **V41 is additive**; existing migrations V1–V40 are preserved. Do not manually edit installed Flyway checksums or disable Flyway for deployment.

```bat
start-renal-fullstack-windows.bat
```

This runs the existing Vite/Spring launcher plus Django. Open the frontend URL printed by the launcher (normally `http://127.0.0.1:5300`). Sign in using an existing authorized clinical account. No new passwords or real clinical patients are created by the renal setup script.

If Windows blocks port 8001, the combined launcher selects another local ML port and passes the same address to Spring after both services load their configuration. Use the printed **Renal ML health** URL for diagnostics. See `WINDOWS_RENAL_PORT_FIX_V53.md` for applying the fix to an existing installation and optional `GOVCARE_RENAL_ML_PORT` overrides.

### If the Windows launcher does not open GovCare

The updated renal setup and startup batch files keep their windows open when they finish or fail. Startup checks for Node/npm, frontend dependencies, the prepared Python interpreter, both local configuration files, Java and Maven before launching services. Existing configuration and model artifacts are preserved.

In File Explorer, open the project folder, click its address bar, type `cmd`, and press Enter. Run `npm ci`, then `setup-renal-ml-windows.bat`. Wait until setup reports success. Configure PostgreSQL and `JWT_SECRET` in `spring-api\.env`, start PostgreSQL, and run `start-renal-fullstack-windows.bat`. Allow the first Maven build to finish and open the **Frontend** URL printed in the terminal. Keep that terminal open while using GovCare.

If it stops, copy the first `ERROR` and the final exit code from the window. A File Explorer screenshot alone cannot identify a database, Java, Python or dependency error. `WINDOWS_STARTUP_FIX.md` records the launcher correction and verification limits.

## Linux/macOS

```bash
npm ci
python3 -m venv ML_Server/.venv
ML_Server/.venv/bin/python -m pip install -r ML_Server/requirements.txt
npm run renal:configure
# Configure PostgreSQL and application JWT_SECRET in spring-api/.env.
npm run dev:renal
```

Set `JAVA_HOME` to Java 21 and put Maven on PATH if the existing Spring launcher cannot discover them. To select a different prepared Python environment, set `GOVCARE_RENAL_PYTHON` to the absolute interpreter path.

## Clinical workflow

1. Open **AI CDSS → CKD**, select an authorized patient, then open **Predictive clinical intelligence → Overview**. The new Sri Lankan renal panel is inside the shared CKD workspace.
2. Record verified measured renal laboratory history with the actual observation date, explicit units and a source note. Separately verify maintenance hemodialysis from a clinical source. Research cohort rows are never automatically imported as real EHR measurements.
3. Hb/URR inference needs at least two verified observations, a latest interval of 14–62 days, the current target value, and at least five available model predictors. Inputs older than 62 days or per-session intervals outside the monthly training scope suppress forecasts.
4. Generate a forecast. Solid chart lines are measured values, dashed lines are research forecasts, and the shaded residual interval is empirical and not clinically calibrated.
5. Review each available output using ACCEPT, MODIFY, DEFER or DISMISS. A clinical reason is mandatory; MODIFY also requires a revised interpretation. Review events append to the immutable prediction and never replace laboratory measurements.
6. Export the existing CKD assessment PDF after storing an assessment. The export includes stored renal predictions, model/version/provenance, review state and limitations; export does not run new inference.

Explicitly verified current maintenance dialysis produces **G5D**. Otherwise the existing clinical rule based eGFR classification remains authoritative. A creatinine value or forecast cannot independently establish G5D.

The seven trend selectors cover Hb, URR, creatinine, urea, potassium, albumin and dry weight. Supported explicit source units are converted only for chart alignment: Hb `g/L → g/dL`, albumin `g/dL → g/L`, creatinine `mg/dL → umol/L` and whole urea `mg/dL → mmol/L`. No BUN, fraction or guessed-unit conversion is applied. Conversion/omission notes identify the chart behavior, while Source observations retains recorded values and units. Tab and Shift+Tab cycle inside renal entry/review dialogs; Escape and Cancel return focus to the initiating control.

Dates retain the source ISO instant and display in the browser's local timezone. Hovering a chart point shows its date, value and measured/research label; tooltip text wraps within the chart width on small screens.

## Services and troubleshooting

| Component | Local endpoint | Configuration |
|---|---|---|
| Frontend | Printed Vite URL, normally port 5300 | Uses the shared Spring API client |
| Spring | Printed API URL, normally port 4002 | `spring-api/.env` |
| Django | Printed ML health URL, normally `http://127.0.0.1:8001/health/` | `ML_Server/.env`; coordinated local port selection |
| Model registry | `/api/ml/models/` | Requires a scoped Spring service JWT |
| Predict Hb/URR/dry weight | `/api/ml/predict/hb/`, `/urr/`, `/dry-weight/` | Requires the same service JWT |

React calls Spring only. Spring performs role/permission and ClinicalPatientAccess checks, retrieves patient-scoped verified history, then sends a 55-second dedicated service JWT to Django. A normal application login token does not authenticate directly to Django. Public health endpoints contain no patient data.

If Django is offline, Spring persists a structured unavailable result rather than manufacturing a forecast. If the renal credential is missing or mismatched, rerun `npm run renal:configure` after correcting existing configuration. If an artifact digest fails, restore the reviewed package rather than accepting an unknown pickle. Source-supplied legacy pickles are never loaded.

Django `runserver` and Vite are development launchers. For hospital deployment use an appropriate production application server, TLS/reverse proxy, protected internal ML networking, database backup and monitoring. No production deployment was performed during this task.

## Re-run checks

```bash
npm run build
node --test scripts/*.test.cjs scripts/*.test.mjs
node --test scripts/renal-measurement-units.test.mjs scripts/renal-local-config.test.cjs
node scripts/verify-predictive-migration.mjs
npm run test:renal:migration
# In spring-api, with Java 21:
mvn clean test package
# From the project root, using the prepared Python environment:
ML_Server/.venv/bin/python -m unittest discover -s ml-training/tests -v
ML_Server/.venv/bin/python ML_Server/manage.py test renal_service -v 2
```

The migration scripts use a disposable PGlite PostgreSQL-compatible engine. This is not native PostgreSQL/Flyway runtime verification. The final native PostgreSQL 16.15 verification attempt was blocked because the executor maps only root UID/GID and cannot create the non-root owner PostgreSQL requires. It does not establish native migration success or a product failure. The live verifier scripts require a disposable local installation and a private JSON account fixture; see their environment-variable instructions. Operational fixtures contribute **zero** clinical-validation subjects.

## Reproduce research training

Preserve your original source archive separately. The original source master spreadsheet and HMAC key are intentionally absent from this deliverable. A securely retained identical HMAC key is required to reproduce the identical pseudonyms and patient split; using a new key changes pseudonym order and may change the partitions/results.

```bash
ML_Server/.venv/bin/python -m pip install -r ml-training/requirements.txt
ML_Server/.venv/bin/python ml-training/run_training.py --source /absolute/path/to/extracted/e19-repository --key-file /private/path/to/pseudonym.key
```

Do not publish the private key. Training overwrites the research artifact/report directories; retain an existing reviewed version first. Metadata records source/artifact SHA-256, training date, package versions, feature order, partitions, selection rule and limitations.

To reproduce the included validation/test metrics without the private key or original master spreadsheet, refit all 16 numeric/classifier candidate pipelines from the packaged pseudonymous CSV and fixed split manifest:

```bash
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 ML_Server/.venv/bin/python ml-training/reproduce_packaged_evaluation.py
```

On Windows, set the two thread environment variables with `set` and use `ML_Server\.venv\Scripts\python.exe`. This command verifies the saved metrics and leaves the reviewed artifacts unchanged. It reproduces internal evaluation; it cannot recover or verify the missing upstream raw data.

## Reports

- `ml-training/reports/DATASET_AUDIT_REPORT.md`
- `ml-training/reports/SRI_LANKAN_RENAL_MODEL_TRAINING_REPORT.md`
- `ml-training/reports/LEAKAGE_AUDIT_REPORT.md`
- `MODEL_RESULTS_OVERVIEW.md`
- `PROJECT_ANALYSIS_AND_CHANGES.md`
- `TESTING_AND_ACCEPTANCE_REPORT.md`
- `MODIFIED_FILES.md`


## V43 hyperkalemia and PDF extension

Retrain the packaged research-only hyperkalemia model:

```cmd
npm run renal:train:hyperkalemia
```

The served model key is `hyperkalemia`; model ID `LK-RENAL-HYPERK-1.0`. The output is a non-calibrated internal research score for the next pre-HD K+ >=5.5 mmol/L label and requires clinician review.

After Flyway V42 has applied and the renal ML service is running, generate a hyperkalemia snapshot through the existing patient-scoped renal intelligence UI. CKD PDF export automatically reads the latest stored Hb, URR and hyperkalemia snapshots plus verified renal observations, computes the transparent deterioration composite, and adds the four-panel graphics page. Export does **not** rerun inference.

See `SRI_LANKAN_HYPERKALEMIA_COMPOSITE_PDF_INTEGRATION.md` and `V43_VALIDATION_REPORT.md`.

## V44 target Windows/PostgreSQL verification

V44 fixes the renal Django launcher so `ML_Server/.env` is actually loaded at runtime. For native Windows/PostgreSQL validation, use `verify-target-windows-postgres.bat`. It can run Flyway V42 verification, Maven tests, Django tests, the frontend build, and—when a private disposable-local account fixture is provided—the live renal API and CKD PDF export checks. See `TARGET_WINDOWS_POSTGRESQL_VALIDATION.md`.
