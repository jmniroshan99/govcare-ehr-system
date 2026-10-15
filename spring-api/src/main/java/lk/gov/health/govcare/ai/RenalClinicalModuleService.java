package lk.gov.health.govcare.ai;

import ca.uhn.fhir.context.FhirContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.ClinicalPatientAccess;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

/** Tenant-scoped immutable six-module snapshots and append-only clinician review. */
@Service
public class RenalClinicalModuleService {
    private final SqlSupport sql; private final ClinicalPatientAccess access;
    private final SriLankanRenalIntelligenceService renal; private final ObjectMapper mapper;
    private final RenalModelMetadata metadata;private final ClinicalPredictionFeatureService clinicalFeatures;
    private static final FhirContext FHIR=FhirContext.forR4Cached();
    public RenalClinicalModuleService(SqlSupport sql,ClinicalPatientAccess access,SriLankanRenalIntelligenceService renal,ObjectMapper mapper) {
        this(sql,access,renal,mapper,new RenalModelMetadata(""));
    }
    public RenalClinicalModuleService(SqlSupport sql,ClinicalPatientAccess access,SriLankanRenalIntelligenceService renal,ObjectMapper mapper,RenalModelMetadata metadata) {
        this(sql,access,renal,mapper,metadata,new ClinicalPredictionFeatureService(sql,access,mapper));
    }
    @Autowired
    public RenalClinicalModuleService(SqlSupport sql,ClinicalPatientAccess access,SriLankanRenalIntelligenceService renal,ObjectMapper mapper,RenalModelMetadata metadata,ClinicalPredictionFeatureService clinicalFeatures) {
        this.clinicalFeatures=clinicalFeatures;
        this.metadata=metadata;
        this.sql=sql;this.access=access;this.renal=renal;this.mapper=mapper.copy().setSerializationInclusion(com.fasterxml.jackson.annotation.JsonInclude.Include.ALWAYS)
                .configure(com.fasterxml.jackson.databind.cfg.JsonNodeFeature.WRITE_NULL_PROPERTIES,true);
    }
    public record ReviewRequest(UUID snapshotId,UUID requestId,String moduleKey,int expectedVersion,String action,String reason,String note,String modifiedInterpretation) {}

    @Transactional
    public ObjectNode overview(GovCarePrincipal actor,UUID patient) {
        GovCarePrincipal scoped=access.clinicalScope(actor,patient,false);
        var history=renal.overview(actor,patient);
        var registry=sql.list("select model_key,version,display_name,model_type,runtime_status,validation_status,local_validation_status,validation_metadata from predictive_model_registry where model_key in ('hb','urr','hyperkalemia') and version='1.0.0' order by model_key",Map.of());
        ObjectNode output=ClinicalFeatureMappingEngine.apply(RenalClinicalModules.assemble(history,metadata.enrich(registry),Instant.now()),clinicalFeatures.load(actor,patient),Instant.now());
        ObjectNode identity=output.deepCopy();identity.remove(List.of("generatedAt","canReview"));
        // Quality freshness changes by UTC date. Reviews do not change immutable clinical evidence identity.
        for(String key:RenalClinicalModules.ORDER){ObjectNode module=(ObjectNode)identity.get(key);module.remove("lastUpdated");((ObjectNode)module.get("readiness")).remove("lastEvaluated");if(module.path("researchReadiness") instanceof ObjectNode research)research.remove("lastEvaluated");}
        for(JsonNode prediction:identity.path("predictions")) if(prediction instanceof ObjectNode object) object.remove(List.of("review_state","review_version","reason","note","modified_interpretation","reviewed_by","reviewed_at"));
        String fingerprint=digest(identity.toString());Map<String,Object> p=params(scoped,patient);p.put("fingerprint",fingerprint);
        sql.required("select pg_advisory_xact_lock(hashtextextended(:lock,0)) as held",Map.of("lock","renal-modules|"+scoped.hospitalId()+"|"+patient),"Cannot serialize the renal snapshot.");
        Optional<Map<String,Object>> existing=sql.one("select id,outputs from renal_clinical_module_snapshots where hospital_id=:h and patient_id=:p and source_fingerprint=:fingerprint",p);
        if(existing.isPresent()) {output=decode(existing.get().get("outputs"));p.put("id",existing.get().get("id"));}
        else {
            UUID id=UUID.randomUUID();p.put("id",id);output.put("snapshotId",id.toString());p.put("outputs",output.toString());p.put("version",RenalClinicalModules.VERSION);
            sql.update("insert into renal_clinical_module_snapshots(id,hospital_id,patient_id,requested_by,source_fingerprint,rule_version,outputs) values(:id,:h,:p,:actor,:fingerprint,:version,cast(:outputs as jsonb))",p);
            persistFhir(scoped,patient,id,output,null,null,null);
            audit(p,"RENAL_SIX_MODULE_SNAPSHOT_CREATED",Map.of("ruleVersion",RenalClinicalModules.VERSION,"sourceFingerprint",fingerprint,"moduleOrder",RenalClinicalModules.ORDER));
        }
        output.put("canReview",history.canReview());decorateReviews(output,p);
        audit(p,"RENAL_SIX_MODULE_SNAPSHOT_VIEWED",Map.of("snapshotId",output.path("snapshotId").asText()));
        return output;
    }
    /** Latest persisted authorized snapshot only. Export cannot contact Django or run a model. */
    @Transactional
    public ObjectNode reportSnapshot(GovCarePrincipal actor,UUID patient) {
        GovCarePrincipal scoped=access.clinicalScope(actor,patient,false);Map<String,Object> p=params(scoped,patient);
        var stored=sql.one("select id,outputs from renal_clinical_module_snapshots where hospital_id=:h and patient_id=:p order by created_at desc,id desc limit 1",p);
        if(stored.isEmpty())return null;
        p.put("id",stored.get().get("id"));ObjectNode out=decode(stored.get().get("outputs"));decorateReviews(out,p);
        audit(p,"RENAL_SIX_MODULE_REPORT_READ",Map.of("snapshotId",p.get("id").toString(),"source","PERSISTED_SNAPSHOT_NO_INFERENCE"));return out;
    }
    /** Assessment-specific values and earlier history. Export never starts inference or guesses laboratory dates. */
    @Transactional
    public ObjectNode assessmentReportSnapshot(GovCarePrincipal actor,UUID patient,UUID assessment) {
        var scoped=access.clinicalScope(actor,patient,false);var p=params(scoped,patient);p.put("assessment",assessment.toString());
        var matching=sql.one("select id,outputs from renal_clinical_module_snapshots where hospital_id=:h and patient_id=:p and outputs #>> '{clinicalFeatureData,latestAssessmentId}'=:assessment order by created_at desc,id desc limit 1",p);
        if(matching.isPresent()){
            p.put("id",matching.get().get("id"));var frozen=decode(matching.get().get("outputs"));decorateReviews(frozen,p);frozen.put("reportAssessmentId",assessment.toString());
            audit(p,"RENAL_SIX_MODULE_REPORT_READ",Map.of("snapshotId",p.get("id").toString(),"assessmentId",assessment.toString(),"source","MATCHING_ASSESSMENT_SNAPSHOT_NO_INFERENCE"));return frozen;
        }
        var registry=sql.list("select model_key,version,display_name,model_type,runtime_status,validation_status,local_validation_status,validation_metadata from predictive_model_registry where model_key in ('hb','urr','hyperkalemia') and version='1.0.0' order by model_key",Map.of());
        var stored=RenalClinicalModules.assemble(renal.reportOverview(actor,patient),metadata.enrich(registry),Instant.now());
        var output=ClinicalFeatureMappingEngine.apply(stored,clinicalFeatures.load(actor,patient,assessment),Instant.now());
        for(String key:RenalClinicalModules.ORDER){var module=(ObjectNode)output.get(key);module.put("moduleReviewState","AWAITING_REVIEW").put("moduleReviewVersion",0).putNull("clinicianReview");}
        output.put("reportAssessmentId",assessment.toString()).put("reportFeaturePolicy","Requested CKD assessment and clinical records available by its recording time; dialysis session / stored research outputs retain their separately displayed source dates.");
        audit(p,"CKD_FEATURE_REPORT_MAPPED",Map.of("assessmentId",assessment.toString(),"mappingVersion",ClinicalFeatureMappingEngine.VERSION,"source","SAVED_ASSESSMENT_NO_INFERENCE"));
        return output;
    }
    @Transactional
    public Map<String,Object> review(GovCarePrincipal actor,UUID patient,ReviewRequest r) {
        GovCarePrincipal scoped=access.clinicalScope(actor,patient,true);
        if(r==null||r.snapshotId()==null||r.requestId()==null||r.moduleKey()==null||!RenalClinicalModules.ORDER.contains(r.moduleKey())||r.expectedVersion()<0
                ||!Set.of("ACCEPT","MODIFY","DEFER","DISMISS").contains(Objects.toString(r.action(),"")))throw ApiException.badRequest("A stored snapshot, module, request UUID, expected version and supported review action are required.");
        String reason=required(r.reason(),2000),note=optional(r.note(),4000),modified=optional(r.modifiedInterpretation(),4000);
        if("MODIFY".equals(r.action())?modified==null:modified!=null)throw ApiException.badRequest("A revised interpretation is required only for MODIFY.");
        Map<String,Object> p=params(scoped,patient);p.put("id",r.snapshotId());p.put("request",r.requestId());p.put("module",r.moduleKey());
        Map<String,Object> content=new TreeMap<>();content.put("snapshot",r.snapshotId());content.put("module",r.moduleKey());content.put("version",r.expectedVersion());content.put("action",r.action());content.put("reason",reason);content.put("note",note);content.put("modified",modified);
        String fp=digest(mapper.valueToTree(content).toString());
        sql.required("select pg_advisory_xact_lock(hashtextextended(:lock,0)) as held",Map.of("lock","renal-module-review|"+scoped.hospitalId()+"|"+patient+"|"+scoped.id()+"|"+r.requestId()),"Cannot serialize the review request.");
        var stored=sql.required("select id,outputs from renal_clinical_module_snapshots where id=:id and hospital_id=:h and patient_id=:p for update",p,"Renal intelligence snapshot not found.");
        var prior=sql.one("select id,input_fingerprint,action,review_version from renal_clinical_module_reviews where hospital_id=:h and patient_id=:p and actor_id=:actor and request_id=:request",p);
        if(prior.isPresent()) {
            if(!fp.equals(prior.get().get("input_fingerprint")))throw ApiException.conflict("This request UUID was already used for different review content.");
            return Map.of("id",prior.get().get("id"),"reviewState",prior.get().get("action"),"reviewVersion",prior.get().get("review_version"),"saved",true);
        }
        int latest=sql.one("select coalesce(max(review_version),0) as version from renal_clinical_module_reviews where snapshot_id=:id and module_key=:module",p).map(x->((Number)x.get("version")).intValue()).orElse(0);
        if(latest!=r.expectedVersion())throw ApiException.conflict("A newer review exists. Refresh before reviewing.");
        ObjectNode outputs=decode(stored.get("outputs"));JsonNode module=outputs.path(r.moduleKey());
        if(Set.of("NOT_APPLICABLE","NOT_INSTALLED","BLOCKED_BY_SAFETY_GATE","ERROR").contains(module.path("status").asText()))throw ApiException.conflict("Review the source evidence before interpreting this unavailable module.");
        UUID review=UUID.randomUUID();p.put("review",review);p.put("action",r.action());p.put("reason",reason);p.put("note",note);p.put("modified",modified);
        p.put("version",latest+1);p.put("fingerprint",fp);p.put("department",scoped.departmentId());p.put("method",module.path("method").asText());
        p.put("modelVersion",module.path("modelVersion").asText(RenalClinicalModules.VERSION));p.put("moduleSnapshot",module.toString());
        sql.update("insert into renal_clinical_module_reviews(id,hospital_id,patient_id,snapshot_id,module_key,actor_id,department_id,request_id,action,reason,clinical_note,modified_interpretation,review_version,input_fingerprint,method,model_version,module_snapshot) values(:review,:h,:p,:id,:module,:actor,:department,:request,:action,:reason,:note,:modified,:version,:fingerprint,:method,:modelVersion,cast(:moduleSnapshot as jsonb))",p);
        persistFhir(scoped,patient,review,outputs,r.moduleKey(),r.action(),reason+(modified==null?"":". Revised interpretation: "+modified));
        p.put("id",review);
        audit(p,"RENAL_MODULE_CLINICIAN_REVIEWED",Map.of("snapshotId",r.snapshotId().toString(),"module",r.moduleKey(),"action",r.action(),"reviewVersion",latest+1,"modelVersion",p.get("modelVersion")));
        return Map.of("id",review,"reviewState",r.action(),"reviewVersion",latest+1,"saved",true);
    }
    private void decorateReviews(ObjectNode output,Map<String,Object> p) {
        var reviews=sql.list("select distinct on (module_key) module_key,action,review_version,actor_id,created_at,reason,clinical_note,modified_interpretation from renal_clinical_module_reviews where hospital_id=:h and patient_id=:p and snapshot_id=:id order by module_key,review_version desc",p);
        int pending=0;
        for(String key:RenalClinicalModules.ORDER) {
            ObjectNode module=(ObjectNode)output.get(key);var r=reviews.stream().filter(x->key.equals(x.get("module_key"))).findFirst().orElse(null);
            // Module review versions are independent of the retained legacy prediction-review versions.
            module.put("moduleReviewVersion",r==null?0:((Number)r.get("review_version")).intValue());
            module.put("moduleReviewState",r==null?"AWAITING_REVIEW":r.get("action").toString());
            if(r!=null)module.set("clinicianReview",mapper.valueToTree(r));else {module.putNull("clinicianReview");pending++;}
        }
        output.putObject("clinicianReviewStatus").put("pendingModules",pending).put("state",pending>0?"AWAITING_REVIEW":"REVIEWED");
    }
    private void persistFhir(GovCarePrincipal actor,UUID patient,UUID id,ObjectNode output,String module,String action,String reason) {
        Map<String,Object> p=params(actor,patient);String patientRef=renal.ensurePatientReference(actor,patient);
        ObjectNode body=mapper.createObjectNode();body.put("resourceType","ClinicalImpression");body.put("id",id.toString());body.put("status","completed");
        body.putObject("subject").put("reference",patientRef);body.put("date",Instant.now().toString());
        body.putObject("assessor").putObject("identifier").put("system","urn:govcare:user").put("value",actor.id().toString());
        body.put("summary",module==null?"Renal clinical trajectory: "+output.path("renalTrajectory").path("signal").asText()+"; directional composite: "+output.path("renalDeterioration").path("signal").asText()+". Clinical review signals; not validated diagnoses.":"Clinician review "+module+": "+action+". "+reason);
        if(module==null&&output.path("clinicalFeatureData").isObject())body.put("summary","CKD feature monitoring: "+output.path("renalTrajectory").path("clinicalAssessment").path("resultTitle").asText()+"; "+output.path("kidneyFailureStatus").path("clinicalAssessment").path("resultTitle").asText()+"; "+output.path("hyperkalemia").path("clinicalAssessment").path("resultTitle").asText()+"; "+output.path("anemia").path("clinicalAssessment").path("resultTitle").asText()+". Measurement-based clinical review signals; not confirmed diagnoses or validated forecasts.");
        var ext=body.putArray("extension");ext.addObject().put("url","urn:govcare:renal-module-version").put("valueString",RenalClinicalModules.VERSION);
        ext.addObject().put("url","urn:govcare:renal-module-snapshot").put("valueString",output.path("snapshotId").asText());
        ext.addObject().put("url","urn:govcare:clinical-validation").put("valueString","NOT_CLINICALLY_VALIDATED");
        if(module!=null){ext.addObject().put("url","urn:govcare:renal-model-version").put("valueString",output.path(module).path("modelVersion").asText(RenalClinicalModules.VERSION));ext.addObject().put("url","urn:govcare:renal-method").put("valueString",output.path(module).path("method").asText());}
        for(JsonNode o:output.path("observations"))body.withArray("supportingInfo").addObject().putObject("identifier").put("system","urn:govcare:renal-session").put("value",o.path("id").asText());
        for(JsonNode assessment:output.path("clinicalFeatureData").path("assessmentSources"))body.withArray("supportingInfo").addObject().putObject("identifier").put("system","urn:govcare:ckd-assessment").put("value",assessment.path("assessmentId").asText());
        if(module!=null)body.withArray("supportingInfo").addObject().put("reference","ClinicalImpression/"+output.path("snapshotId").asText());
        storeFhir(p,"ClinicalImpression",id.toString(),body);
        ObjectNode prov=mapper.createObjectNode();String provenance=UUID.randomUUID().toString();prov.put("resourceType","Provenance");prov.put("id",provenance);prov.put("recorded",Instant.now().toString());
        prov.putArray("target").addObject().put("reference","ClinicalImpression/"+id);
        prov.putArray("agent").addObject().putObject("who").putObject("identifier").put("system","urn:govcare:user").put("value",actor.id().toString());
        prov.putArray("entity").addObject().put("role","source").putObject("what").putObject("identifier").put("system","urn:govcare:renal-module-snapshot").put("value",output.path("snapshotId").asText());
        storeFhir(p,"Provenance",provenance,prov);
    }
    private void storeFhir(Map<String,Object> p,String type,String id,ObjectNode body){FHIR.newJsonParser().parseResource(body.toString());Map<String,Object> args=new HashMap<>(p);args.put("type",type);args.put("rid",id);args.put("body",body.toString());sql.update("insert into fhir_resource(resource_type,resource_id,patient_id,hospital_id,json_data) values(:type,:rid,:p,:h,cast(:body as jsonb))",args);}
    private void audit(Map<String,Object> p,String event,Map<String,Object> metadata){Map<String,Object> args=new HashMap<>(p);args.put("event",event);args.put("metadata",mapper.valueToTree(metadata).toString());sql.update("insert into predictive_audit_events(hospital_id,patient_id,actor_id,event_type,resource_id,metadata) values(:h,:p,:actor,:event,:id,cast(:metadata as jsonb))",args);}
    private ObjectNode decode(Object value){try{return (ObjectNode)(value instanceof String s?mapper.readTree(s):mapper.valueToTree(value));}catch(Exception failure){throw ApiException.conflict("Stored renal snapshot cannot be decoded safely.");}}
    private static Map<String,Object> params(GovCarePrincipal actor,UUID patient){Map<String,Object> p=new HashMap<>();p.put("h",actor.hospitalId());p.put("p",patient);p.put("actor",actor.id());return p;}
    private static String required(String text,int limit){String s=text==null?"":text.trim();if(s.isEmpty()||s.length()>limit)throw ApiException.badRequest("A review reason in 1–"+limit+" characters is required.");return s;}
    private static String optional(String text,int limit){if(text==null||text.isBlank())return null;String s=text.trim();if(s.length()>limit)throw ApiException.badRequest("Review text exceeds "+limit+" characters.");return s;}
    private static String digest(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
}
