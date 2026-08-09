# V16 Ward / 250 Bed Seed Fix

This build adds `V16__seed_ten_wards_and_beds.sql`.

## What it fixes

The failed migration inserted only `ward_no`, while `wards.ward_code` is `NOT NULL` after V11. The corrected migration writes both `ward_no` and `ward_code`, and both `bed_no` and `bed_code`.

## Seeded capacity

- 10 wards (`W-01` to `W-10`)
- 25 beds in every ward
- 250 beds total
- One operational room per seeded ward
- All seeded beds start as `AVAILABLE`
- Ward/bed codes are compatible with the existing V11 canonical ward/bed schema

The migration is safe for a database at Flyway version 15. A failed transactional V16 attempt is rolled back by PostgreSQL/Flyway, so the corrected V16 can run on the next startup.
