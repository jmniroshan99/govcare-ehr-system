-- Add source sampling context without assigning collection times to historical observations.
alter table sri_lankan_renal_observations add column if not exists sampling_context jsonb not null default '{}'::jsonb;
comment on column sri_lankan_renal_observations.sampling_context is 'Verified source session identifier, patient linkage and pre/post collection timestamps. Empty legacy metadata is not inferred.';
