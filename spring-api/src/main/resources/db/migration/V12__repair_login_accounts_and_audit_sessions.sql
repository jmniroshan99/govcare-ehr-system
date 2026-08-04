-- Repair local authentication/demo accounts and normalize historical login sessions.
-- This migration is additive and does not delete hospital, staff, patient or audit data.

-- Old releases created one backend audit row and a second browser audit row for the
-- same login. Close any sessions left active during upgrade so the activity report
-- no longer shows permanently logged-in users after the application was stopped.
update login_activities
set logout_status = 'timed_out',
    logout_time = coalesce(logout_time, now()),
    last_activity_time = coalesce(last_activity_time, now()),
    session_duration_seconds = coalesce(
      session_duration_seconds,
      greatest(0, extract(epoch from (coalesce(logout_time, now()) - login_time))::integer)
    )
where logout_time is null
  and logout_status = 'active';

create index if not exists idx_login_activities_session_user
  on login_activities(session_id, user_id);
create index if not exists idx_login_activities_active_session
  on login_activities(user_id, login_time desc)
  where logout_time is null and logout_status = 'active';

-- The React login screen advertises doctor and patient demo accounts. Earlier
-- Flyway data seeded only the super administrator, causing the default login and
-- both demo buttons to fail on a new database.
insert into app_users(
  auth_uid,hospital_id,department_id,role,full_name,email,password_hash,
  phone,address,permissions,mfa_enabled,status,employee_no,job_title,
  employment_type,joining_date,work_status,must_change_password
)
select
  'spring-demo-doctor',h.id,d.id,'doctor','Dr. Anjali Perera',
  'doctor@govcare.gov.lk',crypt('GovCare@123',gen_salt('bf')),
  '0771234001','Medical Officer Quarters, Colombo','[]'::jsonb,false,'active',
  'DEMO-DOCTOR-001','Medical Officer','permanent',current_date,'active',false
from hospitals h
join departments d on d.hospital_id=h.id and d.code='OPD'
where h.code='NHSL'
on conflict(email) do nothing;

insert into patients(
  hospital_id,patient_no,title,full_name,preferred_name,date_of_birth,age_years,
  gender,blood_group,nationality,address,district,province,phone,email,
  emergency_contact,language_preference,allergies,chronic_diseases,disabilities,
  family_history,risk_flags,qr_payload,release_status,status
)
select
  h.id,'PAT-DEMO-00001','Mr','Nimal Perera','Nimal',date '1990-05-15',
  extract(year from age(current_date,date '1990-05-15'))::integer,
  'male','O+','Sri Lankan','Colombo, Sri Lanka','Colombo','Western',
  '0771234002','patient@govcare.gov.lk',
  jsonb_build_object('name','Demo Emergency Contact','phone','0770000000'),
  'en','[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,
  'PAT-DEMO-00001','released','active'
from hospitals h
where h.code='NHSL'
on conflict(hospital_id,patient_no) do nothing;

insert into app_users(
  auth_uid,hospital_id,department_id,patient_id,role,full_name,email,password_hash,
  phone,address,permissions,mfa_enabled,status,employee_no,job_title,
  work_status,must_change_password
)
select
  'spring-demo-patient',h.id,null,p.id,'patient',p.full_name,
  'patient@govcare.gov.lk',crypt('GovCare@123',gen_salt('bf')),
  p.phone,p.address,'[]'::jsonb,false,'active','DEMO-PATIENT-001',
  'Patient Portal User','active',false
from hospitals h
join patients p on p.hospital_id=h.id and p.patient_no='PAT-DEMO-00001'
where h.code='NHSL'
on conflict(email) do nothing;
