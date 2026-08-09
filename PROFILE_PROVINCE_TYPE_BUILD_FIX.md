# Profile Province TypeScript Build Fix

## Resolved error

`src/pages/Profile.tsx` previously copied `event.target.value` directly into state. Native select values are typed as generic `string`, while the profile state restricts `province` to the Sri Lankan province union plus an empty value.

## Fix

Both `Profile.tsx` and `PatientProfile.tsx` now pass the selected value through `normaliseSriLankaProvince(...)` before updating state. The helper returns `SriLankaProvince | ""`, matching the state type and preserving district/province consistency.

## Affected files

- `src/pages/Profile.tsx`
- `src/pages/PatientProfile.tsx`

No database migration is required.
