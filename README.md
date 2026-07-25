# GovCare EHR System

Production-minded React, TypeScript, Spring Boot, PostgreSQL, and Keycloak EHR starter for Sri Lankan government and private hospitals.

## What is included

- Vite React app with TypeScript, React Router, TanStack Query, Zustand, React Hook Form, Zod, Framer Motion, Recharts, i18next, QR patient cards, and accessible UI primitives.
- Role-based shell for Super Admin, Hospital Admin, Doctor, Nurse, Pharmacist, Lab Technician, Radiologist, Receptionist, and Records Officer.
- Pages for login, dashboard, patient registration/profile, OPD, consultation, nurse notes, wards, pharmacy, lab, radiology, emergency, appointments, reports, users, settings, and audit logs.
- PostgreSQL schema, Sri Lanka seed data, Spring Boot media/document service, API-ready frontend services, and PWA service worker.
- Security utilities for input sanitization and AES-256-GCM sensitive-field encryption.

## Setup

```bash
cd "C:\wamp64\www\wholesale vegetable\govcare-ehr-system"
npm install
copy .env.example .env
npm run dev
```

Fill `.env` with API, media, and Keycloak settings. Do not commit real credentials.

## PostgreSQL database

GovCare EHR uses PostgreSQL for relational hospital data.

Added files:

- `database/postgresql/schema.sql` - production-minded PostgreSQL schema.
- `database/postgresql/seed-production-sri-lanka.sql` - Sri Lanka government/private hospital demo seed with at least 10 connected rows for every table.
- `server/` - Node.js + Express + PostgreSQL API scaffold.
- `docs/POSTGRESQL_MIGRATION_PLAN.md` - step-by-step migration guide.

Recommended architecture:

```text
React frontend -> Spring Boot / REST API -> PostgreSQL
```

Run PostgreSQL locally:

```powershell
createdb govcare_ehr
psql "postgres://postgres:postgres@localhost:5432/govcare_ehr" -f database/postgresql/schema.sql
psql "postgres://postgres:postgres@localhost:5432/govcare_ehr" -f database/postgresql/seed-production-sri-lanka.sql
```

The Sri Lanka production-demo seed includes government and private hospitals, Sinhala/Tamil/English settings, hospital-local doctors, nurses, pharmacists, lab staff, radiology staff, receptionists, ICT users, adult and pediatric patients with guardians, OPD visits, consultations, prescriptions, pharmacy receipts, lab/radiology requests and results, wards, beds, admissions, appointments, notifications, audit logs, login activities, media/documents, and system settings.

Run the new API:

```powershell
npm run postgres:install
copy server\.env.example server\.env
npm run postgres:api
```

Then add this to `.env` for the React app:

```env
VITE_API_BASE_URL=http://127.0.0.1:4001
```

The Firebase implementation has been removed. Frontend services are now API-ready for Spring Boot/PostgreSQL and Keycloak.

## Spring Boot media and document service

Documents, images, reports, scans, profile photos, emergency evidence, lab PDFs, radiology files, and pharmacy receipts should be managed by the Spring Boot API with PostgreSQL metadata.

Added files:

- `spring-api/` - Spring Boot + PostgreSQL API.
- `docs/SPRING_BOOT_POSTGRESQL_MEDIA.md` - media/document management guide.
- `src/services/springMediaService.ts` - React service wrapper for Spring media upload/list/download.

Run:

```powershell
cd "C:\wamp64\www\wholesale vegetable\govcare-ehr-system"
npm run spring:api
```

Add this to `.env`:

```env
VITE_MEDIA_API_BASE_URL=http://127.0.0.1:4002
```

## Data model

Recommended PostgreSQL tables:

`hospitals`, `departments`, `app_users`, `guardians`, `patients`, `visits`, `opd_queue`, `consultations`, `prescriptions`, `prescription_items`, `medicines`, `pharmacy_stock`, `pharmacy_receipts`, `lab_requests`, `lab_results`, `radiology_requests`, `radiology_reports`, `wards`, `beds`, `admissions`, `appointments`, `notifications`, `audit_logs`, `login_activities`, `global_media`, `system_settings`.

Every operational document should include:

`createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `hospitalId`, `status`.

## Security strategy

- Keycloak owns passwords, OAuth 2.0, OpenID Connect, MFA, and identity sessions.
- Staff roles and hospital isolation should be enforced with Keycloak roles/claims plus backend authorization checks.
- Client routes deny access by default. Every protected route must declare allowed roles, and patients are redirected to the patient portal if they try to open staff pages.
- Default patient access includes only `My Health`, `Care Summary`, `My Reports`, and `My Profile`.
- Default staff access is split by role: admins manage settings/users, doctors handle consultations and clinical records, nurses handle ward/vitals notes, pharmacists handle pharmacy, diagnostics staff handle lab/radiology, reception handles registration/appointments, and records officers handle patient records/reports/audit views.
- Doctor module access is limited to `doctor`, `hospital_admin`, and `super_admin`. Consultation drafts and electronic approvals should be written through Spring Boot services with audit entries for every save/approval.
- Sensitive writes like user creation, patient ID generation, stock updates, report creation, and notifications go through backend REST services.
- PostgreSQL row filtering and backend authorization restrict users to their hospital and role-specific records.
- Audit logs are append-only from trusted backend paths and cannot be edited by normal users.
- Highly sensitive clinical fields can be encrypted in the browser with AES-256-GCM before storage. For production, protect key material with a hospital key-management workflow rather than storing passphrases in frontend code.
- Inputs are validated with Zod and sanitized before persistence.

## Performance and caching strategy

- TanStack Query centralizes client cache policy.
- Routes are code split with `lazy`/`Suspense`.
- API service helpers should use pagination and indexed PostgreSQL query patterns.
- Real-time listeners should be limited to queues, emergency alerts, and bed availability.
- Debounced search should be used for patient and medicine lookup before production traffic.
- Nginx or your static host should serve built assets with immutable cache headers.
- PWA service worker provides offline shell caching for read-only access.

## Seed data

Sample Sri Lanka hospital data is in:

`database/postgresql/seed-production-sri-lanka.sql`

Import it after loading the PostgreSQL schema.

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

The backup excludes generated/heavy folders such as `node_modules`, `dist`, `.git`, and log files. The local `.env` file is included by default for full project restore. To exclude `.env` from a manual backup, run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/local-backup.ps1 -ExcludeEnv
```

Restore method:

1. Copy the latest backup folder back to a working location.
2. Run `npm install`.
3. Run `npm run dev -- --host 127.0.0.1`.

## Production checklist

- Replace demo fallback login with mandatory Keycloak profiles.
- Enforce MFA enrollment for privileged roles.
- Add Spring Boot integration tests for all sensitive operations.
- Review backend authorization and PostgreSQL row-scope tests before launch.
- Add clinical terminology/code tables required by your Ministry of Health workflow.
- Configure SMS/email providers in `sendNotification` or dedicated notification functions.
