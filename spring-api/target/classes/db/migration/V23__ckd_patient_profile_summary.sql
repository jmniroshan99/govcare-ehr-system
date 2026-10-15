-- CKD patient profile summary support
CREATE TABLE IF NOT EXISTS ckd_patient_assessment (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 patient_id UUID NOT NULL,
 ckd_stage VARCHAR(50),
 icd10_code VARCHAR(20),
 egfr NUMERIC,
 creatinine NUMERIC,
 risk_level VARCHAR(30),
 diabetes BOOLEAN DEFAULT FALSE,
 hypertension BOOLEAN DEFAULT FALSE,
 last_test_date DATE,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
