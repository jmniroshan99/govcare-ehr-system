# GovCare V48 - renal data readiness and clinical workflow

## 1. Root causes found

The six-card implementation had a single availability status but no explicit backend checklist. It required three evaluable domains before showing any trajectory, hid valid partial trends, and left disabled prediction controls unexplained. The prediction module also treated a stored ML connection failure as an absent model. Standalone JSON assembly serialized observation Instants as numeric timestamps, although the existing React history workflow expected ISO strings.

The review dialog depended on styles imported by another page and remained inside its workspace layout. Its patient/snapshot context and focus restoration were incomplete. The existing dialysis checkbox was attached to a lab-entry form that required at least one numeric value, so clinical dialysis verification could not be recorded independently of laboratory results. Missing-data and eligibility states were also insufficiently distinguished in the PDF.

## 2. Backend readiness changes

`RenalDataReadiness` determines readiness from canonical, dated, valid patient observations and current clinical context. Every module has requirements with labels, required/optional flags, minimum and available counts, states, source dates, additional counts, and an existing-workflow action. Readiness includes a result title, explanation, primary action, source/exclusion lists and independent measured/trend/forecast states where applicable. The UI does not calculate clinical eligibility or invent required features.

Trajectory domains are evaluated independently. One evaluable domain can provide partial trend information; all six biomarkers are not required. The existing transparent composite retains its three-domain minimum, explicitly explains that minimum, excludes unavailable domains from its denominator, and has a null percentage below that threshold. Zero evaluable domains never produce a stable or zero-percent result.

`RenalModelMetadata` reads the actual packaged metadata and verifies model identity, version and artifact SHA-256 without executing a pickle. The 84 ordered features and required source measurements are exposed from the reviewed artifacts. The existing serving gate is centralized in `ml-training/serving_input_contract.json` and consumed by both Spring and Django: two verified HD observations, 14-62 days apart, latest supported observation at most 62 days old, current target present, and at least five of the nine supported current predictors. Training-only imputation may apply to optional predictors; missing source values remain absent in the clinical record.

Hb remains the actual persistence baseline. The previous Hb is needed for a trend, but a current Hb can be carried forward when the existing overall cohort/history gate is met. Thus two HD observations with only one Hb can yield forecast readiness while Hb trend readiness remains false. A single total observation still fails the existing monthly-cohort gate; this release does not relax its validation population or relabel the unused XGBoost candidate as serving.

Measured URR remains derived from valid paired same-session urea, with explicit matching source units, positive pre-HD urea, nonnegative post-HD urea and post-HD urea no greater than pre-HD urea. The measured value, historical trend and next-period forecast have independent readiness. Stored service failures have `ERROR`, a stored prediction reference and an appropriate retry action. Safety gates remain separate and suppress outputs and execution.

## 3. API response and clinical context changes

| API | Behavior |
|---|---|
| GET `/api/ai-cdss/ckd/patients/{patientId}/predictive-intelligence` | Schema 2; same ordered six modules plus per-module `readiness` and consolidated `readinessSummary`; explicit nulls and ISO observation dates; no inference. |
| POST `.../predictive-intelligence/reviews` | Existing immutable snapshot review, mandatory reason, request idempotency and optimistic review version preserved. Technical-error outputs cannot receive an interpretation review. |
| POST `/api/ai-cdss/ckd/patients/{patientId}/renal-intelligence/dialysis-status` | Source-verified manual clinical context: request UUID, supported status, actual nonfuture verification date and source note. No lab value is required or created. |
| Existing renal observation / prediction APIs | Preserved; current clinical context and laboratory sampling context are checked independently. |

Example readiness fields are `status`, `ready`, `resultTitle`, `message`, `requirements`, `missingCount`, `dataPointsUsed`, `lastUpdated`, `lastEvaluated`, `nextAction`, `dataUsed`, and `excludedData`. Requirements name the exact count and dates needed. Model installation and patient applicability are separate from numeric data coverage.

New additive Flyway V44 creates `renal_dialysis_context_events`. Events are patient/tenant scoped, source/date constrained, append-only and request-idempotent. Manual verification emits parseable FHIR R4 ClinicalImpression and Provenance resources and an audit event. It creates no fabricated Observation. Earlier migrations and model artifact bytes are unchanged.

The statuses `MAINTENANCE_HD`, `NOT_ON_MAINTENANCE_HD`, and `UNCONFIRMED` distinguish verified applicability, verified ineligibility, and missing confirmation. A general lab that does not verify dialysis sampling does not revoke an earlier explicit clinical dialysis status. Conversely, patient-level verification does not retroactively turn old lab rows into verified HD sampling records or unlock an unsupported forecast. G5D always requires explicit verified chronic maintenance dialysis; creatinine alone cannot establish it.

Snapshots retain rule version `LK-RENAL-MODULES-1.1`. Their evidence fingerprint excludes evaluation-clock decoration, so repeated unchanged reads reuse the immutable snapshot. New observations, clinical context or model output change readiness and produce new snapshots. Historical snapshots remain immutable. Export uses the latest stored authorized snapshot and does not invoke Django.

## 4. UI changes

Each card has a module header with human-readable badges, a primary result and explanation, visible data-readiness checks, a useful next action, and expandable model/evidence details. Available domain trends remain visible in a partial trajectory. No missing numeric field becomes a displayed zero. The empty composite says “Not enough longitudinal data” and names its evaluable-domain count.

The page-level Renal Intelligence Readiness banner summarizes all six modules. Its missing-data drawer groups duplicate requirements. Model-unavailable cards ask for deployment review, not additional patient data. Ineligible/unverified cohort states explain the difference; they do not turn every missing-input case into “Not applicable”. Eligibility is evaluated before showing the longer model checklist, keeping inapplicable cards compact.

“Add” actions open the existing renal observation dialog with the relevant field focused. “Verify dialysis status” uses a clinical-context mode in that same workflow, with no numeric inputs and no preselected positive verification. “Open history” expands the existing source/history section, including recorded clinical context; “Open clinical record” uses the existing patient profile route. Prediction controls use backend readiness, scope/write permission and safety state, with a visible reason when disabled. Retry and backend-error states retain technical references.

The exact six-card order remains trajectory, kidney failure/G5D, hyperkalemia, anemia/Hb, dialysis adequacy/URR and renal deterioration. Desktop/tablet/mobile grids use 3/2/1 columns. Missing data is amber/neutral, eligibility gray-blue, research purple, and concerning directional signals use warning/risk colors. Tooltips explain readiness, applicability, research models, G5D, URR and the directional composite. The existing research illustration and historical workflow remain available below the active cards.

## 5. Clinician review drawer

The review is a native modal dialog rendered into the document body, so workspace transforms cannot position it at the top-left. Desktop width is 470px; mobile is a full-screen sheet. It provides an actual backdrop, fixed header, scrollable content, keyboard focus containment, Escape close, focus restoration and visible focus indicators.

The drawer shows the authorized patient identifier, captured timestamp, immutable snapshot UUID, rule/model version and review version. Action, clinical reason, optional note and Modify interpretation have proper labels. Save requires a reason and, for Modify, a revised interpretation. Pending saves retain the established idempotent request semantics and cannot be accidentally dismissed mid-write. Stored review actor/date/reason/interpretation remain available in evidence details.

## 6. Modified files

See `MODIFIED_FILES_V48_RENAL_READINESS.txt` for the exact inventory. Main new files are `RenalDataReadiness.java`, `RenalModelMetadata.java`, `RenalDialysisContextService.java`, Flyway V44, the shared serving-input JSON, `RenalSideDrawer.tsx`, the new tests and context/native/browser verification scripts. Existing assembler, scoped service/controller, TypeScript clients, six-card/observation UI, Django inference/registry and CKD PDF generator were updated in place. No application rebuild or model retraining was performed.

## 7. Tests added

New Java suites cover explicit missing requirements, one/two observations, partial trends, potassium targeting, model absence, eligibility, technical errors, independent Hb states, measured URR, invalid denominator, verified G5D, stale measurements, safety suppression, actual metadata, ISO timestamps, standalone clinical context and verified non-HD context. A service regression prevents a general lab from revoking verified patient-level dialysis context.

Clinical context tests cover authorization before SQL, source/date/status rejection, tenant-scoped JDBC timestamps, idempotence/conflicts, audit and FHIR parsing without lab writes. Two actual OpenPDF tests check insufficient-data semantics and measured-versus-forecast URR. Actual TypeScript clients are invoked to verify route, cancellation and payload contracts. Full-chain PGlite checks exercise foreign keys, permitted statuses, future dates, source verification and immutable events.

Browser checks render the actual SriLankanRenalPanel, its existing entry workflow and the new drawer. They exercise partial trends, disabled explanations, source entry/refresh, standalone verification without lab values, metadata/error states, read-only access, review request payloads, keyboard focus and responsive layouts. HTTP boundaries use Java-assembled operational responses; these are software QA fixtures, not clinical subjects or a simulated clinical login.

## 8. Test results

| Check | Fresh result |
|---|---|
| Java 21 / Maven full suite | 167 tests passed; zero failures/errors/skips. Includes all 46 production controller mappings with the real MVC registry/security chain. |
| Django system check and packaged inference/auth suite | System check passed; 17 tests passed. |
| Affected frontend / scope / startup suite | 84 tests passed. |
| TypeScript / Vite production build | Passed; regenerated `dist/` included. |
| Six-module snapshot/review persistence | 14 checks passed through all 43 migration files, ending at V44. |
| Standalone clinical context persistence | 9 checks passed through the same migration chain. |
| Responsive browser verification | 21 checks passed at 1366, 768 and 375 widths; no runtime errors or horizontal overflow. |
| OpenPDF consistency | Actual generated PDFs parsed and rendered; missing requirements, ordered modules, null outputs and measured URR separation checked. |

Fresh logs and JSON evidence are under `verification/renal-readiness-v48/`. Earlier evidence remains unchanged and describes its own release. Software checks do not establish clinical validation or probability calibration.

## 9. Screenshots

The requested screenshots are in `verification/renal-readiness-v48/screenshots/`:

- `renal-readiness-1366.png`
- `renal-readiness-768.png`
- `renal-readiness-375.png`
- `renal-review-drawer-1366.png`
- `renal-review-drawer-375.png`

They show the implemented components and are explicitly labelled operational software QA. They contain no real patient records, clinical predictions, credentials or payment information. The fixture responses are generated by the actual Java assembler; no probability is inserted to make a screenshot appear complete.

## 10. PDF verification

PDF cards consume the stored readiness contract and share the same result titles and explanations. Insufficient data prints “Result not calculated - insufficient longitudinal data.” It lists useful missing requirements and includes full readiness/source details in the evidence section. Zero domains produce no zero-percent composite. Model absence, cohort eligibility, service error and safety suppression remain distinct.

The paired-urea operational test calculates measured URR as 65% from 20 and 7 mmol/L while the next-period forecast remains not ready. The PDF distinguishes the measured result from forecasting. Source dates and invalid/excluded observations are preserved. Export remains read-only with respect to inference. Historical schema-1 snapshots retain their captured evidence and receive the safer missing-status wording; opening the current workspace captures schema-2 readiness.

## 11. Remaining limitations

Native Windows/PostgreSQL execution and a genuine signed-in full-stack patient workflow were not available in this environment. PGlite is a PostgreSQL WASM engine, not native PostgreSQL or a Java Flyway deployment. MVC/security, scoped services, actual model inference, PDF output and browser components were exercised at their documented boundaries; the browser HTTP fixtures do not prove a production login/database session.

Clinical validation, external/prospective validation, probability calibration and dataset permission remain unchanged from the existing research project. A ready serving gate means the available source data satisfy the current research contract, not that a prediction is clinically validated or that the ML service is online. Actual inference occurs only on an authorized run, and service failures remain explicit. The transparent composite keeps its existing minimum and unvalidated directional rules.

## 12. Complete ZIP and Windows startup

This release includes the full project, original functionality/assets/data/model artifacts, existing migrations and evidence, additive V44, updated source, prebuilt frontend, screenshots, this report and verification scripts. Private `.env` files, runtime dependencies, private account fixtures and temporary generated QA response files are excluded.

Stop the previous launcher. Extract the full ZIP into a new folder. Copy your existing local `spring-api\.env` and `ML_Server\.env` into their corresponding locations, retaining any root `.env` configuration. Use the existing database. From Command Prompt in the extracted project root:

```bat
npm ci
setup-renal-ml-windows.bat
start-renal-fullstack-windows.bat
```

The launcher performs a clean Maven startup. Flyway applies additive V44 to the existing database. Keep the service window open and use its printed Frontend URL. For verification:

```bat
mvn -f spring-api\pom.xml clean test
ML_Server\.venv\Scripts\python.exe ML_Server\manage.py test renal_service -v 2
npm run test:renal:readiness
npm run test:renal:six-modules
npm run build
verify-target-windows-postgres.bat
```

The target script now verifies native V44 and the readiness/context checks. Its genuine authenticated API/PDF checks still require the private disposable-local fixture documented in `TARGET_WINDOWS_POSTGRESQL_VALIDATION.md`.

To reproduce component/browser QA, generate responses with `mvn -f spring-api\pom.xml -Dtest=RenalReadinessUiFixtureTest -Dgovcare.renal.readiness.qa.output=target\renal-readiness-qa test`, set `GOVCARE_READINESS_FIXTURES` to the resulting `readiness-ui-fixtures-v48.json`, start Vite on port 5314, and run `npm run test:renal:readiness:browser`. Playwright and its browser are QA prerequisites. `GOVCARE_VISUAL_URL` can select another already-running local frontend port. None of these operational fixtures are loaded into a clinical database automatically.
