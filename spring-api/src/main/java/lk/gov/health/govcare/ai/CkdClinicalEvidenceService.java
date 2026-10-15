package lk.gov.health.govcare.ai;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lk.gov.health.govcare.common.*;
import lk.gov.health.govcare.security.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
/** Source-confirmed evidence, retaining the existing observation, FHIR and authorization pipeline. */
@Service
public class CkdClinicalEvidenceService {
 private final SqlSupport sql;private final ClinicalPatientAccess access;private final PredictiveIntelligenceService observations;private final ObjectMapper mapper;
 public CkdClinicalEvidenceService(SqlSupport sql,ClinicalPatientAccess access,PredictiveIntelligenceService observations,ObjectMapper mapper){this.sql=sql;this.access=access;this.observations=observations;this.mapper=mapper;}
 public record TrendRequest(UUID requestId,String metric,String unit,Double baselineValue,Instant baselineAt,String baselineSource,Double currentValue,Instant currentAt,String currentSource,boolean sourceVerified){}
 public record DiabetesRequest(UUID requestId,String status,Instant verifiedAt,String sourceNote,boolean sourceVerified){}
 @Transactional public Map<String,Object> establishTrend(GovCarePrincipal actor,UUID patient,TrendRequest r){
  var scoped=access.clinicalScope(actor,patient,true);
  if(r==null||r.requestId()==null||!r.sourceVerified()||!Set.of("creatinine","egfr","acr","hemoglobin","potassium","systolic","diastolic").contains(Objects.toString(r.metric(),"")))throw ApiException.badRequest("Select a supported metric and confirm two source results.");
  date(r.baselineAt());date(r.currentAt());if(!r.baselineAt().isBefore(r.currentAt()))throw ApiException.badRequest("Baseline time must be before the later measurement.");
  String first=note(r.baselineSource()),last=note(r.currentSource());validate(r.metric(),r.baselineValue(),r.unit(),r.baselineAt());validate(r.metric(),r.currentValue(),r.unit(),r.currentAt());
  lock("trend|"+scoped.hospitalId()+"|"+patient+"|"+actor.id()+"|"+r.requestId());
  var a=observations.recordMeasurement(actor,patient,new PredictiveIntelligenceService.MeasurementRequest(child(r.requestId(),"baseline"),r.metric(),r.baselineValue(),r.unit(),r.baselineAt(),null,null,first,true));
  var b=observations.recordMeasurement(actor,patient,new PredictiveIntelligenceService.MeasurementRequest(child(r.requestId(),"later"),r.metric(),r.currentValue(),r.unit(),r.currentAt(),null,null,last,true));
  return Map.of("saved",true,"baselineId",a.get("id"),"currentId",b.get("id"));
 }
 @Transactional public Map<String,Object> verifyDiabetes(GovCarePrincipal actor,UUID patient,DiabetesRequest r){
  var scoped=access.clinicalScope(actor,patient,true);
  if(r==null||r.requestId()==null||!r.sourceVerified()||!Set.of("CONFIRMED_DIABETES","NO_KNOWN_DIABETES","UNCONFIRMED").contains(Objects.toString(r.status(),"")))throw ApiException.badRequest("Select a source-confirmed clinical context and request UUID.");
  date(r.verifiedAt());String source=note(r.sourceNote()),fingerprint=ClinicalIntelligenceEngine.sha256(r.status()+"|"+r.verifiedAt()+"|"+source);
  var p=new HashMap<String,Object>(Map.of("h",scoped.hospitalId(),"p",patient,"actor",actor.id(),"request",r.requestId()));lock("diabetes|"+scoped.hospitalId()+"|"+patient+"|"+actor.id()+"|"+r.requestId());
  var prior=sql.one("select id,input_fingerprint from ckd_diabetes_context_events where hospital_id=:h and patient_id=:p and actor_id=:actor and request_id=:request",p);
  if(prior.isPresent()){if(!fingerprint.equals(prior.get().get("input_fingerprint")))throw ApiException.conflict("Request UUID already used for different clinical context.");return Map.of("saved",true,"id",prior.get().get("id"));}
  UUID id=UUID.randomUUID();p.put("id",id);p.put("status",r.status());p.put("at",java.sql.Timestamp.from(r.verifiedAt()));p.put("note",source);p.put("fingerprint",fingerprint);
  sql.update("insert into ckd_diabetes_context_events(id,hospital_id,patient_id,actor_id,request_id,context_status,verified_at,source_note,input_fingerprint) values(:id,:h,:p,:actor,:request,:status,:at,:note,:fingerprint)",p);
  sql.update("insert into predictive_audit_events(hospital_id,patient_id,actor_id,event_type,resource_id,metadata) values(:h,:p,:actor,'CKD_DIABETES_CONTEXT_VERIFIED',:id,jsonb_build_object('contextStatus',cast(:status as text)))",p);
  return Map.of("saved",true,"id",id);
 }
 static ObjectNode diabetesContext(SqlSupport sql,Map<String,Object> scoped,ObjectMapper mapper){
  var out=mapper.createObjectNode().put("status","UNCONFIRMED");
  sql.one("select id,context_status,verified_at,source_note from ckd_diabetes_context_events where hospital_id=:h and patient_id=:p and (cast(:cutoff as timestamptz) is null or created_at<=:cutoff) order by verified_at desc,created_at desc,id desc limit 1",scoped).ifPresent(row->{out.put("status",row.get("context_status").toString()).put("sourceId",row.get("id").toString()).put("sourceNote",row.get("source_note").toString()).put("verifiedAt",ClinicalFeatureNormalizer.instant(row.get("verified_at")).toString());});return out;
 }
 private void validate(String key,Double value,String unit,Instant at){
  if(value==null||!Double.isFinite(value))throw ApiException.badRequest("Both source values must be finite numbers.");
  var meta=mapper.createObjectNode().put("unit",Objects.toString(unit,"")).put("observedAt",at.toString());
  var normalized=ClinicalFeatureNormalizer.measurement(ClinicalFeatureNormalizer.definition(key),mapper.valueToTree(value),meta,Instant.now().toString(),"CLINICIAN_ENTERED","verification",null,Instant.now());
  if(!normalized.path("available").asBoolean())throw ApiException.badRequest("Review the source value, supported unit and measurement date.");
 }
 private static void date(Instant at){if(at==null||at.isAfter(Instant.now())||at.isBefore(Instant.parse("1900-01-01T00:00:00Z")))throw ApiException.badRequest("Use an actual nonfuture source date, from 1900 onward.");}
 private static String note(String value){String text=value==null?"":value.trim();if(text.isEmpty()||text.length()>2000)throw ApiException.badRequest("Document the verified source in 1–2000 characters.");return text;}
 private void lock(String key){sql.required("select pg_advisory_xact_lock(hashtextextended(:lock,0)) as held",Map.of("lock",key),"Cannot serialize evidence recording.");}
 static UUID child(UUID root,String part){return UUID.nameUUIDFromBytes((root+"|"+part).getBytes(StandardCharsets.UTF_8));}
}
