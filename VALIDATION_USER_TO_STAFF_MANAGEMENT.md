# Validation – Staff Management replaces User Management

## Completed source checks

- The only visible administrative account menu is **Staff Management** at `/admin/staff`.
- Legacy routes `/admin/users`, `/users`, and `/user-management` redirect to `/admin/staff` and preserve query parameters.
- The former `UserManagement` component is a compatibility alias of `StaffManagement`; it no longer contains a second management implementation.
- Global staff search results link to `/admin/staff?selected={staffId}`.
- Staff Management can open the selected account from the compatibility query parameter.
- Hospital Admin's database default route is updated to `/admin/staff` by Flyway migration V10.
- Super Admin dashboard terminology and shortcut now use Staff Management.
- English, Sinhala, and Tamil legacy labels resolve to Staff Management.
- `app_users`, JWT authentication, roles, permissions, and profile APIs are retained.

## Automated validation performed

- Modified TypeScript and TSX files: syntax transpilation passed.
- Locale JSON files: parsing passed.
- Flyway V10 migration: structure check passed.
- Archive integrity: checked after packaging.

## Build note

A complete `npm run build` could not run in the packaging environment because the configured package gateway returned HTTP 404 for `zod-4.4.3.tgz`. Maven is not installed in the packaging environment. Run the following commands locally:

```cmd
npm install
npm run build
npm run spring:build
```
