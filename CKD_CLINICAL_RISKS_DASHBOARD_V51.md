# GovCare V51 - CKD Related Clinical Risks

The existing CKD AI-CDSS now presents five clinical risk areas as a focused dashboard. The original CKD assessment, patient/hospital authorization, ML service, source measurements, review persistence, and PDF/report center workflow remain in place.

## What changed

| Area | Behavior |
| --- | --- |
| Anemia | Actual Hb and dated Hb timeline; red/orange theme; source status, input completeness, blood-result entry and clinician review. |
| Hyperkalemia | Actual serum potassium and dated history; purple/blue theme; the generic potassium result is never relabeled as pre/post-HD data. |
| Dialysis adequacy | Measured same-session URR, paired urea checklist, session date and formula; blue/cyan theme; research forecasting stays separate. |
| Renal deterioration | Existing creatinine/AKI monitoring plus actual directional renal marker tiles; teal/navy theme; measured change is labeled separately from probability. |
| Cardiovascular | Pink/red factor surveillance for BP, potassium, creatinine, age and clinical diabetes status. No cardiovascular probability or diagnosis is invented. |

Cards provide keyboard-accessible quick summaries, expandable clinical evidence, missing parameters, source dates, model details, prediction explanations and existing clinical action buttons. A dedicated explanation panel displays measured changes in creatinine, eGFR, potassium and hemoglobin. Light/dark mode, three/two/one-column layouts and reduced-motion preferences are supported.

The original renal trajectory and kidney failure/dialysis verification cards remain in the expandable **Renal trajectory & verified dialysis status** section. Existing model history, clinician-review forms, source entry, longitudinal charts and the research illustration remain available below the dashboard.

The **Generate report** action uses the existing saved CKD assessment report endpoint. PDF export now includes **CKD Related Clinical Intelligence Summary**, with five disease cards, monitoring status, clinical indicators, available evidence, missing information, explanations, action labels and clinician notes. Detailed existing evidence, research outputs, provenance and reporting continue afterward. Export does not start ML inference.

## Interpret the indicators correctly

- **Available clinical data** describes completeness of the listed monitoring inputs. Hb can be 100% complete for the current-Hb rule while iron studies and longitudinal model requirements are still missing.
- **AI prediction readiness** retains the original server eligibility/model gates. Model absence, service error, insufficient observations and unverified dialysis context remain distinct states.
- **Stable** requires a dated pair within the displayed stability band. A single reassuring result is displayed as monitoring, and undated/historical values require date/source verification.
- PCV, RBC count, ferritin and iron profile are not mapped into this CKD snapshot by V50. The dashboard explicitly directs users to review those existing source reports. It never checks them as available based only on Hb.
- Confirmed diabetes status is not mapped into the current CKD feature contract. HbA1c/glucose do not substitute for a clinical diagnosis. Cardiovascular surveillance therefore identifies the missing clinical-record review even when the four other factor groups are available.
- Existing Hb, potassium, eGFR/ACR and AKI monitoring thresholds are unchanged. This update does not validate the research models for clinical deployment.
- PDF exports retain the selected CKD assessment association and stored related-risk source dates. A historical assessment report can differ from the newest patient snapshot; its assessment/snapshot references are printed.

## Run the existing application

1. Extract the entire project, retaining its current `.env`, PostgreSQL configuration and ML configuration when applying the update locally.
2. Use the existing supported Node.js runtime, Java 21+ and Maven 3.9+.
3. Run `npm ci`, then the existing `npm run dev:full` or documented renal-stack launcher.
4. Open `/ai-cdss/ckd`, select an authorized patient, and run/open the CKD assessment. Review **CKD Related Clinical Risks** in the result workspace.

No dependency, database schema, route, ML artifact or training-dataset change is required. The prebuilt frontend is updated in `dist/`. Rebuild the Spring application through the existing launcher to load the updated PDF renderer and additive cardiovascular surveillance field.

## Verification

- Production TypeScript/Vite build: passed.
- Dashboard, CKD source/API contract tests: 16 passed.
- Existing CKD workspace boundary tests: 30 passed.
- Existing theme tests: 10 passed.
- Existing startup tests: 22 passed.
- Full Spring test suite: see `verification/clinical-dashboard-v51/spring-full-tests.log` and `validation-summary.json`; database-dependent integration checks are separately identified there.
- Browser verification at 1440, 900 and 390 px: 13 check groups passed, no browser runtime errors. Verified real React forms, dated Hb entry, unchanged API payloads, immutable snapshot/version review, missing-data drawer, same-session URR 20/7 = 65%, gated prediction, read-only restrictions and failure states.
- Actual OpenPDF exports generated by backend tests were rendered and inspected. The demonstration report is synthetic software QA data, not a patient report.
- The original ML service, model artifacts, datasets, database migrations and patient pipeline are checked byte-for-byte against the supplied V50 archive in `preservation.json`.

These checks use generated Java clinical responses and captured synthetic HTTP boundaries. They do not establish live hospital database validation or clinical model validation.

## Reproduce focused checks

```bash
npm run build
npm run test:ckd:dashboard
npm run test:ckd-workspace
npm run test:theme
npm run test:startup
mvn -f spring-api/pom.xml test
```

To generate actual Java fixtures/PDFs for UI QA:

```bash
mvn -f spring-api/pom.xml -Dtest=ClinicalFeatureUiAndPdfTest -Dgovcare.clinical.feature.qa.output=/absolute/path/qa test
```

The browser script uses Playwright supplied by the QA environment, matching existing browser verification scripts. Set `GOVCARE_FEATURE_UI_FIXTURES` to the generated `clinical-feature-ui-fixtures-v49.json`. Optionally set `GOVCARE_PLAYWRIGHT_MODULE`, `GOVCARE_CHROMIUM_EXECUTABLE` and `GOVCARE_CHROMIUM_ARGS`, then run `npm run test:ckd:dashboard:browser`. The retained v49 fixture filename is the existing generator's compatibility name; the fixture content is generated from V51 source.

## Clinical design references

- KDIGO 2024 CKD guideline executive summary, practice point 2.3.1: use externally validated CKD-appropriate models when estimating cardiovascular event risk. https://kdigo.org/wp-content/uploads/2017/02/KDIGO-2024-CKD-Guideline-Executive-Summary.pdf
- KDIGO 2026 Anemia in CKD guideline: https://kdigo.org/guidelines/anemia-in-ckd/
- UK Kidney Association hyperkalemia guideline, updated July 2026: https://www.ukkidney.org/health-professionals/guidelines/treatment-acute-hyperkalaemia-adults-0

These references inform the distinction between surveillance, missing anemia workup, and validated event prediction. Existing V50 numerical thresholds were preserved rather than replaced in this UI change.
