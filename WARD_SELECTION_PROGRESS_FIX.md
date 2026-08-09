# Ward Selection Progress Fix

## Problem

The inpatient admission wizard could stop at Step 4 when a department and ward-type combination returned no wards. The screen displayed only the filters, with no explanation or recovery action. In addition, the referring department was incorrectly treated as if it had to be the same as the destination ward department.

## Fix

- Department options now show how many configured wards belong to each department.
- Departments with no wards are disabled in the ward filter.
- Ward-type choices are limited to types available in the selected ward department.
- An incompatible ward-type filter is cleared automatically when the department changes.
- A visible `Show all wards` recovery action appears when filters return zero results.
- The page shows the number of matching wards and clear instructions to select a ward card.
- Referring-department mismatch is now an advisory instead of a hard UI blocker.
- The Spring backend no longer rejects a destination ward merely because it differs from the referring department.
- Ward/bed hospital ownership, operational status, availability, gender, age, and isolation safety checks remain enforced.

## Expected Flow

1. Complete admission details.
2. Open Select Ward.
3. Select an enabled ward department or leave the filter as All ward departments.
4. Select an available ward type or leave the filter as All ward types.
5. Select an enabled ward card.
6. The application loads available beds and opens Step 5.
