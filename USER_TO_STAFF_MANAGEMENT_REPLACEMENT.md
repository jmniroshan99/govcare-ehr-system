# User Management replaced by Staff Management

Staff Management at `/admin/staff` is now the only administrative UI for hospital staff accounts.

## Compatibility

The legacy frontend routes `/admin/users`, `/users`, and `/user-management` redirect to `/admin/staff` while preserving query parameters. The old `UserManagement` component is only a compatibility export of `StaffManagement`; it no longer contains a separate implementation.

The `app_users` database table, authentication endpoints, JWT claims, roles, permissions, and profile-related `/api/users` endpoints remain unchanged because they are technical authentication infrastructure. Administrative account changes use `/api/admin/staff`.

## Security

The canonical staff route requires `USER_MANAGE` and is available only to Super Admin and Hospital Admin in the frontend. Backend staff endpoints remain protected with `@PreAuthorize("hasAuthority('USER_MANAGE')")`.
