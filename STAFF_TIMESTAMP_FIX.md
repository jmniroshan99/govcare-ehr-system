# Staff creation timestamp fix

Fixed PostgreSQL error `SQLSTATE 23502` caused by Hibernate inserting null values into
`app_users.created_at` and `app_users.updated_at`.

Changed files:
- `spring-api/src/main/java/lk/gov/health/govcare/security/AppUserEntity.java`
- `spring-api/src/main/java/lk/gov/health/govcare/staff/StaffManagementService.java`
- `spring-api/src/main/resources/db/migration/V8__repair_app_user_timestamps.sql`

After extracting:

```cmd
npm run spring:build
npm run dev:full
```

Flyway should apply migration V8 during startup.
