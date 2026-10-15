-- Additive Sri Lankan hemodialysis research integration. Historical V1-V40 output contracts remain intact.
insert into predictive_model_registry(model_key,version,display_name,purpose,status,input_contract,
 validation_metadata,research_only,model_type,validation_status,local_validation_status,runtime_status,
 target_outcome,forecast_horizon,applicability,activated_at)
values
 ('hb','1.0.0','LK-RENAL-HB-1.0','Next-period hemoglobin regression in the Sri Lankan hemodialysis research cohort','RESEARCH',
  '{"required":["verified_dated_hemodialysis_history"],"minimumObservations":2,"source":"SERVER_STORED_VERIFIED"}',
  '{"clinical_validation":"NOT_COMPLETED","dataset_permission_status":"UNVERIFIED","source_preprocessing":"UPSTREAM_UNVERIFIED","selected_method":"PERSISTENCE_BASELINE","candidate_gate":"FAILED_TO_BEAT_PERSISTENCE"}',true,
  'PERSISTENCE_BASELINE','INTERNAL_RESEARCH_EVALUATION','NOT_CLINICALLY_VALIDATED','ACTIVE','NEXT_PERIOD_HEMOGLOBIN',
  'Next observed measurement 14–62 days; display anchor +30 days','{"requiresVerifiedMaintenanceHemodialysis":true,"country":"Sri Lanka","regression":true}',now()),
 ('urr','1.0.0','LK-RENAL-URR-1.0','Next-period urea reduction ratio regression; not a clinical adequacy decision','RESEARCH',
  '{"required":["verified_dated_hemodialysis_history","paired_urea"],"minimumObservations":2,"source":"SERVER_STORED_VERIFIED"}',
  '{"clinical_validation":"NOT_COMPLETED","dataset_permission_status":"UNVERIFIED","source_preprocessing":"UPSTREAM_UNVERIFIED"}',true,
  'RESEARCH_MODEL','INTERNAL_RESEARCH_EVALUATION','NOT_CLINICALLY_VALIDATED','ACTIVE','NEXT_PERIOD_URR',
  'Next observed measurement 14–62 days; display anchor +30 days','{"requiresVerifiedMaintenanceHemodialysis":true,"country":"Sri Lanka","regression":true}',now()),
 ('dry-weight','1.0.0','LK-RENAL-DRYWEIGHT-1.0','Next-period dry weight research benchmark; never an automatic treatment target','NOT_AVAILABLE',
  '{"required":["verified_dated_hemodialysis_history","dry_weight"],"minimumObservations":2,"source":"SERVER_STORED_VERIFIED"}',
  '{"clinical_validation":"NOT_COMPLETED","dataset_permission_status":"UNVERIFIED","source_preprocessing":"UPSTREAM_UNVERIFIED","training_status":"INSUFFICIENT_DATA"}',true,
  'RESEARCH_MODEL','INTERNAL_RESEARCH_EVALUATION','NOT_CLINICALLY_VALIDATED','NOT_INSTALLED','NEXT_PERIOD_DRY_WEIGHT',
  'Next observed measurement 14–62 days; display anchor +30 days','{"requiresVerifiedMaintenanceHemodialysis":true,"country":"Sri Lanka","regression":true}',now())
on conflict(model_key,version) do nothing;

alter table predictive_model_registry add constraint predictive_registry_identity_key unique(id,model_key,version);
alter table predictive_prediction_snapshots add column model_key text;
alter table predictive_prediction_snapshots add constraint predictive_snapshot_registry_key
 foreign key(model_id,model_key,model_version) references predictive_model_registry(id,model_key,version);
alter table predictive_prediction_snapshots add constraint predictive_snapshot_patient_identity unique(hospital_id,patient_id,id);
alter table predictive_prediction_snapshots drop constraint predictive_horizon;
alter table predictive_prediction_snapshots add constraint predictive_horizon check((
 (model_key is null and horizon_months in (3,6,12)) or
 (model_key in ('hb','urr','dry-weight') and horizon_months=1)) is true);
alter table predictive_prediction_snapshots drop constraint predictive_prediction_output_shape;
alter table predictive_prediction_snapshots add constraint predictive_prediction_output_shape check((
 (model_key is null and ((status='AVAILABLE' and jsonb_typeof(outputs)='object') or (status<>'AVAILABLE' and outputs='[]'::jsonb)))
 or (model_key in ('hb','urr','dry-weight') and jsonb_typeof(outputs)='object'
   and outputs->>'model_key'=model_key and outputs->>'status'=status
   and outputs->>'model_version'=model_version and outputs->'probability'='null'::jsonb
   and outputs->>'clinical_validation'='NOT_COMPLETED' and outputs->>'dataset_permission_status'='UNVERIFIED'
   and outputs->'requires_clinician_review'='true'::jsonb
   and ((status='AVAILABLE' and case when jsonb_typeof(outputs->'prediction')='number'
     then (outputs->>'prediction')::numeric between 0 and case model_key when 'hb' then 25 when 'urr' then 100 else 300 end else false end)
     or (status<>'AVAILABLE' and outputs->'prediction'='null'::jsonb))
   and status in ('AVAILABLE','INSUFFICIENT_DATA','NOT_AVAILABLE'))) is true);

create unique index if not exists uq_departments_hospital_identity on departments(hospital_id,id);
create table sri_lankan_renal_observations (
 id uuid primary key default gen_random_uuid(), hospital_id uuid not null, patient_id uuid not null,
 observed_at timestamptz not null, maintenance_hemodialysis_verified boolean not null,
 measurements jsonb not null, units jsonb not null, source_note text not null,
 source_verified boolean not null check(source_verified), source_type text not null default 'CLINICIAN_VERIFIED_RENAL_SESSION',
 actor_id uuid not null references app_users(id), department_id uuid,
 request_id uuid not null, input_fingerprint char(64) not null, created_at timestamptz not null default now(),
 foreign key(hospital_id,patient_id) references patients(hospital_id,id),
 foreign key(hospital_id,department_id) references departments(hospital_id,id),
 unique(hospital_id,patient_id,id), unique(hospital_id,patient_id,actor_id,request_id),
 unique(hospital_id,patient_id,observed_at),
 constraint renal_observation_measurements check(jsonb_typeof(measurements)='object' and measurements<>'{}'::jsonb),
 constraint renal_observation_units check(jsonb_typeof(units)='object'),
 constraint renal_observation_source_note check(length(btrim(source_note)) between 1 and 2000),
 constraint renal_observation_date check(observed_at>=timestamptz '1900-01-01 00:00:00+00' and observed_at<=created_at),
 constraint renal_observation_source_type check(source_type='CLINICIAN_VERIFIED_RENAL_SESSION')
);
create index idx_renal_observation_patient on sri_lankan_renal_observations(hospital_id,patient_id,observed_at desc);
create trigger immutable_renal_observations before update or delete on sri_lankan_renal_observations
 for each row execute function reject_predictive_history_mutation();

create table sri_lankan_renal_review_events (
 id uuid primary key default gen_random_uuid(), hospital_id uuid not null, patient_id uuid not null,
 prediction_id uuid not null, actor_id uuid not null references app_users(id), department_id uuid,
 request_id uuid not null, action text not null, reason text not null, clinical_note text,
 modified_interpretation text, review_version integer not null, input_fingerprint char(64) not null,
 model_key text not null, model_version text not null, prediction_snapshot jsonb not null,
 created_at timestamptz not null default now(),
 foreign key(hospital_id,patient_id,prediction_id) references predictive_prediction_snapshots(hospital_id,patient_id,id),
 foreign key(hospital_id,department_id) references departments(hospital_id,id),
 unique(hospital_id,patient_id,actor_id,request_id), unique(prediction_id,review_version),
 constraint renal_review_action check(action in ('ACCEPT','MODIFY','DEFER','DISMISS')),
 constraint renal_review_reason check(length(btrim(reason)) between 1 and 2000),
 constraint renal_review_note check(clinical_note is null or length(clinical_note)<=4000),
 constraint renal_review_modified check(((action='MODIFY' and length(btrim(modified_interpretation)) between 1 and 4000)
   or (action<>'MODIFY' and modified_interpretation is null)) is true),
 constraint renal_review_version check(review_version>0),
 constraint renal_review_model check(model_key in ('hb','urr','dry-weight'))
);
create index idx_renal_review_patient on sri_lankan_renal_review_events(hospital_id,patient_id,prediction_id,review_version desc);
create trigger immutable_renal_review_events before update or delete on sri_lankan_renal_review_events
 for each row execute function reject_predictive_history_mutation();
