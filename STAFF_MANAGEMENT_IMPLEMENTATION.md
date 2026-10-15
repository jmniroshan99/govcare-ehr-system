# GovCare EHR Staff Management and Role Assignment

This version adds a centralized staff-management module for Super Admin and Hospital Admin accounts.

## Frontend route

- `/admin/staff`

The page provides:

- Staff summary cards
- Name, email and employee-number search
- Hospital, department, role and status filters
- Paginated staff table
- Three-step staff account creation
- Automatic secure-password generation
- One-time login-details summary
- Role and department changes
- Personal/employment detail updates
- Account activation and deactivation
- Password reset with forced password change
- Super Admin hospital transfer
- Staff audit history

## Spring Boot endpoints

- `GET /api/admin/staff`
- `POST /api/admin/staff`
- `GET /api/admin/staff/{id}`
- `PUT /api/admin/staff/{id}`
- `PATCH /api/admin/staff/{id}/role`
- `PATCH /api/admin/staff/{id}/department`
- `PATCH /api/admin/staff/{id}/status`
- `PATCH /api/admin/staff/{id}/transfer`
- `POST /api/admin/staff/{id}/reset-password`
- `GET /api/admin/staff/{id}/audit`
- `GET /api/admin/staff/options`
- `GET /api/admin/hospitals/{hospitalId}/departments`
- `POST /api/auth/change-password`

All staff endpoints require `USER_MANAGE`. Hospital Admin requests are restricted to the authenticated hospital. The backend reads the current user and hospital from the JWT principal rather than trusting frontend identity fields.

## Database migration

`V7__staff_management.sql` adds staff employment fields, the employee-number sequence, constraints, indexes, common departments, and the Hospital Admin default route.

Employee numbers use this format:

`STAFF-YYYY-000001`

## First-login password flow

New staff can be marked with `must_change_password=true`. After login, the frontend redirects them to `/change-temporary-password`. Spring Boot validates the current temporary password, hashes the new password with BCrypt and clears the first-login requirement.

## Validation commands

```cmd
npm install
npm run build
npm run spring:build
npm run dev:full
```
