-- Read-only diagnostics for the CKD assessment persistence schema.
select installed_rank, version, description, success, installed_on
from flyway_schema_history
where version in ('36','37','38','39')
order by installed_rank;

select c.conname as constraint_name,
       pg_get_constraintdef(c.oid) as definition
from pg_constraint c
where c.conrelid = 'ai_ckd_predictions'::regclass
  and c.contype = 'c'
order by c.conname;

select p.proname as validator_function
from pg_proc p
where p.proname in ('govcare_valid_disease_probability_snapshot',
                    'govcare_valid_disease_probability_snapshot_v2')
order by p.proname;
