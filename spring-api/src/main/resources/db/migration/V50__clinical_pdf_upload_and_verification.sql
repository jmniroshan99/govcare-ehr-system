-- Document acceptance and reviewed observations have independent, patient-scoped lifecycle states.
alter table clinical_reports add column if not exists document_classification text not null default 'CLINICAL_DOCUMENT'
 check(document_classification in ('CLINICAL_DOCUMENT','TEST_DOCUMENT'));
alter table clinical_reports add column if not exists workflow_status text not null default 'MANUAL_REVIEW_REQUIRED'
 check(workflow_status in ('UPLOADED','PENDING_EXTRACTION','EXTRACTION_COMPLETED','PARTIAL_EXTRACTION','MANUAL_REVIEW_REQUIRED','CLINICAL_DATA_VERIFIED','EXTRACTION_FAILED'));
alter table patient_documents add column if not exists document_classification text not null default 'CLINICAL_DOCUMENT'
 check(document_classification in ('CLINICAL_DOCUMENT','TEST_DOCUMENT'));
alter table clinical_observations add column if not exists source_metadata jsonb not null default '{}'::jsonb;
alter table clinical_observations add column if not exists document_classification text not null default 'CLINICAL_DOCUMENT'
 check(document_classification in ('CLINICAL_DOCUMENT','TEST_DOCUMENT'));
create unique index if not exists uq_clinical_pdf_report_scope on clinical_reports(hospital_id,patient_id,id);
create table clinical_pdf_verifications (
 id uuid primary key default gen_random_uuid(), hospital_id uuid not null, patient_id uuid not null, report_id uuid not null,
 actor_id uuid not null references app_users(id), request_id uuid not null, input_fingerprint text not null,
 observations jsonb not null, review_note text not null, created_at timestamptz not null default now(),
 foreign key(hospital_id,patient_id,report_id) references clinical_reports(hospital_id,patient_id,id),
 unique(hospital_id,patient_id,report_id,input_fingerprint),
 unique(hospital_id,patient_id,report_id,actor_id,request_id)
);
