-- Additive, immutable mapping of saved CKD inputs. Existing assessments, observations and model artifacts are retained.
alter table ai_ckd_predictions add constraint uq_ckd_prediction_feature_scope unique(hospital_id,patient_id,id);
create table clinical_prediction_features (
 id uuid primary key default gen_random_uuid(), hospital_id uuid not null, patient_id uuid not null,
 source_assessment_id uuid not null unique, observation_date timestamptz, recorded_at timestamptz not null,
 creatinine numeric, egfr numeric, acr numeric, potassium numeric, hemoglobin numeric, hba1c numeric, proteinuria numeric,
 age numeric, bmi numeric, systolic numeric, diastolic numeric, glucose numeric, bun numeric,
 edema numeric, family_history numeric, previous_aki numeric, nsaids_use numeric,
 source text not null, raw_inputs jsonb not null, feature_metadata jsonb not null default '{}'::jsonb,
 normalization_version text not null, created_at timestamptz not null default now(),
 foreign key(hospital_id,patient_id) references patients(hospital_id,id),
 foreign key(hospital_id,patient_id,source_assessment_id) references ai_ckd_predictions(hospital_id,patient_id,id),
 constraint clinical_prediction_feature_source check(source='CKD_ASSESSMENT'),
 constraint clinical_prediction_feature_shape check((jsonb_typeof(raw_inputs)='object' and jsonb_typeof(feature_metadata)='object') is true),
 constraint clinical_prediction_feature_date check(observation_date is null or (observation_date>='1900-01-01'::timestamptz and observation_date<=created_at)),
 constraint clinical_prediction_feature_bounds check(
  (creatinine is null or creatinine>0 and creatinine<=50) and (egfr is null or egfr between 0 and 300)
  and (acr is null or acr between 0 and 100000) and (potassium is null or potassium>0 and potassium<=15)
  and (hemoglobin is null or hemoglobin>0 and hemoglobin<=30) and (hba1c is null or hba1c>0 and hba1c<=30)
  and (proteinuria is null or proteinuria between 0 and 100000) and (age is null or age between 0 and 120)
  and (bmi is null or bmi>0 and bmi<=150) and (systolic is null or systolic>0 and systolic<=350)
  and (diastolic is null or diastolic>0 and diastolic<=350) and (glucose is null or glucose>0 and glucose<=2000)
  and (bun is null or bun between 0 and 500) and (edema is null or edema in(0,1))
  and (family_history is null or family_history in(0,1)) and (previous_aki is null or previous_aki in(0,1))
  and (nsaids_use is null or nsaids_use between 0 and 10))
);
create index idx_clinical_prediction_features_patient on clinical_prediction_features(hospital_id,patient_id,recorded_at desc);
create index idx_clinical_prediction_features_date on clinical_prediction_features(hospital_id,patient_id,observation_date desc) where observation_date is not null;

-- Backfill uses persisted clinical dates and units, never assessment creation time as a laboratory date.
create function govcare_clinical_feature_date(value text) returns timestamptz language plpgsql stable as $$
declare result timestamptz;
begin
 if value is null or value !~ '^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$' then return null; end if;
 result:=value::timestamptz;
 if result<'1900-01-01'::timestamptz or result>now() then return null; end if;
 return result;
exception when others then return null;
end $$;
create function govcare_normalize_prediction_feature(feature text,raw text,source_unit text) returns numeric language plpgsql immutable as $$
declare value numeric; unit text; canonical text; maximum numeric; positive boolean:=true;
begin
 if raw is null then return null; end if; value:=raw::numeric;
 if value::text in ('NaN','Infinity','-Infinity') then return null; end if;
 if value<0 or value=0 and feature in('SerumCreatinine','SerumElectrolytesPotassium','HemoglobinLevels','HbA1c','BMI','SystolicBP','DiastolicBP','FastingBloodSugar') then return null;end if;
 unit:=replace(replace(replace(replace(replace(lower(coalesce(source_unit,'')),' ',''),'µ','u'),'μ','u'),'²','2'),'^','');
 case feature
  when 'SerumCreatinine' then canonical:='mg/dl';maximum:=50;if unit='umol/l' then value:=value/88.4;unit:=canonical;end if;
  when 'GFR' then canonical:='ml/min/1.73m2';maximum:=300;positive:=false;
  when 'ACR' then canonical:='mg/g';maximum:=100000;positive:=false;if unit='mg/mmol' then value:=value*8.84;unit:=canonical;elsif unit='ug/mg' then unit:=canonical;end if;
  when 'SerumElectrolytesPotassium' then canonical:='mmol/l';maximum:=15;if unit='meq/l' then unit:=canonical;end if;
  when 'HemoglobinLevels' then canonical:='g/dl';maximum:=30;if unit='g/l' then value:=value/10;unit:=canonical;end if;
  when 'HbA1c' then canonical:='%';maximum:=30;if unit='mmol/mol' then value:=value*.09148+2.15;unit:=canonical;end if;
  when 'ProteinInUrine' then canonical:='mg/dl';maximum:=100000;positive:=false;if unit='g/l' then value:=value*100;unit:=canonical;elsif unit='mg/l' then value:=value/10;unit:=canonical;end if;
  when 'Age' then canonical:='years';maximum:=120;positive:=false;
  when 'BMI' then canonical:='kg/m2';maximum:=150;
  when 'SystolicBP','DiastolicBP' then canonical:='mmhg';maximum:=350;if unit='mm[hg]' then unit:=canonical;end if;
  when 'FastingBloodSugar' then canonical:='mg/dl';maximum:=2000;if unit='mmol/l' then value:=value*18.0182;unit:=canonical;end if;
  when 'BUNLevels' then canonical:='mg/dl';maximum:=500;positive:=false;if unit='mmol/l' then value:=value*2.801;unit:=canonical;end if;
  when 'Edema','FamilyHistoryKidneyDisease','PreviousAcuteKidneyInjury' then canonical:='boolean';maximum:=1;positive:=false;if value not in(0,1) then return null;end if;
  when 'NSAIDsUse' then canonical:='assessmentscale';maximum:=10;positive:=false;
  else return null;
 end case;
 if unit='' and feature in('Age','Edema','FamilyHistoryKidneyDisease','PreviousAcuteKidneyInjury','NSAIDsUse') then unit:=canonical;end if;
 if unit<>canonical or value<0 or value>maximum or positive and value<=0 then return null;end if;
 return value;
exception when others then return null;
end $$;

with metadata as (
 select a.id,jsonb_object_agg(i.feature_key,(case when jsonb_typeof(i.source_metadata)='object' then i.source_metadata else '{}'::jsonb end) || jsonb_build_object(
  'unit',coalesce(i.unit,case i.feature_key when 'SerumCreatinine' then 'mg/dL' when 'GFR' then 'mL/min/1.73m²' when 'ACR' then 'mg/g'
    when 'SerumElectrolytesPotassium' then 'mmol/L' when 'HemoglobinLevels' then 'g/dL' when 'HbA1c' then '%'
    when 'ProteinInUrine' then 'mg/dL' when 'Age' then 'years' when 'BMI' then 'kg/m²' when 'SystolicBP' then 'mmHg' when 'DiastolicBP' then 'mmHg'
    when 'FastingBloodSugar' then 'mg/dL' when 'BUNLevels' then 'mg/dL' when 'NSAIDsUse' then 'assessment scale' else 'boolean' end),
  'source',i.source_type,'observationId',i.observation_id,
  'observedAt',coalesce(o.effective_at,r.specimen_collected_at,r.resulted_at,r.report_date),
  'referenceHigh',case when nullif(o.unit,'') is not null then o.reference_range_high end,'referenceHighUnit',o.unit,'excludedReason',case when jsonb_typeof(i.source_metadata)<>'object' then 'SOURCE_METADATA_INVALID' when (i.source_report_id is not null and r.id is null) or (i.observation_id is not null and o.id is null) then 'SOURCE_ASSOCIATION_INVALID' end)) as meta
 from ai_ckd_predictions a join ai_assessment_inputs i on i.assessment_id=a.id
 left join clinical_observations o on o.id=i.observation_id and o.hospital_id=a.hospital_id and o.patient_id=a.patient_id and o.status='FINAL'
 left join clinical_reports r on r.id=coalesce(i.source_report_id,o.report_id) and r.hospital_id=a.hospital_id and r.patient_id=a.patient_id and r.report_status='ACTIVE'
 group by a.id
), inputs as (
 select a.*,coalesce(m.meta,'{}'::jsonb) as meta from ai_ckd_predictions a left join metadata m on m.id=a.id
), features as (
 select a.id,a.hospital_id,a.patient_id,a.created_at,a.input_data,a.meta,
  x.key,case when a.meta->x.key->>'excludedReason' is not null or jsonb_typeof(a.input_data->x.key)<>'number'
    or (coalesce(a.meta->x.key->>'observedAt',a.meta->x.key->>'clinicalDate') is not null and govcare_clinical_feature_date(coalesce(a.meta->x.key->>'observedAt',a.meta->x.key->>'clinicalDate')) is null)
    then null else govcare_normalize_prediction_feature(x.key,x.value,
    coalesce(a.meta->x.key->>'unit',case x.key when 'SerumCreatinine' then 'mg/dL' when 'GFR' then 'mL/min/1.73m²' when 'ACR' then 'mg/g'
    when 'SerumElectrolytesPotassium' then 'mmol/L' when 'HemoglobinLevels' then 'g/dL' when 'HbA1c' then '%'
    when 'ProteinInUrine' then 'mg/dL' when 'Age' then 'years' when 'BMI' then 'kg/m²' when 'SystolicBP' then 'mmHg' when 'DiastolicBP' then 'mmHg'
    when 'FastingBloodSugar' then 'mg/dL' when 'BUNLevels' then 'mg/dL' when 'NSAIDsUse' then 'assessment scale' else 'boolean' end)) end as value,
  govcare_clinical_feature_date(coalesce(a.meta->x.key->>'observedAt',a.meta->x.key->>'clinicalDate')) as at
 from inputs a left join lateral jsonb_each_text(a.input_data) x on true
)
insert into clinical_prediction_features(id,hospital_id,patient_id,source_assessment_id,observation_date,recorded_at,
 creatinine,egfr,acr,potassium,hemoglobin,hba1c,proteinuria,age,bmi,systolic,diastolic,glucose,bun,edema,family_history,previous_aki,nsaids_use,source,raw_inputs,feature_metadata,normalization_version)
select id,hospital_id,patient_id,id,max(at),created_at,
 max(value) filter(where key='SerumCreatinine'),max(value) filter(where key='GFR'),max(value) filter(where key='ACR'),max(value) filter(where key='SerumElectrolytesPotassium'),
 max(value) filter(where key='HemoglobinLevels'),max(value) filter(where key='HbA1c'),max(value) filter(where key='ProteinInUrine'),max(value) filter(where key='Age'),
 max(value) filter(where key='BMI'),max(value) filter(where key='SystolicBP'),max(value) filter(where key='DiastolicBP'),max(value) filter(where key='FastingBloodSugar'),
 max(value) filter(where key='BUNLevels'),max(value) filter(where key='Edema'),max(value) filter(where key='FamilyHistoryKidneyDisease'),max(value) filter(where key='PreviousAcuteKidneyInjury'),max(value) filter(where key='NSAIDsUse'),
 'CKD_ASSESSMENT',input_data,meta,'GOVCARE-CLINICAL-FEATURES-1.0'
from features group by id,hospital_id,patient_id,created_at,input_data,meta on conflict(source_assessment_id) do nothing;
create trigger immutable_clinical_prediction_features before update or delete on clinical_prediction_features
 for each row execute function reject_predictive_history_mutation();
