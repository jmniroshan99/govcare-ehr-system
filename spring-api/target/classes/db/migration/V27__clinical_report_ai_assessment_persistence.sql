-- Durable AI-CDSS clinical report, observation, assessment snapshot and generated-report persistence.
create table if not exists clinical_reports (
 id uuid primary key default gen_random_uuid(), report_uuid uuid not null default gen_random_uuid(),
 hospital_id uuid not null references hospitals(id) on delete cascade, patient_id uuid not null references patients(id) on delete cascade,
 patient_document_id uuid references patient_documents(id) on delete set null, encounter_id uuid references visits(id) on delete set null,
 report_type text not null default 'CLINICAL_PDF', report_title text not null, original_filename text not null,
 mime_type text not null default 'application/pdf', file_size bigint not null default 0, sha256_hash text,
 source_type text not null, report_status text not null default 'ACTIVE', report_date timestamptz,
 specimen_collected_at timestamptz, resulted_at timestamptz, processing_status text not null default 'UPLOADED',
 extraction_method text, failure_message text, uploaded_by uuid not null references app_users(id), uploaded_at timestamptz not null default now(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 unique(hospital_id,report_uuid),
 constraint chk_clinical_report_processing check(processing_status in('UPLOADED','PROCESSING','PROCESSED','PARTIAL','FAILED'))
);
create unique index if not exists uq_clinical_report_patient_hash on clinical_reports(hospital_id,patient_id,sha256_hash) where sha256_hash is not null;
create index if not exists idx_clinical_report_patient on clinical_reports(hospital_id,patient_id,created_at desc);

create table if not exists clinical_observations (
 id uuid primary key default gen_random_uuid(), observation_uuid uuid not null default gen_random_uuid(),
 hospital_id uuid not null references hospitals(id) on delete cascade, patient_id uuid not null references patients(id) on delete cascade,
 encounter_id uuid references visits(id) on delete set null, report_id uuid references clinical_reports(id) on delete set null,
 feature_key text not null, display_name text not null, coding_system text, code text,
 value_numeric numeric, value_text text, unit text, normalized_value numeric, normalized_unit text,
 reference_range_low numeric, reference_range_high numeric, abnormal_flag text, effective_at timestamptz,
 source_type text not null, extraction_confidence numeric, extraction_method text, manual_override boolean not null default false,
 original_observation_id uuid references clinical_observations(id) on delete set null, status text not null default 'FINAL',
 created_by uuid not null references app_users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 unique(hospital_id,observation_uuid)
);
create index if not exists idx_clinical_observation_patient on clinical_observations(hospital_id,patient_id,effective_at desc,created_at desc);
create index if not exists idx_clinical_observation_report on clinical_observations(report_id);
create index if not exists idx_clinical_observation_code on clinical_observations(hospital_id,coding_system,code);

create table if not exists ai_assessments (
 id uuid primary key, assessment_uuid uuid not null default gen_random_uuid(), hospital_id uuid not null references hospitals(id) on delete cascade,
 patient_id uuid not null references patients(id) on delete cascade, encounter_id uuid references visits(id) on delete set null,
 assessment_type text not null, model_name text not null, model_version text not null, status text not null default 'COMPLETED',
 risk_probability numeric(8,6), risk_category text, confidence numeric(8,6), review_status text not null default 'AWAITING_REVIEW',
 reviewed_by uuid references app_users(id) on delete set null, reviewed_at timestamptz, created_by uuid not null references app_users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(hospital_id,assessment_uuid)
);
create index if not exists idx_ai_assessment_patient on ai_assessments(hospital_id,patient_id,created_at desc);

create table if not exists ai_assessment_inputs (
 id uuid primary key default gen_random_uuid(), assessment_id uuid not null references ai_assessments(id) on delete cascade,
 feature_key text not null, observation_id uuid references clinical_observations(id) on delete set null,
 value_numeric numeric, value_text text, unit text, source_type text not null default 'MANUAL', source_report_id uuid references clinical_reports(id) on delete set null,
 manual_override boolean not null default false, source_metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
 unique(assessment_id,feature_key)
);

create table if not exists ai_assessment_factors (
 id uuid primary key default gen_random_uuid(), assessment_id uuid not null references ai_assessments(id) on delete cascade,
 feature_key text not null, display_name text not null, input_value numeric, unit text, contribution_direction text,
 contribution_value numeric, explanation text, created_at timestamptz not null default now()
);
create table if not exists ai_assessment_recommendations (
 id uuid primary key default gen_random_uuid(), assessment_id uuid not null references ai_assessments(id) on delete cascade,
 sequence_no integer not null, recommendation_text text not null, source text not null default 'CKD_AI_MODEL', created_at timestamptz not null default now(),
 unique(assessment_id,sequence_no)
);

create table if not exists generated_reports (
 id uuid primary key default gen_random_uuid(), report_uuid uuid not null default gen_random_uuid(), hospital_id uuid not null references hospitals(id) on delete cascade,
 patient_id uuid not null references patients(id) on delete cascade, assessment_id uuid references ai_assessments(id) on delete set null,
 patient_document_id uuid references patient_documents(id) on delete set null, report_type text not null, file_name text not null,
 mime_type text not null default 'application/pdf', storage_key text not null, sha256_hash text, generated_by uuid not null references app_users(id),
 generated_at timestamptz not null default now(), version integer not null default 1, status text not null default 'ACTIVE', unique(hospital_id,report_uuid)
);
create index if not exists idx_generated_report_assessment on generated_reports(assessment_id,generated_at desc);
