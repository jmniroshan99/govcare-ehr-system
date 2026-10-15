CREATE TABLE IF NOT EXISTS ai_predictions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), hospital_id uuid NOT NULL REFERENCES hospitals(id), patient_id uuid NOT NULL REFERENCES patients(id),
 prediction_type varchar(50) NOT NULL, input_data jsonb NOT NULL DEFAULT '{}'::jsonb, prediction_result jsonb NOT NULL DEFAULT '{}'::jsonb,
 risk_level varchar(20) NOT NULL, probability numeric(6,5), confidence_score numeric(6,5), model_version varchar(100) NOT NULL,
 created_by uuid REFERENCES app_users(id), created_date timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_patient_date ON ai_predictions(patient_id, created_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_hospital_risk ON ai_predictions(hospital_id, risk_level);
CREATE TABLE IF NOT EXISTS ai_models (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), model_name varchar(120) NOT NULL, version varchar(60) NOT NULL, algorithm varchar(120) NOT NULL,
 accuracy numeric(6,5), last_updated timestamptz NOT NULL DEFAULT now(), status varchar(30) NOT NULL DEFAULT 'ACTIVE', UNIQUE(model_name,version)
);
CREATE TABLE IF NOT EXISTS ai_recommendations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), prediction_id uuid NOT NULL REFERENCES ai_predictions(id) ON DELETE CASCADE,
 recommendation_text text NOT NULL, priority varchar(20) NOT NULL DEFAULT 'ROUTINE', created_date timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_audit_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), prediction_id uuid REFERENCES ai_predictions(id) ON DELETE SET NULL, hospital_id uuid NOT NULL REFERENCES hospitals(id),
 patient_id uuid NOT NULL REFERENCES patients(id), user_id uuid REFERENCES app_users(id), prediction_type varchar(50) NOT NULL,
 input_data jsonb NOT NULL DEFAULT '{}'::jsonb, output_data jsonb NOT NULL DEFAULT '{}'::jsonb, created_date timestamptz NOT NULL DEFAULT now()
);
INSERT INTO ai_models(model_name,version,algorithm,accuracy,status) VALUES
 ('CKD Risk','RULES-1.0','Clinical rule-based development model',NULL,'DEVELOPMENT'),
 ('Diabetes Risk','RULES-1.0','Clinical rule-based development model',NULL,'DEVELOPMENT'),
 ('Cardiovascular Risk','RULES-1.0','Clinical rule-based development model',NULL,'DEVELOPMENT'),
 ('Sepsis Early Warning','RULES-1.0','Clinical rule-based development model',NULL,'DEVELOPMENT'),
 ('Readmission Risk','RULES-1.0','Clinical rule-based development model',NULL,'DEVELOPMENT'),
 ('Length of Stay','RULES-1.0','Clinical rule-based development model',NULL,'DEVELOPMENT')
ON CONFLICT(model_name,version) DO NOTHING;
