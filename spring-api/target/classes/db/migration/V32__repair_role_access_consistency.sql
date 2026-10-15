-- Repair access metadata without resetting passwords, MFA or account status.
update app_users u set role_id = r.id
from roles r where r.code = u.role::text and u.role_id is distinct from r.id;

update roles set default_route = case
  when code = 'super_admin' then '/super-admin'
  when code in ('patient','guardian') then '/portal'
  else '/' end,
  updated_at = now();
update roles set name='Front Desk Officer' where code='receptionist';
update roles set name='IT Administrator' where code='ict_admin';

-- OPD registration and emergency capacity are existing governed workflows.
insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code=any(array[
  'PATIENT_CREATE','PATIENT_UPDATE_DEMOGRAPHICS','SELF_REGISTRATION_MANAGE'
]) where r.code='opd_officer' on conflict do nothing;

insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code=any(array[
  'WARD_VIEW','BED_VIEW'
]) where r.code='emergency_staff' on conflict do nothing;

-- Local role accounts are provisioned separately and never by Flyway.
