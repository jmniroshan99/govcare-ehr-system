-- Sri Lankan longitudinal hyperkalemia research classifier and four-output renal intelligence support.
-- Additive only: no historical observations, predictions, reviews or FHIR resources are deleted.
insert into predictive_model_registry(model_key,version,display_name,purpose,status,input_contract,
 validation_metadata,research_only,model_type,validation_status,local_validation_status,runtime_status,
 target_outcome,forecast_horizon,applicability,activated_at)
values
 ('hyperkalemia','1.0.0','LK-RENAL-HYPERK-1.0',
  'Research-only next-period pre-dialysis potassium >=5.5 mmol/L risk score in the Sri Lankan maintenance-hemodialysis cohort; not a calibrated diagnosis or treatment probability',
  'RESEARCH',
  '{"required":["verified_dated_hemodialysis_history","potassium_pre"],"minimumObservations":2,"source":"SERVER_STORED_VERIFIED","targetThreshold":5.5,"targetUnit":"mmol/L"}',
  '{"clinical_validation":"NOT_COMPLETED","dataset_permission_status":"UNVERIFIED","calibration":"NOT_ESTABLISHED","source_preprocessing":"UPSTREAM_UNVERIFIED","selection_uses_test":false}',
  true,'RESEARCH_MODEL','INTERNAL_RESEARCH_EVALUATION','NOT_CLINICALLY_VALIDATED','ACTIVE',
  'NEXT_PERIOD_PRE_DIALYSIS_HYPERKALEMIA_RESEARCH_LABEL','Next observed measurement 14–62 days; display anchor +30 days',
  '{"requiresVerifiedMaintenanceHemodialysis":true,"country":"Sri Lanka","classifier":true,"probabilityIsResearchRiskScore":true,"notTreatmentDecision":true}',now())
on conflict(model_key,version) do nothing;

alter table predictive_prediction_snapshots drop constraint predictive_horizon;
alter table predictive_prediction_snapshots add constraint predictive_horizon check((
 (model_key is null and horizon_months in (3,6,12)) or
 (model_key in ('hb','urr','hyperkalemia','dry-weight') and horizon_months=1)) is true);

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
   and status in ('AVAILABLE','INSUFFICIENT_DATA','NOT_AVAILABLE'))
 or (model_key='hyperkalemia' and jsonb_typeof(outputs)='object'
   and outputs->>'model_key'='hyperkalemia' and outputs->>'status'=status
   and outputs->>'model_version'=model_version and outputs->'prediction'='null'::jsonb
   and outputs->>'clinical_validation'='NOT_COMPLETED' and outputs->>'dataset_permission_status'='UNVERIFIED'
   and outputs->'requires_clinician_review'='true'::jsonb
   and ((status='AVAILABLE' and jsonb_typeof(outputs->'probability')='number'
        and (outputs->>'probability')::numeric between 0 and 1
        and outputs->>'risk_category'='RESEARCH_RISK_SCORE')
     or (status<>'AVAILABLE' and outputs->'probability'='null'::jsonb))
   and status in ('AVAILABLE','INSUFFICIENT_DATA','NOT_AVAILABLE'))) is true);

alter table sri_lankan_renal_review_events drop constraint renal_review_model;
alter table sri_lankan_renal_review_events add constraint renal_review_model
 check(model_key in ('hb','urr','hyperkalemia','dry-weight'));
