-- GovCare EHR PostgreSQL schema
-- Clean SQL schema for Spring Boot + PostgreSQL production migration.

create extension if not exists "pgcrypto";

create type user_role as enum (
  'super_admin','hospital_admin','doctor','nurse','pharmacist','lab_technician','radiologist',
  'receptionist','records_officer','patient','guardian','ict_admin','surgeon','anesthetist','mortuary_officer',
  'pathologist','lab_manager','radiology_technician'
);

create type record_status as enum ('active','inactive','pending','completed','cancelled','suspended','blocked','archived','deleted');
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
  password_hash text not null default crypt('GovCare@123', gen_salt('bf')),
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
  session_id text,
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
-- GovCare EHR Sri Lanka production-demo seed data.
-- Load after database/postgresql/schema.sql.
-- Purpose: make the project suitable for Sri Lankan government/private hospital demos.
-- Coverage: inserts a minimum of 10 connected rows into every table in schema.sql.

create or replace function govcare_seed_uuid(scope text, n integer)
returns uuid as $$
  select (
    substr(md5(scope || ':' || n::text), 1, 8) || '-' ||
    substr(md5(scope || ':' || n::text), 9, 4) || '-' ||
    substr(md5(scope || ':' || n::text), 13, 4) || '-' ||
    substr(md5(scope || ':' || n::text), 17, 4) || '-' ||
    substr(md5(scope || ':' || n::text), 21, 12)
  )::uuid;
$$ language sql immutable;

do $$
declare
  g integer;
  hospital_names text[] := array[
    'National Hospital of Sri Lanka','Colombo South Teaching Hospital','Kandy National Hospital',
    'Karapitiya Teaching Hospital','Jaffna Teaching Hospital','Anuradhapura Teaching Hospital',
    'Rathnapura General Hospital','Badulla Provincial General Hospital','Asiri Central Hospital','Durdans Hospital'
  ];
  cities text[] := array['Colombo','Kalubowila','Kandy','Galle','Jaffna','Anuradhapura','Rathnapura','Badulla','Colombo','Colombo'];
  districts text[] := array['Colombo','Colombo','Kandy','Galle','Jaffna','Anuradhapura','Rathnapura','Badulla','Colombo','Colombo'];
  provinces text[] := array['Western','Western','Central','Southern','Northern','North Central','Sabaragamuwa','Uva','Western','Western'];
  dept_codes text[] := array['OPD','ETU','MED','SUR','PED','GYN','LAB','RAD','PHR','ADM'];
  dept_names text[] := array[
    'Out Patient Department','Emergency Treatment Unit','Medical Clinic','Surgical Clinic','Paediatric Clinic',
    'Gynecology Clinic','Laboratory Services','Radiology Department','Pharmacy Department','Admissions Office'
  ];
  roles user_role[] := array[
    'super_admin','hospital_admin','doctor','nurse','pharmacist','lab_technician','radiologist','receptionist','records_officer','ict_admin'
  ]::user_role[];
  user_names text[] := array[
    'Super Admin Lanka','Hospital Admin Perera','Dr. Anjali Perera','Nurse Sanduni Silva','Pharmacist Dilan Fernando',
    'Lab Tech Kavindi Silva','Dr. Radiologist Kumar','Reception Officer Fathima','Records Officer Thevarajah','ICT Admin Jayasinghe'
  ];
  emails text[] := array[
    'superadmin@govcare.gov.lk','admin@govcare.gov.lk','doctor@govcare.gov.lk','nurse@govcare.gov.lk','pharmacist@govcare.gov.lk',
    'lab@govcare.gov.lk','radiology@govcare.gov.lk','reception@govcare.gov.lk','records@govcare.gov.lk','ict@govcare.gov.lk'
  ];
  patient_names text[] := array[
    'Nimal Perera','Chandrika Silva','Baby Kaveen Perera','Fathima Ayesha','Little Thenuja Fernando',
    'Saman Bandara','Asha Kumari','Baby Arul Kumar','Ravi Jayawardena','Nazeera Farook'
  ];
  genders gender_value[] := array['male','female','male','female','female','male','female','male','male','female']::gender_value[];
  priorities priority_level[] := array['routine','routine','urgent','routine','routine','urgent','routine','stat','routine','routine']::priority_level[];
  medicines text[] := array[
    'Paracetamol 500mg','Metformin 500mg','Amoxicillin 500mg','Losartan 50mg','Salbutamol Inhaler',
    'Omeprazole 20mg','Cetirizine 10mg','Atorvastatin 20mg','ORS Sachet','Insulin Regular'
  ];
  generic_names text[] := array[
    'Paracetamol','Metformin','Amoxicillin','Losartan','Salbutamol','Omeprazole','Cetirizine','Atorvastatin','Oral Rehydration Salts','Human Insulin'
  ];
begin
  for g in 1..10 loop
    insert into hospitals (id, code, name, type, city, district, province, address, phone, email, director_name, settings, status)
    values (
      govcare_seed_uuid('hospital', g),
      'HOSP-LK-' || lpad(g::text, 3, '0'),
      hospital_names[g],
      case when g >= 9 then 'private_hospital' else 'government_hospital' end,
      cities[g], districts[g], provinces[g],
      'Main Hospital Road, ' || cities[g] || ', Sri Lanka',
      '+94 11 2' || lpad(g::text, 6, '0'),
      'hospital' || g || '@govcare.gov.lk',
      'Dr. Director ' || g,
      jsonb_build_object('country','Sri Lanka','languages',jsonb_build_array('en','si','ta'),'supportsPrivateAndGovernment',true),
      'active'
    ) on conflict (code) do update set name = excluded.name, type = excluded.type, updated_at = now();

    insert into departments (id, hospital_id, code, name, type, description, floor, contact_phone, status)
    values (
      govcare_seed_uuid('department', g), govcare_seed_uuid('hospital', g), dept_codes[g], dept_names[g],
      case when g in (7,8) then 'diagnostic' when g = 9 then 'pharmacy' when g = 10 then 'administration' else 'clinical' end,
      'Sri Lankan hospital workflow department for GovCare EHR',
      'Level ' || ((g - 1) % 5 + 1),
      '+94 11 3' || lpad(g::text, 6, '0'),
      'active'
    ) on conflict (hospital_id, code) do update set name = excluded.name, updated_at = now();

    insert into app_users (id, auth_uid, hospital_id, department_id, role, full_name, email, phone, address, permissions, mfa_enabled, status)
    values (
      govcare_seed_uuid('user', g), 'seed-auth-' || g, govcare_seed_uuid('hospital', g), govcare_seed_uuid('department', g),
      roles[g], user_names[g], emails[g], '+94 77 10' || lpad(g::text, 5, '0'), 'Staff Quarters, Sri Lanka',
      jsonb_build_array('module:read','hospital:' || g), g in (1,2,10), 'active'
    ) on conflict (email) do update set full_name = excluded.full_name, role = excluded.role, updated_at = now();

    insert into app_users (id, auth_uid, hospital_id, department_id, role, full_name, email, phone, address, permissions, mfa_enabled, status)
    values
      (govcare_seed_uuid('doctor_user', g), 'seed-doctor-' || g, govcare_seed_uuid('hospital', g), govcare_seed_uuid('department', g), 'doctor', 'Dr. Clinical Officer ' || g, 'doctor' || g || '@hospital.govcare.lk', '+94 77 21' || lpad(g::text, 5, '0'), 'Doctor Quarters, ' || cities[g], jsonb_build_array('patients:read','consultations:write','prescriptions:write'), true, 'active'),
      (govcare_seed_uuid('nurse_user', g), 'seed-nurse-' || g, govcare_seed_uuid('hospital', g), govcare_seed_uuid('department', g), 'nurse', 'Nurse Ward Officer ' || g, 'nurse' || g || '@hospital.govcare.lk', '+94 77 22' || lpad(g::text, 5, '0'), 'Nurse Quarters, ' || cities[g], jsonb_build_array('wards:read','vitals:write','nursing:write'), false, 'active'),
      (govcare_seed_uuid('pharmacist_user', g), 'seed-pharmacist-' || g, govcare_seed_uuid('hospital', g), govcare_seed_uuid('department', g), 'pharmacist', 'Pharmacist Officer ' || g, 'pharmacy' || g || '@hospital.govcare.lk', '+94 77 23' || lpad(g::text, 5, '0'), 'Pharmacy Office, ' || cities[g], jsonb_build_array('prescriptions:read','pharmacy:issue','stock:write'), false, 'active'),
      (govcare_seed_uuid('lab_user', g), 'seed-lab-' || g, govcare_seed_uuid('hospital', g), govcare_seed_uuid('department', g), 'lab_technician', 'Laboratory Technician ' || g, 'lab' || g || '@hospital.govcare.lk', '+94 77 24' || lpad(g::text, 5, '0'), 'Laboratory Unit, ' || cities[g], jsonb_build_array('lab:read','lab:write','lab:approve'), false, 'active'),
      (govcare_seed_uuid('radiologist_user', g), 'seed-radiology-' || g, govcare_seed_uuid('hospital', g), govcare_seed_uuid('department', g), 'radiologist', 'Radiologist Officer ' || g, 'radiology' || g || '@hospital.govcare.lk', '+94 77 25' || lpad(g::text, 5, '0'), 'Radiology Unit, ' || cities[g], jsonb_build_array('radiology:read','radiology:write','radiology:approve'), false, 'active'),
      (govcare_seed_uuid('reception_user', g), 'seed-reception-' || g, govcare_seed_uuid('hospital', g), govcare_seed_uuid('department', g), 'receptionist', 'Reception Officer ' || g, 'reception' || g || '@hospital.govcare.lk', '+94 77 26' || lpad(g::text, 5, '0'), 'Front Desk, ' || cities[g], jsonb_build_array('patients:create','opd:queue','appointments:write'), false, 'active'),
      (govcare_seed_uuid('ict_user', g), 'seed-ict-' || g, govcare_seed_uuid('hospital', g), govcare_seed_uuid('department', g), 'ict_admin', 'ICT Officer ' || g, 'ict' || g || '@hospital.govcare.lk', '+94 77 27' || lpad(g::text, 5, '0'), 'ICT Unit, ' || cities[g], jsonb_build_array('settings:write','audit:read','backup:write'), true, 'active')
    on conflict (email) do update set full_name = excluded.full_name, role = excluded.role, updated_at = now();

    update departments
    set head_user_id = govcare_seed_uuid('doctor_user', g)
    where id = govcare_seed_uuid('department', g);

    insert into guardians (id, hospital_id, guardian_no, nic, full_name, relationship, address, district, phone, email, emergency_contact, status, created_by, updated_by)
    values (
      govcare_seed_uuid('guardian', g), govcare_seed_uuid('hospital', g), 'GRD-2026-' || lpad(g::text, 4, '0'),
      '75' || lpad((1000000 + g)::text, 7, '0') || 'V',
      'Guardian ' || g || ' ' || districts[g],
      (array['Father','Mother','Mother','Legal Guardian','Mother','Father','Grandparent','Father','Mother','Legal Guardian'])[g],
      'No ' || g || ', Main Street, ' || districts[g], districts[g], '+94 76 20' || lpad(g::text, 5, '0'),
      'guardian' || g || '@example.lk', '+94 71 30' || lpad(g::text, 5, '0'), 'active',
      govcare_seed_uuid('reception_user', g), govcare_seed_uuid('reception_user', g)
    ) on conflict (hospital_id, guardian_no) do update set full_name = excluded.full_name, updated_at = now();

    insert into patients (
      id, hospital_id, patient_no, guardian_id, nic, passport_no, birth_certificate_no, title, full_name, preferred_name,
      date_of_birth, age_years, gender, blood_group, nationality, address, district, province, phone, email,
      emergency_contact, language_preference, profile_photo_url, allergies, chronic_diseases, disabilities, family_history,
      risk_flags, qr_payload, release_status, status, created_by, updated_by
    ) values (
      govcare_seed_uuid('patient', g), govcare_seed_uuid('hospital', g), 'PAT-2026-' || lpad(g::text, 5, '0'),
      case when g in (3,5,8) then govcare_seed_uuid('guardian', g) else null end,
      case when g in (3,5,8) then null else '90' || lpad((2000000 + g)::text, 7, '0') || 'V' end,
      case when g = 9 then 'N' || lpad(g::text, 8, '0') else null end,
      case when g in (3,5,8) then 'BC-LK-2026-' || lpad(g::text, 4, '0') else null end,
      (array['Mr','Mrs','Master','Ms','Miss','Mr','Mrs','Master','Mr','Ms'])[g],
      patient_names[g], split_part(patient_names[g], ' ', 1),
      case when g in (3,5,8) then (current_date - interval '6 years')::date else (date '1980-01-01' + (g * 900 || ' days')::interval)::date end,
      case when g in (3,5,8) then 6 else 25 + g end,
      genders[g], (array['O+','A+','B+','AB+','O-','A-','B-','O+','A+','AB-'])[g], 'Sri Lankan',
      'No ' || (100 + g) || ', Hospital Road, ' || districts[g], districts[g], provinces[g],
      '+94 70 40' || lpad(g::text, 5, '0'), 'patient' || g || '@example.lk',
      jsonb_build_object('name','Emergency Contact ' || g,'phone','+94 71 50' || lpad(g::text,5,'0'),'relationship','Family'),
      (array['si','si','en','ta','si','si','si','ta','en','ta'])[g],
      '/media/patients/PAT-2026-' || lpad(g::text, 5, '0') || '.jpg',
      case when g in (2,7) then jsonb_build_array('Penicillin') else '[]'::jsonb end,
      case when g in (1,6,9) then jsonb_build_array('Diabetes') else '[]'::jsonb end,
      case when g = 7 then jsonb_build_array('Visual impairment') else '[]'::jsonb end,
      jsonb_build_array('Family history reviewed'),
      case when g in (3,5,8) then jsonb_build_array('child_under_guardian_care') else '[]'::jsonb end,
      'GOVCARE:patient:PAT-2026-' || lpad(g::text, 5, '0'), 'released', 'active',
      govcare_seed_uuid('reception_user', g), govcare_seed_uuid('reception_user', g)
    ) on conflict (hospital_id, patient_no) do update set full_name = excluded.full_name, updated_at = now();

    insert into visits (id, hospital_id, patient_id, department_id, doctor_id, visit_no, visit_type, reason, diagnosis_summary, priority, checked_at, completed_at, status, created_by, updated_by)
    values (
      govcare_seed_uuid('visit', g), govcare_seed_uuid('hospital', g), govcare_seed_uuid('patient', g),
      govcare_seed_uuid('department', g), govcare_seed_uuid('doctor_user', g), 'VIS-2026-' || lpad(g::text, 5, '0'),
      (array['opd','clinic','emergency','opd','clinic','opd','emergency','clinic','opd','opd'])[g],
      (array['Fever','Diabetes follow-up','Child cough','Antenatal review','Vaccination','Chest discomfort','Wound review','Paediatric fever','Hypertension review','Headache'])[g],
      (array['Viral fever','Type 2 diabetes','Upper respiratory infection','Routine antenatal care','Immunization visit','Chest pain evaluation','Wound care','Dengue rule-out','Hypertension','Migraine'])[g],
      priorities[g], now() - (g || ' hours')::interval, case when g <= 7 then now() - ((g - 1) || ' hours')::interval else null end,
      (case when g <= 7 then 'completed' else 'pending' end)::record_status, govcare_seed_uuid('reception_user', g), govcare_seed_uuid('doctor_user', g)
    ) on conflict (hospital_id, visit_no) do update set status = excluded.status, updated_at = now();

    insert into opd_queue (id, hospital_id, visit_id, patient_id, department_id, doctor_id, token_no, queue_status, priority, estimated_wait_minutes, called_at, completed_at, created_by, updated_by)
    select govcare_seed_uuid('opd_queue', g), govcare_seed_uuid('hospital', g), govcare_seed_uuid('visit', g), govcare_seed_uuid('patient', g),
      govcare_seed_uuid('department', g), govcare_seed_uuid('doctor_user', g), 'TKN-' || lpad(g::text, 3, '0'),
      (array['waiting','called','in_consultation','completed','skipped','transferred','cancelled','waiting','waiting','completed'])[g],
      priorities[g], 8 * g, case when g in (2,3,4,10) then now() - (g || ' minutes')::interval else null end,
      case when g in (4,10) then now() else null end, govcare_seed_uuid('reception_user', g), govcare_seed_uuid('reception_user', g)
    where not exists (select 1 from opd_queue where id = govcare_seed_uuid('opd_queue', g));

    insert into consultations (id, hospital_id, patient_id, visit_id, doctor_id, chief_complaint, history, examination, diagnosis, icd10_code, soap_notes, treatment_plan, follow_up_date, release_status, status, created_by, updated_by)
    select govcare_seed_uuid('consultation', g), govcare_seed_uuid('hospital', g), govcare_seed_uuid('patient', g), govcare_seed_uuid('visit', g),
      govcare_seed_uuid('doctor_user', g), 'Chief complaint ' || g, 'Clinical history recorded for Sri Lanka EHR seed patient ' || g,
      'General examination stable; vitals reviewed.', 'Seed diagnosis ' || g, 'Z' || lpad(g::text, 2, '0'),
      jsonb_build_object('subjective','Recorded','objective','Vitals reviewed','assessment','Seed diagnosis','plan','Follow care plan'),
      'Treatment plan with prescription, lab/radiology if needed, and follow-up advice.', current_date + g,
      (case when g <= 5 then 'released' else 'internal' end)::release_status, 'completed'::record_status, govcare_seed_uuid('doctor_user', g), govcare_seed_uuid('doctor_user', g)
    where not exists (select 1 from consultations where id = govcare_seed_uuid('consultation', g));

    insert into medicines (id, hospital_id, name, generic_name, category, dosage_form, strength, reorder_level, manufacturer, supplier, status, created_by, updated_by)
    select govcare_seed_uuid('medicine', g), govcare_seed_uuid('hospital', g), medicines[g], generic_names[g],
      (array['Analgesic','Antidiabetic','Antibiotic','Antihypertensive','Respiratory','Gastrointestinal','Antihistamine','Lipid lowering','Rehydration','Antidiabetic'])[g],
      (array['Tablet','Tablet','Capsule','Tablet','Inhaler','Capsule','Tablet','Tablet','Sachet','Injection'])[g],
      (array['500mg','500mg','500mg','50mg','100mcg','20mg','10mg','20mg','20.5g','100IU/ml'])[g],
      50 + (g * 10), 'Sri Lanka State Pharma / Approved Supplier', 'Medical Supplies Division Supplier ' || g,
      'active', govcare_seed_uuid('pharmacist_user', g), govcare_seed_uuid('pharmacist_user', g)
    where not exists (select 1 from medicines where id = govcare_seed_uuid('medicine', g));

    insert into prescriptions (id, hospital_id, patient_id, visit_id, consultation_id, doctor_id, prescription_no, diagnosis, priority, digital_signature, qr_payload, pharmacy_status, release_status, status, created_by, updated_by)
    values (
      govcare_seed_uuid('prescription', g), govcare_seed_uuid('hospital', g), govcare_seed_uuid('patient', g), govcare_seed_uuid('visit', g),
      govcare_seed_uuid('consultation', g), govcare_seed_uuid('doctor_user', g), 'RX-2026-' || lpad(g::text, 5, '0'),
      'Seed prescription diagnosis ' || g, priorities[g], 'DIGI-SIGN-DR-ANJALI-' || g, 'GOVCARE:RX:2026:' || g,
      (array['pending','dispensed','partially_dispensed','dispensed','pending','pending','dispensed','pending','dispensed','cancelled'])[g],
      (case when g <= 6 then 'released' else 'internal' end)::release_status, 'active'::record_status, govcare_seed_uuid('doctor_user', g), govcare_seed_uuid('doctor_user', g)
    ) on conflict (hospital_id, prescription_no) do update set pharmacy_status = excluded.pharmacy_status, updated_at = now();

    insert into prescription_items (id, prescription_id, medicine_id, medicine_name, generic_name, dosage, route, frequency, duration, quantity, instructions, status)
    select govcare_seed_uuid('prescription_item', g), govcare_seed_uuid('prescription', g), govcare_seed_uuid('medicine', g),
      medicines[g], generic_names[g], (array['1 tablet','1 tablet','1 capsule','1 tablet','2 puffs','1 capsule','1 tablet','1 tablet','1 sachet','10 units'])[g],
      (array['oral','oral','oral','oral','inhalation','oral','oral','oral','oral','subcutaneous'])[g],
      (array['tds','bd','tds','daily','prn','daily','nocte','nocte','after loose stool','before meals'])[g],
      (array['3 days','30 days','5 days','30 days','as needed','14 days','5 days','30 days','2 days','7 days'])[g],
      10 + g, 'Take as advised by doctor. Provide Sinhala/Tamil/English counselling.', 'active'
    where not exists (select 1 from prescription_items where id = govcare_seed_uuid('prescription_item', g));

    insert into pharmacy_stock (id, hospital_id, medicine_id, batch_no, quantity, expiry_date, location, supplier, received_date, status, created_by, updated_by)
    select govcare_seed_uuid('pharmacy_stock', g), govcare_seed_uuid('hospital', g), govcare_seed_uuid('medicine', g),
      'BATCH-LK-' || lpad(g::text, 4, '0'), 500 - (g * 20), current_date + (180 + g * 20),
      'Main Pharmacy Rack ' || g, 'MSD Supplier ' || g, current_date - g, 'active', govcare_seed_uuid('pharmacist_user', g), govcare_seed_uuid('pharmacist_user', g)
    where not exists (select 1 from pharmacy_stock where id = govcare_seed_uuid('pharmacy_stock', g));

    insert into pharmacy_receipts (id, hospital_id, prescription_id, patient_id, pharmacist_id, receipt_no, issued_items, total_items, notes, status, created_by, updated_by)
    values (
      govcare_seed_uuid('pharmacy_receipt', g), govcare_seed_uuid('hospital', g), govcare_seed_uuid('prescription', g), govcare_seed_uuid('patient', g),
      govcare_seed_uuid('pharmacist_user', g), 'PHR-2026-' || lpad(g::text, 5, '0'),
      jsonb_build_array(jsonb_build_object('medicineId', govcare_seed_uuid('medicine', g), 'quantity', 10 + g, 'issued', g <> 3)),
      1, case when g = 3 then 'Partial issue due to stock verification.' else 'Issued after patient verification.' end,
      'completed'::record_status, govcare_seed_uuid('pharmacist_user', g), govcare_seed_uuid('pharmacist_user', g)
    ) on conflict (hospital_id, receipt_no) do update set notes = excluded.notes, updated_at = now();

    insert into lab_requests (id, hospital_id, patient_id, visit_id, requested_by, test_type, priority, clinical_reason, sample_status, test_status, status, created_by, updated_by)
    select govcare_seed_uuid('lab_request', g), govcare_seed_uuid('hospital', g), govcare_seed_uuid('patient', g), govcare_seed_uuid('visit', g),
      govcare_seed_uuid('doctor_user', g), (array['FBC','Blood Glucose','HbA1c','Urine Full Report','CRP','Dengue NS1','LFT','Creatinine','Lipid Profile','COVID-19 Antigen'])[g],
      priorities[g], 'Clinical reason for diagnostic workflow ' || g,
      (array['requested','collected','received','processing','completed','completed','received','processing','completed','collected'])[g],
      (array['pending','processing','completed','processing','completed','completed','pending','processing','completed','pending'])[g],
      'active'::record_status, govcare_seed_uuid('doctor_user', g), govcare_seed_uuid('lab_user', g)
    where not exists (select 1 from lab_requests where id = govcare_seed_uuid('lab_request', g));

    insert into lab_results (id, hospital_id, lab_request_id, patient_id, entered_by, approved_by, result_data, classification, report_url, release_status, approved_at, status, created_by, updated_by)
    select govcare_seed_uuid('lab_result', g), govcare_seed_uuid('hospital', g), govcare_seed_uuid('lab_request', g), govcare_seed_uuid('patient', g),
      govcare_seed_uuid('lab_user', g), govcare_seed_uuid('lab_user', g),
      jsonb_build_object('test','Seed lab result ' || g,'value', 10 * g,'unit','standard','referenceRange','normal clinical range'),
      (array['normal','normal','abnormal','normal','abnormal','critical','normal','abnormal','normal','normal'])[g],
      '/reports/lab/LAB-2026-' || lpad(g::text, 5, '0') || '.pdf',
      (case when g <= 8 then 'released' else 'pending_review' end)::release_status,
      case when g <= 8 then now() - (g || ' minutes')::interval else null end,
      (case when g <= 8 then 'completed' else 'pending' end)::record_status, govcare_seed_uuid('lab_user', g), govcare_seed_uuid('lab_user', g)
    where not exists (select 1 from lab_results where id = govcare_seed_uuid('lab_result', g));

    insert into radiology_requests (id, hospital_id, patient_id, visit_id, requested_by, imaging_type, priority, clinical_reason, scan_status, scheduled_at, room, status, created_by, updated_by)
    select govcare_seed_uuid('radiology_request', g), govcare_seed_uuid('hospital', g), govcare_seed_uuid('patient', g), govcare_seed_uuid('visit', g),
      govcare_seed_uuid('doctor_user', g), (array['X-Ray','Ultrasound','CT','MRI','ECG','Echo','Portable X-Ray','Dental X-Ray','Mammography','Doppler Scan'])[g],
      priorities[g], 'Imaging requested from Doctor Center workflow ' || g,
      (array['requested','scheduled','completed','scheduled','completed','requested','completed','requested','scheduled','completed'])[g],
      now() + (g || ' hours')::interval, 'RAD Room ' || ((g - 1) % 4 + 1), 'active', govcare_seed_uuid('doctor_user', g), govcare_seed_uuid('radiologist_user', g)
    where not exists (select 1 from radiology_requests where id = govcare_seed_uuid('radiology_request', g));

    insert into radiology_reports (id, hospital_id, radiology_request_id, patient_id, radiologist_id, findings, impression, classification, image_urls, report_url, release_status, approved_at, status, created_by, updated_by)
    select govcare_seed_uuid('radiology_report', g), govcare_seed_uuid('hospital', g), govcare_seed_uuid('radiology_request', g), govcare_seed_uuid('patient', g),
      govcare_seed_uuid('radiologist_user', g), 'Radiology findings documented for imaging request ' || g,
      (array['No acute abnormality','Mild inflammatory changes','Requires clinical correlation','Normal study','Borderline ECG change','Normal echo','Portable X-ray reviewed','Dental image reviewed','Screening image reviewed','Doppler flow acceptable'])[g],
      (array['normal','abnormal','abnormal','normal','abnormal','normal','critical','normal','normal','normal'])[g],
      jsonb_build_array('/media/radiology/RAD-2026-' || lpad(g::text, 5, '0') || '.jpg'),
      '/reports/radiology/RAD-2026-' || lpad(g::text, 5, '0') || '.pdf',
      (case when g <= 7 then 'released' else 'pending_review' end)::release_status,
      case when g <= 7 then now() - (g || ' minutes')::interval else null end,
      (case when g <= 7 then 'completed' else 'pending' end)::record_status, govcare_seed_uuid('radiologist_user', g), govcare_seed_uuid('radiologist_user', g)
    where not exists (select 1 from radiology_reports where id = govcare_seed_uuid('radiology_report', g));

    insert into wards (id, hospital_id, department_id, ward_no, name, category, floor, capacity, nurse_station, status, created_by, updated_by)
    select govcare_seed_uuid('ward', g), govcare_seed_uuid('hospital', g), govcare_seed_uuid('department', g), 'W-' || lpad(g::text, 2, '0'),
      (array['Male Medical Ward','Female Medical Ward','Children Ward','Male Surgical Ward','Female Surgical Ward','ICU','HDU','Isolation Ward','Private Medical Ward','Private Surgical Ward'])[g],
      (array['male','female','children','male','female','icu','hdu','isolation','male','female'])[g],
      'Level ' || ((g - 1) % 5 + 1), 25, 'Nurse Station ' || g, 'active', govcare_seed_uuid('nurse_user', g), govcare_seed_uuid('nurse_user', g)
    where not exists (select 1 from wards where id = govcare_seed_uuid('ward', g));

    insert into beds (id, hospital_id, ward_id, bed_no, bed_type, room_no, floor, status, current_patient_id, current_admission_id, last_cleaned_at, created_by, updated_by)
    values (
      govcare_seed_uuid('bed', g), govcare_seed_uuid('hospital', g), govcare_seed_uuid('ward', g), 'B-' || lpad(g::text, 2, '0'),
      (array['standard','standard','paediatric','standard','standard','icu','hdu','isolation','private','private'])[g],
      'R-' || lpad(g::text, 3, '0'), 'Level ' || ((g - 1) % 5 + 1),
      case when g <= 6 then 'assigned' else 'available' end,
      case when g <= 6 then govcare_seed_uuid('patient', g) else null end,
      case when g <= 6 then govcare_seed_uuid('admission', g) else null end,
      now() - (g || ' hours')::interval, govcare_seed_uuid('nurse_user', g), govcare_seed_uuid('nurse_user', g)
    ) on conflict (ward_id, bed_no) do update set status = excluded.status, current_patient_id = excluded.current_patient_id, updated_at = now();

    insert into admissions (id, hospital_id, patient_id, visit_id, ward_id, bed_id, consultant_id, admission_no, reason, provisional_diagnosis, priority, admitted_at, discharged_at, status, created_by, updated_by)
    values (
      govcare_seed_uuid('admission', g), govcare_seed_uuid('hospital', g), govcare_seed_uuid('patient', g), govcare_seed_uuid('visit', g),
      govcare_seed_uuid('ward', g), govcare_seed_uuid('bed', g), govcare_seed_uuid('doctor_user', g), 'ADM-2026-' || lpad(g::text, 5, '0'),
      (array['Observation','Diabetes control','Paediatric fever','Antenatal observation','Post vaccination monitoring','Chest pain observation','Wound care admission','Dengue observation','Hypertension control','Neurology observation'])[g],
      'Provisional diagnosis ' || g, priorities[g], now() - (g || ' days')::interval,
      case when g in (8,9,10) then now() - ((g - 7) || ' hours')::interval else null end,
      (case when g in (8,9,10) then 'completed' else 'active' end)::record_status, govcare_seed_uuid('doctor_user', g), govcare_seed_uuid('nurse_user', g)
    ) on conflict (hospital_id, admission_no) do update set status = excluded.status, updated_at = now();

    insert into appointments (id, hospital_id, patient_id, doctor_id, department_id, appointment_type, scheduled_at, queue_no, mode, location, status, created_by, updated_by)
    select govcare_seed_uuid('appointment', g), govcare_seed_uuid('hospital', g), govcare_seed_uuid('patient', g), govcare_seed_uuid('doctor_user', g),
      govcare_seed_uuid('department', g), (array['OPD','Clinic','Telemedicine','Follow-up','Physical Visit','Clinic','Emergency Review','Paediatric Review','Cardiology Clinic','Surgical Review'])[g],
      now() + (g || ' days')::interval, 'Q-' || lpad(g::text, 3, '0'), (array['physical','physical','video','physical','physical','physical','physical','physical','physical','video'])[g],
      'Clinic Room ' || g, (array['pending','active','pending','completed','pending','active','pending','pending','completed','pending']::record_status[])[g],
      govcare_seed_uuid('reception_user', g), govcare_seed_uuid('reception_user', g)
    where not exists (select 1 from appointments where id = govcare_seed_uuid('appointment', g));

    insert into notifications (id, hospital_id, target_user_id, target_role, title, message, module, priority, read_at, action_url, group_key, status, created_by, updated_by)
    select govcare_seed_uuid('notification', g), govcare_seed_uuid('hospital', g), govcare_seed_uuid('user', g), roles[g],
      (array['Critical lab result','New admission','Prescription pending','Bed assigned','Low stock alert','Sample received','Radiology report ready','OPD token created','Report export ready','Backup completed'])[g],
      'GovCare notification seed for Sri Lankan hospital workflow ' || g,
      (array['Laboratory','Admissions','Pharmacy','Ward','Pharmacy','Laboratory','Radiology','OPD','Reports','ICT'])[g],
      priorities[g], case when g in (4,8,10) then now() else null end,
      (array['/laboratory','/admissions','/pharmacy','/wards','/pharmacy','/laboratory','/radiology','/opd','/reports','/settings'])[g],
      (array['Diagnostics','Admissions','Pharmacy','Ward','Stock','Diagnostics','Diagnostics','Queue','Reports','System'])[g],
      'active', govcare_seed_uuid('user', g), govcare_seed_uuid('user', g)
    where not exists (select 1 from notifications where id = govcare_seed_uuid('notification', g));

    insert into audit_logs (id, hospital_id, actor_id, actor_role, module, action, entity_type, entity_id, before_state, after_state, ip_address, device_info, created_at)
    select govcare_seed_uuid('audit_log', g), govcare_seed_uuid('hospital', g), govcare_seed_uuid('user', g), roles[g],
      (array['Auth','Patient','OPD','Doctor Center','Pharmacy','Laboratory','Radiology','Admissions','Reports','Settings'])[g],
      (array['login_success','patient_created','queue_created','consultation_saved','medicine_issued','result_approved','report_uploaded','bed_assigned','report_exported','backup_checked'])[g],
      (array['app_users','patients','opd_queue','consultations','pharmacy_receipts','lab_results','radiology_reports','admissions','reports','system_settings'])[g],
      govcare_seed_uuid('patient', g), jsonb_build_object('status','before'), jsonb_build_object('status','after','seed',true),
      '127.0.0.' || g, 'Windows Chrome GovCare Seed', now() - (g || ' minutes')::interval
    where not exists (select 1 from audit_logs where id = govcare_seed_uuid('audit_log', g));

    insert into login_activities (id, hospital_id, user_id, full_name, role, department_name, email, login_status, logout_status, login_time, logout_time, session_duration_seconds, ip_address, device_browser, operating_system, location, authentication_method, failure_reason, last_activity_time, created_at)
    select govcare_seed_uuid('login_activity', g), govcare_seed_uuid('hospital', g), govcare_seed_uuid('user', g), user_names[g], roles[g], dept_names[g], emails[g],
      case when g in (4,9) then 'failed' else 'success' end,
      case when g in (4,9) then 'unknown' else 'logged_out' end,
      now() - (g || ' hours')::interval, case when g in (4,9) then null else now() - ((g * 50) || ' minutes')::interval end,
      case when g in (4,9) then null else g * 600 end, '192.168.1.' || g, 'Chrome ' || (120 + g), 'Windows 10',
      'Sri Lanka', case when g = 3 then 'google' else 'email_password' end, case when g in (4,9) then 'Invalid credential' else null end,
      now() - (g || ' minutes')::interval, now() - (g || ' hours')::interval
    where not exists (select 1 from login_activities where id = govcare_seed_uuid('login_activity', g));

    insert into global_media (id, hospital_id, patient_id, uploaded_by, uploader_role, module, file_url, file_path, file_name, original_file_name, mime_type, file_size_bytes, sha256_checksum, storage_provider, visibility_level, metadata, release_status, released_by, released_at, status, created_at)
    select govcare_seed_uuid('global_media', g), govcare_seed_uuid('hospital', g), govcare_seed_uuid('patient', g), govcare_seed_uuid('user', g), roles[g]::text,
      (array['Patient Profile','OPD','Doctor Center','Ward','Pharmacy','Laboratory','Radiology','Emergency','Reports','Admissions'])[g],
      '/uploads/seed/media-' || g || '.pdf', 'uploads/seed/media-' || g || '.pdf', 'media-' || g || '.pdf',
      'GovCare seed document ' || g || '.pdf', 'application/pdf', 204800 + (g * 1024), md5('seed-media-' || g),
      'spring-local', case when g <= 5 then 'patient-visible' else 'staff-only' end,
      jsonb_build_object('description','Seed media for Sri Lanka EHR workflow','moduleIndex',g),
      case when g <= 5 then 'released' else 'internal' end, case when g <= 5 then govcare_seed_uuid('doctor_user', g) else null end,
      case when g <= 5 then now() else null end, 'active', now() - (g || ' days')::interval
    where not exists (select 1 from global_media where id = govcare_seed_uuid('global_media', g));

    insert into system_settings (id, hospital_id, key, category, description, value, is_public, status, created_by, updated_by)
    values (
      govcare_seed_uuid('system_setting', g), govcare_seed_uuid('hospital', g),
      (array['hospital_profile','language_policy','theme_policy','notification_policy','report_policy','module_permissions','ward_policy','guardian_policy','security_policy','backup_policy'])[g],
      (array['profile','language','ui','notifications','reports','permissions','clinical','patient','security','system'])[g],
      'GovCare EHR Sri Lanka configuration setting ' || g,
      jsonb_build_object('country','Sri Lanka','supportsGovernmentHospitals',true,'supportsPrivateHospitals',true,'languages',jsonb_build_array('English','Sinhala','Tamil'),'enabled',true),
      g in (1,2,3), 'active', govcare_seed_uuid('ict_user', g), govcare_seed_uuid('ict_user', g)
    ) on conflict (hospital_id, key) do update set value = excluded.value, updated_at = now();
  end loop;
end $$;

-- Verification:
-- select table_name, row_count from (
--   select 'hospitals' table_name, count(*) row_count from hospitals union all
--   select 'departments', count(*) from departments union all
--   select 'app_users', count(*) from app_users union all
--   select 'guardians', count(*) from guardians union all
--   select 'patients', count(*) from patients union all
--   select 'visits', count(*) from visits union all
--   select 'opd_queue', count(*) from opd_queue union all
--   select 'consultations', count(*) from consultations union all
--   select 'prescriptions', count(*) from prescriptions union all
--   select 'prescription_items', count(*) from prescription_items union all
--   select 'medicines', count(*) from medicines union all
--   select 'pharmacy_stock', count(*) from pharmacy_stock union all
--   select 'pharmacy_receipts', count(*) from pharmacy_receipts union all
--   select 'lab_requests', count(*) from lab_requests union all
--   select 'lab_results', count(*) from lab_results union all
--   select 'radiology_requests', count(*) from radiology_requests union all
--   select 'radiology_reports', count(*) from radiology_reports union all
--   select 'wards', count(*) from wards union all
--   select 'beds', count(*) from beds union all
--   select 'admissions', count(*) from admissions union all
--   select 'appointments', count(*) from appointments union all
--   select 'notifications', count(*) from notifications union all
--   select 'audit_logs', count(*) from audit_logs union all
--   select 'login_activities', count(*) from login_activities union all
--   select 'global_media', count(*) from global_media union all
--   select 'system_settings', count(*) from system_settings
-- ) counts order by table_name;

DO $$
BEGIN
  -- seed data logic
END $$;