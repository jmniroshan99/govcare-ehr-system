-- Additive research-CDSS foundation. No historical dates, measurements or probabilities are backfilled.
create unique index if not exists uq_patients_hospital_identity on patients(hospital_id,id);

create table predictive_model_registry (
 id uuid primary key default gen_random_uuid(), model_key text not null, version text not null,
 display_name text not null, purpose text not null, status text not null default 'NOT_AVAILABLE',
 input_contract jsonb not null default '{}'::jsonb, validation_metadata jsonb not null default '{}'::jsonb,
 research_only boolean not null default true, created_at timestamptz not null default now(),
 unique(model_key,version), constraint predictive_model_status check(status in ('NOT_AVAILABLE','RESEARCH','VALIDATED','RETIRED'))
);
insert into predictive_model_registry(model_key,version,display_name,purpose,input_contract) values
 ('egfr_trajectory','not-installed','eGFR trajectory','3, 6 and 12 month trajectory with calibrated uncertainty','{"required":["dated_egfr_series","age","clinical_context"]}'),
 ('ckd_progression','not-installed','CKD progression','Validated longitudinal progression risk','{"required":["dated_egfr_series","acr","age"]}'),
 ('kfre','not-installed','Kidney failure risk','Validated KFRE adapter with its published 2/5-year horizons','{"required":["age","sex","egfr","acr"],"horizonsYears":[2,5]}'),
 ('aki','not-installed','Acute kidney injury','Validated future AKI risk; distinct from present laboratory safety criteria','{}'),
 ('hyperkalemia','not-installed','Hyperkalemia','Validated future hyperkalemia risk','{}'),
 ('cardiovascular','not-installed','Cardiovascular risk','Validated cardiovascular model in its eligible population','{}'),
 ('anemia','not-installed','Anemia','Validated future anemia risk','{}');

create table predictive_recommendations (
 id uuid primary key, hospital_id uuid not null, patient_id uuid not null,
 rule_key text not null, rule_version text not null, evidence_fingerprint text not null,
 finding_snapshot jsonb not null, review_state text not null default 'AWAITING_REVIEW',
 version integer not null default 0, reviewed_by uuid references app_users(id), reviewed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(hospital_id,patient_id) references patients(hospital_id,id),
 unique(hospital_id,patient_id,rule_key,rule_version,evidence_fingerprint),
 unique(hospital_id,patient_id,id),
 constraint predictive_review_state check(review_state in ('AWAITING_REVIEW','ACCEPT','MODIFY','DISMISS','DEFER')),
 constraint predictive_review_version check(version>=0)
);
create index idx_predictive_recommendation_patient on predictive_recommendations(hospital_id,patient_id,updated_at desc);

create table predictive_clinician_feedback (
 id uuid primary key default gen_random_uuid(), hospital_id uuid not null, patient_id uuid not null,
 recommendation_id uuid not null, actor_id uuid not null references app_users(id), request_id uuid not null,
 action text not null, reason text not null, modified_recommendation text, evidence_fingerprint text not null,
 review_version integer not null, created_at timestamptz not null default now(),
 foreign key(hospital_id,patient_id,recommendation_id) references predictive_recommendations(hospital_id,patient_id,id),
 unique(hospital_id,patient_id,actor_id,request_id),
 constraint predictive_feedback_action check(action in ('ACCEPT','MODIFY','DISMISS','DEFER')),
 constraint predictive_feedback_reason check(length(btrim(reason)) between 1 and 2000),
 constraint predictive_feedback_modified check((action='MODIFY' and modified_recommendation is not null and length(btrim(modified_recommendation)) between 1 and 4000)
   or (action<>'MODIFY' and (modified_recommendation is null or length(btrim(modified_recommendation))=0))),
 constraint predictive_feedback_version check(review_version>0)
);

create table predictive_prediction_snapshots (
 id uuid primary key, hospital_id uuid not null, patient_id uuid not null,
 requested_by uuid not null references app_users(id), request_id uuid not null, horizon_months integer not null,
 model_id uuid not null references predictive_model_registry(id), status text not null,
 input_snapshot jsonb not null, quality_snapshot jsonb not null, safety_snapshot jsonb not null,
 outputs jsonb not null default '[]'::jsonb, explanation text not null, created_at timestamptz not null default now(),
 foreign key(hospital_id,patient_id) references patients(hospital_id,id),
 unique(hospital_id,patient_id,requested_by,request_id),
 constraint predictive_horizon check(horizon_months in (3,6,12)),
 constraint predictive_prediction_status check(status in ('NOT_AVAILABLE','INSUFFICIENT_DATA','SUPPRESSED')),
 constraint predictive_unavailable_output check(outputs='[]'::jsonb)
);
create index idx_predictive_prediction_patient on predictive_prediction_snapshots(hospital_id,patient_id,created_at desc);

create table predictive_audit_events (
 id uuid primary key default gen_random_uuid(), hospital_id uuid not null, patient_id uuid not null,
 actor_id uuid not null references app_users(id), event_type text not null,
 resource_id uuid, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
 foreign key(hospital_id,patient_id) references patients(hospital_id,id)
);
create index idx_predictive_audit_patient on predictive_audit_events(hospital_id,patient_id,created_at desc);
create unique index if not exists uq_predictive_observation_identity on clinical_observations(hospital_id,patient_id,id);
create table predictive_observation_entries (
 id uuid primary key default gen_random_uuid(), hospital_id uuid not null, patient_id uuid not null,
 observation_id uuid not null, actor_id uuid not null references app_users(id), request_id uuid not null,
 input_fingerprint text not null, source_note text not null, created_at timestamptz not null default now(),
 foreign key(hospital_id,patient_id,observation_id) references clinical_observations(hospital_id,patient_id,id),
 unique(hospital_id,patient_id,actor_id,request_id),
 unique(hospital_id,patient_id,observation_id),
 constraint predictive_observation_source_note check(length(btrim(source_note)) between 1 and 2000)
);
create index if not exists idx_predictive_observation_final on clinical_observations(hospital_id,patient_id,effective_at desc) where status='FINAL';
create index if not exists idx_predictive_fhir_patient on fhir_resource(hospital_id,patient_id,resource_type);

create function reject_predictive_history_mutation() returns trigger language plpgsql as $$
begin raise exception 'Predictive clinical history is append-only'; end;
$$;
create trigger immutable_predictive_feedback before update or delete on predictive_clinician_feedback for each row execute function reject_predictive_history_mutation();
create trigger immutable_predictive_predictions before update or delete on predictive_prediction_snapshots for each row execute function reject_predictive_history_mutation();
create trigger immutable_predictive_audit before update or delete on predictive_audit_events for each row execute function reject_predictive_history_mutation();
create trigger immutable_predictive_observation_entry before update or delete on predictive_observation_entries for each row execute function reject_predictive_history_mutation();
