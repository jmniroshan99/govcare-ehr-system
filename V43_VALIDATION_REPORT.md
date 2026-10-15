# GovCare V43 Validation Report

## Executed checks

- Hyperkalemia model training completed from the packaged de-identified Sri Lankan longitudinal cohort and fixed patient split manifest.
- Held-out hyperkalemia metrics were regenerated and saved with the model artifact.
- Direct ML inference smoke test passed: registry exposes four renal models; hyperkalemia returns an `AVAILABLE` research score with `prediction=null`, a bounded probability, `RESEARCH_RISK_SCORE`, research governance metadata and eight explanation factors.
- `node --test scripts/renal-clinical-risk-graphics.test.cjs`: **4/4 passed**.
- `node --test scripts/ckd-workspace.test.cjs`: **30/30 passed**.
- `python -m unittest discover -s ml-training/tests -p 'test*.py'`: **10/10 passed**.
- `node scripts/check-java-syntax.mjs`: **172 Java sources parsed; 0 syntax errors**.
- Focused TypeScript syntax transpilation: modified renal panel and renal service types parsed without diagnostics.
- V42 migration + CKD PDF static safety contract check: **passed** (hyperkalemia output constraints, research governance fields, four PDF panel labels and non-diagnostic disclaimer present).

## Model evaluation retained in package

Held-out hyperkalemia research evaluation:

- ROC-AUC: **0.6617**
- PR-AUC / average precision: **0.2623**
- balanced accuracy: **0.6337**
- recall: **0.4167**
- specificity: **0.8507**
- F1: **0.3704**
- Brier score: **0.1840**

These results indicate modest research performance. Probability calibration is not established and clinical validation remains `NOT_COMPLETED`.

## Checks not completed in this execution environment

- Full Django test suite: the container does not have Django installed. Direct inference code and the packaged ML training tests were executed instead.
- Full Spring/Maven compile and JUnit suite: Maven is not installed in this container. Java source syntax checks passed, but syntax parsing is not a substitute for dependency-aware compilation.
- PostgreSQL/PGlite Flyway migration execution: the attempted npm dependency installation could not be completed in the restricted environment, so the V42 SQL migration received static/contract review but not a live migration execution here.
- Full Vite production build: project dependencies could not be completely installed because package registry access was unavailable in this environment. Focused TypeScript syntax checks and dependency-free frontend regression tests passed.

## Required deployment validation

Before clinical/research deployment, run in the target environment:

```bash
npm install
npm run build
npm run test:renal:graphics
npm run test:ckd-workspace
npm run test:renal:migration
cd spring-api
mvn test
cd ../ML_Server
python -m pip install -r requirements.txt
python manage.py test renal_service
```

Then apply Flyway migration V42 through the normal Spring startup, start the ML service with the configured server-to-server JWT secret, generate at least one hyperkalemia research snapshot from a non-production test patient, and export a CKD PDF to verify the four graphics end-to-end.
