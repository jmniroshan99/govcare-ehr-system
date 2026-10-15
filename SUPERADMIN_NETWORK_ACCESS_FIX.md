# Super Admin network patients and AI assessment

Super Admin can browse patients across hospitals, inspect a selected patient's details and clinical documents, and use that patient in CKD or deterioration risk assessment. The logged-in account's home hospital no longer limits this authorized network workflow. Other roles retain their existing hospital, relationship and patient-release checks.

## Problems corrected

- Patient search required an identifier or ward and searched only the operator's home hospital. Super Admin now receives a network directory immediately, with hospital/ward filters, search, exact totals and server-side pagination.
- Clinical access accepted assigned doctors, surgeons and anesthetists, but rejected Super Admin. An active Super Admin with the required permissions now has an explicit network exception.
- The shell's AI button turned `/patients/search` into `patientId=search`. It now supplies a patient ID only for a real UUID patient route. Directory and profile actions carry the selected patient's UUID.
- The AI selector hid every clinical API failure behind a demographics search fallback. It now displays the clinical API error and supports retry, without changing the authorization source.
- Assessment, PDF extraction, drafts, observations, report storage and FHIR operations used the operator's home hospital. Their scope now comes from the stored selected patient. The operator ID and permissions are retained; a home-hospital department is cleared when entering a different hospital's context.
- A direct patient link now loads through a clinical access endpoint, so a patient beyond the first results page can still be selected. Patient and assessment state reset when the authenticated identity, tenant, role or permissions change.
- Deterioration assessment starts with blank required observations and clears them when switching patients. It does not assume normal vital signs.

## Architecture and permissions

The frontend hospital filter is a query selector. It never changes the authenticated principal or authorizes network access. `NetworkPatientDirectory` verifies the authenticated Super Admin role and permissions, validates optional hospital/ward selectors, and uses parameterized count/page queries. Pages default to 50 records and cannot exceed 200. Queries include the patient's actual hospital label and latest active admission, ward and bed.

`ClinicalPatientAccess` applies the network exception only to active Super Admin accounts that have completed the temporary-password gate and hold `PATIENT_VIEW`. Clinical reading additionally requires `PATIENT_VIEW_CLINICAL`. AI writes require `CONSULTATION_CREATE` or `CONSULTATION_UPDATE`. Existing clinician relationship predicates remain in place for doctors, surgeons and anesthetists.

For a selected patient, the service creates an internal scoped principal with the patient's PostgreSQL hospital ID and the original operator identity. It does not change the account, JWT, role, permissions or persistent hospital assignment. Report and assessment IDs are resolved to their patient before applying clinical access checks. Workflow drafts remain restricted to their owner, and CKD draft restoration rechecks clinical access.

| Role / workflow | Hospital and patient scope | Permission / restriction |
| --- | --- | --- |
| Super Admin patient directory and details | All registered network patients; optional hospital/ward filter | `PATIENT_VIEW`; clinical arrays require `PATIENT_VIEW_CLINICAL` |
| Super Admin clinical AI patient selector and history | Selected network patient | `PATIENT_VIEW` and `PATIENT_VIEW_CLINICAL` |
| Super Admin AI assessment and CKD drafts | Selected patient's stored hospital; original operator | Clinical access plus `CONSULTATION_CREATE` or `CONSULTATION_UPDATE` |
| Super Admin source PDF upload | Selected patient's stored hospital | Clinical AI write checks, `DOCUMENT_CREATE`, permitted source document type |
| Super Admin clinical document view / download / print | Selected network patient | `DOCUMENT_VIEW`, `PATIENT_VIEW_CLINICAL`, `DOCUMENT_VIEW_CLINICAL`; download/print require their respective permissions |
| Hospital Admin / IT Administrator | Existing assigned hospital workflows | No network patient directory or clinical AI exception; existing governance document restrictions remain |
| Doctor / Surgeon / Anesthetist clinical AI | Assigned clinical relationships in assigned hospital | Existing clinical read/write permissions and relationship SQL |
| Nurse / Ward Manager | Existing hospital/ward workflows | No network clinical AI exception |
| Laboratory / Radiology / Pharmacy / other staff | Existing department and hospital workflows | No network clinical AI exception |
| Patient / Guardian | Existing linked identity and released document rules | No network patient or clinical AI access |

The Super Admin document exception permits reading clinical documents and importing `OTHER_CLINICAL_DOCUMENT` AI source PDFs. It does not grant clinical report verification or release authority. Existing other-role document policies remain in effect.

## API and database changes

| API | Current behavior |
| --- | --- |
| `GET /api/patients` | Super Admin accepts optional `search`, `hospitalId`, `wardId`, `page`, `pageSize`; returns `items`, `total`, `page`, `pageSize`, `hasNext`, `scope`. Other roles retain the existing `items` response and reject a foreign hospital filter. |
| `GET /api/patients/hospitals` | New Super Admin directory reference endpoint; returns hospital ID, code, name and patient count from PostgreSQL. |
| `GET /api/patients/identification-wards` | Optional `hospitalId` for Super Admin; hospital labels included. Other roles remain in their assigned hospital. |
| `GET /api/patients/{id}` | Super Admin may resolve a network UUID or identifier. Ambiguous identifiers return HTTP 409 and require choosing a hospital-labelled record. |
| `GET /api/ai-cdss/ckd/patients` | Same network search/hospital/paging parameters for Super Admin, with clinical authorization. Assigned clinicians retain their existing clinical list. |
| `GET /api/ai-cdss/ckd/patients/{patientId}` | New exact clinical patient lookup for a deep link; returns selected patient and hospital identity after clinical authorization. |
| Existing assessment, history, report, document, PDF and draft APIs | URLs retained; selected-patient hospital context applied internally. |

No Flyway migration or schema change is introduced. The existing V1–V32 schema, authentication, dashboard aggregation APIs, RBAC storage and CKD scoring coefficients remain intact. The ten-hospital demo loader and credential files are retained unchanged. Dataset rows are never substituted for an unavailable API response. Missing clinical values must come from reviewed EHR/PDF results or manual entry before the existing CKD model can run.

## Install, build and run

Use Node.js 22+, JDK 21, Maven 3.9+ and PostgreSQL. Keep the existing database and private configuration files when replacing the source. Use the existing `.env.example` instructions for a fresh environment.

From the project root:

```sh
npm ci
npm run test:roles
npm run test:dashboard
npm run test:startup
npm run test:superadmin
npm run test:demo
npm run build
cd spring-api
mvn test
```

Ensure `JAVA_HOME` points to JDK 21, or put its `java` and `javac` on PATH. `test:superadmin` compiles the actual access, directory, prediction, document policy and draft services in an isolated temporary directory with test database/dependency doubles. It complements Maven tests; it does not launch Spring or replace a full Spring build.

Restart Spring Boot and the frontend with the existing launchers (`npm run dev:full` from the root, or your normal deployment processes). Sign out, sign back in as Super Admin, and complete a temporary password change if required. Existing local and demo credentials remain as documented in `LOCAL_ROLE_CREDENTIALS.md` and `database/postgresql/demo-network-credentials.csv`.

Open **Patient search**, choose **All hospitals** or a specific hospital, and use **Profile** or **AI assessment** on a patient row. In CKD assessment, verify the displayed patient and hospital before loading clinical PDFs or entering reviewed values. There is no need to reseed an already-loaded demo network.

See [SUPERADMIN_NETWORK_ACCESS_TESTING.md](SUPERADMIN_NETWORK_ACCESS_TESTING.md) for executed checks and deployment checks that remain unverified in this environment.
