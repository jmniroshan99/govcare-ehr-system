# GovCare EHR System

Production-minded React, TypeScript, Tailwind CSS, ShadCN-style UI, Firebase EHR starter for government hospitals.

## What is included

- Vite React app with TypeScript, React Router, TanStack Query, Zustand, React Hook Form, Zod, Framer Motion, Recharts, i18next, QR patient cards, and accessible UI primitives.
- Role-based shell for Super Admin, Hospital Admin, Doctor, Nurse, Pharmacist, Lab Technician, Radiologist, Receptionist, and Records Officer.
- Pages for login, dashboard, patient registration/profile, OPD, consultation, nurse notes, wards, pharmacy, lab, radiology, emergency, appointments, reports, users, settings, and audit logs.
- Firebase client configuration, App Check support, Firestore and Storage rules, indexes, Hosting headers, PWA service worker, seed data, and Cloud Functions.
- Security utilities for input sanitization and AES-256-GCM sensitive-field encryption.

## Setup

```bash
cd "C:\wamp64\www\wholesale vegetable\govcare-ehr-system"
npm install
copy .env.example .env
npm run dev
```

Fill `.env` with your Firebase web app keys. These are client identifiers, not Admin SDK credentials.

## Firebase setup

For the full Windows setup, emulator, App Check, indexes, deployment, and security guide, see:

`docs/FIREBASE_SETUP_WINDOWS.md`

1. Create a Firebase project.
2. Enable Authentication with email/password. Google login is wired but optional.
3. Enable Firestore, Storage, Cloud Functions, Hosting, Cloud Messaging, and App Check.
4. Install Firebase CLI and log in:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
npm run functions:install
```

5. Deploy rules and indexes:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

6. Deploy the full app:

```bash
npm run firebase:deploy
```

## Data model

Recommended top-level Firestore collections:

`hospitals`, `departments`, `users`, `patients`, `appointments`, `consultations`, `prescriptions`, `medicines`, `labRequests`, `labResults`, `radiologyRequests`, `radiologyReports`, `admissions`, `wards`, `beds`, `emergencyCases`, `notifications`, `secureChats`, `auditLogs`.

For the complete production Firestore collection structure, required fields, release rules, and indexes, see:

`docs/FIRESTORE_DATABASE_DESIGN.md`

Supporting/internal workflow collections used by the current app:

`visits`, `opdQueues`, `consultationDrafts`, `doctorApprovals`, `telemedicineSessions`, `reports`, `vaccinationRecords`, `billingRecords`, `patientDocuments`, `operationTheatreCases`, `surgeryReports`, `futureCarePlans`, `mortuaryCases`, `mortuaryCertificates`.

Every operational document should include:

`createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `hospitalId`, `status`.

## Security strategy

- Firebase Auth owns passwords and identity.
- Staff roles and hospital isolation are enforced with Firebase custom claims.
- Client routes deny access by default. Every protected route must declare allowed roles, and patients are redirected to the patient portal if they try to open staff pages.
- Default patient access includes only `My Health`, `Care Summary`, `My Reports`, and `My Profile`.
- Default staff access is split by role: admins manage settings/users, doctors handle consultations and clinical records, nurses handle ward/vitals notes, pharmacists handle pharmacy, diagnostics staff handle lab/radiology, reception handles registration/appointments, and records officers handle patient records/reports/audit views.
- Doctor module access is limited to `doctor`, `hospital_admin`, and `super_admin`. Consultation drafts and electronic approvals are written only through Cloud Functions, with audit entries for every save/approval.
- Sensitive writes like user creation, claims, patient ID generation, stock updates, report creation, and notifications go through Cloud Functions.
- Firestore rules restrict users to their hospital and role-specific collections.
- Audit logs are append-only from trusted backend paths and cannot be edited by normal users.
- Highly sensitive clinical fields can be encrypted in the browser with AES-256-GCM before storage. For production, protect key material with a hospital key-management workflow rather than storing passphrases in frontend code.
- App Check is initialized when `VITE_FIREBASE_APPCHECK_SITE_KEY` is present.
- Inputs are validated with Zod and sanitized before persistence.

## Performance and caching strategy

- TanStack Query centralizes client cache policy.
- Routes are code split with `lazy`/`Suspense`.
- Firestore service helpers use pagination and indexed query patterns.
- Real-time listeners should be limited to queues, emergency alerts, and bed availability.
- Debounced search should be used for patient and medicine lookup before production traffic.
- Firebase Hosting serves static assets with immutable cache headers.
- PWA service worker provides offline shell caching for read-only access.

## Seed data

Sample hospital, department, patient, and medicine records are in:

`firebase/seed/sample-data.json`

Import them with your preferred admin script or Firestore import workflow after creating the Firebase project.

## Local hard-drive backup

Create a timestamped backup on this PC hard drive:

```powershell
npm run backup:local
```

Default backup location:

`C:\wamp64\www\wholesale vegetable\backups\govcare-ehr-system`

Create a compressed ZIP backup:

```powershell
npm run backup:local:zip
```

The backup excludes generated/heavy folders such as `node_modules`, `dist`, `.git`, `.firebase`, and log files. The local `.env` file is included by default for full project restore. To exclude `.env` from a manual backup, run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/local-backup.ps1 -ExcludeEnv
```

Restore method:

1. Copy the latest backup folder back to a working location.
2. Run `npm install`.
3. Run `npm run dev -- --host 127.0.0.1`.

## Production checklist

- Replace demo fallback login with mandatory Firebase Auth profiles.
- Enforce MFA enrollment for privileged roles.
- Configure App Check enforcement in Firebase console.
- Add Cloud Function tests for all sensitive operations.
- Review Firestore rules with the emulator before launch.
- Add clinical terminology/code tables required by your Ministry of Health workflow.
- Configure SMS/email providers in `sendNotification` or dedicated notification functions.
