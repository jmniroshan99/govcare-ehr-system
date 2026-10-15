create table if not exists workflow_drafts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references app_users(id), hospital_id uuid not null references hospitals(id), department_id uuid,
 patient_id uuid references patients(id), workflow_type varchar(80) not null, form_type varchar(80) not null, draft_data jsonb not null default '{}'::jsonb,
 status varchar(20) not null default 'DRAFT' check(status in('DRAFT','IN_PROGRESS','SUBMITTED','SAVED','CANCELLED','ARCHIVED','EXPIRED')),
 request_id varchar(120), version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), last_accessed_at timestamptz not null default now(), submitted_at timestamptz, archived_at timestamptz
);
create unique index if not exists uq_workflow_draft_active on workflow_drafts(user_id,hospital_id,coalesce(patient_id,'00000000-0000-0000-0000-000000000000'::uuid),workflow_type,form_type) where status in('DRAFT','IN_PROGRESS','SAVED');
create index if not exists idx_workflow_draft_scope on workflow_drafts(user_id,hospital_id,patient_id,status,updated_at desc);
