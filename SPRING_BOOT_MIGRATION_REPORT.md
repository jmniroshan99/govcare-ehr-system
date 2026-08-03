# Spring Boot Backend Migration Report

## Migration objective

Replace the active Express/TypeScript API with a Spring Boot backend using Spring Security, JWT, JPA/Hibernate, PostgreSQL and centralized role permissions.

## Implemented backend areas

- Authentication and JWT generation/validation
- PostgreSQL-backed roles and permissions
- Hospital and department scoping
- Patient registration, search, duplicate detection, update and archive
- User and department administration
- Appointments and check-in
- OPD tokens and doctor queue
- Consultations
- Prescriptions and multiple prescription items
- Pharmacy verification and dispensing
- Laboratory ordering, result entry, verification and review
- Radiology ordering, reporting, verification and review
- Media upload/download
- PDF reports
- Login activity and audit logs
- Self-registration workflow
- Doctor command center
- Health endpoint

## Central security design

Spring Security method annotations enforce permissions on controllers. User-supplied role, hospital and user identifiers are not trusted for authorization. The authenticated principal is built from the JWT and refreshed from PostgreSQL.

Frontend route/menu filtering is centralized in:

```text
src/lib/roleAccess.ts
src/lib/accessControl.ts
src/routes/AppRouter.tsx
src/components/layout/AppShell.tsx
```

Backend permission storage is created by:

```text
spring-api/src/main/resources/db/migration/V4__role_based_access_control.sql
```

## Default landing routes

| Role | Default route |
|---|---|
| Super Admin | `/super-admin` |
| Hospital Admin | `/admin/users` |
| Records Officer | `/patients/register` |
| Receptionist | `/opd` |
| Doctor | `/doctor` |
| Nurse | `/nurse-notes` |
| Pharmacist | `/pharmacy` |
| Laboratory Technician | `/laboratory` |
| Pathologist | `/laboratory` |
| Radiology Technician | `/radiology` |
| Radiologist | `/radiology` |
| Patient / Guardian | `/portal` |

## Legacy Express backend

The active npm scripts now launch Spring Boot. The final distribution omits the old `server/` Express implementation to avoid accidentally running two APIs on port 4001.
