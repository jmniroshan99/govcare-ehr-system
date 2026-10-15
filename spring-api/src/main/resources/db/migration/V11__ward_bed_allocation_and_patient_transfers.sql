-- GovCare EHR ward, bed allocation and patient-transfer workflow.
-- Extends the existing ward/admission schema without deleting existing data.

create sequence if not exists inter_hospital_transfer_no_seq start with 1 increment by 1;

create or replace function next_inter_hospital_transfer_no()
returns text as $$
begin
  return 'TRF-' || to_char(current_date,'YYYYMMDD') || '-' || lpad(nextval('inter_hospital_transfer_no_seq')::text, 6, '0');
end;
$$ language plpgsql;

-- Existing ward records remain valid while receiving the richer operational fields.
alter table wards drop constraint if exists wards_category_check;
alter table wards
  add column if not exists ward_code text,
  add column if not exists ward_type text,
  add column if not exists building text,
  add column if not exists gender_restriction text,
  add column if not exists age_restriction text,
  add column if not exists isolation_capable boolean not null default false,
  add column if not exists ward_manager_id uuid references app_users(id) on delete set null,
  add column if not exists responsible_consultant_id uuid references app_users(id) on delete set null,
  add column if not exists phone text,
  add column if not exists operational_status text not null default 'ACTIVE';

update wards
set ward_code = coalesce(nullif(ward_code,''), nullif(ward_no,''), 'WARD-' || upper(substr(replace(id::text,'-',''),1,8))),
    ward_type = coalesce(nullif(ward_type,''),
      case lower(coalesce(category,''))
        when 'icu' then 'INTENSIVE_CARE_UNIT'
        when 'hdu' then 'HIGH_DEPENDENCY_UNIT'
        when 'isolation' then 'ISOLATION_WARD'
        when 'children' then 'PAEDIATRIC_WARD'
        else 'GENERAL_MEDICAL_WARD'
      end),
    gender_restriction = coalesce(nullif(gender_restriction,''),
      case lower(coalesce(category,'')) when 'male' then 'MALE' when 'female' then 'FEMALE' else 'ANY' end),
    age_restriction = coalesce(nullif(age_restriction,''), case lower(coalesce(category,'')) when 'children' then 'PAEDIATRIC' else 'ANY' end),
    isolation_capable = isolation_capable or lower(coalesce(category,''))='isolation',
    operational_status = case when status='active' then 'ACTIVE' else 'INACTIVE' end;

alter table wards alter column ward_code set not null;
alter table wards alter column ward_type set not null;
alter table wards drop constraint if exists chk_wards_operational_status;
alter table wards add constraint chk_wards_operational_status check (operational_status in ('ACTIVE','INACTIVE','TEMPORARILY_CLOSED','FULL','QUARANTINED','MAINTENANCE'));

create unique index if not exists uq_wards_hospital_code on wards(hospital_id, ward_code);
create index if not exists idx_wards_hospital_status on wards(hospital_id,status);
create index if not exists idx_wards_department on wards(department_id);

create table if not exists ward_rooms (
  id uuid primary key default gen_random_uuid(),
  ward_id uuid not null references wards(id) on delete cascade,
  room_number text not null,
  room_name text,
  room_type text not null default 'GENERAL',
  floor text,
  maximum_beds integer not null default 1 check (maximum_beds > 0),
  gender_restriction text default 'ANY',
  isolation_room boolean not null default false,
  negative_pressure_room boolean not null default false,
  oxygen_available boolean not null default false,
  ventilator_support boolean not null default false,
  bathroom_available boolean not null default false,
  status text not null default 'ACTIVE',
  created_by uuid references app_users(id) on delete set null,
  updated_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(ward_id,room_number),
  constraint chk_ward_room_type check (room_type in ('GENERAL','SINGLE','DOUBLE','SHARED','ICU','HDU','ISOLATION','PROCEDURE','OBSERVATION')),
  constraint chk_ward_room_status check (status in ('ACTIVE','INACTIVE','CLOSED','MAINTENANCE'))
);

-- Preserve the existing beds table and extend it as the canonical bed registry.
alter table beds
  add column if not exists room_id uuid references ward_rooms(id) on delete set null,
  add column if not exists bed_code text,
  add column if not exists gender_restriction text default 'ANY',
  add column if not exists age_restriction text default 'ANY',
  add column if not exists isolation_support boolean not null default false,
  add column if not exists oxygen_support boolean not null default false,
  add column if not exists ventilator_support boolean not null default false,
  add column if not exists monitor_support boolean not null default false,
  add column if not exists electric_bed boolean not null default false,
  add column if not exists accessible_bed boolean not null default false,
  add column if not exists reserved_patient_id uuid references patients(id) on delete set null,
  add column if not exists reserved_until timestamptz,
  add column if not exists blocked_reason text,
  add column if not exists last_maintenance_at timestamptz,
  add column if not exists version bigint not null default 0;

-- Normalize all legacy bed values before adding the new operational constraint.
-- Older GovCare seed data uses values such as `assigned`; production databases
-- may also contain free/vacant/in-use variants.  Any unknown value is derived
-- safely from the linked patient/admission instead of aborting Flyway startup.
update beds
set bed_code = coalesce(nullif(trim(bed_code),''), 'BED-' || upper(substr(replace(id::text,'-',''),1,10))),
    bed_type = case upper(trim(coalesce(bed_type,'')))
      when '' then 'STANDARD'
      when 'CHILD' then 'PAEDIATRIC'
      when 'PEDIATRIC' then 'PAEDIATRIC'
      when 'PRIVATE' then 'STANDARD'
      else upper(trim(bed_type))
    end,
    status = case
      when upper(trim(coalesce(status,''))) in ('AVAILABLE','FREE','VACANT','READY') then 'AVAILABLE'
      when upper(trim(coalesce(status,''))) in ('RESERVED','BOOKED','HELD') then 'RESERVED'
      when upper(trim(coalesce(status,''))) in ('OCCUPIED','ASSIGNED','IN_USE','IN USE','ADMITTED') then 'OCCUPIED'
      when upper(trim(coalesce(status,''))) in ('CLEANING','DIRTY','AWAITING_CLEANING','TO_CLEAN') then 'CLEANING'
      when upper(trim(coalesce(status,''))) in ('BLOCKED','CLOSED','UNAVAILABLE') then 'BLOCKED'
      when upper(trim(coalesce(status,''))) in ('MAINTENANCE','REPAIR','UNDER_MAINTENANCE') then 'MAINTENANCE'
      when upper(trim(coalesce(status,''))) in ('OUT_OF_SERVICE','DISABLED') then 'OUT_OF_SERVICE'
      when upper(trim(coalesce(status,''))) in ('INFECTION_CONTROL','ISOLATION','QUARANTINE') then 'INFECTION_CONTROL'
      when upper(trim(coalesce(status,''))) in ('PENDING_DISCHARGE','DISCHARGE_PENDING') then 'PENDING_DISCHARGE'
      when current_patient_id is not null or current_admission_id is not null then 'OCCUPIED'
      when reserved_patient_id is not null then 'RESERVED'
      else 'AVAILABLE'
    end;

alter table beds alter column bed_code set not null;
alter table beds alter column status set default 'AVAILABLE';
alter table beds alter column status set not null;
create unique index if not exists uq_beds_hospital_code on beds(hospital_id,bed_code);
create index if not exists idx_beds_ward_status on beds(ward_id,status);
create index if not exists idx_beds_hospital_status on beds(hospital_id,status);
create index if not exists idx_beds_current_patient on beds(current_patient_id);
create index if not exists idx_beds_reserved_patient on beds(reserved_patient_id);

alter table beds drop constraint if exists chk_beds_status;
alter table beds add constraint chk_beds_status check (status in (
  'AVAILABLE','RESERVED','OCCUPIED','CLEANING','BLOCKED','MAINTENANCE','OUT_OF_SERVICE','INFECTION_CONTROL','PENDING_DISCHARGE'
));

-- Add a generic room for legacy beds and link them safely.
insert into ward_rooms(ward_id,room_number,room_name,room_type,floor,maximum_beds,status)
select w.id,'GENERAL','General Room','GENERAL',w.floor,greatest(coalesce(w.capacity,1),1),'ACTIVE'
from wards w
where not exists(select 1 from ward_rooms r where r.ward_id=w.id);

update beds b set room_id=(select r.id from ward_rooms r where r.ward_id=b.ward_id order by r.created_at limit 1)
where b.room_id is null;

create table if not exists bed_reservations (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  admission_request_id uuid references admissions(id) on delete cascade,
  bed_id uuid not null references beds(id) on delete cascade,
  priority text not null default 'ROUTINE',
  status text not null default 'ACTIVE',
  reserved_by uuid not null references app_users(id) on delete restrict,
  reserved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  override_reason text,
  constraint chk_bed_reservation_status check (status in ('ACTIVE','CONFIRMED','EXPIRED','CANCELLED')),
  constraint chk_bed_reservation_priority check (priority in ('ROUTINE','URGENT','EMERGENCY','ICU_PRIORITY','ISOLATION_PRIORITY'))
);
create unique index if not exists uq_active_bed_reservation on bed_reservations(bed_id) where status='ACTIVE';
create index if not exists idx_bed_reservation_expiry on bed_reservations(status,expires_at);

create table if not exists patient_bed_assignments (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  admission_id uuid not null references admissions(id) on delete cascade,
  ward_id uuid not null references wards(id) on delete restrict,
  room_id uuid references ward_rooms(id) on delete set null,
  bed_id uuid not null references beds(id) on delete restrict,
  assigned_by uuid not null references app_users(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  released_by uuid references app_users(id) on delete set null,
  released_at timestamptz,
  release_reason text,
  active boolean not null default true
);
create unique index if not exists uq_active_bed_assignment on patient_bed_assignments(bed_id) where active=true;
create unique index if not exists uq_active_patient_admission_bed on patient_bed_assignments(admission_id) where active=true;
create index if not exists idx_patient_bed_assignment_patient on patient_bed_assignments(patient_id,assigned_at desc);

-- Backfill active admission assignments where the legacy admission already has a bed.
insert into patient_bed_assignments(hospital_id,patient_id,admission_id,ward_id,room_id,bed_id,assigned_by,assigned_at,active)
select a.hospital_id,a.patient_id,a.id,a.ward_id,b.room_id,a.bed_id,coalesce(a.created_by,a.consultant_id),a.admitted_at,true
from admissions a join beds b on b.id=a.bed_id
where a.status='active' and a.ward_id is not null and a.bed_id is not null
  and coalesce(a.created_by,a.consultant_id) is not null
  and not exists(select 1 from patient_bed_assignments x where x.admission_id=a.id and x.active=true)
on conflict do nothing;

update beds b set status='OCCUPIED', current_patient_id=a.patient_id, current_admission_id=a.id
from admissions a where a.bed_id=b.id and a.status='active';

create table if not exists internal_transfer_requests (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  admission_id uuid not null references admissions(id) on delete cascade,
  source_department_id uuid references departments(id) on delete set null,
  source_ward_id uuid not null references wards(id) on delete restrict,
  source_bed_id uuid not null references beds(id) on delete restrict,
  destination_department_id uuid references departments(id) on delete set null,
  destination_ward_id uuid not null references wards(id) on delete restrict,
  destination_bed_id uuid references beds(id) on delete set null,
  transfer_reason text not null,
  priority text not null default 'ROUTINE',
  clinical_notes text,
  isolation_required boolean not null default false,
  transport_assistance_required boolean not null default false,
  status text not null default 'REQUESTED',
  requested_by uuid not null references app_users(id) on delete restrict,
  approved_by uuid references app_users(id) on delete set null,
  accepted_by uuid references app_users(id) on delete set null,
  completed_by uuid references app_users(id) on delete set null,
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  constraint chk_internal_transfer_status check (status in ('REQUESTED','UNDER_REVIEW','APPROVED','ACCEPTED','REJECTED','BED_RESERVED','READY_FOR_TRANSFER','IN_TRANSIT','COMPLETED','CANCELLED')),
  constraint chk_internal_transfer_priority check (priority in ('ROUTINE','URGENT','EMERGENCY','ICU_PRIORITY','ISOLATION_PRIORITY'))
);
create index if not exists idx_internal_transfer_hospital_status on internal_transfer_requests(hospital_id,status,requested_at desc);
create unique index if not exists uq_active_internal_transfer_admission on internal_transfer_requests(admission_id)
where status not in ('REJECTED','COMPLETED','CANCELLED');

create table if not exists inter_hospital_transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_number text not null unique default next_inter_hospital_transfer_no(),
  patient_id uuid not null references patients(id) on delete restrict,
  source_hospital_id uuid not null references hospitals(id) on delete restrict,
  destination_hospital_id uuid not null references hospitals(id) on delete restrict,
  source_admission_id uuid not null references admissions(id) on delete restrict,
  destination_admission_id uuid references admissions(id) on delete set null,
  source_department_id uuid references departments(id) on delete set null,
  source_ward_id uuid references wards(id) on delete set null,
  source_bed_id uuid references beds(id) on delete set null,
  requested_destination_department_id uuid references departments(id) on delete set null,
  requested_ward_type text,
  requested_specialty text,
  preferred_consultant_id uuid references app_users(id) on delete set null,
  destination_ward_id uuid references wards(id) on delete set null,
  destination_bed_id uuid references beds(id) on delete set null,
  transfer_reason text not null,
  clinical_summary text not null,
  current_diagnosis text,
  current_condition text,
  allergies text,
  current_medication text,
  infection_status text,
  isolation_required boolean not null default false,
  oxygen_required boolean not null default false,
  ventilator_required boolean not null default false,
  mobility_status text,
  risk_level text,
  required_equipment text,
  priority text not null default 'ROUTINE',
  status text not null default 'DRAFT',
  transport_type text,
  ambulance_provider text,
  vehicle_number text,
  driver_name text,
  driver_contact text,
  escort_doctor_id uuid references app_users(id) on delete set null,
  escort_nurse_id uuid references app_users(id) on delete set null,
  estimated_departure timestamptz,
  estimated_arrival timestamptz,
  actual_departure timestamptz,
  actual_arrival timestamptz,
  transport_notes text,
  requested_by uuid not null references app_users(id) on delete restrict,
  reviewed_by uuid references app_users(id) on delete set null,
  accepted_by uuid references app_users(id) on delete set null,
  departed_by uuid references app_users(id) on delete set null,
  arrived_by uuid references app_users(id) on delete set null,
  completed_by uuid references app_users(id) on delete set null,
  rejection_reason text,
  information_request text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint chk_inter_hospital_different_hospitals check (source_hospital_id<>destination_hospital_id),
  constraint chk_inter_hospital_status check (status in ('DRAFT','SUBMITTED','UNDER_REVIEW','MORE_INFORMATION_REQUIRED','ACCEPTED','REJECTED','BED_RESERVED','TRANSPORT_SCHEDULED','READY_FOR_DEPARTURE','DEPARTED','IN_TRANSIT','ARRIVED','ADMISSION_CONFIRMED','COMPLETED','CANCELLED')),
  constraint chk_inter_hospital_priority check (priority in ('ROUTINE','URGENT','EMERGENCY','ICU_PRIORITY','ISOLATION_PRIORITY'))
);
create index if not exists idx_inter_transfer_source_status on inter_hospital_transfers(source_hospital_id,status,created_at desc);
create index if not exists idx_inter_transfer_destination_status on inter_hospital_transfers(destination_hospital_id,status,created_at desc);
create unique index if not exists uq_active_inter_transfer_admission on inter_hospital_transfers(source_admission_id)
where status not in ('REJECTED','COMPLETED','CANCELLED');

create table if not exists patient_transfer_documents (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references inter_hospital_transfers(id) on delete cascade,
  patient_document_id uuid not null references patient_documents(id) on delete cascade,
  document_purpose text not null,
  shared_by uuid not null references app_users(id) on delete restrict,
  shared_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(transfer_id,patient_document_id)
);

create table if not exists patient_movement_history (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  admission_id uuid references admissions(id) on delete set null,
  transfer_id uuid,
  movement_type text not null,
  source_hospital_id uuid references hospitals(id) on delete set null,
  destination_hospital_id uuid references hospitals(id) on delete set null,
  source_ward_id uuid references wards(id) on delete set null,
  destination_ward_id uuid references wards(id) on delete set null,
  source_bed_id uuid references beds(id) on delete set null,
  destination_bed_id uuid references beds(id) on delete set null,
  moved_by uuid not null references app_users(id) on delete restrict,
  moved_at timestamptz not null default now(),
  notes text
);
create index if not exists idx_patient_movement_patient on patient_movement_history(patient_id,moved_at desc);
create index if not exists idx_patient_movement_admission on patient_movement_history(admission_id,moved_at desc);

create or replace function touch_ward_transfer_updated_at() returns trigger as $$
begin new.updated_at=now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_touch_ward_updated_at on wards;
create trigger trg_touch_ward_updated_at before update on wards for each row execute function touch_ward_transfer_updated_at();
drop trigger if exists trg_touch_room_updated_at on ward_rooms;
create trigger trg_touch_room_updated_at before update on ward_rooms for each row execute function touch_ward_transfer_updated_at();
drop trigger if exists trg_touch_bed_updated_at on beds;
create trigger trg_touch_bed_updated_at before update on beds for each row execute function touch_ward_transfer_updated_at();
drop trigger if exists trg_touch_inter_transfer_updated_at on inter_hospital_transfers;
create trigger trg_touch_inter_transfer_updated_at before update on inter_hospital_transfers for each row execute function touch_ward_transfer_updated_at();

insert into permissions(code,name,module,action) values
('WARD_VIEW','View wards and ward patients','wards','view'),
('WARD_MANAGE','Manage wards','wards','manage'),
('ROOM_MANAGE','Manage ward rooms','wards','room_manage'),
('BED_VIEW','View bed board','beds','view'),
('BED_MANAGE','Manage beds','beds','manage'),
('BED_ALLOCATE','Allocate beds','beds','allocate'),
('BED_RESERVE','Reserve beds','beds','reserve'),
('BED_BLOCK','Block beds','beds','block'),
('BED_RELEASE','Release beds','beds','release'),
('ADMISSION_REQUEST_CREATE','Create admission requests','admissions','request_create'),
('ADMISSION_APPROVE','Approve admissions','admissions','approve'),
('ADMISSION_VIEW','View admissions','admissions','view'),
('INTERNAL_TRANSFER_CREATE','Create internal transfers','transfers','internal_create'),
('INTERNAL_TRANSFER_APPROVE','Approve internal transfers','transfers','internal_approve'),
('INTERNAL_TRANSFER_ACCEPT','Accept internal transfers','transfers','internal_accept'),
('INTERNAL_TRANSFER_COMPLETE','Complete internal transfers','transfers','internal_complete'),
('INTERNAL_TRANSFER_CANCEL','Cancel internal transfers','transfers','internal_cancel'),
('INTER_HOSPITAL_TRANSFER_CREATE','Create inter-hospital transfers','transfers','inter_create'),
('INTER_HOSPITAL_TRANSFER_REVIEW','Review inter-hospital transfers','transfers','inter_review'),
('INTER_HOSPITAL_TRANSFER_ACCEPT','Accept inter-hospital transfers','transfers','inter_accept'),
('INTER_HOSPITAL_TRANSFER_REJECT','Reject inter-hospital transfers','transfers','inter_reject'),
('INTER_HOSPITAL_TRANSFER_DEPART','Confirm transfer departure','transfers','inter_depart'),
('INTER_HOSPITAL_TRANSFER_ARRIVE','Confirm transfer arrival','transfers','inter_arrive'),
('INTER_HOSPITAL_TRANSFER_COMPLETE','Complete inter-hospital transfers','transfers','inter_complete'),
('TRANSFER_DOCUMENT_VIEW','View transfer documents','transfers','document_view'),
('TRANSFER_DOCUMENT_CREATE','Attach transfer documents','transfers','document_create'),
('TRANSFER_DOCUMENT_SHARE','Share transfer documents','transfers','document_share'),
('TRANSFER_AUDIT_VIEW','View transfer audit history','transfers','audit_view')
on conflict(code) do nothing;

-- Administration and ward operations.
insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code=any(array[
 'WARD_VIEW','WARD_MANAGE','ROOM_MANAGE','BED_VIEW','BED_MANAGE','BED_ALLOCATE','BED_RESERVE','BED_BLOCK','BED_RELEASE',
 'ADMISSION_VIEW','ADMISSION_APPROVE','INTERNAL_TRANSFER_APPROVE','INTERNAL_TRANSFER_ACCEPT','INTERNAL_TRANSFER_COMPLETE','INTERNAL_TRANSFER_CANCEL',
 'INTER_HOSPITAL_TRANSFER_CREATE','INTER_HOSPITAL_TRANSFER_REVIEW','INTER_HOSPITAL_TRANSFER_ACCEPT','INTER_HOSPITAL_TRANSFER_REJECT',
 'INTER_HOSPITAL_TRANSFER_DEPART','INTER_HOSPITAL_TRANSFER_ARRIVE','INTER_HOSPITAL_TRANSFER_COMPLETE',
 'TRANSFER_DOCUMENT_VIEW','TRANSFER_DOCUMENT_CREATE','TRANSFER_DOCUMENT_SHARE','TRANSFER_AUDIT_VIEW'
]) where r.code in ('super_admin','hospital_admin') on conflict do nothing;

insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code=any(array[
 'WARD_VIEW','BED_VIEW','BED_ALLOCATE','BED_RESERVE','ADMISSION_REQUEST_CREATE','ADMISSION_VIEW',
 'INTERNAL_TRANSFER_CREATE','INTERNAL_TRANSFER_CANCEL','INTER_HOSPITAL_TRANSFER_CREATE','INTER_HOSPITAL_TRANSFER_DEPART',
 'TRANSFER_DOCUMENT_VIEW','TRANSFER_DOCUMENT_CREATE','TRANSFER_AUDIT_VIEW'
]) where r.code in ('doctor','surgeon') on conflict do nothing;

insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code=any(array[
 'WARD_VIEW','BED_VIEW','BED_RESERVE','BED_BLOCK','BED_RELEASE','ADMISSION_VIEW',
 'INTERNAL_TRANSFER_CREATE','INTERNAL_TRANSFER_ACCEPT','INTERNAL_TRANSFER_COMPLETE','INTER_HOSPITAL_TRANSFER_ARRIVE',
 'TRANSFER_DOCUMENT_VIEW','TRANSFER_DOCUMENT_CREATE'
]) where r.code='nurse' on conflict do nothing;

insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r join permissions p on p.code=any(array['WARD_VIEW','BED_VIEW','ADMISSION_VIEW'])
where r.code in ('receptionist','records_officer') on conflict do nothing;

-- Ensure Super Admin receives newly created permissions even on upgraded databases.
insert into role_permissions(role_id,permission_id)
select r.id,p.id from roles r cross join permissions p where r.code='super_admin'
on conflict do nothing;
