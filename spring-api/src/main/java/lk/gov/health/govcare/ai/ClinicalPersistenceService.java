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
  a=access.clinicalScope(a,patientId,true);
  if(checksum!=null&&!checksum.isBlank()){
   var existing=sql.one("select id from clinical_reports where hospital_id=:h and patient_id=:p and sha256_hash=:s",Map.of("h",a.hospitalId(),"p",patientId,"s",checksum));
   if(existing.isPresent()) return UUID.fromString(String.valueOf(existing.get().get("id")));
  }
  String method=Objects.toString(extraction.get("extractionMethod"),"LOCAL_TEXT");
  String status=Objects.toString(extraction.get("status"),"COMPLETED");
  String processing="PENDING_EXTRACTION".equals(status)?"PROCESSING":Set.of("COMPLETED","PARTIAL","NO_SUPPORTED_MEASUREMENTS").contains(status)?"PROCESSED":"OCR_REQUIRED".equals(status)?"PARTIAL":"FAILED";
  Map<String,Object> p=new HashMap<>();p.put("h",a.hospitalId());p.put("p",patientId);p.put("d",patientDocumentId);p.put("title",fileName);p.put("file",fileName);p.put("size",size);p.put("sha",checksum);p.put("source",sourceType);p.put("processing",processing);p.put("method",method);p.put("actor",a.id());p.put("metadata",json.write(extraction));
  UUID report=UUID.fromString(String.valueOf(sql.required("insert into clinical_reports(hospital_id,patient_id,patient_document_id,report_title,original_filename,file_size,sha256_hash,source_type,processing_status,extraction_method,uploaded_by,extraction_metadata) values(:h,:p,:d,:title,:file,:size,:sha,:source,:processing,:method,:actor,cast(:metadata as jsonb)) returning id::text",p,"Unable to persist clinical report.").get("id")));
  // Saving source evidence never creates laboratory observations or marks extracted text verified.
  return report;
 }

 public boolean existsChecksum(GovCarePrincipal a,UUID patientId,String checksum){a=access.clinicalScope(a,patientId,false);if(checksum==null||checksum.isBlank())return false;return sql.one("select id from clinical_reports where hospital_id=:h and patient_id=:p and sha256_hash=:s",Map.of("h",a.hospitalId(),"p",patientId,"s",checksum)).isPresent();}
 public List<Map<String,Object>> reports(GovCarePrincipal a,UUID patientId){a=access.clinicalScope(a,patientId,false);return sql.list("select cr.id::text,cr.version,cr.replaces_report_id::text \"replacesReportId\",cr.extraction_metadata #>> '{status}' \"extractionStatus\",cr.extraction_metadata #>> '{reportDates,reportDate}' \"reportDate\",cr.report_uuid::text \"reportUuid\",cr.patient_document_id::text \"documentId\",cr.report_title \"reportTitle\",cr.original_filename \"originalFilename\",cr.source_type \"sourceType\",cr.processing_status \"processingStatus\",cr.extraction_method \"extractionMethod\",cr.uploaded_at \"uploadedAt\" from clinical_reports cr where cr.hospital_id=:h and cr.patient_id=:p order by cr.created_at desc",Map.of("h",a.hospitalId(),"p",patientId));}
 public List<Map<String,Object>> observations(GovCarePrincipal a,UUID patientId,UUID reportId){a=access.clinicalScope(a,patientId,false);return sql.list("select id::text,feature_key \"featureKey\",display_name \"displayName\",coding_system \"codingSystem\",code,value_numeric \"valueNumeric\",value_text \"valueText\",unit,normalized_value \"normalizedValue\",normalized_unit \"normalizedUnit\",source_type \"sourceType\",extraction_confidence \"extractionConfidence\",manual_override \"manualOverride\",created_at \"createdAt\" from clinical_observations where hospital_id=:h and patient_id=:p and report_id=:r order by created_at",Map.of("h",a.hospitalId(),"p",patientId,"r",reportId));}
}
