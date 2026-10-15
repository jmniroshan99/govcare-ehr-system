-- Safe patient-specific trajectory forecasting runtime.
-- This migration does not introduce population disease probabilities.

alter table predictive_model_registry
  add column if not exists model_type text,
  add column if not exists validation_status text,
  add column if not exists local_validation_status text,
  add column if not exists runtime_status text,
  add column if not exists last_reviewed_at timestamptz;

update predictive_model_registry
set model_type = coalesce(model_type, case when model_key='egfr_trajectory' then 'TREND_PROJECTION' else 'VALIDATED_EQUATION' end),
    validation_status = coalesce(validation_status, case when version='not-installed' then 'NOT_INSTALLED' else status end),
    local_validation_status = coalesce(local_validation_status, case when version='not-installed' then 'NOT_INSTALLED' else 'NOT_LOCALLY_VALIDATED' end),
    runtime_status = coalesce(runtime_status, case when version='not-installed' then 'NOT_INSTALLED' else 'ACTIVE' end),
    last_reviewed_at = coalesce(last_reviewed_at, now());

insert into predictive_model_registry(
  id,model_key,version,display_name,purpose,input_contract,status,
  model_type,validation_status,local_validation_status,runtime_status,last_reviewed_at)
select gen_random_uuid(),'egfr_trajectory','trend-linear-1.0','Patient-specific eGFR trajectory',
       '3, 6 and 12 month statistical eGFR projection from the patient''s own dated measurements',
       '{"required":["dated_egfr_series"],"minimumObservations":2,"preferredObservations":3,"horizonsMonths":[3,6,12]}'::jsonb,
       'RESEARCH','TREND_PROJECTION','STATISTICAL_PROJECTION_NOT_CLINICALLY_VALIDATED','NOT_APPLICABLE','ACTIVE',now()
where not exists (
  select 1 from predictive_model_registry where model_key='egfr_trajectory' and version='trend-linear-1.0'
);

alter table predictive_prediction_snapshots drop constraint if exists predictive_prediction_status;
alter table predictive_prediction_snapshots drop constraint if exists predictive_unavailable_output;

alter table predictive_prediction_snapshots
  add constraint predictive_prediction_status
  check(status in ('AVAILABLE','INSUFFICIENT_DATA','BLOCKED_BY_SAFETY_GATE','NOT_INSTALLED','NOT_AVAILABLE','SUPPRESSED'));

alter table predictive_prediction_snapshots
  add constraint predictive_prediction_output_shape
  check(
    (status='AVAILABLE' and jsonb_typeof(outputs)='object')
    or (status<>'AVAILABLE' and outputs='[]'::jsonb)
  );

create index if not exists idx_predictive_model_runtime
  on predictive_model_registry(model_key,runtime_status,version);
