# GovCare V45 - Research infographic integration

## 1. Project identification

GovCare is the uploaded hospital EHR, extended from the supplied V44 full source package. This V45 change integrates the requested university research infographic into the existing Sri Lankan longitudinal renal/hemodialysis intelligence workflow. It is intended for authorized clinical users and research presentations.

## 2. Architecture analysis

The existing application uses React/TypeScript/Vite, shared healthcare theme tokens and a Spring Boot REST API with JWT, role permissions and ClinicalPatientAccess. PostgreSQL persists clinical history through Flyway migrations. Spring retrieves verified patient-scoped observations and sends scoped service credentials to the stateless Django renal inference service. FHIR R4 RiskAssessment, ClinicalImpression and provenance remain part of the stored prediction/review workflow.

The new `RenalResearchInfographic` is an isolated, static React presentation component. It accepts no patient props, reads no clinical cache and performs no inference or API calls. Its PNG and presentation PDF are versioned public assets resolved through Vite's configured base URL. A readable HTML transcript covers all four modules and the complete workflow. Existing patient cards continue to use their established observations and prediction snapshots.

## 3. Problems found

- The prior conceptual asset was available only inside a disclosure after the live cards; it lacked dedicated full-resolution and presentation-PDF download controls.
- A dense raster infographic alone is difficult to read on narrow screens or with assistive technology.
- The first generated illustration incorrectly duplicated the Hb `Baseline forecast` method label in the hyperkalemia module. That draft was corrected before project integration.

These are the bounded issues addressed by this change, not a claim of an exhaustive audit of every unrelated EHR module.

## 4. Root cause analysis

The prior UI embedded one legacy PNG directly inside `ClinicalRiskVisual`. Presentation content and export controls had no independent component or accessible module transcript. The incorrect K+ method label was an image-generation text error, not an ML algorithm error. The reviewed final asset now labels K+ as `Research risk model` and preserves Hb as `Baseline forecast`.

## 5. Fixes applied

- Added a visible research overview before the patient-scoped clinical cards, including during renal history loading or an unavailable renal response.
- Added full-resolution viewing and genuine PNG / landscape PDF downloads.
- Added keyboard-operable expand/collapse controls, descriptive alternative text, an image-load fallback and readable module descriptions.
- Added all requested indicators, URR formula, clinical workflow and four capability badges to the HTML transcript.
- Preserved the original infographic file as a legacy asset and added versioned V45 assets to avoid stale image caches.
- Replaced the old inline disclosure with the reusable component and updated the existing graphics contract test to account for the extracted component.

## 6. Improvements added

The overview uses the requested navy, cyan and teal presentation palette, realistic 3D kidney artwork and four connected modules. Responsive export controls and a mobile transcript provide readable content at narrow widths. Static conceptual charts are explicitly labelled as illustrative clinical review signals. No invented probability percentages or patient measurements were added.

The existing clinical semantics are preserved: verified maintenance dialysis is required for G5D; Hb is a persistence baseline; URR is a research forecast; the hyperkalemia research score is not clinically calibrated; deterioration is a directional composite rather than a disease probability. Clinical-validation and dataset-permission limitations from V44 remain applicable. The presentation PDF is a research illustration, while the existing CKD assessment PDF continues to report stored patient-specific clinical graphics and review provenance.

## 7. Testing results

Freshly executed:

- `npm ci --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=15000`: successful locked installation, 162 packages.
- `npm run build`: successful TypeScript project build and Vite production build, 3,432 modules transformed.
- `node --test scripts/renal-clinical-risk-graphics.test.cjs scripts/ckd-workspace.test.cjs scripts/renal-measurement-units.test.mjs scripts/predictive-access.test.cjs`: 66 tests passed, zero failed.
- Presentation PDF: one page, 960 x 540 points, one embedded illustration; rendered with Poppler and visually checked for clipping and legibility.
- Actual browser verification on Chromium 153: seven interaction/failure-path checks passed; desktop 1366 px, tablet 768 px and mobile 375 px layouts passed without horizontal overflow; zero runtime errors and zero clinical API calls. Full-size opening, real PNG/PDF downloads, keyboard collapse/expand and the unavailable-image fallback were exercised. Results are recorded in `verification/renal-infographic-browser-v45.json`.

The browser verifier renders the real static research component in isolation; it does not claim a signed-in doctor workflow, live PostgreSQL validation or clinical validation. Full Windows/PostgreSQL/Spring/Django execution was not repeated for this presentation-only change. The executor has Java 17, lacks Maven and has no configured clinical database/account fixture; the backend requires Java 21. V44's target verifier remains included for those checks.

## 8. Final package information and build instructions

The delivery contains the complete original V44 source plus the V45 components, assets, optional PDF export script, browser verifier, documentation, checksums and the successful production frontend output in `dist/`. Installed dependencies, temporary QA/browser files, private runtime configurations and local build caches are excluded. Existing backend, ML artifacts, migrations and Windows launchers are retained. No new migration or model retraining is required for V45.

For an existing installation, extract to a new folder and reuse the existing local configuration and PostgreSQL database. Keep private `.env` files local. From the extracted project root:

```bat
npm ci
npm run build
setup-renal-ml-windows.bat
start-renal-fullstack-windows.bat
```

Use the existing V44 prerequisites: Node 22.12+ or Node 24, Java 21, Maven 3.9+, Python 3.12+ and PostgreSQL. Configure the existing Spring database credentials and service secrets through the documented local setup. Do not reset an existing database or run demo seeding merely to see this infographic.

Open **AI CDSS -> CKD**, select an authorized patient, then open **Predictive Clinical Intelligence -> Overview**. The Sri Lankan renal panel contains the visible research overview, full-size PNG and Presentation PDF controls. The underlying live clinical cards and clinician review actions remain below it.

The standalone files are:

- `public/research/ckd-risk-predictive-intelligence-v45.png` (1672 x 941 pixels)
- `public/research/ckd-risk-predictive-intelligence-v45.pdf` (16:9 landscape canvas)

Optional verification with a prepared local Playwright installation and running Vite: `node scripts/verify-renal-infographic.mjs`. `GOVCARE_PLAYWRIGHT_MODULE`, `GOVCARE_CHROMIUM_EXECUTABLE` and `GOVCARE_CHROMIUM_ARGS` can point to a QA browser runtime without changing application dependencies. Optional PDF regeneration requires ReportLab and `python scripts/export-renal-research-infographic.py`; the committed PDF needs no extra runtime dependency.

## 9. Future recommendations

Run `verify-target-windows-postgres.bat` on the configured target machine to confirm native startup and the signed-in CKD/PDF workflow. Review the research wording with the supervisor. Use the PNG or landscape PDF in research materials; prospective clinical validation and probability calibration remain separate research requirements rather than outcomes of this visual integration.

Detailed file changes are listed in `MODIFIED_FILES_V45_RESEARCH_INFOGRAPHIC.txt`. Earlier reports and screenshots describe their original executions; V45 fresh evidence is separated into its own files.
