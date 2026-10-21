# Reproduction and startup

Use Python **3.12** with the enhancement dependency pins. On this Windows workspace the original Python 3.14/pandas 2.2.3 environment crashed natively while parsing dates; its supplied XGBoost pickles also failed to load in both environments. This is an environment/artifact limitation, not a successful training result. The original environment remains available; the new isolated environment has been exercised. Exact installed transitive versions are in `verification/cdss-enhancement/requirements-lock.txt`.

From repository root in PowerShell:

```powershell
py -3.12 -m venv .venv-cdss312
.venv-cdss312/Scripts/python.exe -m pip install -r ml-training/requirements-cdss.txt
.venv-cdss312/Scripts/python.exe ml-training/benchmark_cdss.py --output ml-training/runs/NEW_UNIQUE_RUN
.venv-cdss312/Scripts/python.exe ml-training/write_cdss_handover.py --run ml-training/runs/NEW_UNIQUE_RUN
```

Use a new directory each time; existing runs are not overwritten. The canonical completed run is `cdss-20261020-final`. Its `source/`, `configs/`, code hashes, original split, audit, transformations and manifests capture the recipe. The benchmark seed is 42; patient-bootstrap seed is 314159. Tree models use one worker. Grouped folds keep repeated visits together. Imputation, scaling and SVC calibration are fitted only within the fitting partition. The historical test cohort was already examined; repetition does not create independent validation.

For exact dependency reproduction install `verification/cdss-enhancement/requirements-lock.txt` into a fresh Python 3.12 environment. That lock was measured on Windows x64; non-Windows wheels and platform-dependent tree numerics may differ. Compare seeds, dataset/split hashes and metric tolerances rather than requiring compressed pickle files to have identical bytes across platforms.

Linux commands use `python3.12 -m venv .venv-cdss312` and `.venv-cdss312/bin/python`. This path adaptation is documented, not tested on Linux in this Windows session.

To audit/block the current dataset without fitting:

```powershell
Set-Location ml-training
../.venv-cdss312/Scripts/python.exe -m training.tasks.survival --source data/deidentified_monthly.csv --output runs/NEW_READINESS_RUN
Set-Location ..
```

For a genuine future endpoint cohort use `--source PATH` and `--split PATH`, after meeting `data_contracts/survival_endpoint.json`. This does not activate clinical serving. Do not turn synthetic fixtures or KFRE outputs into outcome data.

The original commands remain compatible:

```powershell
.venv-cdss312/Scripts/python.exe ml-training/run_training.py --help
.venv-cdss312/Scripts/python.exe ml-training/train_packaged_models.py --help
.venv-cdss312/Scripts/python.exe ml-training/train_packaged_models.py --output ml-training/runs/NEW_LEGACY_REPLAY
```

`run_training.py` requires the unavailable original workbook source and private pseudonymization key; only its help/interface can be verified here. It is not used to rewrite the supplied CSV. The packaged legacy replay was executed in `cdss-20261020-serving-repair`. A separate explicit `repair_serving_artifacts.py` operation backed up the original Hb/URR artifact directories, verified the same feature/unit/method contract, required the URR validation gate and replaced only those unreadable legacy-specification artifacts. Hb persistence and the original hyperkalemia object remain served. Artifact revisions/checksums identify the repair. The seven-family benchmark never promotes automatically.

Every replay object also has a `*.joblib.manifest.json` companion, distinguishing primary candidates, preprocessing components and unserved legacy protocol-band classifiers. These auxiliary classifiers are not additional families in the seven-algorithm benchmark and are not served as disease probabilities. Companion metadata can be regenerated without fitting or deployment using `repair_serving_artifacts.py --manifests-only ARTIFACT_DIRECTORY`.

For local service startup, existing `.env` credentials must already be configured and aligned:

```powershell
$env:GOVCARE_RENAL_PYTHON=(Resolve-Path .venv-cdss312/Scripts/python.exe).Path
npm.cmd run dev:renal
```

The launcher also prefers `.venv-cdss312` when installed, then falls back to the legacy environment. Explicit `GOVCARE_RENAL_PYTHON` takes precedence. Existing loopback-port selection and dedicated Spring-to-Django JWT remain in force. The inactive `ai-cdss-service` is not started. Native verification started Spring and Django against a separate synthetic PostgreSQL database; it did not use or migrate the existing clinical database.

Software checks:

```powershell
.venv-cdss312/Scripts/python.exe -m unittest discover -s ml-training/tests -v
Set-Location ML_Server
../.venv-cdss312/Scripts/python.exe manage.py test renal_service --verbosity 2
Set-Location ../spring-api
mvn -B clean '-Dtest=CkdOutlookEngineTest,CkdOutlookServiceTest,CkdOutlookUiAndPdfTest,CkdLearnedReadinessTest,SriLankanRenalMlClientTest,RenalDialysisContextServiceTest,RenalClinicalModuleServiceTest' test
Set-Location ..
npm.cmd run test:ckd:outlook
npm.cmd run build
```

Browser QA uses the existing browser suite through `scripts/verify-cdss-browser.mjs`, with added visible-plot, readiness and patient-switch-without-remount assertions. Install Playwright or point `GOVCARE_PLAYWRIGHT_MODULE` at an installed module URL; set `GOVCARE_CHROMIUM_EXECUTABLE` for installed Chrome/Edge. Generate fresh Java fixtures with `-Dgovcare.outlook.fixtureDir=../verification/cdss-enhancement`, then set `GOVCARE_OUTLOOK_UI_FIXTURES` to that fixture file and `GOVCARE_OUTLOOK_QA_OUTPUT` to a new evidence directory. Synthetic fixtures never become clinical evaluation data.

`python scripts/verify-cdss-stack.py` additionally needs system-Python `psycopg`, `requests`, `psutil` and access to local PostgreSQL using the existing private `spring-api/.env`. It creates a randomly named `govcare_cdss_qa_*` database and applies migrations there. It starts/stops only its own service processes, exercises real HTTP/DB/report boundaries and retains the synthetic QA database for inspection. Short-lived test credentials are not included in retained reports. The original application database is untouched.

The current environment verified native HTTP → Spring → Django → PostgreSQL and native PDF retrieval, plus browser inference/review/reload. The final browser PDF download remained rejected under CORS; stable loopback port ranges were also unavailable. This remaining environment-dependent integration check is explicitly unverified. No wildcard CORS origin or authorization bypass was added. See the retained native browser log and verification report before relying on the live export path.

`scripts/package-cdss-readiness.py` is an offline packaging operation, never called by inference. It packages a measured missing-endpoint conclusion into the Django contract and Spring resource. A changed conclusion requires review and an eligible serving implementation; training alone cannot turn the current fail-closed state into a clinical five-year model.
