-- Clinician-sourced dialysis context without manufacturing a laboratory observation.
create table renal_dialysis_context_events (
 id uuid primary key default gen_random_uuid(), hospital_id uuid not null, patient_id uuid not null,
 actor_id uuid not null references app_users(id), department_id uuid, request_id uuid not null,
 context_status text not null, verified_at timestamptz not null, source_note text not null,
 source_verified boolean not null, input_fingerprint char(64) not null,
 created_at timestamptz not null default now(),
 foreign key(hospital_id,patient_id) references patients(hospital_id,id),
 foreign key(hospital_id,department_id) references departments(hospital_id,id),
 unique(hospital_id,patient_id,actor_id,request_id),
 constraint renal_context_status check(context_status in ('MAINTENANCE_HD','NOT_ON_MAINTENANCE_HD','UNCONFIRMED')),
 constraint renal_context_source check(source_verified is true and length(btrim(source_note)) between 1 and 2000),
 constraint renal_context_date check(verified_at<=created_at)
);
create index idx_renal_context_patient on renal_dialysis_context_events(hospital_id,patient_id,verified_at desc,created_at desc);
create trigger immutable_renal_dialysis_context before update or delete on renal_dialysis_context_events
 for each row execute function reject_predictive_history_mutation();
