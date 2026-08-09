-- GovCare EHR default inpatient capacity seed.
-- Creates/updates 10 NHSL wards and guarantees 25 beds per seeded ward (250 beds total).
-- This migration intentionally populates BOTH legacy ward_no/bed_no and canonical
-- ward_code/bed_code columns introduced by V11.

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
BEGIN
    SELECT id INTO h
    FROM hospitals
    WHERE code = 'NHSL'
    ORDER BY created_at
    LIMIT 1;

    IF h IS NULL THEN
        RAISE EXCEPTION 'V16 ward/bed seed requires the NHSL hospital created by V6.';
    END IF;

    SELECT id INTO d
    FROM departments
    WHERE hospital_id = h AND code = 'OPD'
    ORDER BY created_at
    LIMIT 1;

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
            25,
            gender_value,
            age_value,
            isolation_value,
            'active'::record_status,
            'ACTIVE'
        )
        ON CONFLICT (hospital_id, ward_code) DO UPDATE SET
            department_id = COALESCE(wards.department_id, EXCLUDED.department_id),
            ward_no = EXCLUDED.ward_no,
            name = EXCLUDED.name,
            ward_type = EXCLUDED.ward_type,
            category = EXCLUDED.category,
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
            status
        ) VALUES (
            w,
            'GENERAL',
            ward_name_value || ' - Main Room',
            CASE
                WHEN ward_category_value = 'icu' THEN 'ICU'
                WHEN ward_category_value = 'hdu' THEN 'HDU'
                WHEN ward_category_value = 'isolation' THEN 'ISOLATION'
                ELSE 'GENERAL'
            END,
            'Main Building',
            25,
            gender_value,
            isolation_value,
            'ACTIVE'
        )
        ON CONFLICT (ward_id, room_number) DO UPDATE SET
            room_name = EXCLUDED.room_name,
            maximum_beds = 25,
            gender_restriction = EXCLUDED.gender_restriction,
            isolation_room = EXCLUDED.isolation_room,
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
                    ELSE 'STANDARD'
                END,
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
                room_id = EXCLUDED.room_id,
                bed_code = EXCLUDED.bed_code,
                bed_type = EXCLUDED.bed_type,
                gender_restriction = EXCLUDED.gender_restriction,
                age_restriction = EXCLUDED.age_restriction,
                isolation_support = EXCLUDED.isolation_support,
                oxygen_support = EXCLUDED.oxygen_support,
                ventilator_support = EXCLUDED.ventilator_support,
                monitor_support = EXCLUDED.monitor_support,
                electric_bed = EXCLUDED.electric_bed,
                accessible_bed = EXCLUDED.accessible_bed,
                updated_at = now();
        END LOOP;
    END LOOP;
END $$;

-- Keep the displayed ward capacity synchronized with the seeded bed count.
UPDATE wards w
SET capacity = x.bed_count,
    updated_at = now()
FROM (
    SELECT ward_id, count(*)::integer AS bed_count
    FROM beds
    WHERE bed_code ~ '^W-[0-9]{2}-B[0-9]{2}$'
    GROUP BY ward_id
) x
WHERE w.id = x.ward_id
  AND w.ward_code ~ '^W-[0-9]{2}$';
