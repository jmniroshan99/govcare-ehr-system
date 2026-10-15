create extension if not exists "pgcrypto";

-- Make role migration safe for older GovCare databases whose user_role enum
-- was created before the later laboratory/radiology roles were introduced.
alter type user_role add value if not exists 'pathologist';
alter type user_role add value if not exists 'lab_manager';
alter type user_role add value if not exists 'radiology_technician';

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  default_route text not null default '/',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  module text not null,
  action text not null,
  created_at timestamptz not null default now()
);

create table if not exists role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

alter table app_users add column if not exists role_id uuid references roles(id) on delete set null;
alter table app_users add column if not exists patient_id uuid references patients(id) on delete set null;
create index if not exists idx_app_users_role_id on app_users(role_id);
create index if not exists idx_app_users_patient_id on app_users(patient_id);

insert into roles(code,name,description,default_route) values
('super_admin','Super Admin','Access to all hospitals and system functions','/super-admin'),
('hospital_admin','Hospital Admin','Administration within one hospital','/admin/users'),
('records_officer','Records Officer','Patient registration and demographic records','/patients/register'),
('receptionist','Receptionist','Appointments, registration and OPD queue','/opd'),
('doctor','Doctor','Clinical consultation and ordering','/doctor'),
('surgeon','Surgeon','Surgical and theatre workflows','/operation-theatre'),
('anesthetist','Anesthetist','Anaesthesia and theatre workflows','/operation-theatre'),
('nurse','Nurse','Nursing and ward workflows','/nurse-notes'),
('pharmacist','Pharmacist','Prescription verification and dispensing','/pharmacy'),
('lab_technician','Laboratory Technician','Sample collection and result entry','/laboratory'),
('lab_manager','Laboratory Manager','Laboratory operations management','/laboratory'),
('pathologist','Laboratory Pathologist','Laboratory result verification','/laboratory'),
('radiology_technician','Radiology Technician','Imaging scheduling and completion','/radiology'),
('radiologist','Radiologist','Radiology reporting and verification','/radiology'),
('mortuary_officer','Mortuary Officer','Mortuary workflows','/mortuary'),
('ict_admin','ICT Admin','System operations and configuration','/settings'),
('guardian','Guardian','Linked-patient portal access','/portal'),
('patient','Patient','Self-service patient portal','/portal')
on conflict (code) do update set name=excluded.name, description=excluded.description, default_route=excluded.default_route;

insert into permissions(code,name,module,action) values
('PATIENT_CREATE','Create patients','patients','create'),
('PATIENT_VIEW','View patient demographics','patients','view'),
('PATIENT_UPDATE_DEMOGRAPHICS','Update patient demographics','patients','update_demographics'),
('PATIENT_DELETE','Archive patient records','patients','delete'),
('PATIENT_VIEW_CLINICAL','View clinical patient information','patients','view_clinical'),
('PATIENT_VIEW_SELF','View own patient record','patients','view_self'),
('APPOINTMENT_VIEW','View appointments','appointments','view'),
('APPOINTMENT_CREATE','Create appointments','appointments','create'),
('APPOINTMENT_UPDATE','Update appointments','appointments','update'),
('QUEUE_VIEW','View OPD queue','queue','view'),
('QUEUE_MANAGE','Manage OPD queue','queue','manage'),
('CONSULTATION_VIEW','View consultations','consultations','view'),
('CONSULTATION_CREATE','Create consultations','consultations','create'),
('CONSULTATION_UPDATE','Update consultations','consultations','update'),
('CONSULTATION_COMPLETE','Complete consultations','consultations','complete'),
('PRESCRIPTION_VIEW','View prescriptions','prescriptions','view'),
('PRESCRIPTION_CREATE','Create prescriptions','prescriptions','create'),
('PRESCRIPTION_SIGN','Sign prescriptions','prescriptions','sign'),
('PRESCRIPTION_VERIFY','Verify prescriptions','prescriptions','verify'),
('PRESCRIPTION_DISPENSE','Dispense prescriptions','prescriptions','dispense'),
('LAB_REQUEST_VIEW','View laboratory requests','laboratory','request_view'),
('LAB_REQUEST_CREATE','Create laboratory requests','laboratory','request_create'),
('LAB_SAMPLE_UPDATE','Update laboratory sample status','laboratory','sample_update'),
('LAB_RESULT_CREATE','Enter laboratory results','laboratory','result_create'),
('LAB_RESULT_VERIFY','Verify laboratory results','laboratory','result_verify'),
('LAB_RESULT_REVIEW','Review laboratory results','laboratory','result_review'),
('RADIOLOGY_REQUEST_VIEW','View radiology requests','radiology','request_view'),
('RADIOLOGY_REQUEST_CREATE','Create radiology requests','radiology','request_create'),
('RADIOLOGY_STATUS_UPDATE','Update radiology workflow status','radiology','status_update'),
('RADIOLOGY_RESULT_CREATE','Create radiology reports','radiology','result_create'),
('RADIOLOGY_RESULT_VERIFY','Verify radiology reports','radiology','result_verify'),
('RADIOLOGY_RESULT_REVIEW','Review radiology reports','radiology','result_review'),
('USER_VIEW','View users','users','view'),
('USER_MANAGE','Manage users','users','manage'),
('DEPARTMENT_VIEW','View departments','departments','view'),
('DEPARTMENT_MANAGE','Manage departments','departments','manage'),
('REPORT_VIEW','View reports','reports','view'),
('REPORT_DOWNLOAD','Download reports','reports','download'),
('AUDIT_VIEW','View audit logs','audit','view'),
('SETTINGS_MANAGE','Manage settings','settings','manage'),
('MEDIA_UPLOAD','Upload media','media','upload'),
('MEDIA_VIEW','View media','media','view'),
('SELF_REGISTRATION_MANAGE','Manage self-registration','self_registration','manage'),
('LOGIN_ACTIVITY_VIEW','View login activity','login_activity','view')
on conflict (code) do nothing;

-- Super Admin gets every permission.
insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r cross join permissions p where r.code='super_admin'
on conflict do nothing;

-- Hospital administration.
insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code = any(array[
 'PATIENT_CREATE','PATIENT_VIEW','PATIENT_UPDATE_DEMOGRAPHICS','PATIENT_VIEW_CLINICAL',
 'APPOINTMENT_VIEW','APPOINTMENT_CREATE','APPOINTMENT_UPDATE','QUEUE_VIEW','QUEUE_MANAGE',
 'CONSULTATION_VIEW','PRESCRIPTION_VIEW','LAB_REQUEST_VIEW','RADIOLOGY_REQUEST_VIEW',
 'USER_VIEW','USER_MANAGE','DEPARTMENT_VIEW','DEPARTMENT_MANAGE','REPORT_VIEW','REPORT_DOWNLOAD',
 'AUDIT_VIEW','SETTINGS_MANAGE','MEDIA_UPLOAD','MEDIA_VIEW','SELF_REGISTRATION_MANAGE','LOGIN_ACTIVITY_VIEW'
]) where r.code='hospital_admin' on conflict do nothing;

-- Records Officer: registration and demographic profile only.
insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code = any(array[
 'PATIENT_CREATE','PATIENT_VIEW','PATIENT_UPDATE_DEMOGRAPHICS','PATIENT_DELETE','MEDIA_UPLOAD','MEDIA_VIEW','REPORT_DOWNLOAD'
]) where r.code='records_officer' on conflict do nothing;

-- Receptionist.
insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code = any(array[
 'PATIENT_CREATE','PATIENT_VIEW','PATIENT_UPDATE_DEMOGRAPHICS','APPOINTMENT_VIEW','APPOINTMENT_CREATE','APPOINTMENT_UPDATE','QUEUE_VIEW','QUEUE_MANAGE','MEDIA_UPLOAD','MEDIA_VIEW','SELF_REGISTRATION_MANAGE'
]) where r.code='receptionist' on conflict do nothing;

-- Doctor.
insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code = any(array[
 'PATIENT_VIEW','PATIENT_VIEW_CLINICAL','APPOINTMENT_VIEW','QUEUE_VIEW','QUEUE_MANAGE',
 'CONSULTATION_VIEW','CONSULTATION_CREATE','CONSULTATION_UPDATE','CONSULTATION_COMPLETE',
 'PRESCRIPTION_VIEW','PRESCRIPTION_CREATE','PRESCRIPTION_SIGN',
 'LAB_REQUEST_VIEW','LAB_REQUEST_CREATE','LAB_RESULT_REVIEW',
 'RADIOLOGY_REQUEST_VIEW','RADIOLOGY_REQUEST_CREATE','RADIOLOGY_RESULT_REVIEW',
 'REPORT_VIEW','REPORT_DOWNLOAD','MEDIA_UPLOAD','MEDIA_VIEW'
]) where r.code in ('doctor','surgeon','anesthetist') on conflict do nothing;

-- Nurse.
insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code = any(array[
 'PATIENT_VIEW','PATIENT_VIEW_CLINICAL','APPOINTMENT_VIEW','QUEUE_VIEW','CONSULTATION_VIEW',
 'LAB_REQUEST_VIEW','RADIOLOGY_REQUEST_VIEW','REPORT_VIEW','MEDIA_UPLOAD','MEDIA_VIEW'
]) where r.code='nurse' on conflict do nothing;

-- Pharmacy.
insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code = any(array[
 'PATIENT_VIEW','PRESCRIPTION_VIEW','PRESCRIPTION_VERIFY','PRESCRIPTION_DISPENSE','REPORT_DOWNLOAD','MEDIA_VIEW'
]) where r.code='pharmacist' on conflict do nothing;

-- Laboratory technician/manager/pathologist.
insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code = any(array[
 'PATIENT_VIEW','LAB_REQUEST_VIEW','LAB_SAMPLE_UPDATE','LAB_RESULT_CREATE','REPORT_VIEW','REPORT_DOWNLOAD','MEDIA_UPLOAD','MEDIA_VIEW'
]) where r.code in ('lab_technician','lab_manager','pathologist') on conflict do nothing;
insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code = any(array['LAB_RESULT_VERIFY','LAB_RESULT_REVIEW'])
where r.code in ('lab_manager','pathologist') on conflict do nothing;

-- Radiology technician/radiologist.
insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code = any(array[
 'PATIENT_VIEW','RADIOLOGY_REQUEST_VIEW','RADIOLOGY_STATUS_UPDATE','REPORT_VIEW','REPORT_DOWNLOAD','MEDIA_UPLOAD','MEDIA_VIEW'
]) where r.code in ('radiology_technician','radiologist') on conflict do nothing;
insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code = any(array['RADIOLOGY_RESULT_CREATE','RADIOLOGY_RESULT_VERIFY','RADIOLOGY_RESULT_REVIEW'])
where r.code='radiologist' on conflict do nothing;

insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code = any(array['USER_VIEW','AUDIT_VIEW','SETTINGS_MANAGE','MEDIA_VIEW','LOGIN_ACTIVITY_VIEW'])
where r.code='ict_admin' on conflict do nothing;

insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code = any(array['PATIENT_VIEW_SELF','APPOINTMENT_VIEW','PRESCRIPTION_VIEW','LAB_REQUEST_VIEW','RADIOLOGY_REQUEST_VIEW','REPORT_DOWNLOAD','MEDIA_VIEW'])
where r.code in ('patient','guardian') on conflict do nothing;

update app_users u set role_id=r.id from roles r where r.code=u.role::text and u.role_id is null;

create or replace function sync_app_user_role_id() returns trigger as $$
begin
  select id into new.role_id from roles where code=new.role::text;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_app_user_role_id on app_users;
create trigger trg_sync_app_user_role_id before insert or update of role on app_users
for each row execute function sync_app_user_role_id();
