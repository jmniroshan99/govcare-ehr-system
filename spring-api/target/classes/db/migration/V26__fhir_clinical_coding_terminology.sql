-- GovCare FHIR R4 interoperability/terminology persistence. Existing clinical tables remain authoritative
-- during phased migration; resource_id links prevent duplicate FHIR projections.
CREATE TABLE IF NOT EXISTS fhir_resource (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), resource_type varchar(80) NOT NULL,
 resource_id varchar(120) NOT NULL, version integer NOT NULL DEFAULT 1,
 patient_id uuid NULL REFERENCES patients(id), hospital_id uuid NOT NULL REFERENCES hospitals(id),
 json_data jsonb NOT NULL, created_date timestamptz NOT NULL DEFAULT now(), updated_date timestamptz NOT NULL DEFAULT now(),
 UNIQUE(hospital_id, resource_type, resource_id)
);
CREATE INDEX IF NOT EXISTS idx_fhir_resource_patient ON fhir_resource(hospital_id, patient_id, resource_type);

CREATE TABLE IF NOT EXISTS fhir_terminology (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), system varchar(255) NOT NULL, code varchar(80) NOT NULL,
 display varchar(500) NOT NULL, version varchar(80), category varchar(40) NOT NULL,
 active boolean NOT NULL DEFAULT true, UNIQUE(system, code)
);

CREATE TABLE IF NOT EXISTS fhir_condition (
 resource_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), hospital_id uuid NOT NULL REFERENCES hospitals(id),
 patient_id uuid NOT NULL REFERENCES patients(id), coding_system varchar(255) NOT NULL, code varchar(80) NOT NULL,
 display varchar(500) NOT NULL, status varchar(40) NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS fhir_observation (
 resource_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), hospital_id uuid NOT NULL REFERENCES hospitals(id),
 patient_id uuid NOT NULL REFERENCES patients(id), loinc_code varchar(80) NOT NULL,
 value numeric, unit varchar(80), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS fhir_medication (
 resource_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), hospital_id uuid NOT NULL REFERENCES hospitals(id),
 patient_id uuid NOT NULL REFERENCES patients(id), rxnorm_code varchar(80), dose varchar(120), route varchar(120),
 created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO fhir_terminology(system,code,display,version,category) VALUES
('http://hl7.org/fhir/sid/icd-10','N18.1','Chronic kidney disease stage 1',NULL,'ICD10'),
('http://hl7.org/fhir/sid/icd-10','N18.2','Chronic kidney disease stage 2',NULL,'ICD10'),
('http://hl7.org/fhir/sid/icd-10','N18.30','Chronic kidney disease stage 3 unspecified',NULL,'ICD10'),
('http://hl7.org/fhir/sid/icd-10','N18.31','Chronic kidney disease stage 3a',NULL,'ICD10'),
('http://hl7.org/fhir/sid/icd-10','N18.32','Chronic kidney disease stage 3b',NULL,'ICD10'),
('http://hl7.org/fhir/sid/icd-10','N18.4','Chronic kidney disease stage 4',NULL,'ICD10'),
('http://hl7.org/fhir/sid/icd-10','N18.5','Chronic kidney disease stage 5',NULL,'ICD10'),
('http://hl7.org/fhir/sid/icd-10','N18.6','End stage renal disease',NULL,'ICD10'),
('http://hl7.org/fhir/sid/icd-10','N18.9','Chronic kidney disease unspecified',NULL,'ICD10'),
('http://hl7.org/fhir/sid/icd-10','E11.22','Type 2 diabetes mellitus with diabetic chronic kidney disease',NULL,'ICD10'),
('http://hl7.org/fhir/sid/icd-10','I12.9','Hypertensive chronic kidney disease',NULL,'ICD10'),
('http://hl7.org/fhir/sid/icd-10','R80.9','Proteinuria, unspecified',NULL,'ICD10'),
('http://hl7.org/fhir/sid/icd-10','R94.4','Abnormal results of kidney function studies',NULL,'ICD10'),
('http://loinc.org','2160-0','Creatinine [Mass/volume] in Serum or Plasma',NULL,'LOINC'),
('http://loinc.org','48642-3','Glomerular filtration rate/1.73 sq M predicted among non-blacks by Creatinine-based formula',NULL,'LOINC'),
('http://loinc.org','85354-9','Blood pressure panel with all children optional',NULL,'LOINC'),
('http://loinc.org','39156-5','Body mass index (BMI) [Ratio]',NULL,'LOINC'),
('http://loinc.org','4548-4','Hemoglobin A1c/Hemoglobin.total in Blood',NULL,'LOINC'),
('http://loinc.org','9318-7','Albumin/Creatinine [Mass Ratio] in Urine',NULL,'LOINC')
ON CONFLICT(system,code) DO UPDATE SET display=EXCLUDED.display, active=true;
