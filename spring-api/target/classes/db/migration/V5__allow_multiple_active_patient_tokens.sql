drop index if exists uq_active_queue_patient_department;
create index if not exists idx_opd_queue_patient_department_status
  on opd_queue(hospital_id, patient_id, department_id, queue_status, created_at desc);
