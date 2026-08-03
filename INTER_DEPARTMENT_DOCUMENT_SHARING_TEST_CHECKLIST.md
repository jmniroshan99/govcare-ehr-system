# Inter-Department Document Sharing Test Checklist

## Build and startup

- [ ] `npm install`
- [ ] `npm run build`
- [ ] `npm run spring:build`
- [ ] `npm run dev:full`
- [ ] Frontend opens on `http://127.0.0.1:5300`
- [ ] Spring health is UP on `http://127.0.0.1:4001/actuator/health`
- [ ] Flyway applies migration V9

## Central documents

- [ ] Upload a PDF for a PostgreSQL patient
- [ ] The file is stored under the configured secure storage root
- [ ] The API response does not expose `storageKey` or a local file path
- [ ] The document appears in `/patients/{patientId}/documents`
- [ ] Search, type, status, release, department and date filters work
- [ ] Preview uses an authenticated Blob URL
- [ ] Download works with JWT authentication
- [ ] Print works and records `DOCUMENT_PRINTED`
- [ ] Archive removes the document from active lists

## Laboratory

- [ ] Laboratory staff see laboratory requests
- [ ] Laboratory technician can upload draft/submitted laboratory documents
- [ ] Laboratory technician cannot verify a result
- [ ] Pathologist or laboratory manager can verify/reject
- [ ] A verified result is visible to the requesting doctor
- [ ] An unrelated pharmacy document is not visible to laboratory staff

## Radiology

- [ ] Radiology staff see radiology requests
- [ ] Radiology technician can add radiology documents
- [ ] Radiologist can verify/reject radiology reports
- [ ] A verified report is visible to the requesting doctor

## Pharmacy

- [ ] Pharmacist sees prescription requests and pharmacy documents
- [ ] Pharmacist cannot open unrelated laboratory/radiology clinical PDFs

## Ward and doctor access

- [ ] Assigned doctor sees verified laboratory and radiology reports
- [ ] Unrelated doctor is denied unless an active department share exists
- [ ] Active ward staff see ward-relevant verified documents
- [ ] Ward access stops when the clinical relationship/share no longer applies

## Sharing

- [ ] Only verified documents can be shared
- [ ] Receiving department is in the same hospital
- [ ] VIEW access works
- [ ] DOWNLOAD access works
- [ ] PRINT access works
- [ ] Expired access no longer works
- [ ] Revoked access no longer works
- [ ] Share and revoke actions appear in audit history

## Administrative roles

- [ ] Records Officer sees registration/ID/consent documents only
- [ ] Receptionist sees permitted administrative documents only
- [ ] Hospital Admin can manage sharing metadata but cannot automatically open clinical content
- [ ] Super Admin does not automatically receive unrestricted clinical-content access

## Patient portal

- [ ] Patient sees only their own documents
- [ ] Patient sees only VERIFIED + RELEASED_TO_PATIENT documents
- [ ] Unreleased report returns 403 or scoped 404
- [ ] Another patient’s document cannot be accessed
- [ ] Revoke-release removes future patient access

## Audit

- [ ] Preview creates `DOCUMENT_VIEWED`
- [ ] Download creates `DOCUMENT_DOWNLOADED`
- [ ] Print creates `DOCUMENT_PRINTED`
- [ ] Verify/reject creates the corresponding audit event
- [ ] Share/revoke creates the corresponding audit event
- [ ] Unauthorized content access is recorded as denied when document context is available
