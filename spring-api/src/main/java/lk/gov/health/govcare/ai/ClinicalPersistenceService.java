package lk.gov.health.govcare.ai;

import lk.gov.health.govcare.common.*;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
public class ClinicalPersistenceService {
 private final SqlSupport sql; private final JsonSupport json; private final lk.gov.health.govcare.security.ClinicalPatientAccess access;
 public ClinicalPersistenceService(SqlSupport sql,JsonSupport json,lk.gov.health.govcare.security.ClinicalPatientAccess access){this.sql=sql;this.json=json;this.access=access;}

 @Transactional
 public UUID persistExtraction(GovCarePrincipal a,UUID patientId,UUID patientDocumentId,String fileName,String sourceType,String checksum,long size,Map<String,Object> extraction){
  a=access.clinicalScope(a,patientId,false);
  if(checksum!=null&&!checksum.isBlank()){
   var existing=sql.one("select id from clinical_reports where hospital_id=:h and patient_id=:p and sha256_hash=:s",Map.of("h",a.hospitalId(),"p",patientId,"s",checksum));
   if(existing.isPresent()) return UUID.fromString(String.valueOf(existing.get().get("id")));
  }
  String method=Objects.toString(extraction.get("extractionMethod"),"LOCAL_TEXT");
  String status=Objects.toString(extraction.get("status"),"COMPLETED");
  String processing="COMPLETED".equals(status)?"PROCESSED":"OCR_REQUIRED".equals(status)?"PARTIAL":"FAILED";
  Map<String,Object> p=new HashMap<>();p.put("h",a.hospitalId());p.put("p",patientId);p.put("d",patientDocumentId);p.put("title",fileName);p.put("file",fileName);p.put("size",size);p.put("sha",checksum);p.put("source",sourceType);p.put("processing",processing);p.put("method",method);p.put("actor",a.id());
  UUID report=UUID.fromString(String.valueOf(sql.required("insert into clinical_reports(hospital_id,patient_id,patient_document_id,report_title,original_filename,file_size,sha256_hash,source_type,processing_status,extraction_method,uploaded_by) values(:h,:p,:d,:title,:file,:size,:sha,:source,:processing,:method,:actor) returning id::text",p,"Unable to persist clinical report.").get("id")));
  @SuppressWarnings("unchecked") Map<String,Map<String,Object>> values=(Map<String,Map<String,Object>>)extraction.getOrDefault("extractedValues",Map.of());
  for(var e:values.entrySet()) persistObservation(a,patientId,report,e.getKey(),e.getValue(),method);
  return report;
 }

 private void persistObservation(GovCarePrincipal a,UUID patientId,UUID report,String feature,Map<String,Object> v,String method){
  Object value=v.get("value"); if(!(value instanceof Number n)) return;
  String loinc=blankToNull(v.get("loinc")); String unit=blankToNull(v.get("unit")); String display=Objects.toString(v.get("display"),feature);
  Map<String,Object> p=new HashMap<>();p.put("h",a.hospitalId());p.put("patient",patientId);p.put("report",report);p.put("feature",feature);p.put("display",display);p.put("system",loinc==null?null:"http://loinc.org");p.put("code",loinc);p.put("value",n.doubleValue());p.put("unit",unit);p.put("confidence",number(v.get("confidence")));p.put("method",method);p.put("actor",a.id());p.put("effective",ClinicalMeasurementDates.explicit(v.get("clinicalDate")));
  sql.update("insert into clinical_observations(hospital_id,patient_id,report_id,feature_key,display_name,coding_system,code,value_numeric,unit,normalized_value,normalized_unit,source_type,extraction_confidence,extraction_method,created_by,effective_at) values(:h,:patient,:report,:feature,:display,:system,:code,:value,:unit,:value,:unit,'PDF',:confidence,:method,:actor,:effective)",p);
  if(loinc!=null){
   String fhirId=UUID.randomUUID().toString(); String patientFhir=ensureFhirPatient(a,patientId);
   Map<String,Object> observation=new LinkedHashMap<>();observation.put("resourceType","Observation");observation.put("id",fhirId);observation.put("status","final");
   observation.put("code",Map.of("coding",List.of(Map.of("system","http://loinc.org","code",loinc,"display",display))));observation.put("subject",Map.of("reference","Patient/"+patientFhir));
   observation.put("valueQuantity",Map.of("value",n.doubleValue(),"unit",Objects.toString(unit,"")));
   if(p.get("effective") instanceof java.sql.Timestamp measured)observation.put("effectiveDateTime",measured.toInstant().toString());
   String resource=json.write(observation);
   sql.update("insert into fhir_resource(resource_type,resource_id,patient_id,hospital_id,json_data) values('Observation',:rid,:patient,:h,cast(:j as jsonb)) on conflict(hospital_id,resource_type,resource_id) do nothing",Map.of("rid",fhirId,"patient",patientId,"h",a.hospitalId(),"j",resource));
  }
 }

 public boolean existsChecksum(GovCarePrincipal a,UUID patientId,String checksum){a=access.clinicalScope(a,patientId,false);if(checksum==null||checksum.isBlank())return false;return sql.one("select id from clinical_reports where hospital_id=:h and patient_id=:p and sha256_hash=:s",Map.of("h",a.hospitalId(),"p",patientId,"s",checksum)).isPresent();}
 public List<Map<String,Object>> reports(GovCarePrincipal a,UUID patientId){a=access.clinicalScope(a,patientId,false);return sql.list("select cr.id::text,cr.report_uuid::text \"reportUuid\",cr.patient_document_id::text \"documentId\",cr.report_title \"reportTitle\",cr.original_filename \"originalFilename\",cr.source_type \"sourceType\",cr.processing_status \"processingStatus\",cr.extraction_method \"extractionMethod\",cr.uploaded_at \"uploadedAt\" from clinical_reports cr where cr.hospital_id=:h and cr.patient_id=:p order by cr.created_at desc",Map.of("h",a.hospitalId(),"p",patientId));}
 public List<Map<String,Object>> observations(GovCarePrincipal a,UUID patientId,UUID reportId){a=access.clinicalScope(a,patientId,false);return sql.list("select id::text,feature_key \"featureKey\",display_name \"displayName\",coding_system \"codingSystem\",code,value_numeric \"valueNumeric\",value_text \"valueText\",unit,normalized_value \"normalizedValue\",normalized_unit \"normalizedUnit\",source_type \"sourceType\",extraction_confidence \"extractionConfidence\",manual_override \"manualOverride\",created_at \"createdAt\" from clinical_observations where hospital_id=:h and patient_id=:p and report_id=:r order by created_at",Map.of("h",a.hospitalId(),"p",patientId,"r",reportId));}
 private String ensureFhirPatient(GovCarePrincipal a,UUID patient){var existing=sql.one("select resource_id from fhir_resource where hospital_id=:h and patient_id=:p and resource_type='Patient' order by created_date limit 1",Map.of("h",a.hospitalId(),"p",patient));if(existing.isPresent())return String.valueOf(existing.get().get("resource_id"));Map<String,Object> row=sql.required("select patient_no,full_name from patients where id=:p and hospital_id=:h",Map.of("p",patient,"h",a.hospitalId()),"Patient not found.");String id="patient-"+patient;String body="{\"resourceType\":\"Patient\",\"id\":\""+id+"\",\"identifier\":[{\"system\":\"urn:govcare:patient-number\",\"value\":\""+escape(Objects.toString(row.get("patient_no"),""))+"\"}],\"name\":[{\"text\":\""+escape(Objects.toString(row.get("full_name"),""))+"\"}]}";sql.update("insert into fhir_resource(resource_type,resource_id,patient_id,hospital_id,json_data) values('Patient',:id,:p,:h,cast(:j as jsonb)) on conflict(hospital_id,resource_type,resource_id) do nothing",Map.of("id",id,"p",patient,"h",a.hospitalId(),"j",body));return id;}
 private static Double number(Object o){return o instanceof Number n?n.doubleValue():null;} private static String blankToNull(Object o){String s=Objects.toString(o,"").trim();return s.isEmpty()?null:s;} private static String escape(String s){return s.replace("\\","\\\\").replace("\"","\\\"");}
}
