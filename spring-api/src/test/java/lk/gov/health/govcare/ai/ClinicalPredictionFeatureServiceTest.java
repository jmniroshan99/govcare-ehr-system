package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import lk.gov.health.govcare.common.*;
import lk.gov.health.govcare.security.*;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ClinicalPredictionFeatureServiceTest {
    private final SqlSupport sql=mock(SqlSupport.class);private final ClinicalPatientAccess access=mock(ClinicalPatientAccess.class);
    private final ObjectMapper mapper=new ObjectMapper().findAndRegisterModules();private final UUID p=UUID.randomUUID(),h=UUID.randomUUID(),assessment=UUID.randomUUID();
    private final GovCarePrincipal actor=new GovCarePrincipal(UUID.randomUUID(),h,null,null,"features@govcare.test","Operational doctor","doctor",Set.of("CONSULTATION_UPDATE"),true,false,1);
    private ClinicalPredictionFeatureService service(){return new ClinicalPredictionFeatureService(sql,access,mapper);}
    @Test void captureAndLoadRequireAuthorizedPatientScopeBeforeAnyQuery(){
        when(access.clinicalScope(actor,p,true)).thenThrow(ApiException.forbidden("Denied"));when(access.clinicalScope(actor,p,false)).thenThrow(ApiException.forbidden("Denied"));
        assertThrows(ApiException.class,()->service().capture(actor,p,assessment));assertThrows(ApiException.class,()->service().load(actor,p));verifyNoInteractions(sql);
    }
    @Test void capturePersistsNormalizedActualInputsDatesAndAuditWithoutManufacturingDialysis(){
        when(access.clinicalScope(actor,p,true)).thenReturn(actor);Instant date=Instant.now().minusSeconds(86400);
        when(sql.required(contains("from ai_ckd_predictions"),anyMap(),anyString())).thenReturn(Map.of("source_assessment_id",assessment,"raw_inputs",Map.of("SerumCreatinine",176.8,"HemoglobinLevels",100.0),"recorded_at",java.sql.Timestamp.from(Instant.now())));
        var cr=Map.<String,Object>of("feature_key","SerumCreatinine","unit","µmol/L","source_type","MANUAL","source_metadata",Map.of(),"observed_at",java.sql.Timestamp.from(date),"observation_id",UUID.randomUUID());
        var hb=Map.<String,Object>of("feature_key","HemoglobinLevels","unit","g/L","source_type","MANUAL","source_metadata",Map.of());when(sql.list(contains("from ai_assessment_inputs"),anyMap())).thenReturn(List.of(cr,hb));
        List<Map<String,Object>> saved=new ArrayList<>();when(sql.update(contains("clinical_prediction_features("),anyMap())).thenAnswer(i->{saved.add(new HashMap<>(i.getArgument(1)));return 1;});
        var out=service().capture(actor,p,assessment);assertEquals(2,out.path("features").path("creatinine").path("value").asDouble(),1e-9);assertEquals(10,out.path("features").path("hemoglobin").path("value").asDouble(),1e-9);assertTrue(out.path("features").path("hemoglobin").path("observedAt").isNull());
        assertEquals(1,saved.size());assertEquals(h,saved.getFirst().get("h"));assertEquals(p,saved.getFirst().get("p"));assertEquals(assessment,saved.getFirst().get("a"));assertNull(saved.getFirst().get("potassium"));assertTrue(saved.getFirst().get("date") instanceof java.sql.Timestamp);
        verify(sql).update(contains("CKD_CLINICAL_FEATURES_NORMALIZED"),anyMap());verify(sql,never()).update(contains("sri_lankan_renal_observations"),anyMap());
    }
    @Test void invalidSourceAssociationIsRecordedButExcludedFromTheCanonicalValues(){
        when(access.clinicalScope(actor,p,true)).thenReturn(actor);when(sql.required(anyString(),anyMap(),anyString())).thenReturn(Map.of("source_assessment_id",assessment,"raw_inputs",Map.of("SerumCreatinine",2.0),"recorded_at",Instant.now()));
        when(sql.list(anyString(),anyMap())).thenReturn(List.of(Map.of("feature_key","SerumCreatinine","unit","mg/dL","source_type","PDF","source_metadata",Map.of(),"source_invalid","SOURCE_ASSOCIATION_INVALID")));
        var out=service().capture(actor,p,assessment);assertTrue(out.path("features").path("creatinine").path("value").isNull());assertEquals("INVALID",out.path("features").path("creatinine").path("state").asText());
    }
    @Test void assessmentSpecificReadUsesThePatientTenantAndTheRecordedCutoff(){
        when(access.clinicalScope(actor,p,false)).thenReturn(actor);var date=java.sql.Timestamp.from(Instant.now().minusSeconds(60));when(sql.required(anyString(),anyMap(),anyString())).thenReturn(Map.of("recorded_at",date));
        service().load(actor,p,assessment);verify(sql).required(contains("hospital_id=:h and patient_id=:p and source_assessment_id=:a"),argThat(x->h.equals(x.get("h"))&&p.equals(x.get("p"))&&assessment.equals(x.get("a"))),anyString());
        verify(sql).list(contains("from clinical_prediction_features"),argThat(x->date.equals(x.get("cutoff"))));verify(sql).list(contains("from clinical_observations"),argThat(x->date.equals(x.get("cutoff"))));
    }
    @Test void existingCkdPredictionSaveCallsTheFeatureBridgeWithTheSavedAssessmentId(){
        when(access.clinicalScope(actor,p,true)).thenReturn(actor);when(sql.uuid(p.toString(),"patientId")).thenReturn(p);
        when(sql.required(contains("from patients"),anyMap(),anyString())).thenReturn(Map.of("id",p,"patient_no","OPERATIONAL-QA","full_name","Operational only"));when(sql.required(contains("insert into ai_ckd_predictions"),anyMap(),anyString())).thenReturn(Map.of("id",assessment.toString()));
        var bridge=mock(ClinicalPredictionFeatureService.class);var prediction=new CkdPredictionService(sql,new JsonSupport(mapper),new CkdStageClassificationService(),access,bridge);
        var values=new LinkedHashMap<String,BigDecimal>();var row=CkdAssessmentFeatureBridgeTest.savedAssessment(35.0,null);var raw=(Map<String,Object>)row.get("raw_inputs");raw.forEach((k,v)->values.put(k,BigDecimal.valueOf(((Number)v).doubleValue())));
        for(var entry:Map.of("BMI",28.0,"FastingBloodSugar",140.0,"BUNLevels",30.0,"Edema",0.0,"FamilyHistoryKidneyDisease",0.0,"PreviousAcuteKidneyInjury",0.0,"NSAIDsUse",3.0).entrySet())values.put(entry.getKey(),BigDecimal.valueOf(entry.getValue()));
        var out=prediction.predict(actor,new CkdDtos.PredictionRequest(p.toString(),UUID.randomUUID().toString(),values,Map.of()));assertEquals(assessment.toString(),out.get("predictionId"));assertTrue(((Number)out.get("probability")).doubleValue()>0);verify(bridge).capture(actor,p,assessment);
        verify(sql,times(17)).update(contains("insert into ai_assessment_inputs"),anyMap());verify(sql,times(17)).update(contains("insert into clinical_observations"),anyMap());
    }
}
