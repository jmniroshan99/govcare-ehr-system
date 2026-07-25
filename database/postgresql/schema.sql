-- GovCare EHR PostgreSQL schema
-- Clean SQL schema for Spring Boot + PostgreSQL production migration.

create extension if not exists "pgcrypto";

create type user_role as enum (
  'super_admin','hospital_admin','doctor','nurse','pharmacist','lab_technician','radiologist',
  'receptionist','records_officer','patient','guardian','ict_admin','surgeon','anesthetist','mortuary_officer'
);

create type record_status as enum ('active','inactive','pending','completed','cancelled','suspended','deleted');
create type release_status as enum ('internal','pending_review','released','rejected');
create type gender_value as enum ('male','female','other','prefer_not_to_say');
create type priority_level as enum ('routine','urgent','stat','critical');

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table hospitals (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  type text default 'government_hospital',
  city text,
  district text,
  province text,
  address text,
  phone text,
  email text,
  director_name text,
  settings jsonb not null default '{}'::jsonb,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table departments (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  code text not null,
  name text not null,
  type text,
  description text,
  floor text,
  contact_phone text,
  head_user_id uuid,
  status record_status not null default 'active',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hospital_id, code)
);

create table app_users (
  id uuid primary key default gen_random_uuid(),
  auth_uid text unique,
  hospital_id uuid references hospitals(id) on delete set null,
  department_id uuid references departments(id) on delete set null,
  role user_role not null,
  full_name text not null,
  email text not null unique,
  phone text,
  address text,
  profile_photo_url text,
  permissions jsonb not null default '[]'::jsonb,
  mfa_enabled boolean not null default false,
  last_login_at timestamptz,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table departments add constraint departments_head_user_fk foreign key (head_user_id) references app_users(id) on delete set null;
alter table departments add constraint departments_created_by_fk foreign key (created_by) references app_users(id) on delete set null;
alter table departments add constraint departments_updated_by_fk foreign key (updated_by) references app_users(id) on delete set null;

create table guardians (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  guardian_no text not null,
  nic text not null,
  full_name text not null,
  relationship text not null,
  address text,
  district text,
  phone text,
  email text,
  emergency_contact text,
  status record_status not null default 'active',
  created_by uuid references app_users(id),
  updated_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hospital_id, guardian_no),
  unique (hospital_id, nic)
);

create table patients (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  patient_no text not null,
  guardian_id uuid references guardians(id) on delete set null,
  nic text,
  passport_no text,
  birth_certificate_no text,
  title text,
  full_name text not null,
  preferred_name text,
  date_of_birth date not null,
  age_years integer,
  gender gender_value,
  blood_group text,
  nationality text,
  address text,
  district text,
  province text,
  phone text,
  email text,
  emergency_contact jsonb not null default '{}'::jsonb,
  language_preference text default 'en',
  profile_photo_url text,
  allergies jsonb not null default '[]'::jsonb,
  chronic_diseases jsonb not null default '[]'::jsonb,
  disabilities jsonb not null default '[]'::jsonb,
  family_history jsonb not null default '[]'::jsonb,
  risk_flags jsonb not null default '[]'::jsonb,
  qr_payload text,
  release_status release_status not null default 'internal',
  status record_status not null default 'active',
  created_by uuid references app_users(id),
  updated_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hospital_id, patient_no),
  unique (hospital_id, nic),
  unique (hospital_id, passport_no),
  unique (hospital_id, birth_certificate_no)
);

create table patient_registration_tokens (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  token_hash text not null unique,
  label text,
  expires_at timestamptz not null,
  max_uses integer not null default 100,
  uses_count integer not null default 0,
  status record_status not null default 'active',
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table visits (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  department_id uuid references departments(id),
  doctor_id uuid references app_users(id),
  visit_no text not null,
  visit_type text not null,
  reason text,
  diagnosis_summary text,
  priority priority_level not null default 'routine',
  checked_at timestamptz,
  completed_at timestamptz,
  status record_status not null default 'pending',
  created_by uuid references app_users(id),
  updated_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hospital_id, visit_no)
);

create table opd_queue (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  visit_id uuid not null references visits(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  department_id uuid references departments(id),
  doctor_id uuid references app_users(id),
  token_no text not null,
  queue_status text not null default 'waiting',
  priority priority_level not null default 'routine',
  estimated_wait_minutes integer default 0,
  called_at timestamptz,
  completed_at timestamptz,
  created_by uuid references app_users(id),
  updated_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table consultations (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  visit_id uuid not null references visits(id) on delete cascade,
  doctor_id uuid not null references app_users(id),
  chief_complaint text,
  history text,
  examination text,
  diagnosis text,
  icd10_code text,
  soap_notes jsonb not null default '{}'::jsonb,
  treatment_plan text,
  follow_up_date date,
  release_status release_status not null default 'internal',
  status record_status not null default 'completed',
  created_by uuid references app_users(id),
  updated_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table prescriptions (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  visit_id uuid references visits(id) on delete set null,
  consultation_id uuid references consultations(id) on delete set null,
  doctor_id uuid not null references app_users(id),
  prescription_no text not null,
  diagnosis text,
  priority priority_level not null default 'routine',
  digital_signature text,
  qr_payload text,
  pharmacy_status text not null default 'pending',
  release_status release_status not null default 'internal',
  status record_status not null default 'active',
  created_by uuid references app_users(id),
  updated_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hospital_id, prescription_no)
);

create table prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references prescriptions(id) on delete cascade,
  medicine_id uuid,
  medicine_name text not null,
  generic_name text,
  dosage text not null,
  route text,
  frequency text not null,
  duration text not null,
  quantity numeric(12,2),
  instructions text,
  status record_status not null default 'active'
);

create table medicines (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  name text not null,
  generic_name text,
  category text,
  dosage_form text,
  strength text,
  reorder_level numeric(12,2) default 0,
  manufacturer text,
  supplier text,
  status record_status not null default 'active',
  created_by uuid references app_users(id),
  updated_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table pharmacy_stock (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  medicine_id uuid not null references medicines(id) on delete cascade,
  batch_no text,
  quantity numeric(12,2) not null default 0,
  expiry_date date,
  location text,
  supplier text,
  received_date date,
  status record_status not null default 'active',
  created_by uuid references app_users(id),
  updated_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table pharmacy_receipts (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  prescription_id uuid not null references prescriptions(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  pharmacist_id uuid not null references app_users(id),
  receipt_no text not null,
  issued_items jsonb not null default '[]'::jsonb,
  total_items integer default 0,
  notes text,
  status record_status not null default 'completed',
  created_by uuid references app_users(id),
  updated_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hospital_id, receipt_no)
);

create table lab_requests (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  visit_id uuid references visits(id) on delete set null,
  requested_by uuid references app_users(id),
  test_type text not null,
  priority priority_level not null default 'routine',
  clinical_reason text,
  sample_status text default 'requested',
  test_status text default 'pending',
  status record_status not null default 'active',
  created_by uuid references app_users(id),
  updated_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lab_results (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  lab_request_id uuid not null references lab_requests(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  entered_by uuid references app_users(id),
  approved_by uuid references app_users(id),
  result_data jsonb not null default '{}'::jsonb,
  classification text default 'normal',
  report_url text,
  release_status release_status not null default 'internal',
  approved_at timestamptz,
  status record_status not null default 'pending',
  created_by uuid references app_users(id),
  updated_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table radiology_requests (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  visit_id uuid references visits(id) on delete set null,
  requested_by uuid references app_users(id),
  imaging_type text not null,
  priority priority_level not null default 'routine',
  clinical_reason text,
  scan_status text default 'requested',
  scheduled_at timestamptz,
  room text,
  status record_status not null default 'active',
  created_by uuid references app_users(id),
  updated_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table radiology_reports (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  radiology_request_id uuid not null references radiology_requests(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  radiologist_id uuid references app_users(id),
  findings text,
  impression text,
  classification text default 'normal',
  image_urls jsonb not null default '[]'::jsonb,
  report_url text,
  release_status release_status not null default 'internal',
  approved_at timestamptz,
  status record_status not null default 'pending',
  created_by uuid references app_users(id),
  updated_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table wards (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  department_id uuid references departments(id),
  ward_no text,
  name text not null,
  category text not null check (category in ('male','female','children','icu','hdu','isolation')),
  floor text,
  capacity integer default 0,
  nurse_station text,
  status record_status not null default 'active',
  created_by uuid references app_users(id),
  updated_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table beds (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  ward_id uuid not null references wards(id) on delete cascade,
  bed_no text not null,
  bed_type text,
  room_no text,
  floor text,
  status text not null default 'available',
  current_patient_id uuid references patients(id) on delete set null,
  current_admission_id uuid,
  last_cleaned_at timestamptz,
  created_by uuid references app_users(id),
  updated_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ward_id, bed_no)
);

create table admissions (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  visit_id uuid references visits(id) on delete set null,
  ward_id uuid references wards(id),
  bed_id uuid references beds(id),
  consultant_id uuid references app_users(id),
  admission_no text not null,
  reason text,
  provisional_diagnosis text,
  priority priority_level not null default 'routine',
  admitted_at timestamptz not null default now(),
  discharged_at timestamptz,
  status record_status not null default 'active',
  created_by uuid references app_users(id),
  updated_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hospital_id, admission_no)
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  doctor_id uuid references app_users(id),
  department_id uuid references departments(id),
  appointment_type text not null,
  scheduled_at timestamptz not null,
  queue_no text,
  mode text default 'physical',
  location text,
  status record_status not null default 'pending',
  created_by uuid references app_users(id),
  updated_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  target_user_id uuid references app_users(id) on delete cascade,
  target_role user_role,
  title text not null,
  message text not null,
  module text,
  priority priority_level not null default 'routine',
  read_at timestamptz,
  action_url text,
  group_key text,
  status record_status not null default 'active',
  created_by uuid references app_users(id),
  updated_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid references hospitals(id) on delete set null,
  actor_id uuid references app_users(id) on delete set null,
  actor_role user_role,
  module text not null,
  action text not null,
  entity_type text,
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  ip_address text,
  device_info text,
  created_at timestamptz not null default now()
);

create table login_activities (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid references hospitals(id) on delete set null,
  user_id uuid references app_users(id) on delete set null,
  full_name text,
  role user_role,
  department_name text,
  email text,
  login_status text not null check (login_status in ('success','failed')),
  logout_status text default 'unknown',
  login_time timestamptz not null default now(),
  logout_time timestamptz,
  session_duration_seconds integer,
  ip_address text,
  device_browser text,
  operating_system text,
  location text,
  authentication_method text,
  failure_reason text,
  last_activity_time timestamptz,
  created_at timestamptz not null default now()
);

create table global_media (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  patient_id uuid references patients(id) on delete cascade,
  uploaded_by uuid references app_users(id),
  uploader_role text,
  module text not null,
  file_url text not null,
  file_path text,
  file_name text,
  original_file_name text,
  mime_type text,
  file_size_bytes bigint,
  sha256_checksum text,
  storage_provider text not null default 'spring-local',
  visibility_level text not null default 'private',
  metadata jsonb not null default '{}'::jsonb,
  release_status text not null default 'internal' check (release_status in ('internal','pending_review','released','rejected')),
  released_by uuid references app_users(id),
  released_at timestamptz,
  status text not null default 'active' check (status in ('active','inactive','pending','completed','cancelled','suspended','deleted')),
  created_at timestamptz not null default now()
);

create table system_settings (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid references hospitals(id) on delete cascade,
  key text not null,
  category text not null default 'general',
  description text,
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  status record_status not null default 'active',
  created_by uuid references app_users(id),
  updated_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hospital_id, key)
);

create index idx_users_hospital_role on app_users (hospital_id, role, status);
create index idx_patients_hospital_name on patients (hospital_id, full_name);
create index idx_patients_hospital_phone on patients (hospital_id, phone);
create index idx_visits_patient_created on visits (patient_id, created_at desc);
create index idx_opd_queue_hospital_status on opd_queue (hospital_id, queue_status, created_at);
create index idx_prescriptions_patient_created on prescriptions (patient_id, created_at desc);
create index idx_lab_requests_hospital_status on lab_requests (hospital_id, test_status, created_at desc);
create index idx_radiology_requests_hospital_status on radiology_requests (hospital_id, scan_status, created_at desc);
create index idx_admissions_hospital_status on admissions (hospital_id, status, admitted_at desc);
create index idx_notifications_target on notifications (target_user_id, read_at, created_at desc);
create index idx_audit_logs_hospital_time on audit_logs (hospital_id, created_at desc);
create index idx_login_activities_hospital_time on login_activities (hospital_id, login_time desc);
create index idx_global_media_patient on global_media (patient_id, created_at desc);

create trigger hospitals_updated_at before update on hospitals for each row execute function set_updated_at();
create trigger departments_updated_at before update on departments for each row execute function set_updated_at();
create trigger users_updated_at before update on app_users for each row execute function set_updated_at();
create trigger guardians_updated_at before update on guardians for each row execute function set_updated_at();
create trigger patients_updated_at before update on patients for each row execute function set_updated_at();
create trigger visits_updated_at before update on visits for each row execute function set_updated_at();
create trigger opd_queue_updated_at before update on opd_queue for each row execute function set_updated_at();
create trigger consultations_updated_at before update on consultations for each row execute function set_updated_at();
create trigger prescriptions_updated_at before update on prescriptions for each row execute function set_updated_at();
create trigger medicines_updated_at before update on medicines for each row execute function set_updated_at();
create trigger pharmacy_stock_updated_at before update on pharmacy_stock for each row execute function set_updated_at();
create trigger pharmacy_receipts_updated_at before update on pharmacy_receipts for each row execute function set_updated_at();
create trigger lab_requests_updated_at before update on lab_requests for each row execute function set_updated_at();
create trigger lab_results_updated_at before update on lab_results for each row execute function set_updated_at();
create trigger radiology_requests_updated_at before update on radiology_requests for each row execute function set_updated_at();
create trigger radiology_reports_updated_at before update on radiology_reports for each row execute function set_updated_at();
create trigger wards_updated_at before update on wards for each row execute function set_updated_at();
create trigger beds_updated_at before update on beds for each row execute function set_updated_at();
create trigger admissions_updated_at before update on admissions for each row execute function set_updated_at();
create trigger appointments_updated_at before update on appointments for each row execute function set_updated_at();
create trigger notifications_updated_at before update on notifications for each row execute function set_updated_at();
create trigger system_settings_updated_at before update on system_settings for each row execute function set_updated_at();
