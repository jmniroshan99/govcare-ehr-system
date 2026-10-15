create table if not exists ai_ckd_predictions (
 id uuid primary key default gen_random_uuid(), hospital_id uuid not null references hospitals(id), patient_id uuid not null references patients(id),
 probability numeric(8,6) not null check(probability between 0 and 1), risk_category text not null check(risk_category in('LOW','MODERATE','HIGH','URGENT_REVIEW')),
 confidence numeric(8,6) not null, predicted_class text not null, input_data jsonb not null, contributing_factors jsonb not null default '[]'::jsonb,
 recommendations jsonb not null default '[]'::jsonb, model_version text not null, request_id text not null, created_by uuid references app_users(id) on delete set null, created_at timestamptz not null default now()
);
create unique index if not exists uq_ai_ckd_request on ai_ckd_predictions(hospital_id,request_id);
create index if not exists idx_ai_ckd_patient on ai_ckd_predictions(hospital_id,patient_id,created_at desc);
