insert into hospitals(code,name,type,city,district,province,address,phone,email,status)
values('NHSL','National Hospital of Sri Lanka','government_hospital','Colombo','Colombo','Western','Regent Street, Colombo','0112691111','info@nhsl.gov.lk','active')
on conflict(code) do nothing;

insert into departments(hospital_id,code,name,type,status)
select h.id,x.code,x.name,x.type,'active'::record_status from hospitals h cross join(values
 ('OPD','Out Patient Department','clinical'),('LAB','Laboratory','diagnostic'),('RAD','Radiology','diagnostic'),('PHA','Pharmacy','support')
)as x(code,name,type) where h.code='NHSL' on conflict(hospital_id,code) do nothing;

insert into app_users(auth_uid,hospital_id,department_id,role,full_name,email,password_hash,permissions,mfa_enabled,status)
select 'spring-superadmin',h.id,d.id,'super_admin','Super Admin Lanka','superadmin@govcare.gov.lk',crypt('GovCare@123',gen_salt('bf')),'[]'::jsonb,false,'active'
from hospitals h left join departments d on d.hospital_id=h.id and d.code='OPD' where h.code='NHSL'
on conflict(email) do nothing;
