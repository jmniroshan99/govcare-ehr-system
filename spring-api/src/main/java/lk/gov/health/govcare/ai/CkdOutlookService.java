package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.*;
import lk.gov.health.govcare.common.*;
import lk.gov.health.govcare.security.*;
import lk.gov.health.govcare.ai.predictive.KfreFourVariableEquation;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

/** All reads and writes are patient/tenant authorized; predictions and reviews are append-only. */
@Service
public class CkdOutlookService {
    private final SqlSupport sql; private final ClinicalPatientAccess access;
    private final RenalClinicalModuleService modules; private final ObjectMapper mapper;
    public CkdOutlookService(SqlSupport sql, ClinicalPatientAccess access, RenalClinicalModuleService modules, ObjectMapper mapper) {
        this.sql=sql;this.access=access;this.modules=modules;this.mapper=mapper.copy().setSerializationInclusion(com.fasterxml.jackson.annotation.JsonInclude.Include.ALWAYS).configure(com.fasterxml.jackson.databind.cfg.JsonNodeFeature.WRITE_NULL_PROPERTIES,true);
    }
    public record AssessmentRequest(UUID requestId,String evidenceFingerprint,String sexForEquation,
        boolean confirmedChronicCkd,boolean noKidneyReplacementTherapy,boolean clinicallyStable,String sourceNote) {}
    public record Milestone(int year,String title) {}
    public record ReviewRequest(UUID snapshotId,UUID requestId,int expectedVersion,String action,String reason,
        String note,String modifiedInterpretation,List<Milestone> milestones) {}
    public record ScenarioRequest(UUID snapshotId,double egfr,double acr,String acrUnit) {}
    private record Current(GovCarePrincipal scoped,Map<String,Object> params,Map<String,Object> patient,ObjectNode evidence) {}

    @Transactional
    public ObjectNode overview(GovCarePrincipal actor,UUID patient) {
        Current c=current(actor,patient,false);
        ObjectNode out=mapper.createObjectNode().put("patientId",patient.toString()).put("hospitalId",c.scoped().hospitalId().toString()).put("generatedAt",Instant.now().toString());
        out.set("patient",mapper.valueToTree(c.patient()));out.set("evidence",c.evidence());
        out.set("readiness",CkdOutlookEngine.assess(c.evidence(),null,Instant.now()));
        out.put("canWrite",actor.permissions().contains("*")||actor.permissions().contains("CONSULTATION_CREATE")||actor.permissions().contains("CONSULTATION_UPDATE"));
        var rows=sql.list("select id,outputs from ckd_outlook_snapshots where hospital_id=:h and patient_id=:p order by created_at desc,id desc limit 6",c.params());
        if(rows.isEmpty())out.putNull("assessment");else out.set("assessment",decorate(decode(rows.getFirst().get("outputs")),c.params()));
        var history=out.putArray("previousAssessments");
        for(var row:rows) {
            var value=decode(row.get("outputs"));var item=history.addObject();
            for(String key:List.of("id","assessedAt","status","twoYearRisk","fiveYearRisk","evidenceFingerprint"))item.set(key,value.path(key).deepCopy());
        }
        var prior=sql.one("select id from ai_ckd_predictions where hospital_id=:h and patient_id=:p order by created_at desc,id desc limit 1",c.params());
        if(prior.isPresent())out.put("reportAssessmentId",prior.get().get("id").toString());else out.putNull("reportAssessmentId");
        audit(c.params(),"CKD_OUTLOOK_VIEWED",null,Map.of("ruleVersion",CkdOutlookEngine.VERSION));
        return out;
    }

    @Transactional
    public ObjectNode calculate(GovCarePrincipal actor,UUID patient,AssessmentRequest r) {
        var scoped=access.clinicalScope(actor,patient,true);var p=params(scoped,patient);
        if(r==null||r.requestId()==null||r.evidenceFingerprint()==null||!r.evidenceFingerprint().matches("[a-f0-9]{64}")
            ||!Set.of("MALE","FEMALE").contains(Objects.toString(r.sexForEquation(),""))||!r.confirmedChronicCkd()||!r.noKidneyReplacementTherapy()||!r.clinicallyStable())
            throw ApiException.badRequest("Confirm the equation variable, chronic CKD, absence of all kidney replacement therapy, stable context, and the current evidence fingerprint.");
        String note=requiredText(r.sourceNote(),2000,"A verified clinical context/source note is required.");
        p.put("request",r.requestId());String content=hash(mapper.valueToTree(new AssessmentRequest(r.requestId(),r.evidenceFingerprint(),r.sexForEquation(),true,true,true,note)));
        lock("outlook-assessment|"+scoped.hospitalId()+"|"+patient+"|"+scoped.id()+"|"+r.requestId());
        var prior=sql.one("select outputs,request_fingerprint from ckd_outlook_snapshots where hospital_id=:h and patient_id=:p and requested_by=:actor and request_id=:request",p);
        if(prior.isPresent()) {if(!content.equals(prior.get().get("request_fingerprint")))throw ApiException.conflict("Request UUID already used for another assessment.");return decorate(decode(prior.get().get("outputs")),p);}
        Current c=current(actor,patient,true);
        if(!r.evidenceFingerprint().equals(c.evidence().path("fingerprint").asText()))throw ApiException.conflict("Clinical evidence changed. Refresh and review the current inputs before calculating.");
        ObjectNode output=CkdOutlookEngine.assess(c.evidence(),new CkdOutlookEngine.Confirmation(r.sexForEquation(),true,true,true,note),Instant.now());
        UUID id=UUID.randomUUID();output.put("id",id.toString()).put("patientId",patient.toString()).put("hospitalId",scoped.hospitalId().toString()).put("evidenceFingerprint",r.evidenceFingerprint());
        output.put("patientName",Objects.toString(c.patient().get("full_name"),"Patient")).put("patientNumber",Objects.toString(c.patient().get("patient_no"),""));
        p.put("id",id);p.put("fingerprint",content);p.put("evidence",r.evidenceFingerprint());p.put("outputs",output.toString());p.put("status",output.path("status").asText());
        sql.update("insert into ckd_outlook_snapshots(id,hospital_id,patient_id,requested_by,request_id,request_fingerprint,evidence_fingerprint,status,model_version,outputs) values(:id,:h,:p,:actor,:request,:fingerprint,:evidence,:status,:version,cast(:outputs as jsonb))",with(p,"version",KfreFourVariableEquation.VERSION));
        audit(p,"CKD_OUTLOOK_ASSESSED",id,Map.of("status",output.path("status").asText(),"modelVersion",KfreFourVariableEquation.VERSION,"evidenceFingerprint",r.evidenceFingerprint()));
        output.put("reviewState","AWAITING_REVIEW").put("reviewVersion",0);output.putNull("review");return output;
    }

    @Transactional
    public ObjectNode review(GovCarePrincipal actor,UUID patient,ReviewRequest r) {
        var scoped=access.clinicalScope(actor,patient,true);var p=params(scoped,patient);
        if(r==null||r.snapshotId()==null||r.requestId()==null||r.expectedVersion()<0||!Set.of("ACCEPT","MODIFY","DEFER","DISMISS").contains(Objects.toString(r.action(),"")))throw ApiException.badRequest("A snapshot, request UUID, expected review version and supported review action are required.");
        String reason=requiredText(r.reason(),2000,"A clinical review reason is required.");String note=optionalText(r.note(),4000);
        String modified="MODIFY".equals(r.action())?requiredText(r.modifiedInterpretation(),4000,"A revised interpretation is required for MODIFY."):null;
        List<Milestone> plans=r.milestones()==null?List.of():r.milestones();
        if(plans.size()>12||plans.stream().anyMatch(m->m==null||m.year()<0||m.year()>5||m.title()==null||m.title().isBlank()||m.title().length()>240))throw ApiException.badRequest("Use at most 12 clinician-defined milestones with a year from zero to five and a title up to 240 characters.");
        p.put("snapshot",r.snapshotId());p.put("request",r.requestId());
        // Find the parent within this patient and tenant before any review data is read.
        sql.required("select id from ckd_outlook_snapshots where id=:snapshot and hospital_id=:h and patient_id=:p",p,"Outlook assessment not found.");
        String fingerprint=hash(mapper.valueToTree(new ReviewRequest(r.snapshotId(),r.requestId(),r.expectedVersion(),r.action(),reason,note,modified,plans)));
        lock("outlook-review|"+scoped.hospitalId()+"|"+patient+"|"+r.snapshotId());
        var prior=sql.one("select id,input_fingerprint,review_version from ckd_outlook_reviews where hospital_id=:h and patient_id=:p and actor_id=:actor and request_id=:request",p);
        if(prior.isPresent()) {if(!fingerprint.equals(prior.get().get("input_fingerprint")))throw ApiException.conflict("Request UUID already used for different review content.");return mapper.createObjectNode().put("saved",true).put("id",prior.get().get("id").toString()).put("reviewVersion",((Number)prior.get().get("review_version")).intValue());}
        int version=sql.one("select review_version from ckd_outlook_reviews where hospital_id=:h and patient_id=:p and snapshot_id=:snapshot order by review_version desc limit 1",p).map(row->((Number)row.get("review_version")).intValue()).orElse(0);
        if(version!=r.expectedVersion())throw ApiException.conflict("Another clinician updated this review. Refresh before saving.");
        UUID id=UUID.randomUUID();p.put("id",id);p.put("action",r.action());p.put("reason",reason);p.put("note",note);p.put("modified",modified);p.put("plans",mapper.valueToTree(plans).toString());p.put("version",version+1);p.put("fingerprint",fingerprint);
        sql.update("insert into ckd_outlook_reviews(id,hospital_id,patient_id,snapshot_id,actor_id,request_id,action,reason,clinical_note,modified_interpretation,milestones,review_version,input_fingerprint) values(:id,:h,:p,:snapshot,:actor,:request,:action,:reason,:note,:modified,cast(:plans as jsonb),:version,:fingerprint)",p);
        audit(p,"CKD_OUTLOOK_REVIEWED",r.snapshotId(),Map.of("reviewId",id.toString(),"reviewVersion",version+1,"action",r.action()));
        return mapper.createObjectNode().put("saved",true).put("id",id.toString()).put("reviewVersion",version+1);
    }

    /** Ephemeral input-sensitivity calculation; no update/insert of scenario inputs or clinical measurements. */
    @Transactional(readOnly=true)
    public ObjectNode scenario(GovCarePrincipal actor,UUID patient,ScenarioRequest r) {
        var scoped=access.clinicalScope(actor,patient,false);var p=params(scoped,patient);
        if(r==null||r.snapshotId()==null)throw ApiException.badRequest("A recorded eligible assessment is required.");
        p.put("snapshot",r.snapshotId());var stored=decode(sql.required("select outputs from ckd_outlook_snapshots where id=:snapshot and hospital_id=:h and patient_id=:p",p,"Outlook assessment not found.").get("outputs"));
        if(!stored.path("status").asText().equals("AVAILABLE"))throw ApiException.badRequest("Scenario exploration requires an eligible recorded assessment.");
        var dialysis=sql.one("select context_status from renal_dialysis_context_events where hospital_id=:h and patient_id=:p order by verified_at desc,created_at desc,id desc limit 1",p);
        if(dialysis.map(row->"MAINTENANCE_HD".equals(row.get("context_status"))).orElse(false))throw ApiException.conflict("Current maintenance dialysis is verified. Kidney-failure initiation scenarios are not applicable.");
        // Do not call modules.overview here: that route persists module snapshots.
        // Scenarios remain anchored to immutable, explicitly dated recorded inputs.
        Instant asOf=CkdOutlookEngine.time(stored.path("assessedAt"));
        if(asOf==null||asOf.isBefore(Instant.now().minus(java.time.Duration.ofDays(90))))throw ApiException.conflict("The recorded assessment is older than 90 days. Create a current assessment before exploring assumptions.");
        var inputs=stored.path("evidence").path("inputs");
        try {
            var risk=KfreFourVariableEquation.calculate(inputs.path("age").path("value").asInt(),inputs.path("sex").path("value").asText(),r.egfr(),r.acr(),r.acrUnit());
            var result=mapper.createObjectNode().put("hypothetical",true).put("persisted",false).put("snapshotId",r.snapshotId().toString()).put("twoYearRisk",risk.twoYearRisk()).put("fiveYearRisk",risk.fiveYearRisk());
            result.put("label","Hypothetical input sensitivity; not an observed result, future trajectory or validated treatment-effect estimate");
            result.putObject("assumptions").put("egfr",r.egfr()).put("acrMgG",KfreFourVariableEquation.acrMgG(r.acr(),r.acrUnit()));
            result.put("recordedAsOf",asOf.toString());return result;
        }catch(IllegalArgumentException error){throw ApiException.badRequest(error.getMessage());}
    }

    /** Stored snapshot only: PDF export cannot call clinical assembly, an equation, or Django. */
    @Transactional(readOnly=true)
    public ObjectNode storedForReport(GovCarePrincipal actor,UUID patient) {
        var scoped=access.clinicalScope(actor,patient,false);var p=params(scoped,patient);
        return sql.one("select outputs from ckd_outlook_snapshots where hospital_id=:h and patient_id=:p order by created_at desc,id desc limit 1",p).map(row->decorate(decode(row.get("outputs")),p)).orElse(null);
    }
    public ObjectNode selectedForReport(GovCarePrincipal actor,UUID patient,UUID snapshot){
        if(snapshot==null)return storedForReport(actor,patient);
        var scoped=access.clinicalScope(actor,patient,false);var p=params(scoped,patient);p.put("id",snapshot);
        var row=sql.required("select outputs from ckd_outlook_snapshots where id=:id and hospital_id=:h and patient_id=:p",p,"The selected outlook does not belong to this patient.");
        return decorate(decode(row.get("outputs")),p);
    }

    private Current current(GovCarePrincipal actor,UUID patient,boolean write) {
        var scoped=access.clinicalScope(actor,patient,write);var p=params(scoped,patient);
        var identity=sql.required("select id,patient_no,full_name,date_of_birth,gender,hospital_id from patients where id=:p and hospital_id=:h and status<>'deleted'",p,"Patient not found.");
        ObjectNode source=modules.overview(actor,patient);
        if(!patient.toString().equals(source.path("patientId").asText())||!scoped.hospitalId().toString().equals(source.path("hospitalId").asText()))throw ApiException.conflict("The clinical source does not match the selected patient and hospital. Refresh the workspace.");
        boolean recent=!sql.list("select id from admissions where hospital_id=:h and patient_id=:p and status<>'deleted' and (admitted_at>=now()-interval '14 days' or (status='active' and discharged_at is null)) limit 1",p).isEmpty();
        return new Current(scoped,p,identity,CkdOutlookEngine.evidence(source,identity,recent,Instant.now()));
    }
    private ObjectNode decorate(ObjectNode out,Map<String,Object> base) {
        var p=with(base,"snapshot",UUID.fromString(out.path("id").asText()));
        var row=sql.one("select action,reason,clinical_note,modified_interpretation,milestones,review_version,created_at from ckd_outlook_reviews where hospital_id=:h and patient_id=:p and snapshot_id=:snapshot order by review_version desc limit 1",p);
        if(row.isEmpty()){out.put("reviewState","AWAITING_REVIEW").put("reviewVersion",0);out.putNull("review");}
        else {var r=row.get();out.put("reviewState",r.get("action").toString()).put("reviewVersion",((Number)r.get("review_version")).intValue());var detail=out.putObject("review");for(String key:List.of("reason","clinical_note","modified_interpretation"))if(r.get(key)==null)detail.putNull(key);else detail.put(key,r.get(key).toString());detail.set("milestones",tree(r.get("milestones")));detail.put("reviewedAt",r.get("created_at").toString());}
        return out;
    }
    private Map<String,Object> params(GovCarePrincipal actor,UUID patient){return new HashMap<>(Map.of("h",actor.hospitalId(),"p",patient,"actor",actor.id()));}
    private Map<String,Object> with(Map<String,Object> p,String key,Object value){var copy=new HashMap<>(p);copy.put(key,value);return copy;}
    private JsonNode tree(Object value){try{
        if(value instanceof JsonNode n)return n.deepCopy();
        // SqlSupport normalizes native PostgreSQL JSONB to Map/List. Their Java
        // toString representation is not JSON and must never be parsed as JSON.
        if(value instanceof Map<?,?>||value instanceof List<?>)return mapper.valueToTree(value);
        return mapper.readTree(Objects.toString(value,"null"));
    }catch(Exception e){throw new IllegalStateException("Stored outlook evidence is unreadable.",e);}}
    private ObjectNode decode(Object value){JsonNode node=tree(value);if(!node.isObject())throw new IllegalStateException("Stored outlook evidence must be an object.");return (ObjectNode)node;}
    private String hash(JsonNode node){return ClinicalIntelligenceEngine.sha256(node.toString());}
    private void lock(String key){sql.required("select pg_advisory_xact_lock(hashtextextended(:lock,0)) as held",Map.of("lock",key),"Cannot serialize outlook operation.");}
    private void audit(Map<String,Object> base,String event,UUID id,Map<String,Object> metadata){var p=new HashMap<>(base);p.put("event",event);p.put("resource",id);p.put("metadata",mapper.valueToTree(metadata).toString());sql.update("insert into predictive_audit_events(hospital_id,patient_id,actor_id,event_type,resource_id,metadata) values(:h,:p,:actor,:event,:resource,cast(:metadata as jsonb))",p);}
    private String requiredText(String value,int max,String message){String text=value==null?"":value.trim();if(text.isEmpty()||text.length()>max)throw ApiException.badRequest(message);return text;}
    private String optionalText(String value,int max){if(value==null||value.isBlank())return null;if(value.trim().length()>max)throw ApiException.badRequest("Clinical text exceeds the supported length.");return value.trim();}
}
