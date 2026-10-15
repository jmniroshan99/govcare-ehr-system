# GovCare V47 — Spring startup route correction

## Cause and implemented behavior

The supplied Windows log shows successful compilation, connection to PostgreSQL 18.4, and application of Flyway V43. Spring then stops when its MVC registry discovers two GET handlers for `/api/ai-cdss/ckd/patients/{patientId}/predictive-intelligence`: `PredictiveIntelligenceController.predictiveIntelligence` and `RenalClinicalModuleController.overview`.

V46's isolated service tests did not initialize the complete controller registry and therefore missed this collision. V47 removes the redundant legacy alias and points the clinical overview client to its existing canonical endpoint. Both response contracts remain available at distinct routes:

| Method and endpoint | Owner | Response / consumer |
|---|---|---|
| GET `/api/ai-cdss/ckd/patients/{patientId}/predictive-intelligence` | `RenalClinicalModuleController` | Six renal modules, immutable snapshot, explicit null measurements/scores, patient/hospital IDs; `renalIntelligenceService.getRenalPredictiveIntelligence` |
| POST `/api/ai-cdss/ckd/patients/{patientId}/predictive-intelligence/reviews` | `RenalClinicalModuleController` | Existing patient-scoped renal module review; `renalIntelligenceService.reviewRenalModule` |
| GET `/api/ai-cdss/ckd/patients/{patientId}/intelligence` | `PredictiveIntelligenceController` | Existing `ClinicalOverview`: analysis, recommendations, timeline, medications and review capability; `predictiveIntelligenceService.getPredictiveOverview` / `getClinicalIntelligence` |

The frontend page URL `/ai-cdss/ckd/predictive-intelligence` remains the same. A custom external client expecting the older `ClinicalOverview` response must use the `/intelligence` API route. Its former alias now belongs to the six-module contract.

## Changed files

- `spring-api/src/main/java/lk/gov/health/govcare/ai/PredictiveIntelligenceController.java`: remove the conflicting redundant GET alias; retain the canonical overview and all other controller operations.
- `src/services/predictiveIntelligenceService.ts`: use the canonical clinical overview URL and retain cancellation support.
- `spring-api/src/test/java/lk/gov/health/govcare/config/ControllerMappingStartupTest.java`: discover every production controller and initialize the real Spring MVC registry, production security chain, JWT filter and current-user lookup. Services/repositories are isolated boundaries so this check needs no hospital database or ML server.
- `scripts/renal-api-contracts.test.cjs`: invoke the actual TypeScript client functions and capture their HTTP boundary to check the distinct overview URLs, cancellation, and unchanged review method/payload.
- `package.json`: add `test:renal:api-contracts` and include these checks in `test:renal:six-modules`.
- `README.md`, this report, fresh V47 verification evidence, and regenerated `dist/` / package manifests.

The six clinical modules and their risk wording, authorization services, V43 snapshot/review persistence, FHIR projections, PDF export, ML pipelines and original model artifact bytes are preserved. No schema or model change is needed for this correction. All previous verification evidence is retained unchanged.

## Fresh verification

| Check | Result and scope |
|---|---|
| Regression before production fix | Failed for the exact reported `Ambiguous mapping`, with both actual controller methods named. This is the expected baseline failure, not a passing deployment. |
| Client contract before production fix | Clinical overview test failed because it called the six-module URL; the two renal client checks passed. |
| All-controller MVC/security integration after fix | All 46 production controllers initialized. Five tests passed: unique route ownership, authenticated six-module GET with explicit nulls, distinct clinical overview GET, renal review POST, anonymous requests rejected before service calls. |
| Full Java 21 / Maven Spring suite | 140 tests, 0 failures, 0 errors, 0 skipped. |
| Affected frontend / access / CKD / graphics / startup suite | 83 tests, 0 failures. Includes three actual-client route contract checks. |
| Full frontend production build | TypeScript and Vite passed; fresh `dist/` included. |
| Six-module regression command | Seven Node checks and 14 persistence checks passed through all 42 migration files ending at V43. The database engine is PGlite PostgreSQL WASM, not native Windows PostgreSQL. |
| Archive verification | All ZIP entries and payload hashes checked. Original source, prior evidence, migrations and packaged model artifacts preserved. See the V47 preservation JSON for exact counts. |

Raw evidence is in `verification/startup-route-fix-v47/`. `mapping-before-fix-v47.log` and `clients-before-fix-v47.log` intentionally record the baseline failures; the corresponding `after-fix` logs and complete-suite logs record the passing corrected implementation.

This verifies the failing Spring MVC registration boundary directly. It does not claim execution of the complete production bean graph against a native database, a signed-in full-stack session, or clinical validation. The supplied Windows log establishes that the user's V43 migration ran; the corrected release still needs to be started on that Windows machine. Earlier V46 inference/browser/PDF checks remain historical evidence and were not all rerun for this route-only correction.

## Windows update and startup

1. Stop the previous GovCare launcher with Ctrl+C. Extract this complete ZIP into a new project folder.
2. Copy your already configured `spring-api\.env` and `ML_Server\.env` from the previous folder to their matching locations in the new folder. Retain any existing root `.env` configuration too. Keep credentials local. Use the existing PostgreSQL database; the log already shows V43 applied.
3. Open Command Prompt inside the extracted `GovCare_EHR_Modern_Clinical_Intelligence` folder and run:

```bat
npm ci
setup-renal-ml-windows.bat
start-renal-fullstack-windows.bat
```

The setup script prepares Python dependencies in the new folder. Existing service settings are preserved. The launcher performs a clean Maven startup, avoiding stale compiled controller classes. Keep the service window open. Open the Frontend URL it prints, usually `http://127.0.0.1:5300`, and refresh the browser to load the new frontend.

For an existing configured folder with installed dependencies, the launch command is:

```bat
npm run dev:renal
```

The expected result is that Spring finishes startup and exposes the API instead of stopping with the duplicate mapping. The actual request still goes through the existing signed-in patient and tenant authorization.

## Reproduce the verification on Windows

From the project root, with Java 21 and Maven 3.9+ on PATH:

```bat
mvn -f spring-api\pom.xml -Dtest=ControllerMappingStartupTest test
mvn -f spring-api\pom.xml clean test
npm run test:renal:api-contracts
npm run test:startup
npm run test:renal:six-modules
npm run build
```

For the existing native Windows/PostgreSQL validation workflow:

```bat
verify-target-windows-postgres.bat
```

That workflow performs real service/database checks and includes the new mapping test through the full Maven suite. The authenticated live patient API and PDF checks require the existing private, disposable local account fixture described in `TARGET_WINDOWS_POSTGRESQL_VALIDATION.md`; they do not run as simulated clinical logins. No passwords, `.env` files, private account fixtures, dependency caches or browser QA screenshots are included in this archive.
