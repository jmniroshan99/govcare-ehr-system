-- Secure inter-department patient document sharing and centralized PDF registry.

create table if not exists patient_documents (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  encounter_id uuid references visits(id) on delete set null,
  consultation_id uuid references consultations(id) on delete set null,
  prescription_id uuid references prescriptions(id) on delete set null,
  laboratory_request_id uuid references lab_requests(id) on delete set null,
  radiology_request_id uuid references radiology_requests(id) on delete set null,
  admission_id uuid references admissions(id) on delete set null,
  source_department_id uuid references departments(id) on delete set null,
  document_type text not null,
  title text not null,
  description text,
  file_name text not null,
  original_file_name text,
  mime_type text not null,
  file_size_bytes bigint not null default 0,
  storage_key text not null,
  sha256_checksum text,
  document_status text not null default 'DRAFT',
  patient_release_status text not null default 'NOT_RELEASED',
  visibility_level text not null default 'DEPARTMENT',
  created_by uuid not null references app_users(id) on delete restrict,
  verified_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_at timestamptz,
  released_at timestamptz,
  archived_at timestamptz,
  constraint chk_patient_documents_type check (document_type in (
    'PATIENT_REGISTRATION','PATIENT_ID_CARD','CONSULTATION_REPORT','PRESCRIPTION',
    'PHARMACY_DISPENSING_REPORT','LABORATORY_REQUEST','LABORATORY_RESULT',
    'RADIOLOGY_REQUEST','RADIOLOGY_RESULT','ADMISSION_REPORT','DISCHARGE_SUMMARY',
    'NURSING_REPORT','EMERGENCY_REPORT','OPERATION_THEATRE_REPORT','REFERRAL_LETTER',
    'CONSENT_FORM','MEDICAL_CERTIFICATE','OTHER_CLINICAL_DOCUMENT'
  )),
  constraint chk_patient_documents_status check (document_status in (
    'DRAFT','SUBMITTED','VERIFIED','REJECTED','CANCELLED','ARCHIVED'
  )),
  constraint chk_patient_documents_release check (patient_release_status in (
    'NOT_RELEASED','RELEASED_TO_PATIENT','WITHHELD','REVOKED'
  )),
  constraint chk_patient_documents_visibility check (visibility_level in (
    'PRIVATE','DEPARTMENT','CARE_TEAM','ADMINISTRATIVE','PATIENT_RELEASED'
  ))
);

create table if not exists document_department_access (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references patient_documents(id) on delete cascade,
  department_id uuid not null references departments(id) on delete cascade,
  access_type text not null,
  granted_by uuid not null references app_users(id) on delete restrict,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  constraint chk_document_department_access_type check (access_type in ('VIEW','DOWNLOAD','PRINT','VERIFY','SHARE'))
);

create unique index if not exists uq_document_department_active_access
  on document_department_access(document_id, department_id, access_type)
  where revoked_at is null;

create table if not exists document_access_logs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references patient_documents(id) on delete set null,
  patient_id uuid references patients(id) on delete set null,
  user_id uuid references app_users(id) on delete set null,
  hospital_id uuid references hospitals(id) on delete set null,
  department_id uuid references departments(id) on delete set null,
  role text,
  action text not null,
  result text not null,
  ip_address text,
  user_agent text,
  accessed_at timestamptz not null default now()
);

create index if not exists idx_patient_documents_patient on patient_documents(patient_id, created_at desc);
create index if not exists idx_patient_documents_hospital on patient_documents(hospital_id, created_at desc);
create index if not exists idx_patient_documents_department on patient_documents(source_department_id, created_at desc);
create index if not exists idx_patient_documents_type on patient_documents(document_type, document_status);
create index if not exists idx_patient_documents_release on patient_documents(patient_release_status, created_at desc);
create index if not exists idx_document_department_access_department on document_department_access(department_id, document_id);
create index if not exists idx_document_access_logs_document on document_access_logs(document_id, accessed_at desc);
create index if not exists idx_document_access_logs_patient on document_access_logs(patient_id, accessed_at desc);

create or replace function touch_patient_document_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_patient_document_updated_at on patient_documents;
create trigger trg_touch_patient_document_updated_at
before update on patient_documents
for each row execute function touch_patient_document_updated_at();

insert into permissions(code,name,module,action) values
('PATIENT_VIEW_DEMOGRAPHICS','View patient demographic details','patients','view_demographics'),
('PATIENT_VIEW_ASSIGNED','View assigned patient records','patients','view_assigned'),
('DOCUMENT_CREATE','Create patient documents','documents','create'),
('DOCUMENT_VIEW','View patient documents','documents','view'),
('DOCUMENT_VIEW_CLINICAL','View clinical patient documents','documents','view_clinical'),
('DOCUMENT_VIEW_DEPARTMENT','View documents assigned to a department','documents','view_department'),
('DOCUMENT_VIEW_ALL_HOSPITAL','View permitted documents across a hospital','documents','view_hospital'),
('DOCUMENT_DOWNLOAD','Download patient documents','documents','download'),
('DOCUMENT_PRINT','Print patient documents','documents','print'),
('DOCUMENT_VERIFY','Verify patient documents','documents','verify'),
('DOCUMENT_REJECT','Reject patient documents','documents','reject'),
('DOCUMENT_RELEASE_TO_PATIENT','Release documents to the patient','documents','release_patient'),
('DOCUMENT_REVOKE_PATIENT_RELEASE','Revoke patient document release','documents','revoke_patient'),
('DOCUMENT_SHARE','Share verified documents with departments','documents','share'),
('DOCUMENT_ARCHIVE','Archive patient documents','documents','archive'),
('DOCUMENT_AUDIT_VIEW','View patient document audit history','documents','audit_view'),
('LAB_RESULT_VIEW','View laboratory result documents','laboratory','result_view'),
('RADIOLOGY_RESULT_VIEW','View radiology result documents','radiology','result_view'),
('PHARMACY_DISPENSE','Record medicine dispensing','pharmacy','dispense')
on conflict (code) do nothing;

-- Governance roles can administer metadata and sharing policies, but are not granted unrestricted clinical-document access.
insert into role_permissions(role_id, permission_id)
select r.id,p.id from roles r join permissions p on p.code = any(array[
 'DOCUMENT_VIEW','DOCUMENT_SHARE','DOCUMENT_ARCHIVE','DOCUMENT_AUDIT_VIEW','DOCUMENT_VIEW_ALL_HOSPITAL'
]) where r.code in ('super_admin','hospital_admin') on conflict do nothing;

insert into role_permissions(role_id, permission_id)
select r.id,p.id from roles r join permissions p on p.code = any(array[
 'PATIENT_VIEW_DEMOGRAPHICS','DOCUMENT_VIEW','DOCUMENT_DOWNLOAD','DOCUMENT_PRINT'
]) where r.code in ('records_officer','receptionist') on conflict do nothing;

insert into role_permissions(role_id, permission_id)
select r.id,p.id from roles r join permissions p on p.code = any(array[
 'PATIENT_VIEW_DEMOGRAPHICS','PATIENT_VIEW_ASSIGNED','DOCUMENT_CREATE','DOCUMENT_VIEW',
 'DOCUMENT_VIEW_CLINICAL','DOCUMENT_VIEW_DEPARTMENT','DOCUMENT_DOWNLOAD','DOCUMENT_PRINT',
 'DOCUMENT_SHARE','DOCUMENT_RELEASE_TO_PATIENT','DOCUMENT_REVOKE_PATIENT_RELEASE','DOCUMENT_AUDIT_VIEW',
 'LAB_RESULT_VIEW','RADIOLOGY_RESULT_VIEW'
]) where r.code in ('doctor','surgeon','anesthetist') on conflict do nothing;

insert into role_permissions(role_id, permission_id)
select r.id,p.id from roles r join permissions p on p.code = any(array[
 'PATIENT_VIEW_DEMOGRAPHICS','PATIENT_VIEW_ASSIGNED','DOCUMENT_CREATE','DOCUMENT_VIEW',
 'DOCUMENT_VIEW_CLINICAL','DOCUMENT_VIEW_DEPARTMENT','DOCUMENT_DOWNLOAD','DOCUMENT_PRINT',
 'LAB_RESULT_VIEW','RADIOLOGY_RESULT_VIEW'
]) where r.code='nurse' on conflict do nothing;

insert into role_permissions(role_id, permission_id)
select r.id,p.id from roles r join permissions p on p.code = any(array[
 'PATIENT_VIEW_DEMOGRAPHICS','DOCUMENT_CREATE','DOCUMENT_VIEW','DOCUMENT_VIEW_CLINICAL',
 'DOCUMENT_VIEW_DEPARTMENT','DOCUMENT_DOWNLOAD','DOCUMENT_PRINT','LAB_RESULT_VIEW'
]) where r.code='lab_technician' on conflict do nothing;

insert into role_permissions(role_id, permission_id)
select r.id,p.id from roles r join permissions p on p.code = any(array[
 'PATIENT_VIEW_DEMOGRAPHICS','DOCUMENT_CREATE','DOCUMENT_VIEW','DOCUMENT_VIEW_CLINICAL',
 'DOCUMENT_VIEW_DEPARTMENT','DOCUMENT_DOWNLOAD','DOCUMENT_PRINT','DOCUMENT_VERIFY',
 'DOCUMENT_REJECT','DOCUMENT_RELEASE_TO_PATIENT','DOCUMENT_REVOKE_PATIENT_RELEASE',
 'DOCUMENT_SHARE','DOCUMENT_AUDIT_VIEW','LAB_RESULT_VIEW'
]) where r.code in ('lab_manager','pathologist') on conflict do nothing;

insert into role_permissions(role_id, permission_id)
select r.id,p.id from roles r join permissions p on p.code = any(array[
 'PATIENT_VIEW_DEMOGRAPHICS','DOCUMENT_CREATE','DOCUMENT_VIEW','DOCUMENT_VIEW_CLINICAL',
 'DOCUMENT_VIEW_DEPARTMENT','DOCUMENT_DOWNLOAD','DOCUMENT_PRINT','RADIOLOGY_RESULT_VIEW'
]) where r.code='radiology_technician' on conflict do nothing;

insert into role_permissions(role_id, permission_id)
select r.id,p.id from roles r join permissions p on p.code = any(array[
 'PATIENT_VIEW_DEMOGRAPHICS','DOCUMENT_CREATE','DOCUMENT_VIEW','DOCUMENT_VIEW_CLINICAL',
 'DOCUMENT_VIEW_DEPARTMENT','DOCUMENT_DOWNLOAD','DOCUMENT_PRINT','DOCUMENT_VERIFY',
 'DOCUMENT_REJECT','DOCUMENT_RELEASE_TO_PATIENT','DOCUMENT_REVOKE_PATIENT_RELEASE',
 'DOCUMENT_SHARE','DOCUMENT_AUDIT_VIEW','RADIOLOGY_RESULT_VIEW'
]) where r.code='radiologist' on conflict do nothing;

insert into role_permissions(role_id, permission_id)
select r.id,p.id from roles r join permissions p on p.code = any(array[
 'PATIENT_VIEW_DEMOGRAPHICS','DOCUMENT_CREATE','DOCUMENT_VIEW','DOCUMENT_VIEW_DEPARTMENT',
 'DOCUMENT_DOWNLOAD','DOCUMENT_PRINT','PHARMACY_DISPENSE'
]) where r.code='pharmacist' on conflict do nothing;

insert into role_permissions(role_id, permission_id)
select r.id,p.id from roles r join permissions p on p.code = any(array[
 'DOCUMENT_VIEW','DOCUMENT_DOWNLOAD'
]) where r.code in ('patient','guardian') on conflict do nothing;

-- Register existing patient-related PDF uploads in the central document index without moving their files.
insert into patient_documents(
  id,hospital_id,patient_id,source_department_id,document_type,title,description,file_name,
  original_file_name,mime_type,file_size_bytes,storage_key,sha256_checksum,document_status,
  patient_release_status,visibility_level,created_by,created_at,updated_at,released_at
)
select
  gm.id,gm.hospital_id,gm.patient_id,u.department_id,
  case lower(coalesce(gm.module,''))
    when 'laboratory' then 'LABORATORY_RESULT'
    when 'radiology' then 'RADIOLOGY_RESULT'
    when 'pharmacy' then 'PRESCRIPTION'
    when 'consultation' then 'CONSULTATION_REPORT'
    when 'admissions' then 'ADMISSION_REPORT'
    when 'ward' then 'NURSING_REPORT'
    when 'emergency' then 'EMERGENCY_REPORT'
    else 'OTHER_CLINICAL_DOCUMENT'
  end,
  coalesce(gm.original_file_name,gm.file_name,'Imported patient document'),
  'Imported from the legacy GovCare media registry',
  coalesce(gm.file_name,gm.id::text || '.pdf'),gm.original_file_name,
  coalesce(gm.mime_type,'application/pdf'),coalesce(gm.file_size_bytes,0),
  coalesce(gm.file_path,gm.file_name,gm.id::text || '.pdf'),gm.sha256_checksum,
  case when gm.release_status='released' then 'VERIFIED' else 'SUBMITTED' end,
  case when gm.release_status='released' then 'RELEASED_TO_PATIENT' else 'NOT_RELEASED' end,
  case when gm.release_status='released' then 'PATIENT_RELEASED' when gm.visibility_level='care-team' then 'CARE_TEAM' else 'DEPARTMENT' end,
  gm.uploaded_by,gm.created_at,gm.created_at,gm.released_at
from global_media gm
left join app_users u on u.id=gm.uploaded_by
where gm.patient_id is not null
  and gm.uploaded_by is not null
  and gm.status='active'
  and (lower(coalesce(gm.mime_type,''))='application/pdf' or lower(coalesce(gm.original_file_name,gm.file_name,'')) like '%.pdf')
on conflict (id) do nothing;
