-- Assessment-time availability and model outputs. No new models, clinical data or historical percentages.
alter table ai_ckd_predictions add column disease_probability_snapshot jsonb;

create function govcare_valid_disease_probability_snapshot(s jsonb, ckd_probability numeric, ckd_model text)
returns boolean language plpgsql immutable as $$
declare
 e jsonb;
 keys text[] := array[]::text[];
 p numeric;
begin
 if s is null then return true; end if;
 if jsonb_typeof(s)<>'object' or jsonb_typeof(s->'schemaVersion') is distinct from 'number' or s->>'schemaVersion' is distinct from '1'
    or jsonb_typeof(s->'capturedAt') is distinct from 'string'
    or length(btrim(s->>'capturedAt'))=0
    or jsonb_typeof(s->'entries') is distinct from 'array' then return false; end if;
 if jsonb_array_length(s->'entries')<>7 then return false; end if;
 for e in select value from jsonb_array_elements(s->'entries') loop
  if jsonb_typeof(e)<>'object' then return false; end if;
  if e->>'key' is null or e->>'key'=any(keys) or e->>'key' not in ('ckd','ckd_progression','kfre','aki','cardiovascular','hyperkalemia','anemia') then return false; end if;
  keys:=array_append(keys,e->>'key');
  if jsonb_typeof(e->'label') is distinct from 'string' or length(btrim(e->>'label'))=0
     or jsonb_typeof(e->'modelVersion') is distinct from 'string'
     or jsonb_typeof(e->'horizon') is distinct from 'string' or length(btrim(e->>'horizon'))=0
     or jsonb_typeof(e->'validationStatus') is distinct from 'string'
     or jsonb_typeof(e->'purpose') is distinct from 'string'
     or jsonb_typeof(e->'reason') is distinct from 'string' or length(btrim(e->>'reason'))=0
     or e->>'status' is null or e->>'status' not in ('AVAILABLE','NOT_AVAILABLE','NOT_CAPTURED','INSUFFICIENT_DATA','SUPPRESSED') then return false; end if;
  if e->>'status'='AVAILABLE' then
   if jsonb_typeof(e->'probability') is distinct from 'number' or length(btrim(e->>'modelVersion'))=0 or e->>'modelVersion'='not-installed' then return false; end if;
   p:=(e->>'probability')::numeric;
   if p<0 or p>1 then return false; end if;
   if e->>'key'='ckd' then
    if e->>'validationStatus'<>'EXISTING_MODEL' or e->>'modelVersion'<>ckd_model or abs(p-ckd_probability)>0.000001 then return false; end if;
   elsif e->>'validationStatus'<>'VALIDATED' then return false; end if;
  elsif e->'probability' is distinct from 'null'::jsonb or e->>'key'='ckd' then return false; end if;
 end loop;
 return true;
exception when others then return false;
end $$;

alter table ai_ckd_predictions add constraint ck_ckd_disease_probability_snapshot
 check(govcare_valid_disease_probability_snapshot(disease_probability_snapshot,probability,model_version));

create function govcare_keep_disease_probability_snapshot() returns trigger language plpgsql as $$
begin
 if new.disease_probability_snapshot is distinct from old.disease_probability_snapshot then
  raise exception 'Disease probability snapshots are immutable; create a new assessment';
 end if;
 return new;
end $$;
create trigger keep_ckd_disease_probability_snapshot before update on ai_ckd_predictions
 for each row execute function govcare_keep_disease_probability_snapshot();
