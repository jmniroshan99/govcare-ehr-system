package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class CardiovascularMonitoringTest {
    private ObjectNode mapped(Map<String,Object> inputs) {
        Instant now=Instant.now();var row=CkdAssessmentFeatureBridgeTest.savedAssessment(35.0,now.minusSeconds(86400));
        row.put("raw_inputs",inputs);
        var snapshot=ClinicalFeatureNormalizer.assessment(row,now);
        var overview=new SriLankanRenalIntelligenceService.Overview(CkdAssessmentFeatureBridgeTest.PATIENT,CkdAssessmentFeatureBridgeTest.HOSPITAL,
            new SriLankanRenalIntelligenceService.RenalStatus(null,"Unconfirmed","Operational test"),List.of(),List.of(),null,true,false);
        return ClinicalFeatureMappingEngine.apply(RenalClinicalModules.assemble(overview,RenalReadinessTest.registry(),now),
            new ClinicalPredictionFeatureService.FeatureData(overview.patientId(),overview.hospitalId(),List.of(snapshot),List.of(),false),now);
    }
    @Test void recordedFactorsNeverBecomeACardiovascularProbabilityOrADiabetesDiagnosis() {
        var output=mapped(Map.of("SystolicBP",132,"DiastolicBP",82,"SerumElectrolytesPotassium",5.1,"SerumCreatinine",2.0,"Age",57,"HbA1c",9.0));
        var cv=output.path("cardiovascularMonitoring");
        assertEquals("Not estimated",cv.path("riskLevel").asText());assertFalse(cv.path("modelAvailable").asBoolean());
        assertEquals(80,cv.path("dataReadiness").path("percent").asInt());assertEquals(4,cv.path("dataReadiness").path("availableCount").asInt());
        assertFalse(cv.has("probability"));assertFalse(cv.has("forecast"));assertEquals(6,output.path("moduleOrder").size());
        var diabetes=cv.path("requirements").get(4);assertEquals("diabetes_status",diabetes.path("key").asText());assertFalse(diabetes.path("satisfied").asBoolean());
        assertEquals("OPEN_CLINICAL_RECORD",cv.path("nextAction").path("type").asText());
    }
    @Test void missingInputsRemainUnknownAndZeroIsDataCoverageOnly() {
        var cv=mapped(Map.of()).path("cardiovascularMonitoring");
        assertEquals(0,cv.path("dataReadiness").path("percent").asInt());assertEquals("INSUFFICIENT_DATA",cv.path("status").asText());
        assertEquals("Not estimated",cv.path("riskLevel").asText());assertEquals(5,cv.path("dataReadiness").path("missingCount").asInt());
    }
    @Test void incompleteBloodPressureDoesNotCountAsACompleteFactorGroup() {
        var cv=mapped(Map.of("SystolicBP",132,"Age",57)).path("cardiovascularMonitoring");
        assertFalse(cv.path("requirements").get(0).path("satisfied").asBoolean());assertEquals(20,cv.path("dataReadiness").path("percent").asInt());
        assertTrue(cv.path("featuresUsed").toString().contains("Systolic Blood Pressure"));
    }
}
