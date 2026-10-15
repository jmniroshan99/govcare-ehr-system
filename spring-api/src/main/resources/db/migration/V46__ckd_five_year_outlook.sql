-- Additive research outlook. Existing measurements, predictions and migrations are unchanged.
create table ckd_outlook_snapshots (
 id uuid primary key default gen_random_uuid(), hospital_id uuid not null, patient_id uuid not null,
 requested_by uuid not null references app_users(id), request_id uuid not null,
 request_fingerprint char(64) not null, evidence_fingerprint char(64) not null,
 status text not null, model_version text not null, outputs jsonb not null,
 created_at timestamptz not null default now(),
 foreign key(hospital_id,patient_id) references patients(hospital_id,id),
 unique(hospital_id,patient_id,id), unique(hospital_id,patient_id,requested_by,request_id),
 constraint ckd_outlook_status check(status in ('AVAILABLE','NOT_APPLICABLE','INSUFFICIENT_DATA','SOURCE_REVIEW_REQUIRED','CLINICAL_CONTEXT_REQUIRED')),
 constraint ckd_outlook_shape check((jsonb_typeof(outputs)='object' and outputs->>'id'=id::text
   and outputs->>'hospitalId'=hospital_id::text and outputs->>'patientId'=patient_id::text
   and outputs->>'status'=status and outputs ?& array['evidence','model','twoYearRisk','fiveYearRisk']) is true),
 constraint ckd_outlook_risks check((case when status='AVAILABLE' then
   jsonb_typeof(outputs->'twoYearRisk')='number' and jsonb_typeof(outputs->'fiveYearRisk')='number'
   and (outputs->>'twoYearRisk')::numeric between 0 and 1 and (outputs->>'fiveYearRisk')::numeric between 0 and 1
   and (outputs->>'twoYearRisk')::numeric <= (outputs->>'fiveYearRisk')::numeric
   else outputs->'twoYearRisk'='null'::jsonb and outputs->'fiveYearRisk'='null'::jsonb end) is true)
);
create index idx_ckd_outlook_patient on ckd_outlook_snapshots(hospital_id,patient_id,created_at desc);
create trigger immutable_ckd_outlook_snapshots before update or delete on ckd_outlook_snapshots
 for each row execute function reject_predictive_history_mutation();

create table ckd_outlook_reviews (
 id uuid primary key default gen_random_uuid(), hospital_id uuid not null, patient_id uuid not null,
 snapshot_id uuid not null, actor_id uuid not null references app_users(id), request_id uuid not null,
 action text not null check(action in ('ACCEPT','MODIFY','DEFER','DISMISS')), reason text not null,
 clinical_note text, modified_interpretation text, milestones jsonb not null default '[]'::jsonb,
 review_version integer not null check(review_version>0), input_fingerprint char(64) not null,
 created_at timestamptz not null default now(),
 foreign key(hospital_id,patient_id,snapshot_id) references ckd_outlook_snapshots(hospital_id,patient_id,id),
 unique(hospital_id,patient_id,actor_id,request_id), unique(snapshot_id,review_version),
 constraint ckd_outlook_reason check(length(btrim(reason)) between 1 and 2000),
 constraint ckd_outlook_note check(clinical_note is null or length(clinical_note)<=4000),
 constraint ckd_outlook_modified check(((action='MODIFY' and length(btrim(modified_interpretation)) between 1 and 4000)
   or (action<>'MODIFY' and modified_interpretation is null)) is true),
 constraint ckd_outlook_plans check(jsonb_typeof(milestones)='array' and jsonb_array_length(milestones)<=12)
);
create index idx_ckd_outlook_reviews on ckd_outlook_reviews(hospital_id,patient_id,snapshot_id,review_version desc);
create trigger immutable_ckd_outlook_reviews before update or delete on ckd_outlook_reviews
 for each row execute function reject_predictive_history_mutation();
