# Sri Lanka Province and District Dropdown Fix

## Implemented

- Replaced free-text province and district fields with controlled dropdowns.
- Added all 9 Sri Lankan provinces and all 25 districts.
- District options are filtered automatically by the selected province.
- Selecting a district can automatically select its correct province.
- Invalid province/district combinations are blocked in React validation and Spring Boot APIs.
- Existing values such as `Western` are normalized to `Western Province` when editing legacy records.
- Applied the shared controls to:
  - Staff patient registration
  - Patient self-registration
  - Patient profile editing
  - Patient account profile editing
- Removed low-contrast Optional/Recommended pills from field labels. Only required fields show `*`.
- Added explicit dark-mode styling for inputs, selects and native dropdown options.

## Sri Lankan administrative lists

- 9 provinces
- 25 districts

## Database

No migration is required. Existing patient data is preserved.
