-- Preserve the route by which a patient entered the hospital workflow.
-- Existing records remain valid and older API clients continue to receive the
-- safe walk-in default when they do not send the new optional property.
alter table patients
  add column if not exists registration_type text not null default 'walk_in';

alter table patients
  drop constraint if exists patients_registration_type_check;

alter table patients
  add constraint patients_registration_type_check
  check (registration_type in ('walk_in','appointment','emergency','referral','transfer','newborn'));

create index if not exists idx_patients_hospital_registration_type_created
  on patients(hospital_id, registration_type, created_at desc)
  where status <> 'deleted';
