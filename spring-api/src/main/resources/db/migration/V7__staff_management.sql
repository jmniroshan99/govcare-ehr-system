-- GovCare EHR staff-management extension.
-- Adds safe staff employment/account fields without changing existing workflows.

create sequence if not exists staff_employee_no_seq start with 1 increment by 1;

create or replace function next_staff_employee_no()
returns text as $$
begin
  return 'STAFF-' || extract(year from current_date)::int || '-' || lpad(nextval('staff_employee_no_seq')::text, 6, '0');
end;
$$ language plpgsql;

alter table app_users
  add column if not exists employee_no text,
  add column if not exists title text,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists national_id text,
  add column if not exists date_of_birth date,
  add column if not exists gender text,
  add column if not exists professional_registration_no text,
  add column if not exists job_title text,
  add column if not exists employment_type text,
  add column if not exists joining_date date,
  add column if not exists work_status text not null default 'active',
  add column if not exists must_change_password boolean not null default true,
  add column if not exists created_by uuid references app_users(id) on delete set null;

update app_users set must_change_password=false;
update app_users set work_status=case when status='active' then 'active' when status='suspended' then 'suspended' else 'inactive' end;

update app_users
set employee_no = 'STAFF-' || extract(year from current_date)::int || '-' || lpad(nextval('staff_employee_no_seq')::text, 6, '0')
where employee_no is null;

alter table app_users alter column employee_no set default next_staff_employee_no();
alter table app_users alter column employee_no set not null;

create unique index if not exists uq_app_users_employee_no on app_users(employee_no);
create unique index if not exists uq_app_users_email_lower on app_users(lower(email));
create index if not exists idx_app_users_hospital_id on app_users(hospital_id);
create index if not exists idx_app_users_department_id on app_users(department_id);
create index if not exists idx_app_users_status on app_users(status);
create index if not exists idx_app_users_created_by on app_users(created_by);

alter table app_users drop constraint if exists chk_app_users_employment_type;
alter table app_users add constraint chk_app_users_employment_type
  check (employment_type is null or employment_type in ('permanent','contract','temporary','visiting'));

alter table app_users drop constraint if exists chk_app_users_work_status;
alter table app_users add constraint chk_app_users_work_status
  check (work_status in ('active','on_leave','suspended','inactive'));

-- Add commonly used departments for every active hospital when missing.
insert into departments(hospital_id,code,name,type,status)
select h.id,x.code,x.name,x.type,'active'::record_status
from hospitals h
cross join (values
  ('ADMIN','Administration','administrative'),
  ('RECORDS','Medical Records','administrative'),
  ('RECEPTION','Reception','administrative'),
  ('MEDWARD','Medical Ward','clinical'),
  ('SURGWARD','Surgical Ward','clinical'),
  ('PAEDS','Paediatrics','clinical'),
  ('EMERGENCY','Emergency Department','clinical')
) as x(code,name,type)
where h.status='active'
on conflict(hospital_id,code) do nothing;

update roles set default_route='/admin/staff' where code='hospital_admin';
