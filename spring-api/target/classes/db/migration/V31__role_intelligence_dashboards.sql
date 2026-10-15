-- Role-specific hospital intelligence dashboards.
-- This migration is additive: existing staff accounts, role assignments and
-- clinical workflow permissions remain unchanged.

alter type user_role add value if not exists 'opd_officer';
alter type user_role add value if not exists 'ward_manager';
alter type user_role add value if not exists 'inventory_officer';
alter type user_role add value if not exists 'finance_officer';
alter type user_role add value if not exists 'emergency_staff';
alter type user_role add value if not exists 'quality_officer';

insert into roles(code,name,description,default_route) values
  ('opd_officer','OPD Officer','OPD queue and patient-flow operations','/'),
  ('ward_manager','Ward Manager','Ward capacity, admissions and bed operations','/'),
  ('inventory_officer','Inventory Officer','Medicine stock, expiry and inventory oversight','/'),
  ('finance_officer','Finance Officer','Financial reporting and revenue-cycle oversight','/'),
  ('emergency_staff','Emergency Staff','Emergency arrivals, escalation and admission coordination','/'),
  ('quality_officer','Quality Officer','Quality, safety and operational compliance analytics','/')
on conflict (code) do update set
  name=excluded.name,
  description=excluded.description,
  default_route=excluded.default_route;

insert into permissions(code,name,module,action) values
  ('DASHBOARD_VIEW','View role intelligence dashboard','dashboard','view'),
  ('INVENTORY_VIEW','View medicine inventory analytics','inventory','view'),
  ('INVENTORY_MANAGE','Manage medicine inventory','inventory','manage'),
  ('FINANCE_VIEW','View finance analytics','finance','view'),
  ('EMERGENCY_VIEW','View emergency operations analytics','emergency','view'),
  ('QUALITY_VIEW','View quality and safety analytics','quality','view'),
  ('SYSTEM_MONITOR_VIEW','View system monitoring analytics','system','monitor')
on conflict (code) do nothing;

-- Every authenticated role receives only its own dashboard payload. The API
-- still applies hospital, assignment and patient-self scope to every query.
insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code='DASHBOARD_VIEW'
where r.code in (
  'super_admin','hospital_admin','doctor','surgeon','anesthetist','nurse',
  'receptionist','opd_officer','ward_manager','lab_technician','lab_manager',
  'pathologist','radiology_technician','radiologist','pharmacist',
  'inventory_officer','finance_officer','records_officer','patient','guardian',
  'emergency_staff','quality_officer','ict_admin','mortuary_officer'
)
on conflict do nothing;

insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code=any(array[
  'PATIENT_VIEW','APPOINTMENT_VIEW','APPOINTMENT_CREATE','APPOINTMENT_UPDATE',
  'QUEUE_VIEW','QUEUE_MANAGE','REPORT_VIEW'
]) where r.code='opd_officer'
on conflict do nothing;

insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code=any(array[
  'PATIENT_VIEW','PATIENT_VIEW_CLINICAL','WARD_VIEW','WARD_MANAGE','ROOM_MANAGE',
  'BED_VIEW','BED_MANAGE','BED_ALLOCATE','BED_RESERVE','BED_BLOCK','BED_RELEASE',
  'ADMISSION_VIEW','ADMISSION_APPROVE','ADMISSION_DISCHARGE','ADMISSION_TRANSFER',
  'WARD_PATIENT_LIST','INTERNAL_TRANSFER_APPROVE','INTERNAL_TRANSFER_ACCEPT',
  'INTERNAL_TRANSFER_COMPLETE','REPORT_VIEW'
]) where r.code='ward_manager'
on conflict do nothing;

insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code=any(array[
  'INVENTORY_VIEW','INVENTORY_MANAGE','REPORT_VIEW','REPORT_DOWNLOAD'
]) where r.code='inventory_officer'
on conflict do nothing;

insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code=any(array[
  'FINANCE_VIEW','REPORT_VIEW','REPORT_DOWNLOAD'
]) where r.code='finance_officer'
on conflict do nothing;

insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code=any(array[
  'EMERGENCY_VIEW','PATIENT_VIEW','PATIENT_VIEW_CLINICAL','QUEUE_VIEW','QUEUE_MANAGE',
  'ADMISSION_VIEW','ADMISSION_CREATE','PATIENT_IDENTITY_CONFIRM','REPORT_VIEW'
]) where r.code='emergency_staff'
on conflict do nothing;

insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code=any(array[
  'QUALITY_VIEW','REPORT_VIEW','REPORT_DOWNLOAD','AUDIT_VIEW'
]) where r.code='quality_officer'
on conflict do nothing;

insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code='SYSTEM_MONITOR_VIEW'
where r.code='ict_admin'
on conflict do nothing;

-- Super Admin must receive permissions added after the original RBAC migration.
insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r cross join permissions p where r.code='super_admin'
on conflict do nothing;

-- The intelligence dashboard is the default landing page for staff. Patient
-- and guardian accounts continue to use the privacy-scoped portal route.
update roles set default_route='/'
where code not in ('patient','guardian');
update roles set default_route='/portal'
where code in ('patient','guardian');

-- Bounded dashboard reads. Existing indexes are retained; these are additive
-- and match the hospital/time/assignee predicates used by the new endpoint.
create index if not exists idx_dashboard_users_hospital_role_status
  on app_users(hospital_id,role,status);
create index if not exists idx_dashboard_patients_hospital_created
  on patients(hospital_id,created_at) where status<>'deleted';
create index if not exists idx_dashboard_visits_hospital_created_doctor
  on visits(hospital_id,created_at,doctor_id);
create index if not exists idx_dashboard_appointments_hospital_scheduled_doctor
  on appointments(hospital_id,scheduled_at,doctor_id,status);
create index if not exists idx_dashboard_consultations_hospital_doctor_completed
  on consultations(hospital_id,doctor_id,completed_at,created_at);
create index if not exists idx_dashboard_admissions_hospital_dates
  on admissions(hospital_id,admitted_at,discharged_at,status);
create index if not exists idx_dashboard_lab_hospital_created_workflow
  on lab_requests(hospital_id,created_at,workflow_status);
create index if not exists idx_dashboard_radiology_hospital_created_workflow
  on radiology_requests(hospital_id,created_at,workflow_status);
create index if not exists idx_dashboard_prescriptions_hospital_created_workflow
  on prescriptions(hospital_id,created_at,workflow_status,pharmacy_status);
create index if not exists idx_dashboard_login_hospital_time_status
  on login_activities(hospital_id,login_time,login_status);
create index if not exists idx_dashboard_audit_hospital_time_action
  on audit_logs(hospital_id,created_at,action);
