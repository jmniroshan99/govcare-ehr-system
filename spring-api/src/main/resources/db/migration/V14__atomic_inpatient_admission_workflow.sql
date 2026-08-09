-- Complete inpatient admission workflow: verified identity -> ward -> bed -> admission.
-- Additive, PostgreSQL-compatible and safe for existing GovCare EHR databases.

create sequence if not exists admission_no_seq start with 1 increment by 1;

-- Continue after the highest existing ADM number so upgraded databases do not
-- generate a duplicate admission number.
do $$
declare
  highest_number bigint;
begin
  select coalesce(max((regexp_match(admission_no, '([0-9]+)$'))[1]::bigint), 0)
    into highest_number
  from admissions
  where admission_no ~ '^ADM-[0-9]{8}-[0-9]+$';

  perform setval('admission_no_seq', greatest(highest_number, 1), highest_number > 0);
end;
$$;

create or replace function next_admission_no()
returns text
language plpgsql
as $$
begin
  return 'ADM-' || to_char(current_date,'YYYYMMDD') || '-' || lpad(nextval('admission_no_seq')::text, 6, '0');
end;
$$;

alter table admissions
  add column if not exists admission_type text not null default 'EMERGENCY',
  add column if not exists presenting_complaint text,
  add column if not exists referring_department_id uuid references departments(id) on delete set null,
  add column if not exists isolation_required boolean not null default false,
  add column if not exists special_nursing_requirement text,
  add column if not exists admission_notes text,
  add column if not exists identity_confirmed_by uuid references app_users(id) on delete set null,
  add column if not exists identity_confirmed_at timestamptz,
  add column if not exists discharge_reason text,
  add column if not exists discharge_notes text;

update admissions
set admission_type = case
  when upper(coalesce(admission_type,'')) in ('EMERGENCY','ELECTIVE','TRANSFER','OBSERVATION','MATERNITY','ICU')
    then upper(admission_type)
  else 'EMERGENCY'
end;

alter table admissions drop constraint if exists chk_admissions_admission_type;
alter table admissions add constraint chk_admissions_admission_type
  check (admission_type in ('EMERGENCY','ELECTIVE','TRANSFER','OBSERVATION','MATERNITY','ICU'));

-- Server-side proof that the same authenticated staff member explicitly
-- confirmed the patient before the atomic admission transaction.
create table if not exists patient_identity_confirmations (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  confirmed_by uuid not null references app_users(id) on delete restrict,
  expected_ward_id uuid references wards(id) on delete set null,
  expected_bed_id uuid references beds(id) on delete set null,
  admission_id uuid references admissions(id) on delete set null,
  confirmed_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  consumed_at timestamptz,
  notes text
);
create index if not exists idx_patient_identity_confirmation_lookup
  on patient_identity_confirmations(patient_id,confirmed_by,expires_at desc);
create index if not exists idx_patient_identity_confirmation_open
  on patient_identity_confirmations(hospital_id,patient_id)
  where consumed_at is null;

-- Repair only contradictory active duplicates before adding patient-side
-- uniqueness. The newest admission/allocation is preserved. Older contradictory
-- rows are closed with an explicit migration reason instead of deleting history.
with ranked as (
  select id,
         row_number() over (
           partition by hospital_id,patient_id
           order by admitted_at desc,created_at desc,id desc
         ) as rn
  from admissions
  where status='active' and discharged_at is null
), closed as (
  update admissions a
  set status='completed',
      discharged_at=coalesce(a.discharged_at,now()),
      discharge_reason=coalesce(a.discharge_reason,'Automatically closed during V14 duplicate-active-admission repair'),
      updated_at=now()
  from ranked r
  where a.id=r.id and r.rn>1
  returning a.id
)
update patient_bed_assignments x
set active=false,
    released_at=coalesce(x.released_at,now()),
    release_reason=coalesce(x.release_reason,'Admission closed during V14 duplicate repair')
where x.admission_id in (select id from closed) and x.active=true;

update beds b
set status='CLEANING',
    current_patient_id=null,
    current_admission_id=null,
    version=version+1,
    updated_at=now()
where b.current_admission_id in (
  select a.id from admissions a
  where a.status='completed'
    and a.discharge_reason='Automatically closed during V14 duplicate-active-admission repair'
);

with ranked as (
  select id,bed_id,
         row_number() over (
           partition by hospital_id,patient_id
           order by assigned_at desc,id desc
         ) as rn
  from patient_bed_assignments
  where active=true
), released as (
  update patient_bed_assignments x
  set active=false,
      released_at=coalesce(x.released_at,now()),
      release_reason=coalesce(x.release_reason,'Automatically released during V14 duplicate-patient-bed repair')
  from ranked r
  where x.id=r.id and r.rn>1
  returning x.bed_id,x.patient_id,x.admission_id
)
update beds b
set status='CLEANING',
    current_patient_id=null,
    current_admission_id=null,
    version=version+1,
    updated_at=now()
from released r
where b.id=r.bed_id
  and b.current_patient_id=r.patient_id
  and b.current_admission_id=r.admission_id;

-- One active inpatient admission per patient, one active allocation per patient,
-- and one active patient per bed. Existing V11 indexes already protect the bed
-- and admission sides; these indexes complete patient-side protection.
create unique index if not exists uq_active_admission_per_patient
  on admissions(hospital_id,patient_id)
  where status='active' and discharged_at is null;

create unique index if not exists uq_active_bed_assignment_per_patient
  on patient_bed_assignments(hospital_id,patient_id)
  where active=true;

create index if not exists idx_admissions_hospital_status_time
  on admissions(hospital_id,status,admitted_at desc);
create index if not exists idx_admissions_active_location
  on admissions(hospital_id,ward_id,bed_id)
  where status='active' and discharged_at is null;

insert into permissions(code,name,module,action) values
('PATIENT_IDENTITY_CONFIRM','Confirm patient identity before admission','admissions','identity_confirm'),
('ADMISSION_CREATE','Create an inpatient admission and assign a bed','admissions','create'),
('ADMISSION_DISCHARGE','Discharge an inpatient and release the bed','admissions','discharge'),
('ADMISSION_TRANSFER','Transfer an inpatient to another ward and bed','admissions','transfer'),
('WARD_PATIENT_LIST','View patients actively admitted to a ward','wards','patient_list')
on conflict(code) do nothing;

insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code=any(array[
 'PATIENT_IDENTITY_CONFIRM','ADMISSION_CREATE','ADMISSION_DISCHARGE','ADMISSION_TRANSFER','WARD_PATIENT_LIST'
]) where r.code in ('super_admin','hospital_admin') on conflict do nothing;

insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code=any(array[
 'PATIENT_IDENTITY_CONFIRM','ADMISSION_CREATE','ADMISSION_DISCHARGE','ADMISSION_TRANSFER','WARD_PATIENT_LIST'
]) where r.code in ('doctor','surgeon') on conflict do nothing;

insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code=any(array[
 'PATIENT_IDENTITY_CONFIRM','ADMISSION_CREATE','ADMISSION_DISCHARGE','ADMISSION_TRANSFER','WARD_PATIENT_LIST'
]) where r.code='nurse' on conflict do nothing;

insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code=any(array[
 'PATIENT_IDENTITY_CONFIRM','ADMISSION_CREATE','WARD_PATIENT_LIST'
]) where r.code in ('receptionist','records_officer') on conflict do nothing;

-- Super Admin must receive all new permissions on upgraded databases.
insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r cross join permissions p where r.code='super_admin'
on conflict do nothing;
