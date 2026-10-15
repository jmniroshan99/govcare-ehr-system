-- Additive runtime governance. Historical outputs and all V1-V39 migrations are preserved.
alter table predictive_model_registry
  add column if not exists target_outcome text,
  add column if not exists forecast_horizon text,
  add column if not exists reference text,
  add column if not exists applicability jsonb not null default '{}'::jsonb,
  add column if not exists activated_at timestamptz,
  add column if not exists retired_at timestamptz,
  add column if not exists last_validation_date date;

-- Supersede the unsafe runtime only; keep its registry row and linked historical snapshots.
update predictive_model_registry set runtime_status='RETIRED',retired_at=now()
where model_key='egfr_trajectory' and version='trend-linear-1.0';

insert into predictive_model_registry(model_key,version,display_name,purpose,status,input_contract,
  model_type,validation_status,local_validation_status,runtime_status,target_outcome,forecast_horizon,
  reference,applicability,activated_at)
values
 ('egfr_trajectory','trend-linear-2.0','Patient-specific eGFR projection',
  'Dated patient-specific statistical extrapolation; no disease probability or future-stage diagnosis','RESEARCH',
  '{"required":["dated_egfr_series","creatinine","date_of_birth"],"minimumObservations":2,"minimumWindowDays":90,"horizonsMonths":[3,6,12]}',
  'TREND_PROJECTION','STATISTICAL_PROJECTION_NOT_CLINICALLY_VALIDATED','NOT_APPLICABLE','ACTIVE',
  'CKD_PROGRESSION','3 / 6 / 12 months','Ordinary least squares with Student-t prediction intervals; GovCare conservative renal review policy v2',
  '{"minimumAgeYears":18,"minimumHistoryDays":90,"freshnessDays":90,"requiresRenalSafetyGate":true}',now()),
 ('renal_safety','govcare-longitudinal-2.0.0','Renal safety review',
  'Current laboratory/context safety gate; not future AKI probability','RESEARCH','{"required":["creatinine","egfr"]}',
  'RULE_BASED','CLINICAL_RULE_NOT_PROBABILITY','NOT_LOCALLY_VALIDATED','ACTIVE','AKI','Current data',
  'https://kdigo.org/wp-content/uploads/2016/10/KDIGO-2012-AKI-Guideline-English.pdf',
  '{"minimumAgeYears":18,"notADiagnosis":true}',now()),
 ('hyperkalemia_monitoring','govcare-longitudinal-2.0.0','Potassium review signal',
  'Current potassium monitoring and medication context; not future hyperkalemia probability','RESEARCH','{"required":["potassium"]}',
  'RULE_BASED','CLINICAL_RULE_NOT_PROBABILITY','NOT_LOCALLY_VALIDATED','ACTIVE','HYPERKALEMIA','Current data',
  'https://guidelines.ukkidney.org/hyperkalaemia/',
  '{"minimumAgeYears":18,"notADiagnosis":true,"medicationReconciliationRequired":true}',now()),
 ('anemia_monitoring','govcare-longitudinal-2.0.0','Anemia review signal',
  'Hemoglobin review and longitudinal context; does not establish CKD anemia','RESEARCH','{"required":["hemoglobin","date_of_birth"]}',
  'RULE_BASED','CLINICAL_RULE_NOT_PROBABILITY','NOT_LOCALLY_VALIDATED','ACTIVE','ANEMIA','Current data',
  'https://kdigo.org/wp-content/uploads/2026/01/KDIGO-2026-Anemia-in-CKD-Guideline.pdf',
  '{"minimumAgeYears":18,"notADiagnosis":true,"sourceReferenceRangePreferred":true}',now()),
 ('hospitalization','not-installed','Hospitalization risk adapter',
  'Future research model extension; no reviewed model installed','NOT_AVAILABLE','{"required":["dated_encounters","comorbidity_history","medication_history"]}',
  'RESEARCH_MODEL','NOT_INSTALLED','NOT_LOCALLY_VALIDATED','NOT_INSTALLED','HOSPITALIZATION','Model-specific',null,'{}',null)
on conflict(model_key,version) do nothing;

update predictive_model_registry set target_outcome=case model_key
  when 'kfre' then 'KIDNEY_FAILURE' when 'cardiovascular' then 'CARDIOVASCULAR'
  when 'aki' then 'AKI' when 'ckd_progression' then 'CKD_PROGRESSION'
  when 'hyperkalemia' then 'HYPERKALEMIA' when 'anemia' then 'ANEMIA' else target_outcome end,
  local_validation_status='NOT_LOCALLY_VALIDATED'
where version='not-installed';

alter table predictive_prediction_snapshots
  add column if not exists assessment_id uuid references ai_assessments(id),
  add column if not exists method_type text,
  add column if not exists model_version text,
  add column if not exists validation_status text,
  add column if not exists local_validation_status text,
  add column if not exists data_completeness_percent integer check(data_completeness_percent between 0 and 100),
  add column if not exists elapsed_ms bigint check(elapsed_ms>=0);
create index if not exists idx_predictive_snapshot_assessment on predictive_prediction_snapshots(hospital_id,patient_id,assessment_id,created_at desc);

alter table predictive_clinician_feedback
  add column if not exists reason_code text,
  add column if not exists clinical_note text,
  add constraint predictive_feedback_reason_code check(reason_code is null or reason_code in
    ('CLINICAL_JUDGMENT','INCORRECT_DATA','ALREADY_MANAGED','CONTRAINDICATED','PATIENT_PREFERENCE','NOT_RELEVANT','OTHER')),
  add constraint predictive_feedback_clinical_note check(clinical_note is null or length(clinical_note)<=4000);

-- Operational monitoring only. These counters do not measure clinical accuracy or calibration.
create table predictive_model_monitoring (
  hospital_id uuid not null references hospitals(id),
  model_id uuid not null references predictive_model_registry(id),
  monitoring_date date not null default current_date,
  prediction_count bigint not null default 0 check(prediction_count>=0),
  failure_count bigint not null default 0 check(failure_count>=0 and failure_count<=prediction_count),
  latency_total_ms bigint not null default 0 check(latency_total_ms>=0),
  input_missing_rate numeric not null default 0 check(input_missing_rate between 0 and 1),
  risk_distribution jsonb not null default '{}'::jsonb,
  model_version text not null,
  data_drift_status text not null default 'NOT_EVALUATED',
  last_validation_date date,
  updated_at timestamptz not null default now(),
  primary key(hospital_id,model_id,monitoring_date)
);

-- Separate registry/runtime status from clinical validation. No model is promoted to VALIDATED here.
