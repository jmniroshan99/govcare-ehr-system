-- GovCare EHR - Complete Blood Count (CBC) blood report module.
-- Keeps the existing generic laboratory workflow intact and adds a structured,
-- auditable CBC report model with configurable reference ranges.

create sequence if not exists cbc_report_number_seq start with 1 increment by 1;

create table if not exists lab_test_reference_ranges (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid references hospitals(id) on delete cascade,
  test_code text not null,
  test_name text not null,
  category text not null default 'CBC',
  min_value numeric,
  max_value numeric,
  critical_min numeric,
  critical_max numeric,
  unit text,
  gender text,
  age_min integer,
  age_max integer,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_lab_reference_range_lookup
  on lab_test_reference_ranges(test_code, hospital_id, active, gender, age_min, age_max);

create table if not exists lab_blood_reports (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  report_number text not null,
  patient_id uuid not null references patients(id) on delete cascade,
  lab_request_id uuid references lab_requests(id) on delete set null,
  specimen_type text not null default 'EDTA Whole Blood',
  sample_number text,
  collected_at timestamptz,
  collected_by uuid references app_users(id) on delete set null,
  received_at timestamptz,
  reported_at timestamptz,
  status text not null default 'DRAFT' check (status in ('DRAFT','COMPLETED','VERIFIED','RELEASED','CANCELLED')),
  interpretation text,
  created_by uuid references app_users(id) on delete set null,
  updated_by uuid references app_users(id) on delete set null,
  verified_by uuid references app_users(id) on delete set null,
  verified_at timestamptz,
  released_by uuid references app_users(id) on delete set null,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hospital_id, report_number)
);
create unique index if not exists uq_cbc_report_lab_request
  on lab_blood_reports(lab_request_id) where lab_request_id is not null;
create index if not exists idx_cbc_report_hospital_status on lab_blood_reports(hospital_id, status, created_at desc);
create index if not exists idx_cbc_report_patient on lab_blood_reports(patient_id, created_at desc);

create table if not exists lab_blood_report_results (
  id uuid primary key default gen_random_uuid(),
  blood_report_id uuid not null references lab_blood_reports(id) on delete cascade,
  test_code text not null,
  test_name text not null,
  category text not null,
  result_value numeric,
  min_reference numeric,
  max_reference numeric,
  critical_min numeric,
  critical_max numeric,
  unit text,
  abnormal_flag text check (abnormal_flag in ('N','L','H','C')),
  manually_overridden boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (blood_report_id, test_code)
);
create index if not exists idx_cbc_result_report_order on lab_blood_report_results(blood_report_id, display_order);

-- Reuse the project's standard updated_at trigger function.
drop trigger if exists lab_test_reference_ranges_updated_at on lab_test_reference_ranges;
create trigger lab_test_reference_ranges_updated_at before update on lab_test_reference_ranges
for each row execute function set_updated_at();
drop trigger if exists lab_blood_reports_updated_at on lab_blood_reports;
create trigger lab_blood_reports_updated_at before update on lab_blood_reports
for each row execute function set_updated_at();
drop trigger if exists lab_blood_report_results_updated_at on lab_blood_report_results;
create trigger lab_blood_report_results_updated_at before update on lab_blood_report_results
for each row execute function set_updated_at();

-- Configurable default CBC reference ranges. hospital_id=NULL means system fallback.
insert into lab_test_reference_ranges(test_code,test_name,category,min_value,max_value,unit,display_order)
select v.* from (values
 ('HB','Haemoglobin','CBC',13.0,17.0,'g/dL',10),
 ('WBC','Total Leucocyte Count','CBC',4000,10000,'/cumm',20),
 ('NEUT_PCT','Neutrophils','Differential Leucocyte Count',40,80,'%',30),
 ('LYMPH_PCT','Lymphocytes','Differential Leucocyte Count',20,40,'%',40),
 ('EOS_PCT','Eosinophils','Differential Leucocyte Count',1,6,'%',50),
 ('MONO_PCT','Monocytes','Differential Leucocyte Count',2,10,'%',60),
 ('BASO_PCT','Basophils','Differential Leucocyte Count',0,1,'%',70),
 ('ABS_NEUT','Absolute Neutrophils','Absolute Leucocyte Count',2000,7000,'/cumm',80),
 ('ABS_LYMPH','Absolute Lymphocytes','Absolute Leucocyte Count',1000,3000,'/cumm',90),
 ('ABS_EOS','Absolute Eosinophils','Absolute Leucocyte Count',20,500,'/cumm',100),
 ('ABS_MONO','Absolute Monocytes','Absolute Leucocyte Count',200,1000,'/cumm',110),
 ('ABS_BASO','Absolute Basophils','Absolute Leucocyte Count',0,100,'/cumm',120),
 ('RBC','RBC Count','RBC Indices',4.5,5.5,'Million/cumm',130),
 ('MCV','MCV','RBC Indices',81,101,'fL',140),
 ('MCH','MCH','RBC Indices',27,32,'pg',150),
 ('MCHC','MCHC','RBC Indices',31.5,34.5,'g/dL',160),
 ('HCT','Hct / Haematocrit','RBC Indices',40,50,'%',170),
 ('RDW_CV','RDW-CV','RBC Indices',11.6,14.0,'%',180),
 ('RDW_SD','RDW-SD','RBC Indices',39,46,'fL',190),
 ('PLT','Platelet Count','Platelet Indices',150000,410000,'/cumm',200),
 ('PCT','PCT','Platelet Indices',0.10,0.50,'%',210),
 ('MPV','MPV','Platelet Indices',7.5,11.5,'fL',220),
 ('PDW','PDW','Platelet Indices',9,17,'fL',230)
) as v(test_code,test_name,category,min_value,max_value,unit,display_order)
where not exists (
  select 1 from lab_test_reference_ranges r
  where r.hospital_id is null and r.test_code=v.test_code and r.gender is null and r.age_min is null and r.age_max is null
);

-- Separate release permission so verification and patient release can be audited independently.
-- Safe for older/manual databases where RBAC migration tables are not available.
do $$
begin
  if to_regclass('public.permissions') is not null then
    insert into permissions(code,name,module,action) values
    ('LAB_RESULT_RELEASE','Release laboratory results','laboratory','result_release')
    on conflict (code) do nothing;
  end if;

  if to_regclass('public.role_permissions') is not null
     and to_regclass('public.roles') is not null
     and to_regclass('public.permissions') is not null then
    insert into role_permissions(role_id,permission_id)
    select r.id,p.id from roles r join permissions p on p.code='LAB_RESULT_RELEASE'
    where r.code in ('super_admin','lab_manager','pathologist')
    on conflict do nothing;
  end if;
end $$;
