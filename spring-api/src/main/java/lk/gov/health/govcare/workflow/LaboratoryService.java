package lk.gov.health.govcare.workflow;

import lk.gov.health.govcare.audit.AuditService;
import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.JsonSupport;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class LaboratoryService {
    private final SqlSupport sql; private final JsonSupport json; private final AuditService audit;
    public LaboratoryService(SqlSupport sql, JsonSupport json, AuditService audit){this.sql=sql;this.json=json;this.audit=audit;}

    private static final String SELECT="""
      select lr.id::text,lr.patient_id::text,lr.visit_id::text,lr.consultation_id::text,
       p.patient_no,p.full_name as patient_name,lr.test_catalog_id::text,lr.test_type,lr.test_code,lr.specimen,lr.priority::text,
       lr.clinical_reason,lr.instructions,lr.workflow_status,u.full_name as requested_by_name,
       r.id::text as result_id,r.numeric_result,r.text_result,r.unit,r.reference_range,r.classification,
       r.abnormal_flag,r.critical_flag,lr.created_at
      from lab_requests lr join patients p on p.id=lr.patient_id
      left join app_users u on u.id=lr.requested_by
      left join lateral(select * from lab_results x where x.lab_request_id=lr.id order by x.created_at desc limit 1) r on true
      """;

    public List<Map<String,Object>> list(GovCarePrincipal a,String status,String patient){
        StringBuilder q=new StringBuilder(SELECT+" where lr.hospital_id=:hospital and lr.status<>'deleted'");
        Map<String,Object> p=new HashMap<>();p.put("hospital",a.hospitalId());
        if(Set.of("patient","guardian").contains(a.role())){
            if(a.patientId()==null) return List.of();
            q.append(" and lr.patient_id=:patientId and lr.workflow_status in ('released','reviewed')");
            p.put("patientId",a.patientId());
        } else if(clean(patient)!=null){q.append(" and lr.patient_id=cast(:patientId as uuid)");p.put("patientId",patient);}
        if(clean(status)!=null){q.append(" and lr.workflow_status=:state");p.put("state",status);}
        if(a.departmentId()!=null && Set.of("lab_technician","lab_manager","pathologist").contains(a.role())){
            q.append(" and (u.department_id=:department or u.department_id is null)");p.put("department",a.departmentId());
        }
        q.append(" order by lr.created_at desc limit 300");return sql.list(q.toString(),p);
    }
    public Map<String,Object> get(GovCarePrincipal a,String id){
        StringBuilder q=new StringBuilder(SELECT+" where lr.id=cast(:id as uuid) and lr.hospital_id=:hospital");
        Map<String,Object> p=new HashMap<>();p.put("id",id);p.put("hospital",a.hospitalId());
        if(Set.of("patient","guardian").contains(a.role())){
            if(a.patientId()==null) throw ApiException.notFound("Laboratory order not found.");
            q.append(" and lr.patient_id=:patientId and lr.workflow_status in ('released','reviewed')");p.put("patientId",a.patientId());
        }
        q.append(" limit 1");
        return sql.required(q.toString(),p,"Laboratory order not found.");
    }

    @Transactional
    @SuppressWarnings("unchecked")
    public List<Map<String,Object>> create(GovCarePrincipal a,Map<String,Object> input){
        String patient=req(input,"patientUuid"),indication=req(input,"clinicalIndication");
        if(sql.one("select id from patients where id=cast(:id as uuid) and hospital_id=:hospital and status<>'deleted'",Map.of("id",patient,"hospital",a.hospitalId())).isEmpty())throw ApiException.notFound("Patient not found.");
        String visit=clean(input.get("visitUuid")),consultation=clean(input.get("consultationUuid")); validateLinks(a,patient,visit,consultation);
        Object itemsObj=input.get("items");if(!(itemsObj instanceof List<?> raw)||raw.isEmpty())throw ApiException.badRequest("At least one laboratory test is required.");
        List<Map<String,Object>> out=new ArrayList<>();
        for(Object o:raw){
            if(!(o instanceof Map<?,?> m)) throw ApiException.badRequest("Invalid laboratory test item.");
            Map<String,Object> item=(Map<String,Object>)m;
            String catalogId=clean(item.get("testCatalogId"));
            String test=req(item,"testName");
            String code=clean(item.get("testCode"));
            String specimen=clean(item.get("specimen"));
            if(catalogId!=null){
                Map<String,Object> catalog=sql.required("select id::text,code,name,specimen_type from laboratory_test_catalog where id=cast(:id as uuid) and status='active'",Map.of("id",catalogId),"Laboratory test was not found or is inactive.");
                test=String.valueOf(catalog.get("name"));
                code=String.valueOf(catalog.get("code"));
                if(specimen==null) specimen=clean(catalog.get("specimen_type"));
            }
            Map<String,Object> p=map("hospital",a.hospitalId(),"patient",patient,"visit",visit,"consultation",consultation,"user",a.id(),"catalog",catalogId,"test",test,"code",code,"specimen",specimen,"priority",String.valueOf(input.getOrDefault("priority","routine")),"reason",indication,"instructions",clean(item.get("instructions")));
            Map<String,Object> inserted=sql.required("""
              insert into lab_requests(hospital_id,patient_id,visit_id,consultation_id,requested_by,test_catalog_id,test_type,test_code,specimen,priority,clinical_reason,instructions,workflow_status,sample_status,test_status,status,created_by,updated_by)
              values(:hospital,cast(:patient as uuid),cast(:visit as uuid),cast(:consultation as uuid),:user,cast(:catalog as uuid),:test,:code,:specimen,cast(:priority as priority_level),:reason,:instructions,'ordered','requested','pending','active',:user,:user) returning id::text
              """,p,"Unable to create laboratory order.");
            Map<String,Object> order=get(a,String.valueOf(inserted.get("id")));
            out.add(order);
            audit.record(a,"laboratory","lab_order_created","lab_requests",UUID.fromString(String.valueOf(inserted.get("id"))),null,order);
        }
        return out;
    }

    @Transactional public Map<String,Object> status(GovCarePrincipal a,String id,Map<String,Object> in){
        String state=req(in,"status");if(!Set.of("ordered","received","sample_collected","in_progress","result_entered","verified","released","reviewed","cancelled").contains(state))throw ApiException.badRequest("Invalid laboratory status.");
        Map<String,Object> p=map("id",id,"hospital",a.hospitalId(),"state",state,"user",a.id());int n=sql.update("""
          update lab_requests set workflow_status=:state,sample_status=case when :state='sample_collected' then 'collected' else sample_status end,
          test_status=case when :state in ('in_progress','result_entered','verified','released','reviewed') then :state else test_status end,
          received_at=case when :state='received' then now() else received_at end,sample_collected_at=case when :state='sample_collected' then now() else sample_collected_at end,
          status=case when :state='cancelled' then 'cancelled'::record_status else status end,updated_by=:user,updated_at=now()
          where id=cast(:id as uuid) and hospital_id=:hospital
          """,p);if(n==0)throw ApiException.notFound("Laboratory order not found.");return get(a,id);
    }

    @Transactional public Map<String,Object> result(GovCarePrincipal a,String orderId,Map<String,Object> in){
        Map<String,Object> order=get(a,orderId);String classification=String.valueOf(in.getOrDefault("classification","normal"));if(!Set.of("normal","abnormal","critical").contains(classification))throw ApiException.badRequest("Invalid result classification.");
        Map<String,Object> p=map("hospital",a.hospitalId(),"order",orderId,"patient",order.get("patient_id"),"user",a.id(),"numeric",in.get("numericResult"),"text",clean(in.get("textResult")),"unit",clean(in.get("unit")),"range",clean(in.get("referenceRange")),"classification",classification,"data",json.write(in.getOrDefault("resultData",Map.of())),"url",clean(in.get("reportUrl")));
        Map<String,Object> existingResult=sql.one("select id::text from lab_results where lab_request_id=cast(:order as uuid) order by created_at desc limit 1",Map.of("order",orderId)).orElse(null);
        Map<String,Object> row;
        if(existingResult==null){
          row=sql.required("""
            insert into lab_results(hospital_id,lab_request_id,patient_id,entered_by,result_data,numeric_result,text_result,unit,reference_range,classification,abnormal_flag,critical_flag,report_url,release_status,status,created_by,updated_by)
            values(:hospital,cast(:order as uuid),cast(:patient as uuid),:user,cast(:data as jsonb),:numeric,:text,:unit,:range,:classification,:classification<>'normal',:classification='critical',:url,'internal','pending',:user,:user)
            returning id::text
            """,p,"Unable to save laboratory result.");
        }else{
          p.put("resultId",existingResult.get("id"));
          row=sql.required("""
            update lab_results set entered_by=:user,result_data=cast(:data as jsonb),numeric_result=:numeric,text_result=:text,unit=:unit,reference_range=:range,classification=:classification,abnormal_flag=:classification<>'normal',critical_flag=:classification='critical',report_url=:url,updated_by=:user,updated_at=now()
            where id=cast(:resultId as uuid) returning id::text
            """,p,"Unable to update laboratory result.");
        }
        sql.update("update lab_requests set workflow_status='result_entered',test_status='result_entered',result_entered_at=now(),updated_by=:user,updated_at=now() where id=cast(:id as uuid)",Map.of("user",a.id(),"id",orderId));return row;
    }

    @Transactional public Map<String,Object> verify(GovCarePrincipal a,String resultId,Map<String,Object> in){
        boolean release=Boolean.parseBoolean(String.valueOf(in.getOrDefault("release",true)));Map<String,Object> p=map("id",resultId,"hospital",a.hospitalId(),"user",a.id(),"release",release);
        Map<String,Object> row=sql.required("""
          update lab_results set verified_by=:user,verified_at=now(),approved_by=:user,approved_at=now(),release_status=case when :release then 'released'::release_status else 'internal'::release_status end,released_at=case when :release then now() else released_at end,status='completed',updated_by=:user,updated_at=now()
          where id=cast(:id as uuid) and hospital_id=:hospital returning id::text,lab_request_id::text
          """,p,"Laboratory result not found.");
        sql.update("update lab_requests set workflow_status=:state,verified_by=:user,verified_at=now(),released_at=case when :release then now() else released_at end,updated_by=:user,updated_at=now() where id=cast(:order as uuid)",map("state",release?"released":"verified","user",a.id(),"release",release,"order",row.get("lab_request_id")));return row;
    }
    @Transactional public Map<String,Object> review(GovCarePrincipal a,String resultId){Map<String,Object> row=sql.required("update lab_results set reviewed_by=:user,reviewed_at=now(),updated_by=:user,updated_at=now() where id=cast(:id as uuid) and hospital_id=:hospital returning id::text,lab_request_id::text",map("user",a.id(),"id",resultId,"hospital",a.hospitalId()),"Laboratory result not found.");sql.update("update lab_requests set workflow_status='reviewed',reviewed_by=:user,reviewed_at=now(),updated_by=:user where id=cast(:id as uuid)",map("user",a.id(),"id",row.get("lab_request_id")));return row;}
    private void validateLinks(GovCarePrincipal a,String patient,String visit,String consultation){if(visit!=null&&sql.one("select id from visits where id=cast(:id as uuid) and patient_id=cast(:patient as uuid) and hospital_id=:hospital",map("id",visit,"patient",patient,"hospital",a.hospitalId())).isEmpty())throw ApiException.conflict("Visit does not belong to this patient.");if(consultation!=null&&sql.one("select id from consultations where id=cast(:id as uuid) and patient_id=cast(:patient as uuid) and hospital_id=:hospital",map("id",consultation,"patient",patient,"hospital",a.hospitalId())).isEmpty())throw ApiException.conflict("Consultation does not belong to this patient.");}
    private static String clean(Object o){if(o==null)return null;String s=String.valueOf(o).trim();return s.isBlank()?null:s;}private static String req(Map<String,Object>m,String k){String s=clean(m.get(k));if(s==null)throw ApiException.badRequest(k+" is required.");return s;}private static Map<String,Object> map(Object...x){Map<String,Object>m=new HashMap<>();for(int i=0;i<x.length;i+=2)m.put(String.valueOf(x[i]),x[i+1]);return m;}
}
