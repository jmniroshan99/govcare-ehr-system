-- Read-only verification of the local synthetic hospital network.
begin read only;

do $$
declare
  fixture_hospital record;
begin
  if (select count(*) from hospitals
      where code ~ '^DEMO-HOSP-(0[1-9]|10)$' and settings->>'govcare_demo_fixture'='network-v1')<>10 then
    raise exception 'Expected all 10 labelled demo hospitals. Run npm run demo:seed first.';
  end if;
  for fixture_hospital in select id,code from hospitals
      where code ~ '^DEMO-HOSP-(0[1-9]|10)$' and settings->>'govcare_demo_fixture'='network-v1'
  loop
    if (select count(*) from patients where hospital_id=fixture_hospital.id and patient_no ~ '^PAT-NET-H[0-9]{2}-[0-9]{4}$')<400 then
      raise exception '% has fewer than 400 fixture patients.',fixture_hospital.code;
    end if;
    if (select count(*) from app_users where hospital_id=fixture_hospital.id and role='doctor' and auth_uid like 'govcare-demo-network-v1:%')<100 then
      raise exception '% has fewer than 100 fixture doctors.',fixture_hospital.code;
    end if;
    if (select count(*) from wards where hospital_id=fixture_hospital.id and ward_code ~ '^DEMO-W-[0-9]{3}$')<100 then
      raise exception '% has fewer than 100 fixture wards.',fixture_hospital.code;
    end if;
    if (select count(*) from beds where hospital_id=fixture_hospital.id and bed_code ~ '^DEMO-B-[0-9]{3}-[0-9]{2}$')<800 then
      raise exception '% has fewer than 800 fixture beds.',fixture_hospital.code;
    end if;
    if (select count(*) from visits where hospital_id=fixture_hospital.id and visit_no like 'VIS-NET-%')<400
       or (select count(*) from admissions where hospital_id=fixture_hospital.id and admission_no like 'ADM-NET-%')<200
       or (select count(*) from appointments where hospital_id=fixture_hospital.id and appointment_no like 'APT-NET-%')<200 then
      raise exception '% is missing linked fixture visits, admissions, or appointments.',fixture_hospital.code;
    end if;
  end loop;

  -- The existing schema has UUID foreign keys; also assert hospital equality.
  if exists (
    select 1 from app_users u join hospitals h on h.id=u.hospital_id
    left join departments d on d.id=u.department_id left join patients p on p.id=u.patient_id
    where h.settings->>'govcare_demo_fixture'='network-v1'
      and (d.hospital_id is distinct from u.hospital_id and u.department_id is not null
           or p.hospital_id is distinct from u.hospital_id and u.patient_id is not null)
  ) then raise exception 'A demo user has a cross-hospital department or patient identity.'; end if;

  if exists (
    select 1 from patients p join hospitals h on h.id=p.hospital_id
    join guardians g on g.id=p.guardian_id
    where h.settings->>'govcare_demo_fixture'='network-v1' and g.hospital_id<>p.hospital_id
  ) then raise exception 'A demo guardian relationship crosses hospitals.'; end if;

  if exists (
    select 1 from wards w join hospitals h on h.id=w.hospital_id
    left join departments d on d.id=w.department_id
    left join app_users u on u.id=w.responsible_consultant_id
    left join app_users m on m.id=w.ward_manager_id
    where h.settings->>'govcare_demo_fixture'='network-v1'
      and (d.hospital_id is distinct from w.hospital_id or u.hospital_id is distinct from w.hospital_id
        or m.hospital_id is distinct from w.hospital_id and w.ward_manager_id is not null)
  ) then raise exception 'A demo ward references another hospital.'; end if;

  if exists (
    select 1 from beds b join hospitals h on h.id=b.hospital_id
    join wards w on w.id=b.ward_id join ward_rooms r on r.id=b.room_id
    where h.settings->>'govcare_demo_fixture'='network-v1'
      and (b.hospital_id<>w.hospital_id or r.ward_id<>w.id)
  ) then raise exception 'A demo bed is assigned to the wrong ward or room.'; end if;

  if exists (
    select 1 from visits v join hospitals h on h.id=v.hospital_id
    join patients p on p.id=v.patient_id join app_users d on d.id=v.doctor_id
    join departments dept on dept.id=v.department_id
    where h.settings->>'govcare_demo_fixture'='network-v1'
      and (v.hospital_id<>p.hospital_id or v.hospital_id<>d.hospital_id or v.hospital_id<>dept.hospital_id)
  ) then raise exception 'A demo visit crosses hospitals.'; end if;

  if exists (
    select 1 from appointments a join hospitals h on h.id=a.hospital_id
    join patients p on p.id=a.patient_id join app_users d on d.id=a.doctor_id
    join departments dept on dept.id=a.department_id
    where h.settings->>'govcare_demo_fixture'='network-v1'
      and (a.hospital_id<>p.hospital_id or a.hospital_id<>d.hospital_id or a.hospital_id<>dept.hospital_id)
  ) then raise exception 'A demo appointment crosses hospitals.'; end if;

  if exists (
    select 1 from opd_queue q join hospitals h on h.id=q.hospital_id
    join visits v on v.id=q.visit_id join patients p on p.id=q.patient_id
    join app_users d on d.id=q.doctor_id join departments dept on dept.id=q.department_id
    where h.settings->>'govcare_demo_fixture'='network-v1'
      and (q.hospital_id<>v.hospital_id or q.hospital_id<>p.hospital_id or q.hospital_id<>d.hospital_id
        or q.hospital_id<>dept.hospital_id or q.patient_id<>v.patient_id or q.doctor_id<>v.doctor_id)
  ) then raise exception 'A demo queue entry has inconsistent links.'; end if;

  if exists (
    select 1 from admissions a join hospitals h on h.id=a.hospital_id
    join patients p on p.id=a.patient_id join app_users d on d.id=a.consultant_id
    join wards w on w.id=a.ward_id join beds b on b.id=a.bed_id join visits v on v.id=a.visit_id
    where h.settings->>'govcare_demo_fixture'='network-v1'
      and (a.hospital_id<>p.hospital_id or a.hospital_id<>d.hospital_id or a.hospital_id<>w.hospital_id
        or a.hospital_id<>b.hospital_id or b.ward_id<>a.ward_id
        or a.hospital_id<>v.hospital_id or a.patient_id<>v.patient_id)
  ) then raise exception 'A demo admission has inconsistent patient, doctor, ward, bed or visit links.'; end if;

  if exists (
    select 1 from patient_bed_assignments x join hospitals h on h.id=x.hospital_id
    join admissions a on a.id=x.admission_id join beds b on b.id=x.bed_id join ward_rooms r on r.id=x.room_id
    where h.settings->>'govcare_demo_fixture'='network-v1' and x.active
      and (x.hospital_id<>a.hospital_id or x.patient_id<>a.patient_id or x.ward_id<>a.ward_id
        or x.bed_id<>a.bed_id or b.ward_id<>x.ward_id or r.ward_id<>x.ward_id
        or b.hospital_id<>x.hospital_id or b.current_patient_id is distinct from x.patient_id
        or b.current_admission_id is distinct from a.id or b.status<>'OCCUPIED'
        or a.status<>'active' or a.discharged_at is not null)
  ) then raise exception 'A demo active admission and bed assignment disagree.'; end if;
end $$;

select h.code,
       (select count(*) from patients p where p.hospital_id=h.id) as patients,
       (select count(*) from app_users u where u.hospital_id=h.id and u.role='doctor') as doctors,
       (select count(*) from wards w where w.hospital_id=h.id) as wards,
       (select count(*) from beds b where b.hospital_id=h.id) as beds,
       (select count(*) from admissions a where a.hospital_id=h.id and a.status='active') as active_admissions
from hospitals h where h.code ~ '^DEMO-HOSP-(0[1-9]|10)$'
  and h.settings->>'govcare_demo_fixture'='network-v1' order by h.code;

commit;
