# Searchable Dropdown Visibility Fix

Date: 2026-10-04

## Reported behavior

On the lower part of the Doctor Workspace, the Laboratory specimen and Radiology body-area menus opened below their fields. When the field was close to the bottom of the browser viewport, most options existed below the visible screen and appeared to be missing.

## Root cause

Both shared searchable selector components used a fixed downward menu position. They did not measure the available space above and below the active field. This was a presentation/collision defect; it was not missing PostgreSQL reference data.

## Corrected behavior

- The selector measures available viewport space whenever it opens.
- It opens upward when the space below is insufficient and the space above is larger.
- It remains downward when sufficient space is available.
- Its results area receives a calculated maximum height and remains internally scrollable.
- Placement is recalculated when the page scrolls or the browser resizes.
- The open selector receives a raised stacking level so its menu remains visible over nearby form surfaces.
- Keyboard navigation, search, selection, clearing, ARIA relationships, theme tokens, and existing API calls are preserved.

## Covered controls

The correction applies to both selector families:

- Local/reference options: specimen, body area, route, frequency, province/district and similar lists.
- API-backed options: Laboratory test, Imaging study, medicine/patient/staff searches and other server-side entity selectors.

## Running the corrected version

1. Stop the currently running frontend with `Ctrl+C`.
2. Extract the latest full-source ZIP into a new folder. Do not launch the older extracted folder.
3. Run `npm install` once in the new folder.
4. Start the project using its existing full-stack launcher.
5. In Chrome, press `Ctrl+F5` once to discard the older JavaScript bundle.

## Verification

```bash
npm run test:searchable-select
npm run build
npm run test:doctor-workspace
npm run test:roles
npm run test:theme
npm run test:dashboard
```

All checks passed. No Spring Boot endpoint, PostgreSQL schema, prescription payload, RBAC rule, or hospital/patient isolation rule was changed.
