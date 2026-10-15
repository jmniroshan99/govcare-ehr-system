-- Additive replacement of the active renal cards; legacy model adapters and snapshots are retained.
create table renal_clinical_module_snapshots (
 id uuid primary key default gen_random_uuid(), hospital_id uuid not null, patient_id uuid not null,
 requested_by uuid not null references app_users(id), source_fingerprint char(64) not null,
 rule_version text not null, outputs jsonb not null, created_at timestamptz not null default now(),
 foreign key(hospital_id,patient_id) references patients(hospital_id,id),
 unique(hospital_id,patient_id,id), unique(hospital_id,patient_id,source_fingerprint),
 constraint renal_modules_shape check((jsonb_typeof(outputs)='object' and outputs->>'patientId'=patient_id::text
  and outputs->>'hospitalId'=hospital_id::text and outputs->>'snapshotId'=id::text
  and outputs ?& array['renalTrajectory','kidneyFailureStatus','hyperkalemia','anemia','dialysisAdequacy','renalDeterioration','dataQuality']) is true)
);
create index idx_renal_modules_patient on renal_clinical_module_snapshots(hospital_id,patient_id,created_at desc);
create trigger immutable_renal_module_snapshots before update or delete on renal_clinical_module_snapshots
 for each row execute function reject_predictive_history_mutation();

create table renal_clinical_module_reviews (
 id uuid primary key default gen_random_uuid(), hospital_id uuid not null, patient_id uuid not null,
 snapshot_id uuid not null, module_key text not null, actor_id uuid not null references app_users(id),
 department_id uuid, request_id uuid not null, action text not null, reason text not null,
 clinical_note text, modified_interpretation text, review_version integer not null,
 input_fingerprint char(64) not null, method text not null, model_version text not null,
 module_snapshot jsonb not null, created_at timestamptz not null default now(),
 foreign key(hospital_id,patient_id,snapshot_id) references renal_clinical_module_snapshots(hospital_id,patient_id,id),
 foreign key(hospital_id,department_id) references departments(hospital_id,id),
 unique(hospital_id,patient_id,actor_id,request_id), unique(snapshot_id,module_key,review_version),
 constraint renal_modules_review_key check(module_key in ('renalTrajectory','kidneyFailureStatus','hyperkalemia','anemia','dialysisAdequacy','renalDeterioration')),
 constraint renal_modules_review_action check(action in ('ACCEPT','MODIFY','DEFER','DISMISS')),
 constraint renal_modules_review_reason check(length(btrim(reason)) between 1 and 2000),
 constraint renal_modules_review_version check(review_version>0),
 constraint renal_modules_review_note check(clinical_note is null or length(clinical_note)<=4000),
 constraint renal_modules_review_modified check(((action='MODIFY' and length(btrim(modified_interpretation)) between 1 and 4000)
   or (action<>'MODIFY' and modified_interpretation is null)) is true),
 constraint renal_modules_review_shape check(jsonb_typeof(module_snapshot)='object')
);
create index idx_renal_module_reviews_patient on renal_clinical_module_reviews(hospital_id,patient_id,snapshot_id,module_key,review_version desc);
create trigger immutable_renal_module_reviews before update or delete on renal_clinical_module_reviews
 for each row execute function reject_predictive_history_mutation();

alter table renal_clinical_module_snapshots add constraint renal_modules_order check((outputs->'moduleOrder'=
 '["renalTrajectory","kidneyFailureStatus","hyperkalemia","anemia","dialysisAdequacy","renalDeterioration"]'::jsonb) is true);
alter table renal_clinical_module_snapshots add constraint renal_modules_no_invented_probabilities check((
 outputs->'renalTrajectory'->'researchRiskScore'='null'::jsonb and outputs->'kidneyFailureStatus'->'researchRiskScore'='null'::jsonb
 and outputs->'anemia'->'researchRiskScore'='null'::jsonb and outputs->'dialysisAdequacy'->'researchRiskScore'='null'::jsonb
 and outputs->'renalDeterioration'->'researchRiskScore'='null'::jsonb
 and (outputs->'hyperkalemia'->'researchRiskScore'='null'::jsonb or case when jsonb_typeof(outputs->'hyperkalemia'->'researchRiskScore')='number'
 then (outputs->'hyperkalemia'->>'researchRiskScore')::numeric between 0 and 1 else false end)) is true);
