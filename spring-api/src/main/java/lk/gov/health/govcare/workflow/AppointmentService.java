package lk.gov.health.govcare.workflow;

import lk.gov.health.govcare.audit.AuditService;
import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SequenceService;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;

@Service
public class AppointmentService {
    private final SqlSupport sql; private final WorkflowSql workflow; private final SequenceService sequences; private final AuditService audit;
    public AppointmentService(SqlSupport sql,WorkflowSql workflow,SequenceService sequences,AuditService audit){this.sql=sql;this.workflow=workflow;this.sequences=sequences;this.audit=audit;}

    public Map<String,Object> reference(GovCarePrincipal actor){
        List<Map<String,Object>> departments=sql.list("select id::text,code,name from departments where hospital_id=:hospitalId and status='active' order by name",Map.of("hospitalId",actor.hospitalId()));
        List<Map<String,Object>> doctors=sql.list("select id::text,full_name,department_id::text,role::text from app_users where hospital_id=:hospitalId and role='doctor' and status='active' order by full_name",Map.of("hospitalId",actor.hospitalId()));
        return Map.of("departments",departments,"doctors",doctors);
    }

    public List<Map<String,Object>> list(GovCarePrincipal actor,String status,String date,String search){
        StringBuilder q=new StringBuilder(WorkflowSql.APPOINTMENT_SELECT+" where a.hospital_id=:hospitalId");Map<String,Object> p=new HashMap<>();p.put("hospitalId",actor.hospitalId());
        if (Set.of("patient", "guardian").contains(actor.role())) {
            if (actor.patientId() == null) return List.of();
            q.append(" and a.patient_id=:patientId");
            p.put("patientId", actor.patientId());
        }
        if(clean(status)!=null){q.append(" and a.workflow_status=:status");p.put("status",status.trim());}
        if(clean(date)!=null){q.append(" and a.scheduled_at::date=cast(:date as date)");p.put("date",date.trim());}
        if(clean(search)!=null){q.append(" and (p.full_name ilike :search or p.patient_no ilike :search or coalesce(a.appointment_no,'') ilike :search)");p.put("search","%"+search.trim()+"%");}
        q.append(" order by a.scheduled_at asc limit 250");return sql.list(q.toString(),p);
    }

    @Transactional
    public Map<String,Object> create(GovCarePrincipal actor,Map<String,Object> input){
        String identifier=req(input,"patientIdentifier"),scheduled=req(input,"scheduledAt"),reason=req(input,"reason");
        Map<String,Object> patient=workflow.patient(actor.hospitalId(),identifier);if(patient==null)throw ApiException.notFound("Patient was not found in this hospital.");
        Map<String,Object> department=workflow.department(actor.hospitalId(),clean(input.get("departmentUuid")),clean(input.get("departmentName")));if(department==null)throw ApiException.notFound("Department was not found in this hospital.");
        String doctor=clean(input.get("doctorUuid"));workflow.requireDoctor(actor.hospitalId(),doctor);
        Map<String,Object> dup=sql.one("select id::text,appointment_no from appointments where hospital_id=:hospitalId and patient_id=cast(:patientId as uuid) and department_id=cast(:departmentId as uuid) and scheduled_at=cast(:scheduledAt as timestamptz) and workflow_status in ('scheduled','confirmed') limit 1",Map.of("hospitalId",actor.hospitalId(),"patientId",patient.get("id"),"departmentId",department.get("id"),"scheduledAt",scheduled)).orElse(null);
        if(dup!=null)throw ApiException.conflict("Duplicate active appointment "+(dup.get("appointment_no")!=null?dup.get("appointment_no"):dup.get("id"))+".");
        sequences.lock("govcare:"+actor.hospitalId()+":appointments:"+scheduled.substring(0,10));
        String appointmentNo=sequences.daily(actor.hospitalId(),"appointments","appointment_no","APT-");
        Map<String,Object> p=new HashMap<>();p.put("hospitalId",actor.hospitalId());p.put("patientId",patient.get("id"));p.put("doctorId",doctor);p.put("departmentId",department.get("id"));p.put("appointmentNo",appointmentNo);p.put("appointmentType",String.valueOf(input.getOrDefault("appointmentType","clinic")));p.put("scheduledAt",scheduled);p.put("reason",reason);p.put("priority",String.valueOf(input.getOrDefault("priority","routine")));p.put("mode",String.valueOf(input.getOrDefault("mode","physical")));p.put("location",clean(input.get("location")));p.put("actorId",actor.id());
        Map<String,Object> inserted=sql.required("""
          insert into appointments(hospital_id,patient_id,doctor_id,department_id,appointment_no,appointment_type,scheduled_at,reason,priority,mode,location,workflow_status,status,created_by,updated_by)
          values(:hospitalId,cast(:patientId as uuid),cast(:doctorId as uuid),cast(:departmentId as uuid),:appointmentNo,:appointmentType,cast(:scheduledAt as timestamptz),:reason,cast(:priority as priority_level),:mode,:location,'scheduled','pending',:actorId,:actorId)
          returning id::text
        """,p,"Unable to create appointment.");
        audit.record(actor,"appointments","appointment_created","appointments",UUID.fromString(String.valueOf(inserted.get("id"))),null,inserted);
        return workflow.appointment(actor.hospitalId(),String.valueOf(inserted.get("id")));
    }

    @Transactional
    public Map<String,Object> checkIn(GovCarePrincipal actor,String id){
        Map<String,Object> a=sql.required("select id::text,patient_id::text,department_id::text,doctor_id::text,appointment_no,reason,priority::text,workflow_status,queue_id::text from appointments where id=cast(:id as uuid) and hospital_id=:hospitalId for update",Map.of("id",id,"hospitalId",actor.hospitalId()),"Appointment not found.");
        String status=String.valueOf(a.get("workflow_status"));if(Set.of("cancelled","no_show","completed").contains(status))throw ApiException.conflict("Appointment is "+status+" and cannot be checked in.");
        String existing=clean(a.get("queue_id"));if(existing!=null&&sql.one("select id from opd_queue where id=cast(:id as uuid) and queue_status in ('waiting','called','checking','in-consultation','paused')",Map.of("id",existing)).isPresent())return Map.of("queue",workflow.queue(actor.hospitalId(),existing),"reused",true);
        String departmentId=clean(a.get("department_id"));Map<String,Object> dep=departmentId==null?Map.of("name","OPD","code","OPD"):sql.required("select name,code from departments where id=cast(:id as uuid)",Map.of("id",departmentId),"Department not found.");
        sequences.lock("govcare:"+actor.hospitalId()+":queue:"+OffsetDateTime.now().toLocalDate());
        Number count=(Number)sql.required("select count(*)::int as total from opd_queue where hospital_id=:hospitalId and created_at::date=current_date",Map.of("hospitalId",actor.hospitalId()),"Unable to generate token.").get("total");int seq=count.intValue()+1;
        String token=WorkflowSql.tokenPrefix(String.valueOf(dep.get("name")),String.valueOf(dep.get("code")))+"-"+String.format("%03d",seq);
        String visitNo=sequences.daily(actor.hospitalId(),"visits","visit_no","VIS-");
        Map<String,Object> p=new HashMap<>();p.put("hospitalId",actor.hospitalId());p.put("patientId",a.get("patient_id"));p.put("departmentId",departmentId);p.put("doctorId",a.get("doctor_id"));p.put("appointmentId",id);p.put("visitNo",visitNo);p.put("reason",a.get("reason")!=null?a.get("reason"):"Appointment visit");p.put("priority",a.get("priority"));p.put("actorId",actor.id());p.put("token",token);
        Map<String,Object> visit=sql.required("""
          insert into visits(hospital_id,patient_id,department_id,doctor_id,appointment_id,visit_no,visit_type,reason,priority,workflow_status,status,created_by,updated_by)
          values(:hospitalId,cast(:patientId as uuid),cast(:departmentId as uuid),cast(:doctorId as uuid),cast(:appointmentId as uuid),:visitNo,'appointment',:reason,cast(:priority as priority_level),'waiting','pending',:actorId,:actorId) returning id::text
        """,p,"Unable to create visit.");p.put("visitId",visit.get("id"));
        Map<String,Object> queue=sql.required("""
          insert into opd_queue(hospital_id,visit_id,patient_id,department_id,doctor_id,appointment_id,token_no,queue_status,priority,estimated_wait_minutes,created_by,updated_by)
          values(:hospitalId,cast(:visitId as uuid),cast(:patientId as uuid),cast(:departmentId as uuid),cast(:doctorId as uuid),cast(:appointmentId as uuid),:token,'waiting',cast(:priority as priority_level),0,:actorId,:actorId) returning id::text
        """,p,"Unable to create queue.");
        sql.update("update appointments set queue_id=cast(:queueId as uuid),checked_in_at=now(),workflow_status='waiting',status='active',updated_by=:actorId where id=cast(:id as uuid)",Map.of("queueId",queue.get("id"),"actorId",actor.id(),"id",id));
        return Map.of("queue",workflow.queue(actor.hospitalId(),String.valueOf(queue.get("id"))),"reused",false);
    }

    @Transactional
    public Map<String,Object> status(GovCarePrincipal actor,String id,Map<String,Object> input){String state=req(input,"status");if(!Set.of("scheduled","confirmed","cancelled","no_show").contains(state))throw ApiException.badRequest("Invalid appointment status.");Map<String,Object> p=new HashMap<>();p.put("id",id);p.put("hospitalId",actor.hospitalId());p.put("state",state);p.put("record",state.equals("cancelled")?"cancelled":"active");p.put("actorId",actor.id());int changed=sql.update("update appointments set workflow_status=:state,status=cast(:record as record_status),confirmed_at=case when :state='confirmed' then now() else confirmed_at end,cancelled_at=case when :state='cancelled' then now() else cancelled_at end,no_show_at=case when :state='no_show' then now() else no_show_at end,updated_by=:actorId where id=cast(:id as uuid) and hospital_id=:hospitalId",p);if(changed==0)throw ApiException.notFound("Appointment not found.");return workflow.appointment(actor.hospitalId(),id);}
    private static String clean(Object o){if(o==null)return null;String s=String.valueOf(o).trim();return s.isEmpty()?null:s;}private static String req(Map<String,Object>m,String k){String s=clean(m.get(k));if(s==null)throw ApiException.badRequest(k+" is required.");return s;}
}
