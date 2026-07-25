# GovCare EHR System Efficiency Upgrades

This document describes the practical efficiency improvements applied to GovCare EHR and the rules to follow for future modules.

## Implemented Frontend Improvements

### 1. Deferred startup work

The app now defers service worker registration and offline synchronization until after the first paint.

File:

`src/main.tsx`

Helper:

`src/utils/schedule.ts`

Benefit:

- Faster first screen render.
- Less work during initial login/dashboard loading.
- Offline sync still runs automatically after the UI becomes responsive.

### 2. Route preloading on navigation intent

Sidebar links now preload page chunks when the user hovers, focuses, or touches a menu item.

Files:

- `src/routes/routePreload.ts`
- `src/components/layout/AppShell.tsx`

Benefit:

- Pages open faster after the first hover/touch.
- Keeps route lazy loading but removes some waiting time before navigation.
- Works well for large EHR modules such as Doctor Center, Laboratory, Radiology, Reports, and Admissions.

## Recommended Backend Efficiency

### PostgreSQL

Use indexed queries for all large tables:

- `hospital_id`
- `patient_id`
- `status`
- `created_at`
- `visit_id`
- `doctor_id`
- `department_id`
- `release_status`

Avoid loading full tables into React. Use server-side filters, pagination, and search endpoints.

### Spring Boot API

Recommended API behavior:

- Validate role and hospital scope before every query.
- Return paginated results.
- Use transactions for prescription dispensing, stock deduction, admissions, bed assignment, and report approval.
- Stream file downloads instead of loading large files into memory.
- Store file metadata in PostgreSQL and binary files in controlled storage.

## UI Efficiency Rules

1. Use dashboards as action centers, not information dumps.
2. Put the most common action in the first screen.
3. Use search, filters, and badges for large lists.
4. Use skeleton loading states for slower modules.
5. Use confirmation dialogs only for risky clinical/admin actions.
6. Keep patient identity visible in every clinical workflow.
7. Use real-time updates only for:
   - active OPD queue
   - emergency alerts
   - bed availability
   - secure chat
   - critical notifications

## Module-Level Efficiency Ideas

### OPD

- QR/NIC search.
- One-click visit creation.
- Auto token generation.
- Doctor assignment presets.
- Queue status badges.

### Doctor Center

- Patient snapshot at top.
- Auto-save consultation draft.
- Quick templates for SOAP notes.
- One-click prescription/lab/radiology/admission.

### Nurse Module

- Task board for shift duties.
- Barcode Medication Administration.
- Vitals trend alerting.
- Bedside QR verification.

### Pharmacy

- Queue by urgency.
- Stock availability visible before issuing.
- Transaction-safe stock deduction.
- Fast PDF receipt generation.

### Laboratory/Radiology

- Request queues by priority.
- Result templates.
- Critical alert badges.
- Release workflow for patient portal.

### Reports

- Server-side filtering.
- Background report generation for heavy reports.
- Export only filtered results.
- Audit every export.

## Verification

After efficiency changes, run:

```powershell
npm run build
```

The production build should pass before deployment.

