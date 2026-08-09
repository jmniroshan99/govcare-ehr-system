-- GovCare EHR corrective ward/bed seed.
-- V17 exists intentionally even though V16 also seeds wards/beds: some upgraded
-- databases may already have V16 recorded while still containing only legacy
-- ward/bed rows. This migration is idempotent and repairs that state safely.
--
-- Result for NHSL:
--   W-01 .. W-10
--   25 bed slots per ward (01 .. 25)
--   250 canonical seeded bed slots in total
-- Existing occupied/reserved/cleaning bed STATUS is preserved on conflict.

DO $$
DECLARE
    h uuid;
    d uuid;
    w uuid;
    r uuid;
    ward_index integer;
    bed_index integer;
    ward_code_value text;
    ward_name_value text;
    ward_type_value text;
    ward_category_value text;
    gender_value text;
    age_value text;
    isolation_value boolean;
    bed_number_value text;
    bed_code_value text;
    repaired_ward_count integer;
    undersized_ward_count integer;
BEGIN
    SELECT id INTO h
    FROM hospitals
    WHERE upper(code) = 'NHSL'
    ORDER BY created_at NULLS LAST, id
    LIMIT 1;

    IF h IS NULL THEN
        RAISE EXCEPTION 'V17 requires hospital code NHSL, but no NHSL hospital exists.';
    END IF;

    SELECT id INTO d
    FROM departments
    WHERE hospital_id = h
      AND upper(code) = 'OPD'
    ORDER BY created_at NULLS LAST, id
    LIMIT 1;

    -- Defensive fallback for databases where the department seed was renamed.
    IF d IS NULL THEN
        SELECT id INTO d
        FROM departments
        WHERE hospital_id = h
        ORDER BY CASE WHEN status = 'active'::record_status THEN 0 ELSE 1 END,
                 created_at NULLS LAST,
                 id
        LIMIT 1;
    END IF;

    IF d IS NULL THEN
        RAISE EXCEPTION 'V17 cannot seed wards because NHSL has no department.';
    END IF;

    FOR ward_index IN 1..10 LOOP
        ward_code_value := 'W-' || lpad(ward_index::text, 2, '0');

        CASE ward_index
            WHEN 1 THEN
                ward_name_value := 'Male Medical Ward';
                ward_type_value := 'GENERAL_MEDICAL_WARD';
                ward_category_value := 'male';
                gender_value := 'MALE';
                age_value := 'ADULT';
                isolation_value := false;
            WHEN 2 THEN
                ward_name_value := 'Female Medical Ward';
                ward_type_value := 'GENERAL_MEDICAL_WARD';
                ward_category_value := 'female';
                gender_value := 'FEMALE';
                age_value := 'ADULT';
                isolation_value := false;
            WHEN 3 THEN
                ward_name_value := 'Male Surgical Ward';
                ward_type_value := 'SURGICAL_WARD';
                ward_category_value := 'male';
                gender_value := 'MALE';
                age_value := 'ADULT';
                isolation_value := false;
            WHEN 4 THEN
                ward_name_value := 'Female Surgical Ward';
                ward_type_value := 'SURGICAL_WARD';
                ward_category_value := 'female';
                gender_value := 'FEMALE';
                age_value := 'ADULT';
                isolation_value := false;
            WHEN 5 THEN
                ward_name_value := 'Paediatric Ward';
                ward_type_value := 'PAEDIATRIC_WARD';
                ward_category_value := 'children';
                gender_value := 'ANY';
                age_value := 'PAEDIATRIC';
                isolation_value := false;
            WHEN 6 THEN
                ward_name_value := 'Maternity Ward';
                ward_type_value := 'MATERNITY_WARD';
                ward_category_value := 'female';
                gender_value := 'FEMALE';
                age_value := 'ADULT';
                isolation_value := false;
            WHEN 7 THEN
                ward_name_value := 'Intensive Care Unit';
                ward_type_value := 'INTENSIVE_CARE_UNIT';
                ward_category_value := 'icu';
                gender_value := 'ANY';
                age_value := 'ANY';
                isolation_value := false;
            WHEN 8 THEN
                ward_name_value := 'High Dependency Unit';
                ward_type_value := 'HIGH_DEPENDENCY_UNIT';
                ward_category_value := 'hdu';
                gender_value := 'ANY';
                age_value := 'ANY';
                isolation_value := false;
            WHEN 9 THEN
                ward_name_value := 'Isolation Ward';
                ward_type_value := 'ISOLATION_WARD';
                ward_category_value := 'isolation';
                gender_value := 'ANY';
                age_value := 'ANY';
                isolation_value := true;
            ELSE
                ward_name_value := 'Observation Ward';
                ward_type_value := 'OBSERVATION_WARD';
                ward_category_value := 'male';
                gender_value := 'ANY';
                age_value := 'ANY';
                isolation_value := false;
        END CASE;

        INSERT INTO wards (
            hospital_id,
            department_id,
            ward_no,
            ward_code,
            name,
            ward_type,
            category,
            building,
            floor,
            capacity,
            gender_restriction,
            age_restriction,
            isolation_capable,
            status,
            operational_status
        ) VALUES (
            h,
            d,
            ward_code_value,
            ward_code_value,
            ward_name_value,
            ward_type_value,
            ward_category_value,
            'Main Building',
            'Main Building',
            25,
            gender_value,
            age_value,
            isolation_value,
            'active'::record_status,
            'ACTIVE'
        )
        ON CONFLICT (hospital_id, ward_code) DO UPDATE SET
            department_id = d,
            ward_no = EXCLUDED.ward_no,
            name = EXCLUDED.name,
            ward_type = EXCLUDED.ward_type,
            category = EXCLUDED.category,
            building = COALESCE(NULLIF(wards.building, ''), EXCLUDED.building),
            floor = COALESCE(NULLIF(wards.floor, ''), EXCLUDED.floor),
            capacity = 25,
            gender_restriction = EXCLUDED.gender_restriction,
            age_restriction = EXCLUDED.age_restriction,
            isolation_capable = EXCLUDED.isolation_capable,
            status = 'active'::record_status,
            operational_status = 'ACTIVE',
            updated_at = now()
        RETURNING id INTO w;

        INSERT INTO ward_rooms (
            ward_id,
            room_number,
            room_name,
            room_type,
            floor,
            maximum_beds,
            gender_restriction,
            isolation_room,
            oxygen_available,
            ventilator_support,
            status
        ) VALUES (
            w,
            'GENERAL',
            ward_name_value || ' - Main Room',
            CASE
                WHEN ward_category_value = 'icu' THEN 'ICU'
                WHEN ward_category_value = 'hdu' THEN 'HDU'
                WHEN ward_category_value = 'isolation' THEN 'ISOLATION'
                WHEN ward_type_value = 'OBSERVATION_WARD' THEN 'OBSERVATION'
                ELSE 'GENERAL'
            END,
            'Main Building',
            25,
            gender_value,
            isolation_value,
            ward_category_value IN ('icu','hdu'),
            ward_category_value = 'icu',
            'ACTIVE'
        )
        ON CONFLICT (ward_id, room_number) DO UPDATE SET
            room_name = EXCLUDED.room_name,
            room_type = EXCLUDED.room_type,
            floor = COALESCE(NULLIF(ward_rooms.floor, ''), EXCLUDED.floor),
            maximum_beds = 25,
            gender_restriction = EXCLUDED.gender_restriction,
            isolation_room = EXCLUDED.isolation_room,
            oxygen_available = EXCLUDED.oxygen_available,
            ventilator_support = EXCLUDED.ventilator_support,
            status = 'ACTIVE',
            updated_at = now()
        RETURNING id INTO r;

        FOR bed_index IN 1..25 LOOP
            bed_number_value := lpad(bed_index::text, 2, '0');
            bed_code_value := ward_code_value || '-B' || bed_number_value;

            INSERT INTO beds (
                hospital_id,
                ward_id,
                room_id,
                bed_no,
                bed_code,
                bed_type,
                room_no,
                floor,
                status,
                gender_restriction,
                age_restriction,
                isolation_support,
                oxygen_support,
                ventilator_support,
                monitor_support,
                electric_bed,
                accessible_bed
            ) VALUES (
                h,
                w,
                r,
                bed_number_value,
                bed_code_value,
                CASE
                    WHEN ward_category_value = 'children' THEN 'PAEDIATRIC'
                    WHEN ward_category_value = 'icu' THEN 'ICU'
                    WHEN ward_category_value = 'hdu' THEN 'HDU'
                    WHEN ward_category_value = 'isolation' THEN 'ISOLATION'
                    WHEN ward_type_value = 'MATERNITY_WARD' THEN 'MATERNITY'
                    WHEN ward_type_value = 'OBSERVATION_WARD' THEN 'OBSERVATION'
                    ELSE 'STANDARD'
                END,
                'GENERAL',
                'Main Building',
                'AVAILABLE',
                gender_value,
                age_value,
                isolation_value,
                ward_category_value IN ('icu','hdu'),
                ward_category_value = 'icu',
                ward_category_value IN ('icu','hdu'),
                ward_category_value IN ('icu','hdu'),
                bed_index = 1
            )
            ON CONFLICT (ward_id, bed_no) DO UPDATE SET
                hospital_id = EXCLUDED.hospital_id,
                room_id = EXCLUDED.room_id,
                bed_code = EXCLUDED.bed_code,
                bed_type = EXCLUDED.bed_type,
                room_no = EXCLUDED.room_no,
                floor = COALESCE(NULLIF(beds.floor, ''), EXCLUDED.floor),
                gender_restriction = EXCLUDED.gender_restriction,
                age_restriction = EXCLUDED.age_restriction,
                isolation_support = EXCLUDED.isolation_support,
                oxygen_support = EXCLUDED.oxygen_support,
                ventilator_support = EXCLUDED.ventilator_support,
                monitor_support = EXCLUDED.monitor_support,
                electric_bed = EXCLUDED.electric_bed,
                accessible_bed = EXCLUDED.accessible_bed,
                -- Do not overwrite status/current patient/reservation on an
                -- already existing bed; live occupancy data must be preserved.
                updated_at = now();
        END LOOP;
    END LOOP;

    -- Recalculate the visible capacity from the actual canonical bed rows.
    UPDATE wards w2
    SET capacity = x.bed_count,
        updated_at = now()
    FROM (
        SELECT b.ward_id, count(*)::integer AS bed_count
        FROM beds b
        JOIN wards wx ON wx.id = b.ward_id
        WHERE wx.hospital_id = h
          AND wx.ward_code ~ '^W-(0[1-9]|10)$'
          AND b.bed_no ~ '^(0[1-9]|1[0-9]|2[0-5])$'
        GROUP BY b.ward_id
    ) x
    WHERE w2.id = x.ward_id;

    SELECT count(*) INTO repaired_ward_count
    FROM wards
    WHERE hospital_id = h
      AND ward_code ~ '^W-(0[1-9]|10)$';

    SELECT count(*) INTO undersized_ward_count
    FROM (
        SELECT w3.id
        FROM wards w3
        LEFT JOIN beds b3
          ON b3.ward_id = w3.id
         AND b3.bed_no ~ '^(0[1-9]|1[0-9]|2[0-5])$'
        WHERE w3.hospital_id = h
          AND w3.ward_code ~ '^W-(0[1-9]|10)$'
        GROUP BY w3.id
        HAVING count(b3.id) < 25
    ) q;

    IF repaired_ward_count <> 10 OR undersized_ward_count <> 0 THEN
        RAISE EXCEPTION 'V17 verification failed: expected 10 seeded wards with 25 bed slots each; wards=%, undersized=%', repaired_ward_count, undersized_ward_count;
    END IF;
END $$;
