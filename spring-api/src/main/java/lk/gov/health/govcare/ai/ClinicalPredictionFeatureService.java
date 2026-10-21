package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.*;
import lk.gov.health.govcare.common.*;
import lk.gov.health.govcare.security.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

/** Unified, authorized feature seam. CKD input persistence and this projection share the assessment transaction. */
@Service
public class ClinicalPredictionFeatureService {
    private final SqlSupport sql;private final ClinicalPatientAccess access;private final ObjectMapper mapper;
    public ClinicalPredictionFeatureService(SqlSupport sql,ClinicalPatientAccess access,ObjectMapper mapper){this.sql=sql;this.access=access;this.mapper=mapper;}
    public record FeatureData(UUID patientId,UUID hospitalId,List<ObjectNode> snapshots,List<ObjectNode> observations,boolean truncated,ObjectNode clinicalContext){
 public FeatureData(UUID patientId,UUID hospitalId,List<ObjectNode> snapshots,List<ObjectNode> observations,boolean truncated){this(patientId,hospitalId,snapshots,observations,truncated,new ObjectMapper().createObjectNode());}
 }
    @Transactional public ObjectNode capture(GovCarePrincipal actor,UUID patient,UUID assessment){
        var scoped=access.clinicalScope(actor,patient,true);Map<String,Object> p=new HashMap<>(Map.of("h",scoped.hospitalId(),"p",patient,"a",assessment));
        var row=sql.required("select id as source_assessment_id,input_data as raw_inputs,created_at as recorded_at from ai_ckd_predictions where hospital_id=:h and patient_id=:p and id=:a",p,"Saved CKD assessment not found.");
        var metadata=mapper.createObjectNode();for(var input:sql.list(INPUTS,p)){
            var savedMetadata=ClinicalFeatureNormalizer.node(input.get("source_metadata"));var detail=savedMetadata.isObject()?(ObjectNode)savedMetadata.deepCopy():mapper.createObjectNode().put("excludedReason","SOURCE_METADATA_INVALID");
            Object date=input.get("observed_at");if(date!=null)detail.put("observedAt",Objects.toString(ClinicalFeatureNormalizer.instant(date),null));
            detail.put("unit",Objects.toString(input.get("unit"),""));detail.put("source",Objects.toString(input.get("source_type"),"MANUAL"));
            if(input.get("observation_id")!=null)detail.put("observationId",input.get("observation_id").toString());
            detail.put("sourceVerified",Boolean.TRUE.equals(input.get("source_verified")));
            if(input.get("source_invalid")!=null)detail.put("excludedReason",input.get("source_invalid").toString());
            detail.remove("referenceHigh");if(input.get("reference_range_high") instanceof Number n&&input.get("observation_unit") instanceof String unit&&!unit.isBlank())detail.put("referenceHigh",n.doubleValue()).put("referenceHighUnit",unit);
            metadata.set(Objects.toString(input.get("feature_key")),detail);
        }
        var source=new LinkedHashMap<>(row);source.put("id",assessment);source.put("feature_metadata",metadata);
        var normalized=ClinicalFeatureNormalizer.assessment(source,Instant.now());
        p.put("id",assessment);p.put("recorded",row.get("recorded_at"));var measurementDate=ClinicalFeatureNormalizer.instant(normalized.path("observationDate").asText(null));p.put("date",measurementDate==null?null:java.sql.Timestamp.from(measurementDate));
        p.put("raw",ClinicalFeatureNormalizer.node(row.get("raw_inputs")).toString());p.put("meta",metadata.toString());
        for(var d:ClinicalFeatureNormalizer.DEFINITIONS)p.put(d.key(),normalized.path("features").path(d.key()).path("value").isNumber()?normalized.path("features").path(d.key()).path("value").asDouble():null);
        sql.update("""
            insert into clinical_prediction_features(id,hospital_id,patient_id,source_assessment_id,observation_date,recorded_at,
              creatinine,egfr,acr,potassium,hemoglobin,hba1c,proteinuria,age,bmi,systolic,diastolic,glucose,bun,edema,family_history,previous_aki,nsaids_use,source,raw_inputs,feature_metadata,normalization_version)
            values(:id,:h,:p,:a,:date,:recorded,:creatinine,:egfr,:acr,:potassium,:hemoglobin,:hba1c,:proteinuria,:age,:bmi,:systolic,:diastolic,:glucose,:bun,:edema,:family_history,:previous_aki,:nsaids_use,
              'CKD_ASSESSMENT',cast(:raw as jsonb),cast(:meta as jsonb),'GOVCARE-CLINICAL-FEATURES-1.0') on conflict(source_assessment_id) do nothing
            """,p);
        // Use the established audit schema, including its required module and typed role.
        // Keep audit persistence in the assessment transaction; a genuine failure must roll back.
        sql.update("""
            insert into audit_logs(hospital_id,actor_id,actor_role,module,action,entity_type,entity_id,after_state)
            values(:h,:actor,cast(:role as user_role),'ai_cdss','CKD_CLINICAL_FEATURES_NORMALIZED',
              'clinical_prediction_features',:id,cast(:details as jsonb))
            """,Map.of("h",scoped.hospitalId(),"actor",scoped.id(),"role",scoped.role(),"id",assessment,
              "details",mapper.createObjectNode().put("assessmentId",assessment.toString()).put("normalizationVersion",ClinicalFeatureNormalizer.VERSION).toString()));
        return normalized;
    }
    public FeatureData load(GovCarePrincipal actor,UUID patient){return load(actor,patient,null);}
    public FeatureData load(GovCarePrincipal actor,UUID patient,UUID assessment){
        var scoped=access.clinicalScope(actor,patient,false);Map<String,Object> p=new HashMap<>(Map.of("h",scoped.hospitalId(),"p",patient));p.put("a",assessment);Instant cutoff=null;
        if(assessment!=null){var target=sql.required("select recorded_at from clinical_prediction_features where hospital_id=:h and patient_id=:p and source_assessment_id=:a",p,"CKD assessment feature projection not found.");cutoff=ClinicalFeatureNormalizer.instant(target.get("recorded_at"));}
        p.put("cutoff",cutoff==null?null:java.sql.Timestamp.from(cutoff));
        var stored=sql.list("select id,hospital_id,patient_id,source_assessment_id,raw_inputs,feature_metadata,source,recorded_at from clinical_prediction_features where hospital_id=:h and patient_id=:p and (cast(:cutoff as timestamptz) is null or recorded_at<=:cutoff) order by recorded_at desc,source_assessment_id desc limit 201",p);
        List<ObjectNode> snapshots=stored.stream().limit(200).map(row->ClinicalFeatureNormalizer.assessment(row,Instant.now())).toList();
        var rows=sql.list("""
            select o.id,o.feature_key,o.value_numeric,o.unit,o.created_at,
              exists(select 1 from predictive_observation_entries e where e.observation_id=o.id and e.hospital_id=:h and e.patient_id=:p) as source_verified,
              coalesce(o.effective_at,r.specimen_collected_at) as observed_at,o.source_type,o.reference_range_high
            from clinical_observations o left join clinical_reports r on r.id=o.report_id and r.hospital_id=:h and r.patient_id=:p and r.report_status='ACTIVE'
            where o.hospital_id=:h and o.patient_id=:p and o.status='FINAL' and (o.report_id is null or r.id is not null)
              and (cast(:cutoff as timestamptz) is null or o.created_at<=:cutoff)
            order by o.created_at desc,o.id limit 1001
            """,p);
        List<ObjectNode> observations=new ArrayList<>();for(var row:rows.stream().limit(1000).toList()){
            var d=ClinicalFeatureNormalizer.definition(Objects.toString(row.get("feature_key"),""));if(d==null)continue;
            var metadata=mapper.createObjectNode().put("unit",Objects.toString(row.get("unit"),""));ClinicalFeatureNormalizer.putDate(metadata,"observedAt",ClinicalFeatureNormalizer.instant(row.get("observed_at")));
            metadata.put("sourceVerified",Boolean.TRUE.equals(row.get("source_verified")));
            if(row.get("reference_range_high") instanceof Number n)metadata.put("referenceHigh",n.doubleValue());
            observations.add(ClinicalFeatureNormalizer.measurement(d,mapper.valueToTree(row.get("value_numeric")),metadata,Objects.toString(ClinicalFeatureNormalizer.instant(row.get("created_at")),null),Objects.toString(row.get("source_type"),"CLINICAL_OBSERVATION"),Objects.toString(row.get("id")),null,Instant.now()));
        }
        // Reuse laboratory persistence without substituting approval/entry time for collection time.
        var labs=sql.list("""
            select l.id,q.test_type as feature_key,l.numeric_result as value_numeric,l.unit,l.created_at,
              q.sample_collected_at as observed_at,'LABORATORY_RESULT' as source_type,
              (l.verified_by is not null and l.verified_at is not null) as source_verified
            from lab_results l join lab_requests q on q.id=l.lab_request_id and q.hospital_id=:h and q.patient_id=:p
            where l.hospital_id=:h and l.patient_id=:p and l.status not in ('deleted','cancelled') and q.status not in ('deleted','cancelled')
              and (cast(:cutoff as timestamptz) is null or l.created_at<=:cutoff and l.verified_at<=:cutoff)
              and l.numeric_result is not null
            union all
            select v.id,v.test_code,v.result_value,v.unit,b.created_at,b.collected_at,'CBC_REPORT',
              (b.verified_by is not null and b.verified_at is not null and b.status in ('VERIFIED','RELEASED'))
            from lab_blood_report_results v join lab_blood_reports b on b.id=v.blood_report_id
            where b.hospital_id=:h and b.patient_id=:p and b.status<>'CANCELLED' and v.result_value is not null
              and (cast(:cutoff as timestamptz) is null or b.created_at<=:cutoff and b.verified_at<=:cutoff)
            order by created_at desc limit 1001
            """,p);
        for(var row:labs.stream().limit(1000).toList()){
            String key=RenalTrendTimeline.metric(Objects.toString(row.get("feature_key"),""));
            var d=ClinicalFeatureNormalizer.definition(key);if(d==null)continue;
            var meta=mapper.createObjectNode().put("unit",Objects.toString(row.get("unit"),""))
              .put("sourceVerified",Boolean.TRUE.equals(row.get("source_verified")));
            ClinicalFeatureNormalizer.putDate(meta,"observedAt",ClinicalFeatureNormalizer.instant(row.get("observed_at")));
            observations.add(ClinicalFeatureNormalizer.measurement(d,mapper.valueToTree(row.get("value_numeric")),meta,
              Objects.toString(ClinicalFeatureNormalizer.instant(row.get("created_at")),null),Objects.toString(row.get("source_type")),Objects.toString(row.get("id")),null,Instant.now()));
        }
        var fhirRows=sql.list("""
            select f.resource_id,f.json_data,f.created_date,
              exists(select 1 from predictive_observation_entries e where e.observation_id::text=f.resource_id and e.hospital_id=:h and e.patient_id=:p) as source_verified
            from fhir_resource f where f.hospital_id=:h and f.patient_id=:p and f.resource_type='Observation'
              and (cast(:cutoff as timestamptz) is null or f.created_date<=:cutoff and f.updated_date<=:cutoff)
            order by f.updated_date desc limit 1001
            """,p);
        Set<String> patientReferences=new HashSet<>(Set.of("Patient/"+patient,"Patient/patient-"+patient));
        for(var linked:sql.list("select resource_id from fhir_resource where hospital_id=:h and patient_id=:p and resource_type='Patient'",p))patientReferences.add("Patient/"+linked.get("resource_id"));
        for(var row:fhirRows.stream().limit(1000).toList())
            observations.addAll(RenalTrendTimeline.fhirMeasurements(row,patientReferences,Instant.now()));
        var context=mapper.createObjectNode();context.set("diabetes",CkdClinicalEvidenceService.diabetesContext(sql,p,mapper));
        var demographic=sql.one("select date_of_birth,gender::text as sex from patients where id=:p and hospital_id=:h",p);
        if(demographic.isPresent()){
            var details=context.putObject("demographics").put("source","AUTHORIZED_PATIENT_RECORD").put("sourceId",patient.toString()).put("sex",Objects.toString(demographic.get().get("sex"),"UNKNOWN").toUpperCase(Locale.ROOT));
            Object birth=demographic.get().get("date_of_birth");
            if(birth!=null)try{var date=java.time.LocalDate.parse(birth.toString().substring(0,10));var asOf=(cutoff==null?Instant.now():cutoff).atOffset(java.time.ZoneOffset.UTC).toLocalDate();if(!date.isAfter(asOf))details.put("ageYears",java.time.Period.between(date,asOf).getYears());}catch(java.time.DateTimeException ignored){}
            details.put("pregnancyPathway","NOT_VERIFIED");
        }
        return new FeatureData(patient,scoped.hospitalId(),snapshots,List.copyOf(observations),stored.size()>200||rows.size()>1000||labs.size()>1000||fhirRows.size()>1000,context);
    }
    private static final String INPUTS="""
        select i.feature_key,i.unit,i.source_type,i.source_metadata,i.observation_id,o.reference_range_high,o.unit as observation_unit,
          exists(select 1 from predictive_observation_entries e where e.observation_id=o.id and e.hospital_id=:h and e.patient_id=:p) as source_verified,
          coalesce(o.effective_at,r.specimen_collected_at) as observed_at,
          case when (i.source_report_id is not null and r.id is null) or (i.observation_id is not null and o.id is null) then 'SOURCE_ASSOCIATION_INVALID' end as source_invalid
        from ai_assessment_inputs i join ai_assessments a on a.id=i.assessment_id and a.hospital_id=:h and a.patient_id=:p
        left join clinical_observations o on o.id=i.observation_id and o.hospital_id=:h and o.patient_id=:p and o.status='FINAL'
        left join clinical_reports r on r.id=coalesce(i.source_report_id,o.report_id) and r.hospital_id=:h and r.patient_id=:p and r.report_status='ACTIVE'
        where i.assessment_id=:a order by i.feature_key
        """;
}
