package lk.gov.health.govcare.ai;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lk.gov.health.govcare.common.*;
import lk.gov.health.govcare.security.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
/** Explicitly requested synthetic patients; no existing patient is populated or modified. */
@Service
public class CkdResearchDemoService {
 static final String SOURCE="SYNTHETIC SOFTWARE DEMONSTRATION — NOT A REAL PATIENT OR CLINICAL VALIDATION";
 private final SqlSupport sql;private final ObjectMapper mapper;private final CkdPredictionService ckd;private final SriLankanRenalIntelligenceService renal;private final RenalDialysisContextService dialysis;private final CkdClinicalEvidenceService evidence;
 public CkdResearchDemoService(SqlSupport sql,ObjectMapper mapper,CkdPredictionService ckd,SriLankanRenalIntelligenceService renal,RenalDialysisContextService dialysis,CkdClinicalEvidenceService evidence){this.sql=sql;this.mapper=mapper;this.ckd=ckd;this.renal=renal;this.dialysis=dialysis;this.evidence=evidence;}
 public record Request(UUID requestId,boolean acknowledgedSyntheticData){}
 @Transactional public ObjectNode create(GovCarePrincipal actor,Request r){
  if(actor==null||!actor.active()||actor.mustChangePassword()||!"super_admin".equals(actor.role())||actor.hospitalId()==null||!has(actor,"PATIENT_CREATE")||!has(actor,"PATIENT_VIEW_CLINICAL")||!has(actor,"CONSULTATION_CREATE"))throw ApiException.forbidden("An active Super Admin with patient creation and clinical write permissions is required.");
  if(r==null||r.requestId()==null||!r.acknowledgedSyntheticData())throw ApiException.badRequest("Acknowledge creation of two labeled synthetic demonstration patients.");
  var p=new HashMap<String,Object>(Map.of("h",actor.hospitalId(),"actor",actor.id(),"request",r.requestId()));
  sql.required("select pg_advisory_xact_lock(hashtextextended(:lock,0)) as held",Map.of("lock","ckd-demo|"+actor.hospitalId()+"|"+actor.id()+"|"+r.requestId()),"Cannot serialize synthetic demonstration creation.");
  var prior=sql.one("select outputs from ckd_research_demo_runs where hospital_id=:h and actor_id=:actor and request_id=:request",p);
  if(prior.isPresent())try{return (ObjectNode)mapper.readTree(prior.get().get("outputs").toString());}catch(Exception e){throw new IllegalStateException("Stored demonstration is unreadable.",e);}
  Instant now=Instant.now();LocalDate birth=now.atZone(ZoneOffset.UTC).toLocalDate().minusYears(65).minusMonths(3);
  var result=mapper.createObjectNode().put("synthetic",true).put("createdAt",now.toString()).put("label",SOURCE);var patients=result.putArray("patients");
  for(boolean hd:List.of(false,true)){
   UUID patient=UUID.randomUUID();String number="SYNTH-CKD-"+(hd?"HD-":"ND-")+patient.toString().substring(0,8),name=hd?"SYNTHETIC CKD — Maintenance HD Demonstration":"SYNTHETIC CKD — Non-dialysis Demonstration";
   var args=new HashMap<String,Object>(p);args.put("patient",patient);args.put("number",number);args.put("name",name);args.put("birth",java.sql.Date.valueOf(birth));
   sql.update("insert into patients(id,hospital_id,patient_no,full_name,date_of_birth,gender,risk_flags,created_by,updated_by) values(:patient,:h,:number,:name,:birth,'male','[\"SYNTHETIC_RESEARCH_DEMONSTRATION\",\"NOT_A_REAL_PATIENT\"]'::jsonb,:actor,:actor)",args);
   for(int day:List.of(366,276,186,96,1)){
    Instant at=now.minus(Duration.ofDays(day));var values=features(hd,(366.0-day)/365.0,birth,at);Map<String,Map<String,Object>> sources=new LinkedHashMap<>();
    values.keySet().forEach(key->sources.put(key,Map.of("source","MANUAL","clinicalDate",at.toString(),"observedAt",at.toString(),"sourceNote",SOURCE)));
    ckd.predict(actor,new CkdDtos.PredictionRequest(patient.toString(),"SYNTHETIC-"+r.requestId()+"-"+patient+"-"+day,values,sources));
   }
   Instant at=now.minus(Duration.ofDays(1));dialysis.verify(actor,patient,new RenalDialysisContextService.Request(UUID.randomUUID(),hd?"MAINTENANCE_HD":"NOT_ON_MAINTENANCE_HD",at,SOURCE+"; synthetic dialysis context",true));
   evidence.verifyDiabetes(actor,patient,new CkdClinicalEvidenceService.DiabetesRequest(UUID.randomUUID(),hd?"CONFIRMED_DIABETES":"NO_KNOWN_DIABETES",at,SOURCE+"; clinical context is not inferred from HbA1c",true));
   if(hd)for(int day:List.of(61,31,1)){
    double t=(61.0-day)/30.0;Map<String,Double> values=Map.ofEntries(Map.entry("hb",10.2+.3*t),Map.entry("albumin",38.0+.5*t),Map.entry("calcium",2.2),Map.entry("sodium",138.0),Map.entry("potassium_pre",4.7+.2*t),Map.entry("potassium_post",3.4),Map.entry("creatinine_pre",700.0+20*t),Map.entry("creatinine_post",300.0),Map.entry("urea_pre",20.0+.5*t),Map.entry("urea_post",7.0-.35*t),Map.entry("dry_weight",65.0));
    var units=new HashMap<String,String>();values.keySet().forEach(key->units.put(key,key.equals("hb")?"g/dL":key.equals("albumin")?"g/L":key.startsWith("creatinine")?"umol/L":key.equals("dry_weight")?"kg":"mmol/L"));
    renal.recordObservation(actor,patient,new SriLankanRenalIntelligenceService.ObservationRequest(UUID.randomUUID(),now.minus(Duration.ofDays(day)),true,values,units,SOURCE+"; paired synthetic HD session",true));
   }
   patients.add(mapper.valueToTree(ckd.patient(actor,patient)));
  }
  UUID id=UUID.randomUUID();p.put("id",id);p.put("outputs",result.toString());sql.update("insert into ckd_research_demo_runs(id,hospital_id,actor_id,request_id,outputs) values(:id,:h,:actor,:request,cast(:outputs as jsonb))",p);
  sql.update("insert into audit_logs(hospital_id,actor_id,actor_role,module,action,entity_type,entity_id,after_state) values(:h,:actor,'super_admin','ai_cdss','CKD_SYNTHETIC_DEMO_CREATED','ckd_research_demo_runs',:id,cast(:outputs as jsonb))",p);return result;
 }
 static Map<String,BigDecimal> features(boolean hd,double t,LocalDate birth,Instant at){
  Map<String,Double> raw=Map.ofEntries(Map.entry("Age",(double)Period.between(birth,at.atZone(ZoneOffset.UTC).toLocalDate()).getYears()),Map.entry("BMI",26.0),Map.entry("SystolicBP",hd?148.0:138.0),Map.entry("DiastolicBP",hd?86.0:82.0),Map.entry("FastingBloodSugar",hd?130.0:105.0),Map.entry("HbA1c",hd?7.2:6.1),Map.entry("SerumCreatinine",hd?8.0+.2*t:2.0+.8*t),Map.entry("BUNLevels",hd?45.0:40.0),Map.entry("GFR",hd?8.0:45.0-20*t),Map.entry("ProteinInUrine",1.0),Map.entry("ACR",hd?800.0:200.0+100*t),Map.entry("SerumElectrolytesPotassium",hd?4.7+.4*t:4.5+.3*t),Map.entry("HemoglobinLevels",hd?10.2+.6*t:12.2-.4*t),Map.entry("Edema",0.0),Map.entry("FamilyHistoryKidneyDisease",0.0),Map.entry("PreviousAcuteKidneyInjury",0.0),Map.entry("NSAIDsUse",0.0));
  var values=new LinkedHashMap<String,BigDecimal>();raw.forEach((key,value)->values.put(key,BigDecimal.valueOf(value)));return values;
 }
 private static boolean has(GovCarePrincipal actor,String permission){return actor.permissions().contains("*")||actor.permissions().contains(permission);}
}
