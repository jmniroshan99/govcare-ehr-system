# Pharmacy runtime data-format repair

## Error fixed

`selected.allergies?.join is not a function`

## Root cause

PostgreSQL `json/jsonb` values can be returned by JDBC as `PGobject`. The API previously passed that driver object directly to Jackson. The frontend type declared `allergies` as `string[]`, but runtime data could therefore be a JSON string or an object such as `{ type, value }`. Optional chaining only checks for `null`/`undefined`; it does not verify that `.join` is a function.

## Repairs

- `SqlSupport` now converts every PostgreSQL `json/jsonb` `PGobject` into normal Java maps/lists before API serialization.
- Prescription API responses are normalized at the frontend boundary.
- Pharmacy allergies and prescription lines are rendered from normalized arrays.
- Legacy string, PostgreSQL-array text, JSON-string, and PGobject-shaped browser data are supported.
- The recovery screen no longer incorrectly states that every render failure is caused by an old module cache.

No database recreation or destructive migration is required.
