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
public class RadiologyService {
    private final SqlSupport sql; private final JsonSupport json; private final AuditService audit;
    public RadiologyService(SqlSupport sql,JsonSupport json,AuditService audit){this.sql=sql;this.json=json;this.audit=audit;}
    private static final String SELECT="""
      select rr.id::text,rr.patient_id::text,rr.visit_id::text,rr.consultation_id::text,p.patient_no,p.full_name as patient_name,rr.study_catalog_id::text,
       rr.imaging_type,rr.body_area,rr.priority::text,rr.clinical_reason,rr.contrast_required,rr.pregnancy_warning,rr.instructions,
       rr.workflow_status,u.full_name as requested_by_name,r.id::text as report_id,r.findings,r.impression,r.classification,rr.created_at
      from radiology_requests rr join patients p on p.id=rr.patient_id left join app_users u on u.id=rr.requested_by
      left join lateral(select * from radiology_reports x where x.radiology_request_id=rr.id order by x.created_at desc limit 1) r on true
      """;
    public List<Map<String,Object>> list(GovCarePrincipal a,String status,String patient){
        StringBuilder q=new StringBuilder(SELECT+" where rr.hospital_id=:hospital and rr.status<>'deleted'");
        Map<String,Object>p=new HashMap<>();p.put("hospital",a.hospitalId());
        if(Set.of("patient","guardian").contains(a.role())){
            if(a.patientId()==null) return List.of();
            q.append(" and rr.patient_id=:patient and rr.workflow_status in ('released','reviewed')");
            p.put("patient",a.patientId());
        }else if(clean(patient)!=null){q.append(" and rr.patient_id=cast(:patient as uuid)");p.put("patient",patient);}
        if(clean(status)!=null){q.append(" and rr.workflow_status=:state");p.put("state",status);}
        q.append(" order by rr.created_at desc limit 300");return sql.list(q.toString(),p);
    }
    public Map<String,Object> get(GovCarePrincipal a,String id){
        StringBuilder q=new StringBuilder(SELECT+" where rr.id=cast(:id as uuid) and rr.hospital_id=:hospital");
        Map<String,Object> p=new HashMap<>();p.put("id",id);p.put("hospital",a.hospitalId());
        if(Set.of("patient","guardian").contains(a.role())){
            if(a.patientId()==null) throw ApiException.notFound("Radiology order not found.");
            q.append(" and rr.patient_id=:patientId and rr.workflow_status in ('released','reviewed')");p.put("patientId",a.patientId());
        }
        q.append(" limit 1");
        return sql.required(q.toString(),p,"Radiology order not found.");
    }
    @Transactional
    @SuppressWarnings("unchecked")
    public List<Map<String,Object>> create(GovCarePrincipal a,Map<String,Object> in){
        String patient=req(in,"patientUuid"),reason=req(in,"clinicalIndication");
        if(sql.one("select id from patients where id=cast(:id as uuid) and hospital_id=:hospital and status<>'deleted'",Map.of("id",patient,"hospital",a.hospitalId())).isEmpty()) throw ApiException.notFound("Patient not found.");
        String visit=clean(in.get("visitUuid")),consultation=clean(in.get("consultationUuid"));
        validateLinks(a,patient,visit,consultation);
        Object obj=in.get("items");
        if(!(obj instanceof List<?> raw)||raw.isEmpty()) throw ApiException.badRequest("At least one radiology investigation is required.");
        List<Map<String,Object>> out=new ArrayList<>();
        for(Object o:raw){
            if(!(o instanceof Map<?,?> x)) throw ApiException.badRequest("Invalid radiology item.");
            Map<String,Object> item=(Map<String,Object>)x;
            String catalogId=clean(item.get("studyCatalogId"));
            String type=req(item,"imagingType");
            String area=clean(item.get("bodyArea"));
            if(catalogId!=null){
                Map<String,Object> catalog=sql.required("select id::text,name,modality,body_region,contrast_default from radiology_study_catalog where id=cast(:id as uuid) and status='active'",Map.of("id",catalogId),"Radiology study was not found or is inactive.");
                type=String.valueOf(catalog.get("name"));
                if(area==null) area=clean(catalog.get("body_region"));
            }
            Map<String,Object> p=map("hospital",a.hospitalId(),"patient",patient,"visit",visit,"consultation",consultation,"user",a.id(),"catalog",catalogId,"type",type,"area",area,"priority",String.valueOf(in.getOrDefault("priority","routine")),"reason",reason,"contrast",Boolean.parseBoolean(String.valueOf(item.getOrDefault("contrastRequired",false))),"pregnancy",Boolean.parseBoolean(String.valueOf(item.getOrDefault("pregnancyWarning",false))),"instructions",clean(item.get("instructions")));
            Map<String,Object> row=sql.required("""
              insert into radiology_requests(hospital_id,patient_id,visit_id,consultation_id,requested_by,study_catalog_id,imaging_type,body_area,priority,clinical_reason,contrast_required,pregnancy_warning,instructions,workflow_status,scan_status,status,created_by,updated_by)
              values(:hospital,cast(:patient as uuid),cast(:visit as uuid),cast(:consultation as uuid),:user,cast(:catalog as uuid),:type,:area,cast(:priority as priority_level),:reason,:contrast,:pregnancy,:instructions,'ordered','requested','active',:user,:user) returning id::text
              """,p,"Unable to create radiology order.");
            Map<String,Object> order=get(a,String.valueOf(row.get("id")));
            out.add(order);
            audit.record(a,"radiology","radiology_order_created","radiology_requests",UUID.fromString(String.valueOf(row.get("id"))),null,order);
        }
        return out;
    }
    @Transactional public Map<String,Object> status(GovCarePrincipal a,String id,Map<String,Object> in){String state=req(in,"status");if(!Set.of("ordered","scheduled","patient_arrived","imaging_started","imaging_completed","report_drafted","verified","released","reviewed","cancelled").contains(state))throw ApiException.badRequest("Invalid radiology status.");Map<String,Object> p=map("id",id,"hospital",a.hospitalId(),"state",state,"user",a.id(),"scheduled",clean(in.get("scheduledAt")),"room",clean(in.get("room")));int n=sql.update("""
      update radiology_requests set workflow_status=:state,scan_status=:state,scheduled_at=coalesce(cast(:scheduled as timestamptz),scheduled_at),room=coalesce(:room,room),
      patient_arrived_at=case when :state='patient_arrived' then now() else patient_arrived_at end,
      imaging_started_at=case when :state='imaging_started' then now() else imaging_started_at end,
      imaging_completed_at=case when :state='imaging_completed' then now() else imaging_completed_at end,
      status=case when :state='cancelled' then 'cancelled'::record_status else status end,updated_by=:user,updated_at=now()
      where id=cast(:id as uuid) and hospital_id=:hospital
      """,p);if(n==0)throw ApiException.notFound("Radiology order not found.");return get(a,id);}
    @Transactional public Map<String,Object> report(GovCarePrincipal a,String orderId,Map<String,Object> in){Map<String,Object> order=get(a,orderId);String findings=req(in,"findings"),impression=req(in,"impression"),classification=String.valueOf(in.getOrDefault("classification","normal"));if(!Set.of("normal","abnormal","critical").contains(classification))throw ApiException.badRequest("Invalid report classification.");Map<String,Object> p=map("hospital",a.hospitalId(),"order",orderId,"patient",order.get("patient_id"),"user",a.id(),"findings",findings,"impression",impression,"classification",classification,"images",json.write(in.getOrDefault("imageUrls",List.of())),"url",clean(in.get("reportUrl")));Map<String,Object> existingReport=sql.one("select id::text from radiology_reports where radiology_request_id=cast(:order as uuid) order by created_at desc limit 1",Map.of("order",orderId)).orElse(null);Map<String,Object> row;if(existingReport==null){row=sql.required("""
      insert into radiology_reports(hospital_id,radiology_request_id,patient_id,radiologist_id,findings,impression,classification,image_urls,report_url,workflow_status,release_status,status,created_by,updated_by)
      values(:hospital,cast(:order as uuid),cast(:patient as uuid),:user,:findings,:impression,:classification,cast(:images as jsonb),:url,'report_drafted','internal','pending',:user,:user)
      returning id::text
      """,p,"Unable to save radiology report.");}else{p.put("reportId",existingReport.get("id"));row=sql.required("""
      update radiology_reports set radiologist_id=:user,findings=:findings,impression=:impression,classification=:classification,image_urls=cast(:images as jsonb),report_url=:url,workflow_status='report_drafted',updated_by=:user,updated_at=now()
      where id=cast(:reportId as uuid) returning id::text
      """,p,"Unable to update radiology report.");}sql.update("update radiology_requests set workflow_status='report_drafted',updated_by=:user,updated_at=now() where id=cast(:id as uuid)",Map.of("user",a.id(),"id",orderId));return row;}
    @Transactional public Map<String,Object> verify(GovCarePrincipal a,String reportId,Map<String,Object> in){boolean release=Boolean.parseBoolean(String.valueOf(in.getOrDefault("release",true)));Map<String,Object> row=sql.required("""
      update radiology_reports set verified_by=:user,verified_at=now(),approved_at=now(),workflow_status=:state,release_status=case when :release then 'released'::release_status else 'internal'::release_status end,released_at=case when :release then now() else released_at end,status='completed',updated_by=:user,updated_at=now()
      where id=cast(:id as uuid) and hospital_id=:hospital returning id::text,radiology_request_id::text
      """,map("user",a.id(),"state",release?"released":"verified","release",release,"id",reportId,"hospital",a.hospitalId()),"Radiology report not found.");sql.update("update radiology_requests set workflow_status=:state,released_at=case when :release then now() else released_at end,updated_by=:user,updated_at=now() where id=cast(:id as uuid)",map("state",release?"released":"verified","release",release,"user",a.id(),"id",row.get("radiology_request_id")));return row;}
    @Transactional public Map<String,Object> review(GovCarePrincipal a,String reportId){Map<String,Object> row=sql.required("update radiology_reports set reviewed_by=:user,reviewed_at=now(),workflow_status='reviewed',updated_by=:user,updated_at=now() where id=cast(:id as uuid) and hospital_id=:hospital returning id::text,radiology_request_id::text",map("user",a.id(),"id",reportId,"hospital",a.hospitalId()),"Radiology report not found.");sql.update("update radiology_requests set workflow_status='reviewed',reviewed_by=:user,reviewed_at=now(),updated_by=:user where id=cast(:id as uuid)",map("user",a.id(),"id",row.get("radiology_request_id")));return row;}
    private void validateLinks(GovCarePrincipal a,String patient,String visit,String consultation){if(visit!=null&&sql.one("select id from visits where id=cast(:id as uuid) and patient_id=cast(:patient as uuid) and hospital_id=:hospital",map("id",visit,"patient",patient,"hospital",a.hospitalId())).isEmpty())throw ApiException.conflict("Visit does not belong to this patient.");if(consultation!=null&&sql.one("select id from consultations where id=cast(:id as uuid) and patient_id=cast(:patient as uuid) and hospital_id=:hospital",map("id",consultation,"patient",patient,"hospital",a.hospitalId())).isEmpty())throw ApiException.conflict("Consultation does not belong to this patient.");}
    private static String clean(Object o){if(o==null)return null;String s=String.valueOf(o).trim();return s.isBlank()?null:s;}private static String req(Map<String,Object>m,String k){String s=clean(m.get(k));if(s==null)throw ApiException.badRequest(k+" is required.");return s;}private static Map<String,Object> map(Object...x){Map<String,Object>m=new HashMap<>();for(int i=0;i<x.length;i+=2)m.put(String.valueOf(x[i]),x[i+1]);return m;}
}
