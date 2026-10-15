# V54 verification report

The existing GovCare project now includes a patient-authorized **5-Year CKD Outlook**. A published KFRE assessment, recorded history, transient input comparisons and clinician planning are deliberately distinct. Existing short-term models retain their original horizons and weights.

## Executed checks

| Area | Fresh result | Evidence / practical scope |
| --- | --- | --- |
| Frontend | Production TypeScript/Vite build passed | `frontend-build.log`; lazy integrated outlook chunk and rebuilt `dist` |
| Spring Java 21 | 227 tests: 222 passed, 5 skipped | `spring-tests.log`, `validation-summary.json`; includes 23 new equation, eligibility, authorization/service and PDF/fixture tests |
| JavaScript | 102 passed | `node-tests.log`; new formatter/history behavior, CKD role/view boundaries, retained disease dashboard, feature contracts, theme and startup/port tests |
| Existing ML preprocessing/training gates | 16 passed | `ml-tests.log`; tests only, no retraining |
| Existing Django renal service | 17 passed | `django-tests.log`; authenticated model loading, inference, baselines, safety gates and contracts |
| Additive database migration | 22 passed | `database-report.json`; all 45 migrations through V46 applied to isolated PGlite PostgreSQL WASM |
| PDF | Generated, extracted by tests, rendered and visually inspected | `GovCare_V54_Synthetic_Five_Year_Outlook.pdf`; five-page full legacy report plus stored outlook appendix; embedded fonts, repeated table headers and no orphaned outlook heading |
| Preservation | Passed | `preservation.json`; original models/training data, ML services, earlier migrations, lockfile and V53 startup fixes compared byte for byte against V53 |
| Browser / responsive UI | Blocked, not a pass | `browser-report.json`; Chromium aborted on an environment-denied local socket. No desktop/tablet/mobile screenshot or native focus result is claimed. Reproducible Playwright suite is included. |

379 test/check assertions passed across the nonoverlapping Java, JavaScript, ML, Django and migration groups above; 5 JDBC-dependent Java tests were skipped. Repeated focused checks are not added to that total. Build and PDF inspection are separate checks.

## Requirement coverage

- Independent reference: five synthetic male/female cases from the authors' arithmetic, each with separate two/five-year expectations; unit conversion and boundary rejection tested.
- Data quality: absent ACR, serum albumin non-substitution, invalid/stale/future/undated/unaligned input, acute hospital context, truncated retrieval, pediatric/early-stage and maintenance-HD exclusions tested. Unavailable probabilities remain JSON null.
- Patient boundaries: authorization occurs before SQL in every public operation; incorrect patient/hospital clinical source is rejected. Snapshot/review/scenario lookups include tenant and patient, not just an object UUID.
- Recording: server source fingerprints, request-id idempotency, evidence-change conflict, optimistic append-only review versions, required modification reasons, retained probabilities and clinician-defined plans tested.
- Scenarios: eligible scoped stored baseline, no observation/review/snapshot inserts, invalid-input rejection, baseline age/sex retained and newly verified maintenance-HD suppression tested.
- PDF: stored assessment/review read without source assembly or inference, exact sample probabilities, existing clinical sections, unavailable states and notes/plans tested. The sample is conspicuously synthetic and is not a clinical record.
- Resilience: the included browser suite checks operational API failure, missing/stale/dialysis/read-only states, patient switching, report download, dialog/form actions, dark mode and three viewport widths. These browser assertions could not execute here. Native dialog, focus-return, tab-key behavior and responsive appearance require workstation execution.

## Limits and remaining target checks

Native Windows startup, a live hospital PostgreSQL/Flyway upgrade and an authenticated hospital-patient UI session were not available. Five native JDBC tests are explicitly skipped without `GOVCARE_TEST_JDBC_URL`; PGlite migration checks do not replace that production-driver/environment verification. The V53 permission-denied-port workaround is byte-identical and covered by retained JavaScript startup tests, but native Windows execution is not newly claimed.

The design plugin CLI was automatically blocked for unsolicited external telemetry; implementation continued locally using the existing application components and scoped CSS. No external design submission or telemetry retry was used.

This is software verification, not prospective clinical validation, local KFRE calibration, a validated causal treatment model or a trained five-year laboratory/survival model. The UI and PDF explicitly label the feature **RESEARCH_PREVIEW / local validation NOT_COMPLETED**.

## Repeat

See `CKD_FIVE_YEAR_OUTLOOK_V54.md` for normal startup, migration, Java, Node and Playwright commands. Browser fixtures are generated by the actual Java equation/eligibility engine. Model limitations and primary equation references are in `MODEL_HORIZON_AUDIT_V54.md`. All complete modified/new source files are in the full project archive; `modified-files.json` lists them with digests.
