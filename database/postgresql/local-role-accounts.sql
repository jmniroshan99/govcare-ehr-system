\set ON_ERROR_STOP on
\if :{?allow_local_accounts}
\else
  \set allow_local_accounts false
\endif
\if :allow_local_accounts
\else
  \echo 'This file is for local test databases. Run npm run accounts:local after Flyway V32.'
  do $$ begin raise exception 'Local test-account setup must be explicitly enabled.'; end $$;
\endif

begin;

do $$
begin
  if not exists(select 1 from flyway_schema_history where version='32' and success) then
    raise exception 'Start the updated Spring API first; Flyway V32 must be applied.';
  end if;
end $$;

create temporary table _govcare_local_context on commit drop as
select h.id hospital_id,
       (select p.id from patients p where :'patient_no'<>'' and p.hospital_id=h.id and p.patient_no=:'patient_no' and p.status<>'deleted') patient_id,
       (select d.id from departments d where :'ward_department_code'<>'' and d.hospital_id=h.id and d.code=:'ward_department_code' and d.status='active') ward_department_id
from hospitals h where h.code=:'hospital_code' and h.status='active';

do $$
begin
  if not exists(select 1 from _govcare_local_context) then
    raise exception 'The selected active hospital does not exist. No accounts were created.';
  end if;
end $$;

create temporary table _govcare_local_roles(
  role_code text primary key, full_name text, email text, temporary_password text, department_code text
) on commit drop;

insert into _govcare_local_roles values
  ('super_admin','Local Super Admin','superadmin.local@govcare.test','Gc1!55r1yqsr4o7jXQ','OPD'),
  ('hospital_admin','Local Hospital Admin','hospitaladmin.local@govcare.test','Gc1!lZI1hH0wtiLDYg','OPD'),
  ('doctor','Local Doctor','doctor.local@govcare.test','Gc1!UHwb3JruS1LgUA','OPD'),
  ('nurse','Local Nurse','nurse.local@govcare.test','Gc1!qxcQQbsBKpmMkg',''),
  ('receptionist','Local Front Desk Officer','receptionist.local@govcare.test','Gc1!zadczfQ_YSr-DQ','OPD'),
  ('opd_officer','Local OPD Officer','opdofficer.local@govcare.test','Gc1!RkbSR0rBjP3zEQ','OPD'),
  ('ward_manager','Local Ward Manager','wardmanager.local@govcare.test','Gc1!6Z6fDOc69uhc-Q',''),
  ('lab_technician','Local Laboratory Technician','labtechnician.local@govcare.test','Gc1!t0DT1FakFOPOHQ','LAB'),
  ('radiology_technician','Local Radiology Technician','radiologytechnician.local@govcare.test','Gc1!Ne1gd2jFvFeb_Q','RAD'),
  ('pharmacist','Local Pharmacist','pharmacist.local@govcare.test','Gc1!dAqqoMhZunVpWQ','PHA'),
  ('inventory_officer','Local Inventory Officer','inventoryofficer.local@govcare.test','Gc1!5FX0ZqW9_Za8fA','PHA'),
  ('finance_officer','Local Finance Officer','financeofficer.local@govcare.test','Gc1!pFbDRtgEL_gsng',''),
  ('records_officer','Local Records Officer','recordsofficer.local@govcare.test','Gc1!XFYZsf-BYhOo-Q','OPD'),
  ('patient','Local Patient','patient.local@govcare.test','Gc1!4H3GLgBXypVHUg',''),
  ('guardian','Local Guardian','guardian.local@govcare.test','Gc1!GY603apkLvPW9A',''),
  ('emergency_staff','Local Emergency Staff','emergencystaff.local@govcare.test','Gc1!95ib1j_uqVuocA','OPD'),
  ('quality_officer','Local Quality Officer','qualityofficer.local@govcare.test','Gc1!GSY_VhWcGF7DGQ',''),
  ('ict_admin','Local IT Administrator','ictadmin.local@govcare.test','Gc1!ZTDNLMDA9ifV8A',''),
  ('surgeon','Local Surgeon','surgeon.local@govcare.test','Gc1!LeHvQZT5UV14ZQ','OPD'),
  ('anesthetist','Local Anesthetist','anesthetist.local@govcare.test','Gc1!VYZ2yRuvaDi4RQ','OPD'),
  ('lab_manager','Local Laboratory Manager','labmanager.local@govcare.test','Gc1!8AN8WEze5WMpmw','LAB'),
  ('pathologist','Local Pathologist','pathologist.local@govcare.test','Gc1!kHScmjqRD75PXg','LAB'),
  ('radiologist','Local Radiologist','radiologist.local@govcare.test','Gc1!tmwVHgWTl8jU4g','RAD'),
  ('mortuary_officer','Local Mortuary Officer','mortuaryofficer.local@govcare.test','Gc1!abTXyT2kdBFJIQ','');

-- Invalid optional identity/ward links fail rather than silently linking elsewhere.
select set_config('govcare.local_patient_no', :'patient_no', true);
select set_config('govcare.local_ward_code', :'ward_department_code', true);
do $$
begin
  if exists(select 1 from _govcare_local_roles a left join roles r on r.code=a.role_code where r.id is null) then
    raise exception 'A required role definition is missing. Complete the database upgrade first.';
  end if;
  if current_setting('govcare.local_patient_no')<>'' and
     (select patient_id is null from _govcare_local_context) then
    raise exception 'The patient number must belong to the selected hospital. No records were created.';
  end if;
  if current_setting('govcare.local_ward_code')<>'' and
     (select ward_department_id is null from _govcare_local_context) then
    raise exception 'The ward department must belong to the selected hospital.';
  end if;
end $$;

-- Do not overwrite, unlock, reset or change any existing account.
-- No hospitals, patients, clinical encounters or worklist rows are inserted.
with created as (
  insert into app_users(
    auth_uid,hospital_id,department_id,patient_id,role,role_id,full_name,email,password_hash,
    permissions,mfa_enabled,status,employee_no,job_title,employment_type,joining_date,
    work_status,must_change_password,credentials_version
  )
  select 'local-role-'||a.role_code,c.hospital_id,
    case when a.role_code in ('nurse','ward_manager') then c.ward_department_id
         else (select d.id from departments d where d.hospital_id=c.hospital_id and d.code=a.department_code and d.status='active') end,
    case when a.role_code='patient' then c.patient_id else null end,
    a.role_code::user_role,r.id,a.full_name,a.email,crypt(a.temporary_password,gen_salt('bf',12)),
    '[]'::jsonb,false,'active',next_staff_employee_no(),r.name,'temporary',current_date,
    'active',true,0
  from _govcare_local_roles a cross join _govcare_local_context c join roles r on r.code=a.role_code
  where not exists(select 1 from app_users u where lower(u.email)=lower(a.email))
  on conflict(email) do nothing
  returning email,role,status,must_change_password
)
select email,role,status,must_change_password from created order by role;

commit;
