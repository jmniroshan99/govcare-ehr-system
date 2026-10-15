# CKD assessment and predictive intelligence integration

## Architecture

`CKDAICDSS` remounts the clinical workspace whenever the authenticated identity, role, tenant or permission context changes. `CkdClinicalWorkspace` owns the authorized patient and the selected clinical view. The assessment component is keyed by patient UUID and stays mounted when its tab is hidden. The predictive panel is lazy-loaded and mounted only while its authorized view is active.

This gives the two views one patient context without merging their clinical calculations. A patient change remounts assessment state, cancels report/prediction/draft operations and removes predictive state. Closing the predictive view also aborts its existing reads, forecasts and writes. Returning reloads the patient aggregate.

`PatientOperationScope` tracks cancellation and suppresses late responses even if a transport ignores abort. PDF extraction and prediction responses must match the selected patient ID before their contents are applied. Report imports, existing draft schema, model feature definitions, input guardrails, source provenance, manual result dates and result/PDF behavior are preserved.

## Permission matrix

| Account | Current CKD assessment | Embedded predictive intelligence | Patient scope |
| --- | --- | --- | --- |
| Super Admin | Existing CKD route permission required | Existing clinical route permission required | Authorized network patients; hospital filter available |
| Doctor, Surgeon, Anesthetist | Existing CKD route permission required | `PATIENT_VIEW_CLINICAL` required | Backend-enforced assigned clinical patients in the authorized hospital |
| Hospital Admin, Pathologist | Existing CKD route policy retained | Unavailable | Existing authorized CKD scope |
| Nurse, Patient, Guardian and other operational roles | Denied by existing CKD route policy | Unavailable, including with a wildcard permission | Existing role-specific application scope |
| Anonymous, suspended or missing-permission account | Denied by existing route guards | Cannot activate the embedded view | No workspace data request |

The detailed predictive write permission is still returned by the backend as `canReview`, based on existing clinical write permissions. A readable panel does not grant authority to save reviews or record measurements. Recommendation reasons, idempotency, source evidence, FHIR provenance and server audit logging remain unchanged.

## URLs and API/database compatibility

| Interface | Change |
| --- | --- |
| `/ai-cdss/ckd` | Integrated workspace; default view is current CKD assessment |
| `/ai-cdss/ckd?view=intelligence&patientId=<UUID>` | Intelligence view only for authorized roles; UUID resolved through the scoped patient API |
| `/ai-cdss/ckd/predictive-intelligence?patientId=<UUID>` | Existing guarded route now redirects to the integrated view |
| Sidebar | One `CKD & Clinical Intelligence` entry replaces the two separate CKD/predictive entries |
| CKD prediction/PDF API paths and payloads | Preserved; client helpers accept an optional AbortSignal |
| Patient documents and workflow drafts | Existing API contracts preserved; helpers accept optional cancellation |
| Predictive aggregate, review, measurement and forecast APIs | Preserved; used directly inside the embedded panel |
| Spring Boot/FHIR/PostgreSQL | No Java, REST-controller, clinical-model or migration changes in this update |

Changing a view does not change the selected patient or send clinical writes. Theme changes do not change patient scope or refetch clinical data. No patient records, synthetic production metrics, credentials or hospital fixtures are added by this update.

Future-risk and trajectory adapters remain unavailable until they are installed and validated. The deterministic history/review features and the existing current CKD model keep their separate evidence and capability states.
