# GovCare V54 — 5-Year CKD Outlook

Open **AI-CDSS → CKD workspace → select an authorized patient → 5-year outlook**.

This extends the existing application. The CKD assessment, patient feature pipeline, six renal modules, trained artifacts, FHIR flow, authentication, PDF workflow and V53 automatic port selection remain in place. Full replacement source files and the rebuilt production frontend are included in this archive.

## What the dashboard provides

- A compact patient context panel, navy outcome card with a probability ring, and an evidence panel.
- Separate two-year and five-year probabilities of kidney failure requiring dialysis or transplantation, for clinically confirmed eligible patients.
- Measured eGFR/urine ACR history with source dates and an accessible table; no invented five-year laboratory curve.
- A Today/Years 1–5 planning timeline populated only by clinician-defined milestones, anchored to the stored assessment date.
- Comparison with up to five preceding stored assessments. Differences are percentage-point comparisons, not treatment-effect estimates.
- Current anemia, hyperkalemia, dialysis adequacy, renal deterioration and cardiovascular monitoring, connected to the existing detailed monitoring and data-entry flows.
- Explainability, transient hypothetical eGFR/ACR comparisons, clinical review, revised interpretation, notes and PDF export.

The interface has light/dark styles, responsive breakpoints, native keyboard-accessible dialogs, arrow-key journey tabs, text alternatives for charts and reduced-motion support. Automated browser execution was blocked by this execution environment; desktop/tablet/phone appearance and native focus behavior still require the supplied browser QA on a supported workstation.

## Method and eligibility

The new assessment uses the **published four-variable KFRE, non-North American 2016 calibration**, implementation version `KFRE4-NNA-2016-GOVCARE-1.0`. See `MODEL_HORIZON_AUDIT_V54.md` for coefficients, primary references, independent cases and the limitations of every existing model.

Required inputs are age from stored date of birth, a clinician-confirmed equation sex variable, eGFR and **urine ACR**. Serum albumin is never substituted for urine ACR. Supported ACR conversions use `mg/mmol × 8.84 = mg/g` through the existing clinical measurement pipeline.

The enabled population is adults aged 18–120 with confirmed CKD G3–G5, eGFR greater than zero and below 60 mL/min/1.73 m², a quantified positive urine ACR at or below 100,000 mg/g, and no previous/current kidney replacement therapy. Maintenance HD is an explicit not-applicable state. The clinician must also confirm absence of peritoneal dialysis/transplantation, chronic CKD and stable context, and record a source note. A demographic field alone is not clinical confirmation.

**GovCare source policy**, distinct from the published equation: eGFR and ACR must have valid, nonfuture dates within 90 days and be no more than 30 days apart. Invalid sources, unresolved acute signals, recent/active hospital admission or truncated retrieval block calculation. A checkbox cannot override these server checks. Missing, zero/censored, stale and conflicting values produce explained unavailable states with null probabilities.

Keep these concepts separate: input presence, population eligibility, method availability, local validation, and uncertainty. Input availability of 100% is not clinical validation. Local validation remains **NOT_COMPLETED / RESEARCH_PREVIEW**. No individual prediction interval is supplied, and the event probabilities are not survival probabilities.

KDIGO purpose-specific review prompts use two-year risk >40% for KRT planning review, >10% for multidisciplinary-care review, and five-year risk ≥3% for consideration within its 3–5% referral review range. These prompts require the full clinical context and do not automatically order treatment.

## Workflow

1. Select the patient and inspect source dates, applicability and the current monitoring modules.
2. Use **Add a verified result** for missing measurements. This opens the existing dated, unit-aware observation workflow.
3. Select **Calculate eligible risk**, complete the clinical confirmations and source note, then save the assessment.
4. Inspect **Why this outlook?** for actual inputs, dates, sources, equation version, calibration and limitations.
5. Use **Explore assumptions** to compare hypothetical eGFR/ACR with the recorded result. Age and the verified equation variable remain fixed. This is input sensitivity, not a validated treatment effect, forecast laboratory trajectory or patient observation. Reset restores recorded values; scenario inputs/results are not persisted.
6. Use **Review & plan** to accept, modify the interpretation, defer or dismiss, with a clinical reason. Notes and Today/Years 1–5 plans are appended as a new review version; equation probabilities remain unchanged.
7. **Generate report** uses the existing saved CKD assessment/report flow. If no CKD assessment exists, save one in the CKD assessment tab first. The new PDF appendix reads the most recent stored outlook assessment and its latest review without calculating a new outlook or invoking ML.

Evidence changes suppress a saved probability from the current outcome card until a new assessment is recorded. The earlier value remains in assessment history. Permission-limited users can inspect authorized records; clinical recording actions stay under existing write permissions.

## Integration and persistence

Flyway migration **V46** is additive; V54 is the package release number. Spring startup applies V46 through the existing migration process. It adds immutable `ckd_outlook_snapshots` and append-only `ckd_outlook_reviews`, with patient/tenant foreign keys, explicit result constraints, optimistic review versions and idempotent request UUIDs. Earlier migrations are unchanged.

Patient-authorized endpoints under `/api/ai-cdss/ckd/patients/{patientId}/outlook`:

| Method/path | Behavior |
| --- | --- |
| GET base path | Current evidence/readiness, latest stored assessment/review and assessment comparisons |
| POST `/assessments` | Re-read server evidence, verify fingerprint and clinical context, calculate and store an immutable snapshot |
| POST `/reviews` | Append a versioned review/notes/plan to a scoped parent snapshot |
| POST `/scenarios` | Transient input-sensitivity result from a scoped eligible snapshot; no scenario or clinical writes |

Every operation applies `ClinicalPatientAccess` before patient-data queries. Responses are `no-store`. Snapshot IDs do not grant access. Calculations accept confirmations and a source fingerprint, never client-supplied real-patient laboratory values or probabilities. Requests and reviews are audited. Scenario calculations require an eligible assessment no more than 90 days old and reject newly verified maintenance HD.

The older automatic predictive KFRE adapter stays inactive because it lacks the explicit confirmation workflow; its explanation directs clinicians to this tab. The separate Python adapter scaffold is unchanged. No short-term model is relabeled, recursively extended or retrained.

## Run and verify

Use the existing installation and launcher instructions, including `WINDOWS_RENAL_PORT_FIX_V53.md`. Run `npm run dev:renal` or the existing Windows launcher and open the frontend URL printed by the launcher. Keep the local environment/database configuration already used by GovCare. No new Python dependency or model-training command is required for this feature.

```bash
npm ci
npm run build
npm run test:ckd:outlook
npm run test:ckd:outlook:migration
```

With Java 21 and Maven, from `spring-api`:

```bash
mvn clean test
```

To regenerate synthetic browser fixtures and the PDF, set `-Dgovcare.outlook.fixtureDir=<absolute project>/verification/ckd-outlook-v54` while running `CkdOutlookUiAndPdfTest`. A clearly labeled software-only synthetic patient is used; no demonstration observation is imported into the EHR.

Browser QA needs Playwright plus its Chromium runtime. Install it in a disposable development environment without changing the application lockfile (`npm install --no-save --package-lock=false playwright`, then `npx playwright install chromium`) and run `npm run test:ckd:outlook:browser`. The script uses isolated synthetic intercepted API responses; it does not use a hospital session. It checks 1440/900/390 px layouts, overflow, forms, modal keyboard dismissal, scenarios, patient switching, review/version contracts, report/download and dark mode. This remains **unverified here**, not counted as a passing test.

See `verification/ckd-outlook-v54/VERIFICATION_REPORT.md` for fresh counts and explicit target-environment limitations. Native Windows, live hospital PostgreSQL and prospective clinical validation are not claimed.
