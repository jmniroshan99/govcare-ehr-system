create table if not exists ai_deterioration_assessments (
 id uuid primary key default gen_random_uuid(), hospital_id uuid not null references hospitals(id) on delete cascade,
 patient_id uuid not null references patients(id) on delete cascade, score integer not null check(score between 0 and 30),
 risk_level text not null check(risk_level in('LOW','MEDIUM','HIGH','CRITICAL')), confidence numeric(5,2) not null,
 input_data jsonb not null, contributing_factors jsonb not null default '[]'::jsonb, recommendation text not null,
 model_version text not null, status text not null default 'OPEN' check(status in('OPEN','REVIEWED')),
 reviewed_by uuid references app_users(id) on delete set null, reviewed_at timestamptz, review_note text,
 created_by uuid references app_users(id) on delete set null, created_at timestamptz not null default now()
);
create index if not exists idx_ai_risk_hospital_created on ai_deterioration_assessments(hospital_id,created_at desc);
create index if not exists idx_ai_risk_patient_created on ai_deterioration_assessments(patient_id,created_at desc);
