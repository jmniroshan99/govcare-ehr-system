-- Keep patient age synchronized and support fast ward-scoped patient identification.
-- The API still calculates age dynamically from date_of_birth so birthdays are always correct.

create or replace function govcare_patient_age_years(p_date_of_birth date)
returns integer
language sql
stable
as $$
  select case
    when p_date_of_birth is null or p_date_of_birth > current_date then null
    else greatest(0, extract(year from age(current_date, p_date_of_birth))::integer)
  end
$$;

create or replace function govcare_sync_patient_age_years()
returns trigger
language plpgsql
as $$
begin
  new.age_years := govcare_patient_age_years(new.date_of_birth);
  return new;
end;
$$;

drop trigger if exists trg_patients_sync_age_years on patients;
create trigger trg_patients_sync_age_years
before insert or update of date_of_birth on patients
for each row execute function govcare_sync_patient_age_years();

update patients
set age_years = govcare_patient_age_years(date_of_birth)
where age_years is distinct from govcare_patient_age_years(date_of_birth);

create index if not exists idx_admissions_active_ward_patient
  on admissions(hospital_id, ward_id, patient_id, admitted_at desc)
  where status='active' and discharged_at is null;

create index if not exists idx_beds_current_patient_admission
  on beds(current_patient_id, current_admission_id)
  where current_patient_id is not null;
