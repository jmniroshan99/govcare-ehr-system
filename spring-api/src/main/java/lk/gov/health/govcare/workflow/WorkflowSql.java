package lk.gov.health.govcare.workflow;

import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Component
public class WorkflowSql {
    private final SqlSupport sql;
    public WorkflowSql(SqlSupport sql){this.sql=sql;}

    public static final String QUEUE_SELECT = """
      select q.id::text as queue_id,q.hospital_id::text as hospital_id,q.token_no,q.queue_status,q.priority::text as priority,
        q.estimated_wait_minutes,q.called_at,q.started_at,q.completed_at,q.no_show_at,q.created_at,q.updated_at,
        q.department_id::text as department_id,q.doctor_id::text as doctor_id,q.appointment_id::text as appointment_id,
        p.id::text as patient_id,p.patient_no,p.full_name,p.nic,p.date_of_birth,govcare_patient_age_years(p.date_of_birth) as age_years,p.gender::text as gender,
        p.blood_group,p.phone,p.profile_photo_url,p.allergies,p.chronic_diseases,p.risk_flags,
        v.id::text as visit_id,v.visit_no,v.visit_type,v.reason,d.name as department_name,d.code as department_code,
        u.full_name as doctor_name,c.id::text as consultation_id,c.workflow_status as consultation_status,
        a.appointment_no,a.scheduled_at,true as verified
      from opd_queue q join patients p on p.id=q.patient_id join visits v on v.id=q.visit_id
      left join departments d on d.id=q.department_id left join app_users u on u.id=q.doctor_id
      left join appointments a on a.id=q.appointment_id
      left join lateral (select id,workflow_status from consultations where visit_id=q.visit_id and patient_id=q.patient_id order by created_at desc limit 1)c on true
      """;

    public static final String APPOINTMENT_SELECT = """
      select a.id::text,a.appointment_no,a.patient_id::text,p.patient_no,p.full_name as patient_name,p.nic,govcare_patient_age_years(p.date_of_birth) as age_years,p.gender::text,p.blood_group,
        a.doctor_id::text,u.full_name as doctor_name,a.department_id::text,d.name as department_name,a.appointment_type,a.scheduled_at,a.reason,
        a.priority::text,a.mode,a.location,a.workflow_status,a.checked_in_at,a.queue_id::text,q.token_no,a.created_at
      from appointments a join patients p on p.id=a.patient_id left join departments d on d.id=a.department_id
      left join app_users u on u.id=a.doctor_id left join opd_queue q on q.id=a.queue_id
      """;

    public Map<String,Object> patient(UUID hospitalId,String identifier){return sql.one("""
      select id::text,patient_no,full_name,nic from patients where hospital_id=:hospitalId and status<>'deleted' and
      (id::text=:value or patient_no=:value or nic=:value or passport_no=:value or phone=:value or qr_payload=:value) limit 1
      """,Map.of("hospitalId",hospitalId,"value",identifier.trim())).orElse(null);}

    public Map<String,Object> department(UUID hospitalId,String uuid,String name){
        if(uuid!=null&&!uuid.isBlank())return sql.one("select id::text,code,name from departments where id=cast(:id as uuid) and hospital_id=:hospitalId and status<>'deleted' limit 1",Map.of("id",uuid,"hospitalId",hospitalId)).orElse(null);
        if(name!=null&&!name.isBlank())return sql.one("select id::text,code,name from departments where hospital_id=:hospitalId and lower(name)=lower(:name) and status<>'deleted' limit 1",Map.of("name",name.trim(),"hospitalId",hospitalId)).orElse(null);
        return null;
    }

    public void requireDoctor(UUID hospitalId,String doctorId){if(doctorId==null||doctorId.isBlank())return;boolean ok=sql.one("select id from app_users where id=cast(:id as uuid) and hospital_id=:hospitalId and role='doctor' and status='active'",Map.of("id",doctorId,"hospitalId",hospitalId)).isPresent();if(!ok)throw ApiException.notFound("Doctor not found.");}

    public Map<String,Object> queue(UUID hospitalId,String id){return sql.required(QUEUE_SELECT+" where q.id=cast(:id as uuid) and q.hospital_id=:hospitalId limit 1",Map.of("id",id,"hospitalId",hospitalId),"Queue record not found.");}
    public Map<String,Object> appointment(UUID hospitalId,String id){return sql.required(APPOINTMENT_SELECT+" where a.id=cast(:id as uuid) and a.hospital_id=:hospitalId limit 1",Map.of("id",id,"hospitalId",hospitalId),"Appointment not found.");}

    public static String tokenPrefix(String name,String code){String c=code==null?"":code.replaceAll("[^A-Za-z]","").toUpperCase();if(!c.isBlank())return c.substring(0,Math.min(3,c.length()));String n=name==null?"":name.toLowerCase();if(n.contains("paediatric")||n.contains("pediatric"))return "PED";if(n.contains("emergency"))return "ETU";if(n.contains("ent"))return "ENT";if(n.contains("surgical"))return "SUR";if(n.contains("antenatal")||n.contains("maternity"))return "ANC";return "OPD";}
}
