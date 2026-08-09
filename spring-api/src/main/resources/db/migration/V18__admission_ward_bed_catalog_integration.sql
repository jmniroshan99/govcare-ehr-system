-- GovCare EHR admission ward/bed catalog integration.
-- Repairs databases where the UI still sees only the legacy W-01 / single-bed row.
-- This migration is intentionally V18 so it runs even when V16/V17 are already
-- present in flyway_schema_history.

DO $$
DECLARE
    h uuid;
    ward_index integer;
    bed_index integer;
    dept_code text;
    dept_id uuid;
    w uuid;
    r uuid;
    ward_code_value text;
    ward_name_value text;
    ward_type_value text;
    ward_category_value text;
    gender_value text;
    age_value text;
    isolation_value boolean;
    bed_type_value text;
    bed_number_value text;
    bed_code_value text;
    ward_count integer;
    canonical_bed_count integer;
BEGIN
    SELECT id INTO h
    FROM hospitals
    WHERE upper(code) = 'NHSL' AND status = 'active'::record_status
    ORDER BY created_at NULLS LAST, id
    LIMIT 1;

    IF h IS NULL THEN
        RAISE EXCEPTION 'V18 requires an active NHSL hospital.';
    END IF;

    -- Inpatient departments used by the admission ward selector.
    INSERT INTO departments(hospital_id, code, name, type, status)
    VALUES
      (h,'MED','General Medicine','clinical','active'::record_status),
      (h,'SURG','General Surgery','clinical','active'::record_status),
      (h,'PED','Paediatrics','clinical','active'::record_status),
      (h,'MAT','Maternity and Obstetrics','clinical','active'::record_status),
      (h,'ICU','Intensive Care','clinical','active'::record_status),
      (h,'HDU','High Dependency Unit','clinical','active'::record_status),
      (h,'ISO','Isolation Services','clinical','active'::record_status),
      (h,'OBS','Observation Unit','clinical','active'::record_status)
    ON CONFLICT (hospital_id, code) DO UPDATE SET
      status='active'::record_status,
      updated_at=now();

    FOR ward_index IN 1..10 LOOP
        ward_code_value := 'W-' || lpad(ward_index::text, 2, '0');

        CASE ward_index
          WHEN 1 THEN dept_code:='MED';  ward_name_value:='Male Medical Ward';      ward_type_value:='GENERAL_MEDICAL_WARD'; ward_category_value:='male';      gender_value:='MALE';   age_value:='ADULT';     isolation_value:=false; bed_type_value:='STANDARD';
          WHEN 2 THEN dept_code:='MED';  ward_name_value:='Female Medical Ward';    ward_type_value:='GENERAL_MEDICAL_WARD'; ward_category_value:='female';    gender_value:='FEMALE'; age_value:='ADULT';     isolation_value:=false; bed_type_value:='STANDARD';
          WHEN 3 THEN dept_code:='SURG'; ward_name_value:='Male Surgical Ward';     ward_type_value:='SURGICAL_WARD';        ward_category_value:='male';      gender_value:='MALE';   age_value:='ADULT';     isolation_value:=false; bed_type_value:='STANDARD';
          WHEN 4 THEN dept_code:='SURG'; ward_name_value:='Female Surgical Ward';   ward_type_value:='SURGICAL_WARD';        ward_category_value:='female';    gender_value:='FEMALE'; age_value:='ADULT';     isolation_value:=false; bed_type_value:='STANDARD';
          WHEN 5 THEN dept_code:='PED';  ward_name_value:='Paediatric Ward';        ward_type_value:='PAEDIATRIC_WARD';      ward_category_value:='children';  gender_value:='ANY';    age_value:='PAEDIATRIC'; isolation_value:=false; bed_type_value:='PAEDIATRIC';
          WHEN 6 THEN dept_code:='MAT';  ward_name_value:='Maternity Ward';         ward_type_value:='MATERNITY_WARD';       ward_category_value:='female';    gender_value:='FEMALE'; age_value:='ADULT';     isolation_value:=false; bed_type_value:='MATERNITY';
          WHEN 7 THEN dept_code:='ICU';  ward_name_value:='Intensive Care Unit';    ward_type_value:='INTENSIVE_CARE_UNIT';  ward_category_value:='icu';       gender_value:='ANY';    age_value:='ANY';       isolation_value:=false; bed_type_value:='ICU';
          WHEN 8 THEN dept_code:='HDU';  ward_name_value:='High Dependency Unit';   ward_type_value:='HIGH_DEPENDENCY_UNIT'; ward_category_value:='hdu';       gender_value:='ANY';    age_value:='ANY';       isolation_value:=false; bed_type_value:='HDU';
          WHEN 9 THEN dept_code:='ISO';  ward_name_value:='Isolation Ward';         ward_type_value:='ISOLATION_WARD';       ward_category_value:='isolation'; gender_value:='ANY';    age_value:='ANY';       isolation_value:=true;  bed_type_value:='ISOLATION';
          ELSE        dept_code:='OBS';  ward_name_value:='Observation Ward';       ward_type_value:='OBSERVATION_WARD';     ward_category_value:='male';      gender_value:='ANY';    age_value:='ANY';       isolation_value:=false; bed_type_value:='OBSERVATION';
        END CASE;

        SELECT id INTO dept_id
        FROM departments
        WHERE hospital_id=h AND upper(code)=dept_code AND status='active'::record_status
        LIMIT 1;

        INSERT INTO wards(
          hospital_id,department_id,ward_no,ward_code,name,ward_type,category,
          building,floor,capacity,gender_restriction,age_restriction,isolation_capable,
          status,operational_status
        ) VALUES (
          h,dept_id,ward_code_value,ward_code_value,ward_name_value,ward_type_value,ward_category_value,
          'Main Building','Main Building',25,gender_value,age_value,isolation_value,
          'active'::record_status,'ACTIVE'
        )
        ON CONFLICT (hospital_id,ward_code) DO UPDATE SET
          department_id=EXCLUDED.department_id,
          ward_no=EXCLUDED.ward_no,
          name=EXCLUDED.name,
          ward_type=EXCLUDED.ward_type,
          category=EXCLUDED.category,
          capacity=25,
          gender_restriction=EXCLUDED.gender_restriction,
          age_restriction=EXCLUDED.age_restriction,
          isolation_capable=EXCLUDED.isolation_capable,
          status='active'::record_status,
          operational_status='ACTIVE',
          updated_at=now()
        RETURNING id INTO w;

        INSERT INTO ward_rooms(
          ward_id,room_number,room_name,room_type,floor,maximum_beds,
          gender_restriction,isolation_room,oxygen_available,ventilator_support,status
        ) VALUES (
          w,'GENERAL',ward_name_value || ' - Main Room',
          CASE
            WHEN bed_type_value='ICU' THEN 'ICU'
            WHEN bed_type_value='HDU' THEN 'HDU'
            WHEN bed_type_value='ISOLATION' THEN 'ISOLATION'
            WHEN bed_type_value='OBSERVATION' THEN 'OBSERVATION'
            ELSE 'GENERAL'
          END,
          'Main Building',25,gender_value,isolation_value,
          bed_type_value IN ('ICU','HDU'),bed_type_value='ICU','ACTIVE'
        )
        ON CONFLICT (ward_id,room_number) DO UPDATE SET
          room_name=EXCLUDED.room_name,
          room_type=EXCLUDED.room_type,
          maximum_beds=25,
          gender_restriction=EXCLUDED.gender_restriction,
          isolation_room=EXCLUDED.isolation_room,
          oxygen_available=EXCLUDED.oxygen_available,
          ventilator_support=EXCLUDED.ventilator_support,
          status='ACTIVE',
          updated_at=now()
        RETURNING id INTO r;

        -- Preserve one legacy bed as canonical bed 01 when possible. This keeps
        -- an existing occupied bed/patient relationship while eliminating the
        -- old single-bed representation from the admission UI.
        IF NOT EXISTS (SELECT 1 FROM beds WHERE ward_id=w AND bed_no='01') THEN
          UPDATE beds b
          SET bed_no='01',
              bed_code=ward_code_value || '-B01',
              room_id=r,
              hospital_id=h,
              bed_type=bed_type_value,
              gender_restriction=gender_value,
              age_restriction=age_value,
              isolation_support=isolation_value,
              updated_at=now()
          WHERE b.id = (
            SELECT bx.id FROM beds bx
            WHERE bx.ward_id=w
            ORDER BY CASE WHEN bx.current_patient_id IS NOT NULL OR bx.current_admission_id IS NOT NULL THEN 0 ELSE 1 END,
                     bx.created_at NULLS LAST,
                     bx.id
            LIMIT 1
          );
        END IF;

        FOR bed_index IN 1..25 LOOP
          bed_number_value := lpad(bed_index::text,2,'0');
          bed_code_value := ward_code_value || '-B' || bed_number_value;

          INSERT INTO beds(
            hospital_id,ward_id,room_id,bed_no,bed_code,bed_type,room_no,floor,status,
            gender_restriction,age_restriction,isolation_support,oxygen_support,
            ventilator_support,monitor_support,electric_bed,accessible_bed
          ) VALUES (
            h,w,r,bed_number_value,bed_code_value,bed_type_value,'GENERAL','Main Building','AVAILABLE',
            gender_value,age_value,isolation_value,
            bed_type_value IN ('ICU','HDU'),bed_type_value='ICU',bed_type_value IN ('ICU','HDU'),
            bed_type_value IN ('ICU','HDU'),bed_index=1
          )
          ON CONFLICT (ward_id,bed_no) DO UPDATE SET
            hospital_id=EXCLUDED.hospital_id,
            room_id=EXCLUDED.room_id,
            bed_code=EXCLUDED.bed_code,
            bed_type=EXCLUDED.bed_type,
            room_no=EXCLUDED.room_no,
            gender_restriction=EXCLUDED.gender_restriction,
            age_restriction=EXCLUDED.age_restriction,
            isolation_support=EXCLUDED.isolation_support,
            oxygen_support=EXCLUDED.oxygen_support,
            ventilator_support=EXCLUDED.ventilator_support,
            monitor_support=EXCLUDED.monitor_support,
            electric_bed=EXCLUDED.electric_bed,
            accessible_bed=EXCLUDED.accessible_bed,
            -- Keep live bed state if a bed already exists.
            updated_at=now();
        END LOOP;
    END LOOP;

    SELECT count(*) INTO ward_count
    FROM wards
    WHERE hospital_id=h AND ward_code ~ '^W-(0[1-9]|10)$' AND status='active'::record_status;

    SELECT count(*) INTO canonical_bed_count
    FROM beds b
    JOIN wards w2 ON w2.id=b.ward_id
    WHERE w2.hospital_id=h
      AND w2.ward_code ~ '^W-(0[1-9]|10)$'
      AND b.bed_no ~ '^(0[1-9]|1[0-9]|2[0-5])$';

    IF ward_count <> 10 OR canonical_bed_count <> 250 THEN
      RAISE EXCEPTION 'V18 ward/bed verification failed. wards=%, canonical beds=%',ward_count,canonical_bed_count;
    END IF;
END $$;
