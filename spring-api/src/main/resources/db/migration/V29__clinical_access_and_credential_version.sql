-- Existing access tokens carry no credential version and become invalid on deployment.
-- A password change or staff reset increments this value and revokes earlier tokens.
alter table app_users add column if not exists credentials_version bigint not null default 0;

-- Records officers manage registration and demographics, not patient deletion
-- or the clinical admission workflow.
delete from role_permissions rp
using roles r, permissions p
where rp.role_id=r.id and rp.permission_id=p.id
  and r.code='records_officer'
  and p.code in ('PATIENT_DELETE','ADMISSION_CREATE');

-- Permit registration staff to upload administrative patient media through
-- the governed document registry; type checks still bar clinical documents.
insert into role_permissions(role_id, permission_id)
select r.id,p.id from roles r join permissions p on p.code='DOCUMENT_CREATE'
where r.code in ('records_officer','receptionist')
on conflict do nothing;
