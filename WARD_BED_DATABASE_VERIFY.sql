-- Run in pgAdmin / psql against govcare_ehr_v2 after Spring starts.
-- Expected: 10 rows, each with canonical_beds = 25.
select
  w.ward_code,
  w.name as ward_name,
  d.code as department_code,
  d.name as department_name,
  count(b.id) filter (where b.bed_no ~ '^(0[1-9]|1[0-9]|2[0-5])$') as canonical_beds,
  count(b.id) filter (
    where b.bed_no ~ '^(0[1-9]|1[0-9]|2[0-5])$'
      and b.status='AVAILABLE'
      and b.current_patient_id is null
      and b.current_admission_id is null
      and (b.reserved_patient_id is null or b.reserved_until < now())
  ) as available_beds
from wards w
join hospitals h on h.id=w.hospital_id
left join departments d on d.id=w.department_id
left join beds b on b.ward_id=w.id
where upper(h.code)='NHSL'
  and w.ward_code ~ '^W-(0[1-9]|10)$'
group by w.ward_code,w.name,d.code,d.name
order by w.ward_code;

-- Expected: 10 wards and 250 canonical beds.
select
  count(distinct w.id) as ward_count,
  count(b.id) filter (where b.bed_no ~ '^(0[1-9]|1[0-9]|2[0-5])$') as canonical_bed_count
from wards w
join hospitals h on h.id=w.hospital_id
left join beds b on b.ward_id=w.id
where upper(h.code)='NHSL'
  and w.ward_code ~ '^W-(0[1-9]|10)$';
