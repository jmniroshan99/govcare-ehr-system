-- GovCare EHR end-to-end workflow migration
-- Idempotent: safe for an existing govcare_ehr_v2 database.

alter table appointments
      add column if not exists appointment_no text,
      add column if not exists reason text,
      add column if not exists priority priority_level not null default 'routine',
      add column if not exists workflow_status text not null default 'scheduled',
      add column if not exists checked_in_at timestamptz,
      add column if not exists confirmed_at timestamptz,
      add column if not exists cancelled_at timestamptz,
      add column if not exists no_show_at timestamptz,
      add column if not exists queue_id uuid;

    alter table visits
      add column if not exists appointment_id uuid,
      add column if not exists workflow_status text not null default 'waiting';

    alter table opd_queue
      add column if not exists appointment_id uuid,
      add column if not exists called_by uuid,
      add column if not exists started_at timestamptz,
      add column if not exists no_show_at timestamptz,
      add column if not exists paused_at timestamptz,
      add column if not exists version integer not null default 0;

    alter table consultations
      add column if not exists symptoms text,
      add column if not exists presenting_history text,
      add column if not exists past_medical_history text,
      add column if not exists surgical_history text,
      add column if not exists family_history text,
      add column if not exists social_history text,
      add column if not exists allergy_review text,
      add column if not exists current_medications text,
      add column if not exists vital_signs jsonb not null default '{}'::jsonb,
      add column if not exists differential_diagnosis text,
      add column if not exists clinical_notes text,
      add column if not exists follow_up_instructions text,
      add column if not exists workflow_status text not null default 'draft',
      add column if not exists started_at timestamptz,
      add column if not exists completed_at timestamptz,
      add column if not exists completion_override_reason text;

    alter table prescriptions
      add column if not exists workflow_status text not null default 'draft',
      add column if not exists signed_at timestamptz,
      add column if not exists sent_to_pharmacy_at timestamptz,
      add column if not exists pharmacy_verified_by uuid,
      add column if not exists pharmacy_verified_at timestamptz,
      add column if not exists pharmacy_verification_notes text,
      add column if not exists dispensed_by uuid,
      add column if not exists dispensed_at timestamptz;

    update prescriptions
      set pharmacy_status = 'pending'
      where pharmacy_status = 'pending_verification';

    alter table prescription_items
      add column if not exists strength text,
      add column if not exists substitution_allowed boolean not null default true,
      add column if not exists notes text;

    alter table lab_requests
      add column if not exists consultation_id uuid,
      add column if not exists test_code text,
      add column if not exists specimen text,
      add column if not exists instructions text,
      add column if not exists workflow_status text not null default 'ordered',
      add column if not exists received_at timestamptz,
      add column if not exists sample_collected_at timestamptz,
      add column if not exists result_entered_at timestamptz,
      add column if not exists verified_by uuid,
      add column if not exists verified_at timestamptz,
      add column if not exists released_at timestamptz,
      add column if not exists reviewed_by uuid,
      add column if not exists reviewed_at timestamptz;

    alter table lab_results
      add column if not exists numeric_result numeric,
      add column if not exists text_result text,
      add column if not exists unit text,
      add column if not exists reference_range text,
      add column if not exists abnormal_flag boolean not null default false,
      add column if not exists critical_flag boolean not null default false,
      add column if not exists verified_by uuid,
      add column if not exists verified_at timestamptz,
      add column if not exists released_at timestamptz,
      add column if not exists reviewed_by uuid,
      add column if not exists reviewed_at timestamptz;

    alter table radiology_requests
      add column if not exists consultation_id uuid,
      add column if not exists body_area text,
      add column if not exists contrast_required boolean not null default false,
      add column if not exists pregnancy_warning boolean not null default false,
      add column if not exists instructions text,
      add column if not exists workflow_status text not null default 'ordered',
      add column if not exists patient_arrived_at timestamptz,
      add column if not exists imaging_started_at timestamptz,
      add column if not exists imaging_completed_at timestamptz,
      add column if not exists released_at timestamptz,
      add column if not exists reviewed_by uuid,
      add column if not exists reviewed_at timestamptz;

    alter table radiology_reports
      add column if not exists workflow_status text not null default 'report_drafted',
      add column if not exists verified_by uuid,
      add column if not exists verified_at timestamptz,
      add column if not exists released_at timestamptz,
      add column if not exists reviewed_by uuid,
      add column if not exists reviewed_at timestamptz;

create table if not exists consultation_diagnoses (
      id uuid primary key default gen_random_uuid(),
      hospital_id uuid not null references hospitals(id) on delete cascade,
      consultation_id uuid not null references consultations(id) on delete cascade,
      patient_id uuid not null references patients(id) on delete cascade,
      code text,
      description text not null,
      diagnosis_type text not null default 'primary',
      created_by uuid references app_users(id),
      created_at timestamptz not null default now()
    );

    create table if not exists pharmacy_verifications (
      id uuid primary key default gen_random_uuid(),
      hospital_id uuid not null references hospitals(id) on delete cascade,
      prescription_id uuid not null references prescriptions(id) on delete cascade,
      pharmacist_id uuid not null references app_users(id),
      verification_status text not null,
      notes text,
      verified_at timestamptz not null default now(),
      created_at timestamptz not null default now()
    );

do $$
    begin
      if not exists (select 1 from pg_constraint where conname = 'appointments_queue_fk') then
        alter table appointments add constraint appointments_queue_fk foreign key (queue_id) references opd_queue(id) on delete set null;
      end if;
      if not exists (select 1 from pg_constraint where conname = 'visits_appointment_fk') then
        alter table visits add constraint visits_appointment_fk foreign key (appointment_id) references appointments(id) on delete set null;
      end if;
      if not exists (select 1 from pg_constraint where conname = 'opd_queue_appointment_fk') then
        alter table opd_queue add constraint opd_queue_appointment_fk foreign key (appointment_id) references appointments(id) on delete set null;
      end if;
      if not exists (select 1 from pg_constraint where conname = 'opd_queue_called_by_fk') then
        alter table opd_queue add constraint opd_queue_called_by_fk foreign key (called_by) references app_users(id) on delete set null;
      end if;
      if not exists (select 1 from pg_constraint where conname = 'lab_requests_consultation_fk') then
        alter table lab_requests add constraint lab_requests_consultation_fk foreign key (consultation_id) references consultations(id) on delete set null;
      end if;
      if not exists (select 1 from pg_constraint where conname = 'radiology_requests_consultation_fk') then
        alter table radiology_requests add constraint radiology_requests_consultation_fk foreign key (consultation_id) references consultations(id) on delete set null;
      end if;
      if not exists (select 1 from pg_constraint where conname = 'prescriptions_pharmacy_verified_by_fk') then
        alter table prescriptions add constraint prescriptions_pharmacy_verified_by_fk foreign key (pharmacy_verified_by) references app_users(id) on delete set null;
      end if;
      if not exists (select 1 from pg_constraint where conname = 'prescriptions_dispensed_by_fk') then
        alter table prescriptions add constraint prescriptions_dispensed_by_fk foreign key (dispensed_by) references app_users(id) on delete set null;
      end if;
      if not exists (select 1 from pg_constraint where conname = 'lab_requests_verified_by_fk') then
        alter table lab_requests add constraint lab_requests_verified_by_fk foreign key (verified_by) references app_users(id) on delete set null;
      end if;
      if not exists (select 1 from pg_constraint where conname = 'lab_requests_reviewed_by_fk') then
        alter table lab_requests add constraint lab_requests_reviewed_by_fk foreign key (reviewed_by) references app_users(id) on delete set null;
      end if;
      if not exists (select 1 from pg_constraint where conname = 'lab_results_verified_by_fk') then
        alter table lab_results add constraint lab_results_verified_by_fk foreign key (verified_by) references app_users(id) on delete set null;
      end if;
      if not exists (select 1 from pg_constraint where conname = 'lab_results_reviewed_by_fk') then
        alter table lab_results add constraint lab_results_reviewed_by_fk foreign key (reviewed_by) references app_users(id) on delete set null;
      end if;
      if not exists (select 1 from pg_constraint where conname = 'radiology_requests_reviewed_by_fk') then
        alter table radiology_requests add constraint radiology_requests_reviewed_by_fk foreign key (reviewed_by) references app_users(id) on delete set null;
      end if;
      if not exists (select 1 from pg_constraint where conname = 'radiology_reports_verified_by_fk') then
        alter table radiology_reports add constraint radiology_reports_verified_by_fk foreign key (verified_by) references app_users(id) on delete set null;
      end if;
      if not exists (select 1 from pg_constraint where conname = 'radiology_reports_reviewed_by_fk') then
        alter table radiology_reports add constraint radiology_reports_reviewed_by_fk foreign key (reviewed_by) references app_users(id) on delete set null;
      end if;
    end $$;

create unique index if not exists uq_appointments_number on appointments (hospital_id, appointment_no) where appointment_no is not null;
    create index if not exists idx_appointments_workflow on appointments (hospital_id, workflow_status, scheduled_at);
    create index if not exists idx_queue_doctor_workflow on opd_queue (hospital_id, doctor_id, queue_status, created_at);
    create index if not exists idx_consultations_workflow on consultations (hospital_id, doctor_id, workflow_status, updated_at desc);
    create index if not exists idx_prescriptions_pharmacy_workflow on prescriptions (hospital_id, pharmacy_status, created_at desc);
    create index if not exists idx_lab_workflow on lab_requests (hospital_id, workflow_status, created_at desc);
    create index if not exists idx_radiology_workflow on radiology_requests (hospital_id, workflow_status, created_at desc);
    create unique index if not exists uq_active_queue_patient_department
      on opd_queue (hospital_id, patient_id, coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid))
      where queue_status in ('waiting','called','checking','in-consultation','paused');
