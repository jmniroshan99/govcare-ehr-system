# GovCare modern clinical workspace

> Latest UI update (2026-10-05): CKD assessment and predictive intelligence now share one patient workspace, and the modern theme is applied across the application. See `START_HERE_UNIFIED_CLINICAL_UI.md`, `docs/UNIFIED_THEME_SYSTEM.md`, `docs/CKD_WORKSPACE_INTEGRATION.md` and `docs/UNIFIED_UI_TEST_REPORT.md` for the current UI and verification status. The backend architecture and prior evidence below remain preserved.


The 2026-10-05 compiler hotfix is included. See [Observation build fix and Windows rebuild steps](BUILD_FIX_OBSERVATION_AMBIGUITY.md).

The subsequent Windows log confirms successful compilation, all 72 Maven tests and migration V35. The occupied-port startup fix is also included: [API port selection and startup instructions](STARTUP_PORT_CONFLICT_FIX.md).

Open **Clinical Intelligence → Predictive Clinical Intelligence** after signing in as an authorized Super Admin or assigned clinician. The route is `/ai-cdss/ckd/predictive-intelligence`.

This source adds a modern, patient-scoped longitudinal workspace while retaining the current dashboards, registration, doctor notes, CKD assessment, authentication, PostgreSQL and FHIR APIs. It does not seed hospital/patient data or activate a medical prediction model.

## Delivered

- Compact patient context and an expandable authorized selector.
- Token-based dark/light cards; responsive grids; lazy historical charts; Overview, Trends, Care gaps and Timeline views.
- Verified-result entry with explicit measurement time, original units, source confirmation, audit and FHIR provenance.
- Backend-calculated changes, rolling windows, observed slope, G/A measurement categories, chronicity evidence and renal safety checks.
- Versioned Accept/Modify/Dismiss/Defer reviews, mandatory reasons, evidence fingerprints and append-only feedback.
- Explicit unavailable/suppressed/insufficient forecast capability states. No projected measurements or future probabilities are fabricated.

## Documentation

- [Architecture and data rules](docs/PREDICTIVE_INTELLIGENCE_ARCHITECTURE.md)
- [API and database changes](docs/PREDICTIVE_INTELLIGENCE_API_DATABASE.md)
- [Role permission matrix](docs/PREDICTIVE_INTELLIGENCE_PERMISSIONS.md)
- [Build and local verification](docs/PREDICTIVE_INTELLIGENCE_BUILD.md)
- [Testing report](docs/PREDICTIVE_INTELLIGENCE_TEST_REPORT.md)
- [Modified files](docs/MODIFIED_FILES_MODERN_UI.md)
- [Pre-implementation audit](docs/PREDICTIVE_INTELLIGENCE_AUDIT.md)

## Verification status

Frontend build and available domain, role, migration and regression checks pass. The user's supplied Windows log confirms full Java compilation, 72 passing Maven tests and V35 application. The startup update passes 22 local launcher checks and a configured-API frontend build. Maven dependency downloads remain unavailable in the delivery environment, and the updated launchers' live Windows startup/role/browser checks remain pending. This delivery is a Phase 1 research-CDSS foundation with future-model interfaces; clinical validation and production release sign-off are not established by this delivery.
