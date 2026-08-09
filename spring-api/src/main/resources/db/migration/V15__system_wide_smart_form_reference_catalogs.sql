-- System-wide smart-form reference catalogs.
-- Additive and safe for existing clinical data. Existing narrative values remain unchanged.

create table if not exists diagnosis_reference (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null,
  category text,
  aliases text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists laboratory_test_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  specimen_type text,
  department text default 'Laboratory',
  turnaround_minutes integer,
  unit_hint text,
  aliases text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists radiology_study_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  modality text not null,
  body_region text,
  contrast_default boolean not null default false,
  aliases text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep operational rows linked to controlled catalogs while preserving legacy text columns.
alter table lab_requests add column if not exists test_catalog_id uuid references laboratory_test_catalog(id) on delete set null;
alter table radiology_requests add column if not exists study_catalog_id uuid references radiology_study_catalog(id) on delete set null;

create index if not exists idx_lab_requests_test_catalog on lab_requests(test_catalog_id) where test_catalog_id is not null;
create index if not exists idx_radiology_requests_study_catalog on radiology_requests(study_catalog_id) where study_catalog_id is not null;

create index if not exists idx_diagnosis_reference_search on diagnosis_reference using gin (to_tsvector('simple', code || ' ' || description || ' ' || coalesce(aliases,'')));
create index if not exists idx_lab_catalog_search on laboratory_test_catalog using gin (to_tsvector('simple', code || ' ' || name || ' ' || coalesce(aliases,'')));
create index if not exists idx_radiology_catalog_search on radiology_study_catalog using gin (to_tsvector('simple', code || ' ' || name || ' ' || modality || ' ' || coalesce(aliases,'')));
create index if not exists idx_medicines_search on medicines(hospital_id,status,name,generic_name);
create index if not exists idx_staff_reference_search on app_users(hospital_id,status,role,department_id,full_name);

insert into diagnosis_reference(code,description,category,aliases) values
('A09','Infectious gastroenteritis and colitis, unspecified','Infectious diseases','diarrhoea gastroenteritis'),
('B34.9','Viral infection, unspecified','Infectious diseases','viral illness'),
('D64.9','Anaemia, unspecified','Blood diseases','anemia low haemoglobin'),
('E11.9','Type 2 diabetes mellitus without complications','Endocrine','diabetes mellitus type 2'),
('E78.5','Hyperlipidaemia, unspecified','Endocrine','high cholesterol dyslipidaemia'),
('F32.9','Depressive episode, unspecified','Mental health','depression'),
('G40.9','Epilepsy, unspecified','Neurology','seizure disorder'),
('I10','Essential (primary) hypertension','Cardiovascular','high blood pressure'),
('I20.9','Angina pectoris, unspecified','Cardiovascular','chest pain angina'),
('I50.9','Heart failure, unspecified','Cardiovascular','cardiac failure'),
('J06.9','Acute upper respiratory infection, unspecified','Respiratory','URTI common cold'),
('J18.9','Pneumonia, unspecified organism','Respiratory','chest infection'),
('J45.9','Asthma, unspecified','Respiratory','bronchial asthma'),
('K21.9','Gastro-oesophageal reflux disease without oesophagitis','Digestive','GERD acid reflux'),
('K29.7','Gastritis, unspecified','Digestive','gastritis'),
('M54.5','Low back pain','Musculoskeletal','backache lumbar pain'),
('N39.0','Urinary tract infection, site not specified','Genitourinary','UTI urine infection'),
('O80','Single spontaneous delivery','Pregnancy','normal delivery childbirth'),
('R07.4','Chest pain, unspecified','Symptoms','chest pain'),
('R10.4','Other and unspecified abdominal pain','Symptoms','abdominal pain'),
('R50.9','Fever, unspecified','Symptoms','pyrexia high temperature'),
('S52.9','Fracture of forearm, part unspecified','Injury','forearm fracture'),
('Z00.0','General medical examination','Health services','medical checkup')
on conflict(code) do update set description=excluded.description,category=excluded.category,aliases=excluded.aliases,status='active';

insert into laboratory_test_catalog(code,name,specimen_type,turnaround_minutes,unit_hint,aliases) values
('FBC','Full Blood Count','Blood',120,'various','CBC complete blood count'),
('ESR','Erythrocyte Sedimentation Rate','Blood',180,'mm/hr','inflammation'),
('CRP','C-Reactive Protein','Serum',180,'mg/L','inflammation marker'),
('FBS','Fasting Blood Sugar','Plasma',90,'mg/dL','fasting glucose'),
('RBS','Random Blood Sugar','Plasma',60,'mg/dL','random glucose'),
('HBA1C','Glycated Haemoglobin','Blood',240,'%','diabetes control'),
('LIPID','Lipid Profile','Serum',240,'mg/dL','cholesterol triglyceride'),
('LFT','Liver Function Tests','Serum',240,'various','ALT AST bilirubin'),
('RFT','Renal Function Tests','Serum',180,'various','creatinine urea electrolytes'),
('UE','Urine Full Report','Urine',120,'various','urinalysis UFR'),
('CULT-UR','Urine Culture and Sensitivity','Urine',2880,'culture','urine C&S'),
('CULT-BLD','Blood Culture','Blood',4320,'culture','blood C&S'),
('TROP-I','Troponin I','Serum',60,'ng/L','cardiac marker'),
('TSH','Thyroid Stimulating Hormone','Serum',240,'mIU/L','thyroid'),
('FT4','Free Thyroxine','Serum',240,'pmol/L','thyroid'),
('PT-INR','Prothrombin Time / INR','Plasma',90,'INR','coagulation'),
('APTT','Activated Partial Thromboplastin Time','Plasma',90,'seconds','coagulation'),
('DENGUE-NS1','Dengue NS1 Antigen','Serum',120,'qualitative','dengue'),
('DENGUE-IGM','Dengue IgM Antibody','Serum',180,'qualitative','dengue antibody'),
('PCR-COVID','SARS-CoV-2 PCR','Swab',720,'qualitative','COVID PCR')
on conflict(code) do update set name=excluded.name,specimen_type=excluded.specimen_type,turnaround_minutes=excluded.turnaround_minutes,unit_hint=excluded.unit_hint,aliases=excluded.aliases,status='active';

insert into radiology_study_catalog(code,name,modality,body_region,contrast_default,aliases) values
('XR-CHEST','Chest X-ray','X-ray','Chest',false,'CXR PA AP'),
('XR-ABD','Abdominal X-ray','X-ray','Abdomen',false,'AXR'),
('XR-SPINE-LS','Lumbosacral Spine X-ray','X-ray','Spine',false,'LS spine'),
('US-ABD','Ultrasound Abdomen','Ultrasound','Abdomen',false,'USS abdomen'),
('US-PELVIS','Ultrasound Pelvis','Ultrasound','Pelvis',false,'USS pelvis'),
('US-OB','Obstetric Ultrasound','Ultrasound','Pelvis',false,'pregnancy scan'),
('CT-BRAIN','CT Brain','CT','Brain',false,'CT head'),
('CT-CHEST','CT Chest','CT','Chest',true,'thorax CT'),
('CT-ABD-PEL','CT Abdomen and Pelvis','CT','Abdomen',true,'CT A/P'),
('MRI-BRAIN','MRI Brain','MRI','Brain',false,'brain MRI'),
('MRI-SPINE','MRI Spine','MRI','Spine',false,'spinal MRI'),
('MAMMO','Mammography','Mammography','Chest',false,'breast imaging'),
('FLUORO-BARIUM','Barium Study','Fluoroscopy','Abdomen',true,'barium swallow meal'),
('DOPPLER-LIMB','Limb Doppler Ultrasound','Ultrasound','Lower limb',false,'vascular Doppler')
on conflict(code) do update set name=excluded.name,modality=excluded.modality,body_region=excluded.body_region,contrast_default=excluded.contrast_default,aliases=excluded.aliases,status='active';

-- Seed a minimal active hospital formulary only when equivalent items do not exist.
insert into medicines(hospital_id,name,generic_name,category,dosage_form,strength,reorder_level,status)
select h.id,x.name,x.generic_name,x.category,x.dosage_form,x.strength,20,'active'::record_status
from hospitals h cross join (values
 ('Paracetamol 500mg','Paracetamol','Analgesic','Tablet','500mg'),
 ('Metformin 500mg','Metformin','Antidiabetic','Tablet','500mg'),
 ('Losartan 50mg','Losartan','Antihypertensive','Tablet','50mg'),
 ('Amoxicillin 500mg','Amoxicillin','Antibiotic','Capsule','500mg'),
 ('Salbutamol 100mcg','Salbutamol','Respiratory','Inhaler','100mcg')
) as x(name,generic_name,category,dosage_form,strength)
where h.status='active' and not exists(
 select 1 from medicines m where m.hospital_id=h.id and lower(coalesce(m.generic_name,m.name))=lower(x.generic_name) and lower(coalesce(m.strength,''))=lower(x.strength)
);
