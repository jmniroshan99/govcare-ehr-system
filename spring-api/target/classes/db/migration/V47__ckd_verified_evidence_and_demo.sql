create table ckd_diabetes_context_events (
 id uuid primary key default gen_random_uuid(), hospital_id uuid not null, patient_id uuid not null,
 actor_id uuid not null references app_users(id), request_id uuid not null,
 context_status text not null check(context_status in ('CONFIRMED_DIABETES','NO_KNOWN_DIABETES','UNCONFIRMED')),
 verified_at timestamptz not null, source_note text not null check(length(btrim(source_note)) between 1 and 2000),
 input_fingerprint char(64) not null, created_at timestamptz not null default now(),
 foreign key(hospital_id,patient_id) references patients(hospital_id,id),
 unique(hospital_id,patient_id,actor_id,request_id), check(verified_at<=created_at)
);
create index idx_ckd_diabetes_context on ckd_diabetes_context_events(hospital_id,patient_id,verified_at desc,created_at desc);
create trigger immutable_ckd_diabetes_context before update or delete on ckd_diabetes_context_events for each row execute function reject_predictive_history_mutation();
create table ckd_research_demo_runs (
 id uuid primary key default gen_random_uuid(), hospital_id uuid not null references hospitals(id),
 actor_id uuid not null references app_users(id), request_id uuid not null, outputs jsonb not null,
 created_at timestamptz not null default now(), unique(hospital_id,actor_id,request_id),
 check((jsonb_typeof(outputs)='object' and outputs->>'synthetic'='true') is true)
);
create trigger immutable_ckd_research_demo_runs before update or delete on ckd_research_demo_runs for each row execute function reject_predictive_history_mutation();
