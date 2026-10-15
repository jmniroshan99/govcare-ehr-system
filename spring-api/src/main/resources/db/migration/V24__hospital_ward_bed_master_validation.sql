-- V24__hospital_ward_bed_master_validation.sql
-- Ensures hospital infrastructure master data is available.
-- Existing records are preserved.

-- This migration is intentionally defensive because this project already
-- contains ward/bed seed migrations (V16/V17). It validates the target state.

DO $$
DECLARE
    hospital_count integer;
    ward_count integer;
    bed_count integer;
BEGIN
    SELECT COUNT(*) INTO hospital_count FROM hospitals;
    IF hospital_count = 0 THEN
        RAISE EXCEPTION 'No hospital master record found';
    END IF;

    SELECT COUNT(*) INTO ward_count FROM wards;
    IF ward_count < 10 THEN
        RAISE EXCEPTION 'Expected minimum 10 wards, found %', ward_count;
    END IF;

    SELECT COUNT(*) INTO bed_count FROM beds;
    IF bed_count < 250 THEN
        RAISE EXCEPTION 'Expected minimum 250 beds, found %', bed_count;
    END IF;
END $$;
