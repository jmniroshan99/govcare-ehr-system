# Ward/Bed V11 startup fix

This release repairs the two errors reported during local validation:

1. TypeScript TS7016 for `file-saver`
   - Added `src/types/file-saver.d.ts`, so no additional package is required.
2. PostgreSQL/Flyway SQLSTATE 23514 on `chk_beds_status`
   - V11 now normalizes legacy bed statuses before adding the check constraint.
   - Legacy `assigned` beds become `OCCUPIED`.
   - Other supported legacy synonyms are mapped safely.
   - Unknown values are derived from current patient/admission links, otherwise `AVAILABLE`.

The earlier failed V11 execution was rolled back by PostgreSQL, so the corrected V11 can run from schema version 10 without deleting data.
