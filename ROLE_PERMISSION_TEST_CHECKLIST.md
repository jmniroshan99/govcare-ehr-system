# GovCare EHR Role-Permission Test Checklist

Use separate test accounts for each role. Verify both the visible UI and direct API access using Thunder Client or Postman.

## General authentication

- [ ] Unauthenticated protected API request returns `401`.
- [ ] Valid JWT permits only its assigned role/permissions.
- [ ] Expired or malformed JWT returns `401`.
- [ ] Disabled account cannot log in.
- [ ] Cross-hospital record identifiers return `404` to non-super-admin users.
- [ ] Unauthorized valid user receives `403`.
- [ ] Denied access is recorded in `audit_logs`.

## Records Officer

- [ ] Login redirects to `/patients/register`.
- [ ] Sidebar shows Patient Registration, Search and Profiles only.
- [ ] Can create a patient.
- [ ] Can perform duplicate detection.
- [ ] Can update demographic fields and photo.
- [ ] Can print QR/barcode actions.
- [ ] Clinical history is not included unless specifically permitted.
- [ ] `POST /api/prescriptions` returns `403`.
- [ ] Laboratory, radiology, pharmacy and user-management routes are denied.

## Receptionist

- [ ] Login redirects to `/opd`.
- [ ] Can register/search patients.
- [ ] Can create appointments and OPD tokens.
- [ ] Can manage the live queue.
- [ ] Cannot create consultations or prescriptions.
- [ ] Cannot enter laboratory/radiology results.

## Doctor

- [ ] Login redirects to `/doctor`.
- [ ] Can see assigned/waiting patients.
- [ ] Can start and complete consultations.
- [ ] Can create/sign/send prescriptions.
- [ ] Can create laboratory and radiology requests.
- [ ] Cannot verify pharmacy dispensing.
- [ ] Cannot manage users.

## Nurse

- [ ] Login redirects to `/nurse-notes`.
- [ ] Can view permitted assigned patient/clinical information.
- [ ] Cannot create final prescriptions.
- [ ] Cannot verify laboratory or radiology reports.
- [ ] Cannot manage users.

## Laboratory Technician

- [ ] Login redirects to `/laboratory`.
- [ ] Sidebar contains laboratory-related functions only.
- [ ] Can view hospital/department laboratory requests.
- [ ] Can update sample status.
- [ ] Can enter and save results.
- [ ] Cannot verify results unless granted `LAB_RESULT_VERIFY`.
- [ ] Cannot edit consultations or prescriptions.
- [ ] Cannot access unrelated patient clinical information.

## Pathologist / Laboratory Manager

- [ ] Can perform all permitted laboratory technician actions.
- [ ] Can verify/release laboratory results.
- [ ] Can request correction or review as supported.
- [ ] Cannot access pharmacy or user administration without explicit permission.

## Radiology Technician

- [ ] Login redirects to `/radiology`.
- [ ] Can view assigned radiology requests.
- [ ] Can update scheduling/investigation status.
- [ ] Cannot verify final radiology reports.

## Radiologist

- [ ] Can create findings/impression.
- [ ] Can verify/release radiology reports.
- [ ] Cannot access unrelated modules.

## Pharmacist

- [ ] Login redirects to `/pharmacy`.
- [ ] Can view pharmacy prescriptions.
- [ ] Can verify or reject signed prescriptions.
- [ ] Can dispense available medicines.
- [ ] Cannot edit diagnoses or consultations.
- [ ] Cannot enter laboratory/radiology results.

## Patient / Guardian

- [ ] Login redirects to `/portal`.
- [ ] Can view only the linked patient profile.
- [ ] Can view only linked appointments and non-draft prescriptions.
- [ ] Can view only released/reviewed laboratory and radiology reports.
- [ ] Cannot enumerate other hospital patients.
- [ ] Another patient UUID, patient number or report ID returns `404` or `403`.

## Super Admin and Hospital Admin

- [ ] Super Admin can access all permitted hospitals and modules.
- [ ] Hospital Admin is limited to their hospital.
- [ ] Hospital Admin cannot create another Super Admin.
- [ ] Role/permission changes are audited.

## Build and migration

- [ ] `npm run build` succeeds.
- [ ] `npm run spring:build` succeeds.
- [ ] `npm run dev:full` starts frontend and Spring API.
- [ ] Flyway migration completes without error.
- [ ] `/actuator/health` reports a healthy application/database.
