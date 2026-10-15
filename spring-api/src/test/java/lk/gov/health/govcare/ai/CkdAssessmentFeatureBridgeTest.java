package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.*;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Regression for saved CKD inputs reaching the existing renal module service. */
class CkdAssessmentFeatureBridgeTest {
    static final UUID PATIENT=UUID.fromString("00000000-0000-4000-8000-000000000001"),HOSPITAL=UUID.fromString("00000000-0000-4000-8000-000000000002");
    static Map<String,Object> savedAssessment(Double egfr,Instant date) {
        var input=new LinkedHashMap<String,Object>();
        input.putAll(Map.of("SerumCreatinine",2.0,"GFR",egfr,"ACR",420.0,"ProteinInUrine",2.0,"SerumElectrolytesPotassium",5.8,"HemoglobinLevels",9.8,"HbA1c",7.1,"Age",56.0,"SystolicBP",148.0,"DiastolicBP",92.0));
        var metadata=new LinkedHashMap<String,Object>();for(String key:input.keySet()){var detail=new LinkedHashMap<String,Object>();detail.put("source","MANUAL");detail.put("observedAt",date==null?null:date.toString());metadata.put(key,detail);}
        var row=new LinkedHashMap<String,Object>();var id=UUID.randomUUID();row.put("id",id);row.put("source_assessment_id",id);row.put("hospital_id",HOSPITAL);row.put("patient_id",PATIENT);row.put("raw_inputs",input);row.put("feature_metadata",metadata);row.put("source","CKD_ASSESSMENT");row.put("recorded_at",Instant.now().minusSeconds(60));return row;
    }
    private com.fasterxml.jackson.databind.node.ObjectNode overview(Map<String,Object> row) {
        var sql=mock(SqlSupport.class);var access=mock(ClinicalPatientAccess.class);var renal=mock(SriLankanRenalIntelligenceService.class);
        var actor=new GovCarePrincipal(UUID.randomUUID(),HOSPITAL,null,null,"bridge@govcare.test","Operational clinician","doctor",Set.of("CONSULTATION_UPDATE"),true,false,1);
        when(access.clinicalScope(actor,PATIENT,false)).thenReturn(actor);
        when(sql.list(contains("clinical_prediction_features"),anyMap())).thenReturn(List.of(row));
        when(renal.overview(actor,PATIENT)).thenReturn(new SriLankanRenalIntelligenceService.Overview(PATIENT,HOSPITAL,new SriLankanRenalIntelligenceService.RenalStatus(null,"Unconfirmed","No dated renal context"),List.of(),List.of(),null,true,false));
        when(renal.ensurePatientReference(actor,PATIENT)).thenReturn("Patient/patient-"+PATIENT);
        return new RenalClinicalModuleService(sql,access,renal,new ObjectMapper().findAndRegisterModules()).overview(actor,PATIENT);
    }
    @Test void aSavedCkdSnapshotCalculatesMonitoringWithoutDialysisOrFakeForecasts() {
        var out=overview(savedAssessment(35.0,null));
        assertEquals("CALCULATED",out.path("renalTrajectory").path("clinicalAssessment").path("status").asText());
        assertEquals("High",out.path("renalTrajectory").path("clinicalAssessment").path("riskLevel").asText());
        assertEquals("High potassium monitoring signal",out.path("hyperkalemia").path("clinicalAssessment").path("resultTitle").asText());
        assertEquals("Anemia monitoring signal",out.path("anemia").path("clinicalAssessment").path("resultTitle").asText());
        assertEquals("Baseline creatinine required for AKI trend calculation",out.path("akiRisk").path("message").asText());
        assertEquals("Requires hemodialysis session data",out.path("dialysisAdequacy").path("clinicalAssessment").path("message").asText());
        assertTrue(out.path("hyperkalemia").path("forecast").isNull());assertTrue(out.path("anemia").path("forecast").isNull());
    }
    @Test void lowEgfrProvidesAnIndicatorWithoutInventingG5DVerification() {
        var out=overview(savedAssessment(10.0,Instant.now().minusSeconds(86400)));
        assertEquals("High",out.path("kidneyFailureStatus").path("clinicalAssessment").path("riskLevel").asText());
        assertEquals("Dialysis verification required",out.path("kidneyFailureStatus").path("clinicalAssessment").path("dialysisMessage").asText());
        assertNotEquals("G5D",out.path("kidneyFailureStatus").path("renalStatus").asText());
    }
}
