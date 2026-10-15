-- Support bounded daily OPD reads and per-medicine stock aggregation.
create index if not exists idx_opd_queue_hospital_created_at
  on opd_queue(hospital_id, created_at);

create index if not exists idx_pharmacy_stock_hospital_medicine_active
  on pharmacy_stock(hospital_id, medicine_id, expiry_date)
  where status='active';
