-- Normalize CKD assessment CHECK constraints across databases upgraded from older GovCare archives.
-- This migration preserves the intended safety rules while removing brittle legacy constraint definitions.
-- No clinical data is deleted or rewritten.

-- Drop legacy CHECK constraints on ai_ckd_predictions that govern the probability,
-- risk category, or disease-probability JSON snapshot. Older project archives may have
-- different automatically-generated names or stricter JSON-shape checks.
do $$
declare
  r record;
begin
  for r in
    select c.conname, pg_get_constraintdef(c.oid) as definition
    from pg_constraint c
    where c.conrelid = 'ai_ckd_predictions'::regclass
      and c.contype = 'c'
  loop
    if lower(r.definition) like '%probability%'
       or lower(r.definition) like '%risk_category%'
       or lower(r.definition) like '%disease_probability_snapshot%'
       or lower(r.definition) like '%govcare_valid_disease_probability_snapshot%'
    then
      execute format('alter table ai_ckd_predictions drop constraint %I', r.conname);
    end if;
  end loop;
end $$;

-- Preserve strict scalar safety constraints with stable names.
alter table ai_ckd_predictions
  add constraint ck_ai_ckd_probability_range
  check (probability >= 0 and probability <= 1);

alter table ai_ckd_predictions
  add constraint ck_ai_ckd_risk_category
  check (risk_category in ('LOW','MODERATE','HIGH','URGENT_REVIEW'));

-- Application code is the primary validator for rich metadata. The database validator
-- enforces the durable invariants required to keep assessment history trustworthy:
--   * schemaVersion = 1
--   * exactly seven unique outcome keys
--   * the CKD entry is the current installed CKD model output and matches the row value
--   * non-available outcomes cannot carry a probability
-- It intentionally tolerates omitted optional/null JSON properties so Jackson serialization
-- settings cannot reject an otherwise valid clinical assessment.
create or replace function govcare_valid_disease_probability_snapshot_v2(
  s jsonb,
  ckd_probability numeric,
  ckd_model text
) returns boolean
language plpgsql
immutable
as $$
declare
  e jsonb;
  keys text[] := array[]::text[];
  p numeric;
  ckd_seen boolean := false;
begin
  if s is null then
    return true;
  end if;

  if jsonb_typeof(s) <> 'object'
     or coalesce(s->>'schemaVersion','') <> '1'
     or jsonb_typeof(s->'entries') is distinct from 'array'
  then
    return false;
  end if;

  if jsonb_array_length(s->'entries') <> 7 then
    return false;
  end if;

  for e in select value from jsonb_array_elements(s->'entries') loop
    if jsonb_typeof(e) <> 'object' then
      return false;
    end if;

    if e->>'key' is null
       or e->>'key' = any(keys)
       or e->>'key' not in ('ckd','ckd_progression','kfre','aki','cardiovascular','hyperkalemia','anemia')
    then
      return false;
    end if;

    keys := array_append(keys, e->>'key');

    if e->>'status' is null
       or e->>'status' not in ('AVAILABLE','NOT_AVAILABLE','NOT_CAPTURED','INSUFFICIENT_DATA','SUPPRESSED')
    then
      return false;
    end if;

    if e->>'key' = 'ckd' then
      ckd_seen := true;
      if e->>'status' <> 'AVAILABLE'
         or jsonb_typeof(e->'probability') is distinct from 'number'
         or coalesce(e->>'modelVersion','') <> ckd_model
      then
        return false;
      end if;

      begin
        p := (e->>'probability')::numeric;
      exception when others then
        return false;
      end;

      if p < 0 or p > 1 or abs(p - ckd_probability) > 0.000001 then
        return false;
      end if;
    elsif e->>'status' = 'AVAILABLE' then
      -- Future outcome probabilities are accepted only when an actual numeric model output
      -- is present. Model provenance/validation metadata remains enforced by application code.
      if jsonb_typeof(e->'probability') is distinct from 'number'
         or coalesce(e->>'modelVersion','') = ''
         or e->>'modelVersion' = 'not-installed'
      then
        return false;
      end if;
      begin
        p := (e->>'probability')::numeric;
      exception when others then
        return false;
      end;
      if p < 0 or p > 1 then
        return false;
      end if;
    else
      -- Missing property and explicit JSON null are both valid representations of
      -- "no probability calculated" for unavailable outcomes.
      if e ? 'probability' and jsonb_typeof(e->'probability') <> 'null' then
        return false;
      end if;
    end if;
  end loop;

  return ckd_seen
     and array_length(keys,1) = 7
     and 'ckd' = any(keys)
     and 'ckd_progression' = any(keys)
     and 'kfre' = any(keys)
     and 'aki' = any(keys)
     and 'cardiovascular' = any(keys)
     and 'hyperkalemia' = any(keys)
     and 'anemia' = any(keys);
exception when others then
  return false;
end $$;

alter table ai_ckd_predictions
  add constraint ck_ckd_disease_probability_snapshot_v2
  check (govcare_valid_disease_probability_snapshot_v2(
    disease_probability_snapshot,
    probability,
    model_version
  ));
