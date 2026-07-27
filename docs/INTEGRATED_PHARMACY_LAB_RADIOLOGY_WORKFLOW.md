# Integrated Pharmacy, Laboratory, and Radiology Workflow

## Pharmacy Workflow

1. Doctor signs the e-prescription through the authenticated PostgreSQL REST API.
2. Function writes `prescriptions` and `pharmacyQueue` with patient, doctor, diagnosis, medicine list, allergy flags, priority, and hospitalId.
3. Pharmacist verifies patient identity using patient ID, NIC, QR code, OPD token, or admission number.
4. System checks allergies, duplicate medicines, stock availability, expiry, dosage warnings, and approved substitutions.
5. Pharmacist issues available medicines, marks unavailable items, or partially issues.
6. A PostgreSQL transaction deducts `pharmacy_stock`, records the issue and receipt, updates prescription status, writes audit logs, and creates patient/doctor notifications.

## Laboratory Workflow

1. Doctor creates `labRequests` from consultation, admission, OPD, or emergency workflow.
2. Lab queue tracks requested, sample-collected, received, processing, entered, pending-approval, approved, critical, released, and rejected states.
3. Technician records sample status, rejection reason, result values, attachments, reference ranges, and abnormal flags.
4. Pathologist or authorized lab manager approves results.
5. Critical values trigger immediate notifications to doctor, nurse, and emergency team where relevant.
6. Released reports become visible in the patient portal only when `releaseStatus` is `released` or `approved`.

## Radiology Workflow

1. Doctor creates `radiologyRequests` with modality, priority, clinical reason, patient context, and requesting doctor.
2. Radiology queue tracks requested, scheduled, patient-arrived, scan-started, scan-completed, reporting, approval-pending, approved, critical, released, and cancelled states.
3. Technician records scan status, equipment room, portable request, radiation exposure, attachments, and technician notes.
4. Radiologist enters findings, impression, normal/abnormal/critical status, digital signature, and optional DICOM or image links.
5. Critical imaging findings notify the doctor instantly.
6. Approved reports are attached to the patient timeline and released to the patient portal only after clinical approval.

## Shared Implementation Model

- Use TanStack Query for lists and details, with cache invalidation after PostgreSQL REST API mutations.
- Use real-time listeners only for active queues, urgent/critical statuses, and result-ready notifications.
- Use `hospitalId`, `patientId`, `status`, `releaseStatus`, `createdAt`, `updatedAt`, `createdBy`, and `updatedBy` on every document.
- Use backend API jobs for receipt generation, report approval, stock deduction, critical alert dispatch, and audit logging.
- Never expose unreleased lab/radiology findings, internal notes, medicine stock, or staff-only comments to patients.

