# GovCare EHR Inter-Department Patient Documents

## Purpose

This version adds a central, hospital-scoped patient document registry for uploaded and generated PDFs and related clinical documents. It keeps one patient identifier across OPD, doctor, ward, pharmacy, laboratory and radiology workflows while applying role, department, verification and release rules.

## Main routes

Frontend:

- `/patients/{patientId}/documents`
- `/laboratory/documents`
- `/radiology/documents`
- `/pharmacy/documents`
- `/doctor/documents`
- `/ward/documents`

Spring Boot:

- `GET /api/patients/{patientId}/documents`
- `GET /api/patients/{patientId}/documents/{documentId}`
- `GET /api/patients/{patientId}/documents/{documentId}/content`
- `POST /api/patients/{patientId}/documents`
- `POST /api/patients/{patientId}/documents/generate`
- `PATCH /api/patients/{patientId}/documents/{documentId}/verify`
- `PATCH /api/patients/{patientId}/documents/{documentId}/reject`
- `PATCH /api/patients/{patientId}/documents/{documentId}/release`
- `PATCH /api/patients/{patientId}/documents/{documentId}/revoke-release`
- `PATCH /api/patients/{patientId}/documents/{documentId}/archive`
- `POST /api/patients/{patientId}/documents/{documentId}/share`
- `DELETE /api/patients/{patientId}/documents/{documentId}/share/{departmentId}`
- `GET /api/patients/{patientId}/documents/{documentId}/shares`
- `GET /api/patients/{patientId}/documents/{documentId}/audit`
- `GET /api/departments/{departmentId}/documents`
- `GET /api/departments/{departmentId}/requests`
- `GET /api/patients/{patientId}/timeline`
- `GET /api/documents/shareable-departments`

## Database migration

`V9__inter_department_patient_documents.sql` creates:

- `patient_documents`
- `document_department_access`
- `document_access_logs`
- document permissions and role mappings
- indexes and timestamp trigger
- migration of eligible legacy patient PDFs from `global_media`

New patient PDFs uploaded through the existing Media API are also indexed in `patient_documents`. Releasing a legacy media PDF synchronizes its central release state.

## Security model

- Every request is JWT authenticated.
- Hospital scope comes from the authenticated principal.
- Patient and guardian accounts can access only their linked patient and only verified, released documents.
- Records and reception roles can access administrative document types only.
- Hospital and super administrators can manage metadata and sharing policies without automatically obtaining clinical-content access.
- Drafts remain with the creator/source department and authorized verifier.
- Other departments normally consume only verified documents.
- Doctors require a clinical relationship with the patient unless a valid department share exists.
- Nurses require an active ward relationship for ward-relevant documents unless a valid share exists.
- Storage keys and local paths are removed from API responses.
- Preview, download and print use authenticated Blob requests.
- View, download, print, share, verify, release and denial events are audited.

## Storage

Metadata is stored in PostgreSQL. Files are stored under the configured `govcare.storage.root` directory using generated UUID filenames. Path normalization prevents directory traversal. PDF, JPEG, PNG and DOCX files are supported by the dedicated document endpoint, with a default maximum size of 25 MB.

## Workflow example

1. A doctor creates a laboratory request.
2. Laboratory staff see the request in the department request list.
3. A laboratory document is uploaded or generated and submitted.
4. A pathologist or laboratory manager verifies it.
5. The requesting doctor can see the verified report through the central patient profile.
6. The report can be shared with an active ward department.
7. The report becomes visible to the patient only after an authorized release action.
