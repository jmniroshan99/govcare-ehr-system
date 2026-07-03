# GovCare EHR Firebase Setup Guide

This guide configures Firebase for the GovCare EHR System on Windows for a Sri Lankan government hospital deployment.

## 1. Required Tools

Use Node.js 22 LTS or Node.js 24.

```powershell
node -v
npm -v
npm install -g firebase-tools
firebase login
```

If Node.js 25 or newer is installed, switch to Node 22 or 24 before deploying Cloud Functions.

## 2. Project Files

The Firebase setup uses:

- `firebase.json`
- `.firebaserc`
- `firebase/firestore.rules`
- `firebase/firestore.indexes.json`
- `firebase/storage.rules`
- `firebase/functions/src/index.ts`
- `firebase/functions/index.js`
- `.env.example`
- `src/lib/firebase.ts`
- `src/lib/firebase.js`

The active frontend is TypeScript and imports `src/lib/firebase.ts`. The JavaScript file is included as a reference setup.

## 3. Environment Variables

Create `.env` from `.env.example`.

```powershell
copy .env.example .env
```

Required frontend values:

```text
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=
VITE_FIREBASE_APPCHECK_SITE_KEY=
VITE_FIREBASE_FUNCTIONS_REGION=us-central1
VITE_USE_FIREBASE_EMULATORS=true
VITE_FIELD_ENCRYPTION_PASSPHRASE=
```

Function secrets must not be exposed to the frontend. Configure them through Firebase secrets or your deployment secret manager:

```powershell
firebase functions:secrets:set OTP_PEPPER
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASS
firebase functions:secrets:set SMTP_FROM
```

## 4. Firebase Console Setup

In Firebase Console:

1. Select project `healthapp-462e7`.
2. Authentication:
   - Enable Email/Password.
   - Enable password reset emails.
   - Optional: enable Google provider.
   - Add authorized domains: `localhost`, `127.0.0.1`, and production hosting domain.
3. Firestore:
   - Create Firestore Database.
   - Deploy `firebase/firestore.rules`.
   - Deploy `firebase/firestore.indexes.json`.
4. App Check:
   - Register the web app.
   - Add reCAPTCHA v3 or reCAPTCHA Enterprise site key to `.env`.
5. Cloud Messaging:
   - Generate Web Push certificate.
   - Add it as `VITE_FIREBASE_VAPID_KEY`.
6. Storage:
   - Optional for production uploads. Firebase Storage may require Blaze plan.

## 5. Emulator Suite

Configured emulator ports:

- Auth: `127.0.0.1:9099`
- Firestore: `127.0.0.1:8081`
- Functions: `127.0.0.1:5001`
- Hosting: `127.0.0.1:5000`
- Storage: `127.0.0.1:9199`
- Emulator UI: `127.0.0.1:4000`

Start emulators:

```powershell
npm run firebase:emulators
```

Open Emulator UI:

```powershell
start http://127.0.0.1:4000
```

Run Vite locally:

```powershell
npm run dev -- --host 127.0.0.1 --port 5174
```

## 6. Deployment Commands

Initialize local Firebase setup:

```powershell
npm run firebase:init
```

Deploy rules and indexes:

```powershell
npm run firebase:deploy:rules
```

Deploy Cloud Functions:

```powershell
npm run firebase:deploy:functions
```

Deploy Hosting:

```powershell
npm run firebase:deploy:hosting
```

Deploy everything:

```powershell
npm run firebase:deploy:all
```

## 7. EHR Collections

Recommended Firestore collections:

- `hospitals`
- `departments`
- `users`
- `patients`
- `appointments`
- `consultations`
- `prescriptions`
- `pharmacyQueue`
- `medicineStock`
- `medicineIssues`
- `pharmacyReceipts`
- `labRequests`
- `labResults`
- `radiologyRequests`
- `radiologyReports`
- `admissions`
- `admissionRequests`
- `wards`
- `beds`
- `notifications`
- `emailOtps`
- `auditLogs`

Every document should include:

```text
hospitalId
status
createdAt
updatedAt
createdBy
updatedBy
```

## 8. Security Model

The rules enforce:

- Hospital-level data isolation using `hospitalId`.
- Role-based access using Firebase custom claims.
- Patient records protected by role and patient ownership.
- Admin-only user and department management.
- Doctor consultation and prescription access.
- Nurse ward and care-task access.
- Pharmacist prescription/stock/receipt access.
- Lab and radiology role boundaries.
- Immutable audit logs.
- Blocked direct client access to `emailOtps`.
- Sensitive writes through Cloud Functions.

## 9. Cloud Functions

Implemented function categories include:

- Create staff/users and assign custom claims.
- Generate patient IDs.
- Create audit logs.
- Send and verify email OTPs.
- Mark doctor consultation patients as checked.
- Process prescriptions and deduct stock.
- Generate pharmacy receipts.
- Send notifications.
- Generate report metadata.

## 10. Production Notes

- Do not expose Admin SDK credentials in frontend files.
- Keep `VITE_USE_FIREBASE_EMULATORS=false` for production builds.
- Use App Check enforcement after testing all clients.
- Use Cloud Functions for sensitive writes.
- Store SMTP and OTP secrets in Firebase secrets.
- Enable MFA and Google login only after Firebase Console providers are configured.
- Review indexes after adding high-volume queries.
