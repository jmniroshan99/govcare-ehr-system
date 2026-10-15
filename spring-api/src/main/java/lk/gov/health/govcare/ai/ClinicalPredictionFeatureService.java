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
              coalesce(o.effective_at,r.specimen_collected_at,r.resulted_at,r.report_date) as observed_at,o.source_type,o.reference_range_high
            from clinical_observations o left join clinical_reports r on r.id=o.report_id and r.hospital_id=:h and r.patient_id=:p and r.report_status='ACTIVE'
            where o.hospital_id=:h and o.patient_id=:p and o.status='FINAL' and (o.report_id is null or r.id is not null)
              and (cast(:cutoff as timestamptz) is null or o.created_at<=:cutoff)
              and not exists(select 1 from ai_assessment_inputs i join clinical_prediction_features f on f.source_assessment_id=i.assessment_id
                where i.observation_id=o.id and f.hospital_id=:h and f.patient_id=:p and (cast(:cutoff as timestamptz) is null or f.recorded_at<=:cutoff))
            order by o.created_at desc,o.id limit 1001
            """,p);
        List<ObjectNode> observations=new ArrayList<>();for(var row:rows.stream().limit(1000).toList()){
            var d=ClinicalFeatureNormalizer.definition(Objects.toString(row.get("feature_key"),""));if(d==null)continue;
            var metadata=mapper.createObjectNode().put("unit",Objects.toString(row.get("unit"),d.unit()));ClinicalFeatureNormalizer.putDate(metadata,"observedAt",ClinicalFeatureNormalizer.instant(row.get("observed_at")));
            if(row.get("reference_range_high") instanceof Number n)metadata.put("referenceHigh",n.doubleValue());
            observations.add(ClinicalFeatureNormalizer.measurement(d,mapper.valueToTree(row.get("value_numeric")),metadata,Objects.toString(ClinicalFeatureNormalizer.instant(row.get("created_at")),null),Objects.toString(row.get("source_type"),"CLINICAL_OBSERVATION"),Objects.toString(row.get("id")),null,Instant.now()));
        }
        var context=mapper.createObjectNode();context.set("diabetes",CkdClinicalEvidenceService.diabetesContext(sql,p,mapper));
        return new FeatureData(patient,scoped.hospitalId(),snapshots,List.copyOf(observations),stored.size()>200||rows.size()>1000,context);
    }
    private static final String INPUTS="""
        select i.feature_key,i.unit,i.source_type,i.source_metadata,i.observation_id,o.reference_range_high,o.unit as observation_unit,
          coalesce(o.effective_at,r.specimen_collected_at,r.resulted_at,r.report_date) as observed_at,
          case when (i.source_report_id is not null and r.id is null) or (i.observation_id is not null and o.id is null) then 'SOURCE_ASSOCIATION_INVALID' end as source_invalid
        from ai_assessment_inputs i join ai_assessments a on a.id=i.assessment_id and a.hospital_id=:h and a.patient_id=:p
        left join clinical_observations o on o.id=i.observation_id and o.hospital_id=:h and o.patient_id=:p and o.status='FINAL'
        left join clinical_reports r on r.id=coalesce(i.source_report_id,o.report_id) and r.hospital_id=:h and r.patient_id=:p and r.report_status='ACTIVE'
        where i.assessment_id=:a order by i.feature_key
        """;
}
