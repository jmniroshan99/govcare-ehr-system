package lk.gov.health.govcare.ai;

import ca.uhn.fhir.context.FhirContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lk.gov.health.govcare.common.*;
import lk.gov.health.govcare.security.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

/** Manual, dated clinical context. Never writes a fake lab value or relabels past observations. */
@Service
public class RenalDialysisContextService {
    private final SqlSupport sql;private final ClinicalPatientAccess access;private final ObjectMapper mapper;
    private static final FhirContext FHIR=FhirContext.forR4Cached();
    public RenalDialysisContextService(SqlSupport sql,ClinicalPatientAccess access,ObjectMapper mapper){this.sql=sql;this.access=access;this.mapper=mapper;}
    public record Request(UUID requestId,String status,Instant verifiedAt,String sourceNote,boolean sourceVerified) {}
    public record Context(UUID id,String status,Instant verifiedAt,String sourceNote) {}
    Context latest(GovCarePrincipal scoped,UUID patient){
        return sql.one("select id,context_status,verified_at,source_note from renal_dialysis_context_events where hospital_id=:h and patient_id=:p order by verified_at desc,created_at desc,id desc limit 1",Map.of("h",scoped.hospitalId(),"p",patient))
                .filter(row->row.get("context_status") instanceof String&&row.get("verified_at")!=null)
                .map(row->new Context(UUID.fromString(row.get("id").toString()),row.get("context_status").toString(),instant(row.get("verified_at")),row.get("source_note").toString())).orElse(null);
    }
    @Transactional
    public Map<String,Object> verify(GovCarePrincipal actor,UUID patient,Request r){
        GovCarePrincipal scoped=access.clinicalScope(actor,patient,true);
        if(r==null||r.requestId()==null||!Set.of("MAINTENANCE_HD","NOT_ON_MAINTENANCE_HD","UNCONFIRMED").contains(Objects.toString(r.status(),""))
                ||r.verifiedAt()==null||r.verifiedAt().isAfter(Instant.now())||!r.sourceVerified()||r.sourceNote()==null||r.sourceNote().isBlank()||r.sourceNote().trim().length()>2000)
            throw ApiException.badRequest("A supported clinical status, actual nonfuture verification date, verified source note and request UUID are required.");
        Map<String,Object> content=new TreeMap<>();content.put("status",r.status());content.put("verifiedAt",r.verifiedAt().toString());content.put("sourceNote",r.sourceNote().trim());
        String fingerprint=digest(mapper.valueToTree(content).toString());
        Map<String,Object> p=new HashMap<>();p.put("h",scoped.hospitalId());p.put("p",patient);p.put("actor",scoped.id());p.put("department",scoped.departmentId());p.put("request",r.requestId());
        sql.required("select pg_advisory_xact_lock(hashtextextended(:lock,0)) as held",Map.of("lock","renal-context|"+scoped.hospitalId()+"|"+patient+"|"+scoped.id()+"|"+r.requestId()),"Cannot serialize clinical verification.");
        var prior=sql.one("select id,input_fingerprint from renal_dialysis_context_events where hospital_id=:h and patient_id=:p and actor_id=:actor and request_id=:request",p);
        if(prior.isPresent()){if(!fingerprint.equals(prior.get().get("input_fingerprint")))throw ApiException.conflict("The request UUID was already used for different verification content.");return Map.of("id",prior.get().get("id"),"saved",true);}
        UUID id=UUID.randomUUID();p.put("id",id);p.put("status",r.status());p.put("verified",java.sql.Timestamp.from(r.verifiedAt()));p.put("note",r.sourceNote().trim());p.put("fingerprint",fingerprint);
        sql.update("insert into renal_dialysis_context_events(id,hospital_id,patient_id,actor_id,department_id,request_id,context_status,verified_at,source_note,source_verified,input_fingerprint) values(:id,:h,:p,:actor,:department,:request,:status,:verified,:note,true,:fingerprint)",p);
        ObjectNode body=mapper.createObjectNode().put("resourceType","ClinicalImpression").put("id",id.toString()).put("status","completed").put("date",r.verifiedAt().toString());
        body.putObject("subject").putObject("identifier").put("system","urn:govcare:patient").put("value",patient.toString());
        body.putObject("assessor").putObject("identifier").put("system","urn:govcare:user").put("value",scoped.id().toString());
        body.put("summary","Clinician-recorded dialysis context: "+r.status()+". Source: "+r.sourceNote().trim()+". This does not create a laboratory result or infer kidney failure from creatinine.");
        store(p,"ClinicalImpression",id.toString(),body);
        String provenance=UUID.randomUUID().toString();ObjectNode prov=mapper.createObjectNode().put("resourceType","Provenance").put("id",provenance).put("recorded",Instant.now().toString());
        prov.putArray("target").addObject().put("reference","ClinicalImpression/"+id);
        prov.putArray("agent").addObject().putObject("who").putObject("identifier").put("system","urn:govcare:user").put("value",scoped.id().toString());store(p,"Provenance",provenance,prov);
        p.put("metadata",mapper.valueToTree(Map.of("status",r.status(),"verifiedAt",r.verifiedAt().toString(),"source","MANUAL_CLINICIAN_VERIFICATION_NO_LAB_VALUES")).toString());
        sql.update("insert into predictive_audit_events(hospital_id,patient_id,actor_id,event_type,resource_id,metadata) values(:h,:p,:actor,'RENAL_DIALYSIS_CONTEXT_VERIFIED',:id,cast(:metadata as jsonb))",p);
        return Map.of("id",id,"saved",true);
    }
    private void store(Map<String,Object> p,String type,String id,ObjectNode body){FHIR.newJsonParser().parseResource(body.toString());Map<String,Object> args=new HashMap<>(p);args.put("type",type);args.put("rid",id);args.put("body",body.toString());sql.update("insert into fhir_resource(resource_type,resource_id,patient_id,hospital_id,json_data) values(:type,:rid,:p,:h,cast(:body as jsonb))",args);}
    private String digest(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
    private static Instant instant(Object value){if(value instanceof Instant i)return i;if(value instanceof java.sql.Timestamp t)return t.toInstant();if(value instanceof java.time.OffsetDateTime t)return t.toInstant();return Instant.parse(value.toString());}
}
