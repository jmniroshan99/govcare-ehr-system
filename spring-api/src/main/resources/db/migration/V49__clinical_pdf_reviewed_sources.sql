-- Source document review is separate from laboratory observation verification.
alter table clinical_reports add column if not exists extraction_metadata jsonb not null default '{}'::jsonb;
alter table clinical_reports add column if not exists replaces_report_id uuid references clinical_reports(id);
alter table clinical_reports add column if not exists revision_reason text;
create index if not exists idx_clinical_report_replaces on clinical_reports(replaces_report_id) where replaces_report_id is not null;
