package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import lk.gov.health.govcare.common.*;
import lk.gov.health.govcare.security.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Explicit source review orchestrates the existing verified-measurement and renal-session services. */
@Service
public class ClinicalPdfVerificationService {
 public record Value(String feature,Double value,String unit,Instant observedAt,Double extractedValue,String originalText){}
 public record DialysisSession(String sessionId,boolean maintenanceHemodialysisVerified,String regimen){}
 public record Request(UUID requestId,boolean confirmed,boolean associationConfirmed,String note,List<Value> values,DialysisSession dialysisSession){}
 private final SqlSupport sql;private final JsonSupport json;private final ObjectMapper mapper;private final ClinicalPatientAccess access;
 private final ClinicalPdfImportService imports;private final PredictiveIntelligenceService measurements;private final SriLankanRenalIntelligenceService renal;
 public ClinicalPdfVerificationService(SqlSupport sql,JsonSupport json,ObjectMapper mapper,ClinicalPatientAccess access,ClinicalPdfImportService imports,PredictiveIntelligenceService measurements,SriLankanRenalIntelligenceService renal){this.sql=sql;this.json=json;this.mapper=mapper;this.access=access;this.imports=imports;this.measurements=measurements;this.renal=renal;}
 @Transactional public Map<String,Object> verify(GovCarePrincipal actor,UUID patient,UUID report,Request request)throws java.io.IOException{
  var scoped=access.clinicalScope(actor,patient,true);
  if(request==null||request.requestId()==null||!request.confirmed()||!request.associationConfirmed()||request.values()==null||request.values().isEmpty()||request.values().size()>40||request.note()==null||request.note().isBlank()||request.note().length()>2000)throw ApiException.badRequest("Confirm the source, patient association, values, units and actual collection dates, and enter a review note.");
  var p=new HashMap<String,Object>(Map.of("h",scoped.hospitalId(),"p",patient,"report",report,"actor",actor.id(),"request",request.requestId()));
  var source=sql.required("select id,patient_document_id,original_filename,sha256_hash,document_classification from clinical_reports where id=:report and hospital_id=:h and patient_id=:p and report_status='ACTIVE' for update",p,"The source report is not available for this patient.");
  boolean synthetic=ClinicalTestPatientPolicy.synthetic(sql,scoped,patient);String classification=synthetic?"TEST_DOCUMENT":"CLINICAL_DOCUMENT";
  if("TEST_DOCUMENT".equals(source.get("document_classification"))&&!synthetic)throw ApiException.forbidden("Test documents cannot become clinical evidence for a real patient.");
  if(source.get("patient_document_id")==null)throw ApiException.badRequest("The original document must be saved before verification.");
  UUID document=UUID.fromString(source.get("patient_document_id").toString());var preview=imports.previewDocument(scoped,patient,document);
  if("MISMATCH".equals(preview.get("identityStatus"))&&!synthetic)throw ApiException.unprocessable("This report belongs to another patient. Clinical association is blocked.");
  var seen=new HashSet<String>();
  for(var value:request.values()){
   var definition=ClinicalFeatureNormalizer.definition(value.feature());
   if(definition==null||Set.of("Age","Edema","FamilyHistoryKidneyDisease","PreviousAcuteKidneyInjury","NSAIDsUse").contains(definition.input())||value.value()==null||!Double.isFinite(value.value())||value.unit()==null||value.observedAt()==null||value.observedAt().isAfter(Instant.now())||value.observedAt().isBefore(Instant.parse("1900-01-01T00:00:00Z")))throw ApiException.badRequest("Each reviewed measurement needs a supported analyte, numeric value, explicit unit and valid past collection time.");
   var normalized=ClinicalFeatureNormalizer.convert(definition.key(),value.value(),value.unit());
   if(normalized==null||!Double.isFinite(normalized)||normalized<definition.minimum()||normalized>definition.maximum()||definition.strictlyPositive()&&normalized<=0)throw ApiException.badRequest("Check the value and explicit unit for "+definition.label()+".");
   if(!seen.add(definition.input()+"|"+value.observedAt()))throw ApiException.badRequest("Choose one reviewed result per measurement and collection time.");
  }
  var ordered=request.values().stream().sorted(Comparator.comparing(Value::feature).thenComparing(Value::observedAt)).toList();
  String fingerprint=ClinicalIntelligenceEngine.sha256(json.write(Map.of("report",report,"classification",classification,"values",ordered,"note",request.note().trim(),"dialysis",request.dialysisSession()==null?Map.of():request.dialysisSession())));p.put("fingerprint",fingerprint);
  var reused=sql.one("select observations,input_fingerprint from clinical_pdf_verifications where hospital_id=:h and patient_id=:p and report_id=:report and actor_id=:actor and request_id=:request",p);
  if(reused.isPresent()&&!fingerprint.equals(reused.get().get("input_fingerprint")))throw ApiException.conflict("This review request was already used for different values.");
  if(reused.isEmpty())reused=sql.one("select observations,input_fingerprint from clinical_pdf_verifications where hospital_id=:h and patient_id=:p and report_id=:report and input_fingerprint=:fingerprint",p);
  if(reused.isPresent())return response(patient,report,classification,true,ClinicalFeatureNormalizer.node(reused.get().get("observations")));
  var outputs=new ArrayList<Map<String,Object>>();
  for(var value:ordered){
   var definition=ClinicalFeatureNormalizer.definition(value.feature());double normalized=ClinicalFeatureNormalizer.convert(definition.key(),value.value(),value.unit());
   var args=new HashMap<String,Object>(p);args.put("feature",definition.input());args.put("value",normalized);args.put("unit",definition.unit());args.put("time",java.sql.Timestamp.from(value.observedAt()));
   var prior=sql.one("select id from clinical_observations where hospital_id=:h and patient_id=:p and report_id=:report and feature_key=:feature and normalized_value=:value and normalized_unit=:unit and effective_at=:time and status='FINAL' and source_metadata->>'clinicianConfirmed'='true'",args);
   UUID observation;
   if(prior.isPresent())observation=UUID.fromString(prior.get().get("id").toString());else{
    UUID entryRequest=UUID.nameUUIDFromBytes((report+"|"+fingerprint+"|"+definition.input()+"|"+value.observedAt()+"|"+normalized+"|"+definition.unit()).getBytes(StandardCharsets.UTF_8));
    String sourceNote=classification+"; source "+source.get("original_filename")+"; "+request.note().trim();
    var recorded=measurements.recordMeasurement(scoped,patient,new PredictiveIntelligenceService.MeasurementRequest(entryRequest,definition.key(),normalized,definition.unit(),value.observedAt(),null,null,sourceNote.substring(0,Math.min(2000,sourceNote.length())),true));
    observation=UUID.fromString(recorded.get("id").toString());
    args.put("id",observation);args.put("classification",classification);args.put("label",definition.label());
    var meta=new LinkedHashMap<String,Object>();meta.put("clinicianConfirmed",true);meta.put("documentId",document.toString());meta.put("reportId",report.toString());meta.put("documentClassification",classification);meta.put("sourcePatientIdentity",preview.getOrDefault("patientIdentity",Map.of()));meta.put("identityStatus",preview.getOrDefault("identityStatus","UNVERIFIED"));meta.put("reviewedValue",value.value());meta.put("reviewedUnit",value.unit());meta.put("clinicalDate",value.observedAt().toString());meta.put("reviewNote",request.note().trim());
    var original=original(preview,definition.input(),value);meta.put("originalExtraction",original);meta.put("manualAddition",original.isEmpty());args.put("metadata",json.write(meta));
    sql.update("update clinical_observations set report_id=:report,feature_key=:feature,display_name=:label,source_metadata=cast(:metadata as jsonb),document_classification=:classification,extraction_method='CLINICIAN_REVIEWED_PDF',manual_override=:override where id=:id and hospital_id=:h and patient_id=:p",with(args,"override",!original.isEmpty()&&!Objects.equals(((Number)original.get("value")).doubleValue(),normalized)));
    sql.update("update clinical_observations set status='SUPERSEDED',updated_at=now() where hospital_id=:h and patient_id=:p and report_id=:report and feature_key=:feature and effective_at=:time and id<>:id and status='FINAL'",args);
    sql.update("update fhir_resource set json_data=jsonb_set(json_data,'{status}','\"entered-in-error\"'::jsonb) where hospital_id=:h and patient_id=:p and resource_type='Observation' and resource_id in(select id::text from clinical_observations where hospital_id=:h and patient_id=:p and report_id=:report and feature_key=:feature and effective_at=:time and status='SUPERSEDED')",args);
    sql.update("update fhir_resource set json_data=json_data||cast(:link as jsonb) where hospital_id=:h and patient_id=:p and resource_type='Observation' and resource_id=:resource",with(with(args,"resource",observation.toString()),"link",json.write(Map.of("derivedFrom",List.of(Map.of("reference","DocumentReference/clinical-report-"+report)),"meta",Map.of("tag",List.of(Map.of("system","urn:govcare:document-classification","code",classification)))))));
   }
   var out=new LinkedHashMap<String,Object>();out.put("feature",definition.input());out.put("value",normalized);out.put("unit",definition.unit());out.put("clinicalDate",value.observedAt().toString());out.put("observationId",observation.toString());out.put("reportId",report.toString());out.put("documentId",document.toString());out.put("sourceReport",source.get("original_filename"));out.put("sourceVerified",true);out.put("importReviewed",true);out.put("fingerprint",source.get("sha256_hash"));out.put("originalExtraction",original(preview,definition.input(),value));outputs.add(out);
  }
  if(request.dialysisSession()!=null){
   var session=request.dialysisSession();var pre=ordered.stream().filter(v->ClinicalFeatureNormalizer.definition(v.feature()).key().equals("urea_pre")).findFirst().orElseThrow(()->ApiException.badRequest("Select a reviewed pre-dialysis urea result."));var post=ordered.stream().filter(v->ClinicalFeatureNormalizer.definition(v.feature()).key().equals("urea_post")).findFirst().orElseThrow(()->ApiException.badRequest("Select a reviewed post-dialysis urea result."));
   var values=Map.of("urea_pre",pre.value(),"urea_post",post.value());var units=Map.of("urea_pre",pre.unit(),"urea_post",post.unit());
   renal.recordObservation(scoped,patient,new SriLankanRenalIntelligenceService.ObservationRequest(UUID.nameUUIDFromBytes((report+"|"+fingerprint+"|dialysis").getBytes(StandardCharsets.UTF_8)),post.observedAt(),session.maintenanceHemodialysisVerified(),values,units,classification+"; "+request.note(),true,Map.of("sessionId",Objects.toString(session.sessionId(),""),"preCollectedAt",pre.observedAt().toString(),"postCollectedAt",post.observedAt().toString(),"regimen",Objects.toString(session.regimen(),""))));
  }
  p.put("outputs",json.write(outputs));p.put("note",request.note().trim());
  sql.update("insert into clinical_pdf_verifications(hospital_id,patient_id,report_id,actor_id,request_id,input_fingerprint,observations,review_note) values(:h,:p,:report,:actor,:request,:fingerprint,cast(:outputs as jsonb),:note)",p);
  sql.update("update clinical_reports set workflow_status='CLINICAL_DATA_VERIFIED',extraction_metadata=jsonb_set(extraction_metadata,'{verificationStatus}','\"CLINICAL_DATA_VERIFIED\"'::jsonb),updated_at=now() where id=:report and hospital_id=:h and patient_id=:p",p);
  p.put("details",json.write(Map.of("reportId",report,"count",outputs.size(),"documentClassification",classification,"fingerprint",fingerprint)));
  sql.update("insert into audit_logs(hospital_id,actor_id,actor_role,module,action,entity_type,entity_id,after_state) values(:h,:actor,cast(:role as user_role),'ai_cdss','CLINICAL_PDF_VALUES_CONFIRMED','clinical_reports',:report,cast(:details as jsonb))",with(p,"role",actor.role()));
  return response(patient,report,classification,false,outputs);
 }
 private static Map<String,Object> response(UUID patient,UUID report,String classification,boolean duplicate,Object values){return Map.of("patientId",patient.toString(),"clinicalReportId",report.toString(),"documentClassification",classification,"workflowStatus","CLINICAL_DATA_VERIFIED","duplicate",duplicate,"observations",values);}
 private static Map<String,Object> with(Map<String,Object> source,String key,Object value){var result=new HashMap<>(source);result.put(key,value);return result;}
 @SuppressWarnings("unchecked") private static Map<String,Object> original(Map<String,Object> preview,String feature,Value reviewed){
  var groups=(Map<String,List<Map<String,Object>>>)preview.getOrDefault("measurementCandidates",Map.of());var candidates=groups.getOrDefault(feature,List.of());
  if(candidates.size()==1)return candidates.getFirst();
  return candidates.stream().filter(value->reviewed.extractedValue()!=null&&Double.compare(((Number)value.get("value")).doubleValue(),reviewed.extractedValue())==0&&Objects.equals(value.get("originalText"),reviewed.originalText())).findFirst().orElse(Map.of());
 }
}
