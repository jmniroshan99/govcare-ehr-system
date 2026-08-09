# PatientWorkbench TypeScript build fix

## Error fixed

`TS2345: Argument of type 'string | null | undefined' is not assignable to parameter of type 'string | number | boolean'`

The JSX condition checked `selected.ward_id`, but TypeScript did not preserve that narrowing inside the button click callback.

## Repair

The callback now copies `selected.ward_id` into a local variable and validates it before calling `encodeURIComponent` and navigating to the ward bed board.

The Spring Boot build and Flyway V13 migration reported by the user were already successful and required no change.
