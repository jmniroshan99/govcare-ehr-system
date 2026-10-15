# GovCare V55 - establish the clinical evidence

V55 completes the entry paths behind incomplete monitoring and adds an optional research demonstration. The existing CKD assessment, Spring API, renal ML service, trained artifacts, patient authorization, longitudinal pipeline, FHIR, reviews, five-year outlook and PDF workflow are retained.

## Resolve the states in the supplied screenshots

| Previous state | V55 behavior | Evidence still required |
| --- | --- | --- |
| Trend not established | **Establish the clinical evidence** opens a two-result form for creatinine, hemoglobin or potassium. The measurement selector also supports eGFR, urine ACR and systolic/diastolic BP. | Two actual numeric source results, supported units, distinct nonfuture measurement times and both source references. |
| Latest assessment undated despite dated history | A valid historical pair now establishes a separately labeled measured trend. The undated snapshot keeps its own value and source-review warning. | The snapshot's date is not invented. Invalid/conflicting current sources continue to block interpretation. |
| Diabetes permanently missing | **Verify diabetes context** records confirmed diabetes, no known diabetes in the reviewed record, or unconfirmed context. | Actual verification time, source note and clinician confirmation. HbA1c/glucose alone never create a diagnosis. |
| URR not calculated | **Add paired dialysis results** opens the existing verified renal-session workflow. | Actual pre-HD urea, post-HD urea and their shared dialysis-session date. BUN is not substituted. |
| 100% Ready on an undated snapshot | The disease cards and PDF say **% available** for monitoring inputs. Research model eligibility remains separate. | Available input coverage does not establish dated history, safe model eligibility or clinical validation. |

Open **AI CDSS -> CKD -> Predictive clinical intelligence**, select an authorized patient, and use **Establish the clinical evidence**. A successful save refreshes the monitoring cards from the backend. No actual patient receives default values or dates. Both source observations save in one transaction through the existing observation/FHIR/audit pipeline. Failed validation does not save the first result alone; retries use stable request UUIDs.

A historical pair is not an acute diagnosis. When a separate latest snapshot is undated, historical creatinine change does not produce an acute review signal. Existing severe-value warnings remain visible.

## Optional synthetic demonstration

An active **Super Admin** with an assigned hospital and patient-create, clinical-view and consultation-create permissions can expand **Research demonstration patients** in the shared patient workspace and click **Create two synthetic demo patients**. The button explicitly creates new records; it does not populate the currently selected patient. Each case has a reserved `SYNTH-CKD-` patient number, a SYNTHETIC name, source notes and a persistent warning across the three CKD views.

1. **Non-dialysis demonstration:** five dated CKD assessments spanning approximately one year, verified non-maintenance-HD context and reviewed diabetes context. Select **5-year outlook**, inspect the evidence, then use the existing explicit clinical-confirmation form to calculate the published two-/five-year kidney-failure equation. Eligibility is not automatically confirmed by creating the patient.
2. **Maintenance-HD demonstration:** five dated CKD assessments and three verified paired dialysis sessions at approximately 61, 31 and 1 days before creation. The latest session has pre-HD urea 21 mmol/L and post-HD urea 6.3 mmol/L, giving measured URR **70%**. The original hemoglobin, URR and hyperkalemia research controls can be used when the existing ML service and model registry are available and the source/eligibility gates pass.

The synthetic assessments pass through the existing CKD prediction and source-capture service. The dialysis sessions use the existing renal observation service. No stored research forecast or five-year risk is fabricated during creation. Repeating the same creation request returns the same two patients. The complete operation is transactional.

The five-year equation is not applicable to the maintenance-HD case. Short-term research models retain their original 14-62-day next-observation horizon. The Hb/URR persistence baselines remain baselines; the hyperkalemia model is unchanged. Dry-weight forecasting, cardiovascular event probabilities, survival predictions, treatment-effect predictions and clinical validation are not established by synthetic examples.

## PDF behavior

The existing **CKD Related Clinical Intelligence Summary** retains all five disease cards, measured indicators, missing information, explanations, actions and clinician notes. Monitoring coverage now says **% available**. The cardiovascular card includes verified diabetes context, its date and the source note.

Assessment PDFs remain tied to their stored source evidence. An old assessment/report is not silently rewritten with later clinical entries. Refresh the clinical dashboard after saving evidence and create/review the appropriate new CKD assessment or snapshot before exporting an updated assessment-linked report. Existing frozen snapshots retain their original meaning. The example in `verification/ckd-evidence-v55/synthetic-evidence-summary-v55.pdf` is a software fixture, not a clinical report or an ML validation result.

## Upgrade and run

1. Stop the existing GovCare launcher. Extract this complete package into a new directory and retain your existing database and local environment configuration. Keep the previous package available.
2. From the extracted project root, run `npm ci`. Reuse the existing Java 21, PostgreSQL and renal Python environment; V55 adds no production Python dependency or model-training requirement.
3. Start `start-renal-fullstack-windows.bat` or run `npm run dev:renal`. Keep the launcher open and use the frontend URL it prints. V53's automatic port selection is preserved; do not assume that ML must bind a fixed unavailable port.
4. Spring's existing Flyway startup applies additive **V47**. It adds append-only `ckd_diabetes_context_events` and `ckd_research_demo_runs`; V55 is the release number. Earlier migrations and clinical records are not replaced.
5. Open the CKD workspace, test the new source-evidence forms, and optionally create the two labeled demonstration cases as Super Admin.

## Verification

See `verification/ckd-evidence-v55/VERIFICATION_REPORT.md` for fresh test results, commands and boundaries. Native browser layout/modal behavior and startup against your Windows PostgreSQL instance require target-machine verification. The packaged code does not claim to have modified the patient's records shown in the screenshots.

Useful checks from the project root:

```sh
npm run build
npm run test:ckd:evidence
npm run test:ckd:evidence:migration
npm run test:ckd:dashboard
npm run test:ckd:outlook
npm run test:startup
```

Run `mvn test` from `spring-api` with Java 21. The optional DOM form verifier uses jsdom 26, supplied separately through `GOVCARE_JSDOM_MODULE`; it is a development verification dependency, not a production dependency. The existing native-browser verification scripts remain available on a workstation with Playwright/Chromium.
