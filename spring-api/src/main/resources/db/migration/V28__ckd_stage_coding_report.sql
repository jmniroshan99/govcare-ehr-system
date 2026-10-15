-- CKD AI coding-assistance snapshot. AI suggestions remain distinct from clinician-confirmed Condition records.
alter table ai_assessments add column if not exists suggested_ckd_g_category text;
alter table ai_assessments add column if not exists suggested_ckd_stage text;
alter table ai_assessments add column if not exists suggested_icd_code text;
alter table ai_assessments add column if not exists suggested_icd_system text;
alter table ai_assessments add column if not exists suggested_icd_display text;
alter table ai_assessments add column if not exists coding_status text not null default 'AI_ASSISTED_SUGGESTION';
alter table ai_assessments add column if not exists coding_basis text;

-- The research catalogue contains ICD-10-CM-specific codes (e.g. N18.31/N18.32/E11.22).
-- Keep the old rows for migration compatibility but make the edition explicit for new validation/reporting.
insert into fhir_terminology(system,code,display,version,category) values
('http://hl7.org/fhir/sid/icd-10-cm','N18.1','Chronic kidney disease, stage 1',NULL,'ICD10CM'),
('http://hl7.org/fhir/sid/icd-10-cm','N18.2','Chronic kidney disease, stage 2',NULL,'ICD10CM'),
('http://hl7.org/fhir/sid/icd-10-cm','N18.30','Chronic kidney disease, stage 3 unspecified',NULL,'ICD10CM'),
('http://hl7.org/fhir/sid/icd-10-cm','N18.31','Chronic kidney disease, stage 3a',NULL,'ICD10CM'),
('http://hl7.org/fhir/sid/icd-10-cm','N18.32','Chronic kidney disease, stage 3b',NULL,'ICD10CM'),
('http://hl7.org/fhir/sid/icd-10-cm','N18.4','Chronic kidney disease, stage 4 (severe)',NULL,'ICD10CM'),
('http://hl7.org/fhir/sid/icd-10-cm','N18.5','Chronic kidney disease, stage 5',NULL,'ICD10CM'),
('http://hl7.org/fhir/sid/icd-10-cm','N18.6','End stage renal disease',NULL,'ICD10CM'),
('http://hl7.org/fhir/sid/icd-10-cm','N18.9','Chronic kidney disease, unspecified',NULL,'ICD10CM'),
('http://hl7.org/fhir/sid/icd-10-cm','E11.22','Type 2 diabetes mellitus with diabetic chronic kidney disease',NULL,'ICD10CM'),
('http://hl7.org/fhir/sid/icd-10-cm','I12.9','Hypertensive chronic kidney disease with stage 1 through stage 4 CKD, or unspecified CKD',NULL,'ICD10CM'),
('http://hl7.org/fhir/sid/icd-10-cm','R80.9','Proteinuria, unspecified',NULL,'ICD10CM'),
('http://hl7.org/fhir/sid/icd-10-cm','R94.4','Abnormal results of kidney function studies',NULL,'ICD10CM')
on conflict(system,code) do update set display=excluded.display, active=true;
