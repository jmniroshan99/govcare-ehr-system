-- GovCare EHR prescription-send compatibility fix.
-- Safe and idempotent for existing PostgreSQL installations.

-- The original schema uses `pending` as the pharmacy queue status.
-- Normalize newer temporary values so old and new installations behave consistently.
update prescriptions
   set pharmacy_status = 'pending'
 where pharmacy_status = 'pending_verification';

create index if not exists idx_prescriptions_hospital_number
    on prescriptions (hospital_id, prescription_no);
