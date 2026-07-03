# GovCare Prescription-to-Pharmacy Pipeline

## Purpose

This workflow connects Doctor Workspace, E-Prescription, Pharmacy Queue, Notifications, and Audit Logs so a signed prescription moves to pharmacy without manual handover.

## Frontend Flow

1. Doctor creates or signs a structured prescription from Doctor Workspace or E-Prescription.
2. `createPrescriptionFromConsultation` builds a prescription with patient, diagnosis, doctor, medicine, dosage, frequency, duration, priority, and safety metadata.
3. `pushPrescriptionToPharmacyQueue` places the item in the shared pharmacy queue and emits `govcare:pharmacy-queue-updated`.
4. Pharmacy dashboard refreshes automatically and shows queued prescriptions above seed/demo records.
5. Pharmacist verifies patient identity, checks safety warnings, stock, expiry, allergy risk, and duplicate medicines.
6. `completePharmacyTransaction` issues medicines, marks the prescription released, creates receipt metadata, and prepares notifications.

## Cloud Function Contract

- `createPrescriptionFromConsultation`
- `pushPrescriptionToPharmacyQueue`
- `verifyPrescriptionSafety`
- `issueMedicineAndUpdateStock`
- `completePharmacyTransaction`

All production writes should be performed through Cloud Functions. Direct client writes to `prescriptions`, `pharmacyQueue`, `medicineStock`, `medicineIssues`, and `pharmacyReceipts` remain blocked by Firestore rules except where explicitly allowed for read access.

## Firestore Collections

- `prescriptions`: signed prescription record, internal until released.
- `pharmacyQueue`: active queue for pharmacist verification and dispensing.
- `medicineStock`: stock and expiry state.
- `medicineIssues`: per-medicine issue records.
- `pharmacyReceipts`: patient-visible receipt after completion.
- `notifications`: doctor, pharmacist, and patient alerts.
- `auditLogs`: immutable action history.

## Patient Visibility

Patients should only see prescriptions and receipts where `releaseStatus` is `released` or `approved`. Internal warnings, pharmacist notes, stock details, and audit records remain staff-only.

## Development Behavior

The frontend service stores queue items in `localStorage` when Cloud Functions are unavailable. This keeps the UI testable during local development while preserving the production Cloud Function names and data shape.
