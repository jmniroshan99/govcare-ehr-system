-- Super Admin hospital-network master-data administration.
-- Operational records remain protected by the existing ward/bed permissions.

insert into permissions(code,name,module,action)
values('HOSPITAL_MANAGE','Create and manage hospitals','hospitals','manage')
on conflict(code) do update set
  name=excluded.name,
  module=excluded.module,
  action=excluded.action;

insert into role_permissions(role_id,permission_id)
select r.id,p.id
from roles r
join permissions p on p.code='HOSPITAL_MANAGE'
where r.code='super_admin'
on conflict do nothing;

-- Keep the network owner complete when future installations skipped an older
-- additive permission grant.
insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r cross join permissions p where r.code='super_admin'
on conflict do nothing;
