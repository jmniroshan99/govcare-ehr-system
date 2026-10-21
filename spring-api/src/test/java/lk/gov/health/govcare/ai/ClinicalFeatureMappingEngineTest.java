package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class ClinicalFeatureMappingEngineTest {
    static final Instant NOW=Instant.parse("2026-10-12T08:00:00Z");
    static final ObjectMapper JSON=new ObjectMapper().findAndRegisterModules();
    static ObjectNode normalized(Map<String,Double> values,Instant at,Instant recorded){
        var metadata=JSON.createObjectNode();for(String key:values.keySet())if(at!=null)metadata.putObject(key).put("observedAt",at.toString());
        var row=new HashMap<String,Object>();row.put("id",UUID.randomUUID());row.put("source_assessment_id",row.get("id"));row.put("raw_inputs",values);row.put("feature_metadata",metadata);row.put("recorded_at",recorded);
        return ClinicalFeatureNormalizer.assessment(row,NOW);
    }
    static ObjectNode mapped(List<ObjectNode> snapshots){
        var data=new SriLankanRenalIntelligenceService.Overview(CkdAssessmentFeatureBridgeTest.PATIENT,CkdAssessmentFeatureBridgeTest.HOSPITAL,new SriLankanRenalIntelligenceService.RenalStatus(null,"Unconfirmed","Operational fixture"),List.of(),List.of(),null,true,false);
        return ClinicalFeatureMappingEngine.apply(RenalClinicalModules.assemble(data,List.of(),NOW),new ClinicalPredictionFeatureService.FeatureData(data.patientId(),data.hospitalId(),snapshots,List.of(),false),NOW);
    }
    @Test void potassiumBoundaryBandsAreInclusiveAndNoResearchProbabilityIsInvented(){
        double[] values={4.99,5,5.5,5.5001};String[] levels={"Not classified as low/high","Not classified as low/high","Mild","Mild"};for(int i=0;i<values.length;i++){
            var out=mapped(List.of(normalized(Map.of("SerumElectrolytesPotassium",values[i]),null,NOW)));
            assertEquals(levels[i],out.path("hyperkalemia").path("clinicalAssessment").path("riskLevel").asText());assertTrue(out.path("hyperkalemia").path("researchRiskScore").isNull());
            assertEquals(100,out.path("hyperkalemia").path("readiness").path("clinicalDataReadiness").path("percent").asInt());assertFalse(out.path("hyperkalemia").path("canRun").asBoolean());
        }
    }
    @Test void hemoglobinBoundaryBandsDoNotBecomeDiagnoses(){
        double[] values={9.99,10,12,12.001};String[] levels={"High","Monitor","Monitor","Normal"};for(int i=0;i<values.length;i++){
            var out=mapped(List.of(normalized(Map.of("HemoglobinLevels",values[i]),null,NOW)));var c=out.path("anemia").path("clinicalAssessment");
            assertTrue(c.path("riskLevel").isNull());assertEquals("POPULATION_CONTEXT_REQUIRED",c.path("clinicalSignal").path("code").asText());assertTrue(out.path("anemia").path("forecast").isNull());
        }
    }
    @Test void progressionUsesActualEgfrAcrAndOnlyAssignsLowWithBothLowSignalMeasurements(){
        var high=mapped(List.of(normalized(Map.of("GFR",35.0,"ACR",420.0),null,NOW)));
        assertTrue(high.path("renalTrajectory").path("clinicalAssessment").path("riskLevel").isNull());assertEquals("Very high",high.path("renalTrajectory").path("clinicalAssessment").path("prognosticClassification").path("category").asText());
        assertEquals(0,high.path("renalTrajectory").path("coverage").path("recordedCount").asInt());assertEquals(4,high.path("renalTrajectory").path("coverage").path("requiredCount").asInt());
        var low=mapped(List.of(normalized(Map.of("GFR",90.0,"ACR",20.0),null,NOW)));assertTrue(low.path("renalTrajectory").path("clinicalAssessment").path("riskLevel").isNull());
        var unknown=mapped(List.of(normalized(Map.of("GFR",90.0),null,NOW)));assertTrue(unknown.path("renalTrajectory").path("clinicalAssessment").path("riskLevel").isNull());assertEquals("INSUFFICIENT_DATA",unknown.path("renalTrajectory").path("status").asText());
    }
    @Test void kidneyFailureIndicatorBoundaryDoesNotManufactureG5D(){
        for(double g:List.of(14.99,15.0)){var out=mapped(List.of(normalized(Map.of("GFR",g),null,NOW)));assertEquals(g<15?"High":"Below high-signal threshold",out.path("kidneyFailureStatus").path("clinicalAssessment").path("riskLevel").asText());assertNotEquals("G5D",out.path("kidneyFailureStatus").path("renalStatus").asText());}
    }
    @Test void distinctDatedCreatinineUsesTheRequestedPercentageFormula(){
        var out=mapped(List.of(normalized(Map.of("SerumCreatinine",1.0),NOW.minusSeconds(86400*3),NOW.minusSeconds(86400*3)),normalized(Map.of("SerumCreatinine",1.5),NOW.minusSeconds(86400),NOW.minusSeconds(86400))));
        assertEquals(50,out.path("akiRisk").path("creatinineChangePercent").asDouble(),1e-9);assertTrue(out.path("akiRisk").path("acuteReviewSignal").asBoolean());
        assertEquals(100,out.path("renalDeterioration").path("readiness").path("clinicalDataReadiness").path("percent").asInt());
    }
    @Test void monthlyCreatinineRiseIsATrendWithoutAnAcuteAkiClaim(){
        var out=mapped(List.of(normalized(Map.of("SerumCreatinine",1.0),NOW.minusSeconds(86400*31),NOW.minusSeconds(86400*31)),normalized(Map.of("SerumCreatinine",1.5),NOW.minusSeconds(86400),NOW.minusSeconds(86400))));
        assertEquals(50,out.path("akiRisk").path("creatinineChangePercent").asDouble(),1e-9);assertFalse(out.path("akiRisk").path("acuteReviewSignal").asBoolean());
    }
    @Test void anEarlierBaselineInTheAcuteWindowIsNotHiddenByTheLatestPreviousValue(){
        var out=mapped(List.of(normalized(Map.of("SerumCreatinine",1.0),NOW.minusSeconds(48*3600),NOW.minusSeconds(48*3600)),normalized(Map.of("SerumCreatinine",1.4),NOW.minusSeconds(30*3600),NOW.minusSeconds(30*3600)),normalized(Map.of("SerumCreatinine",1.5),NOW.minusSeconds(24*3600),NOW.minusSeconds(24*3600))));
        assertTrue(out.path("akiRisk").path("acuteReviewSignal").asBoolean());assertEquals(100.0/14,out.path("akiRisk").path("creatinineChangePercent").asDouble(),1e-6);
    }
    @Test void undatedAssessmentAndDatedBaselineNeverCreateAnInventedCurrentTime(){
        var current=normalized(Map.of("SerumCreatinine",2.0),null,NOW.minusSeconds(120));
        var metadata=JSON.createObjectNode().put("unit","mg/dL").put("observedAt",NOW.minusSeconds(86400*30).toString());
        var baseline=ClinicalFeatureNormalizer.measurement(ClinicalFeatureNormalizer.definition("creatinine"),JSON.valueToTree(1.0),metadata,NOW.toString(),"MANUAL",UUID.randomUUID().toString(),null,NOW);
        var root=mapped(List.of());var data=new ClinicalPredictionFeatureService.FeatureData(CkdAssessmentFeatureBridgeTest.PATIENT,CkdAssessmentFeatureBridgeTest.HOSPITAL,List.of(current),List.of(baseline),false);
        var out=ClinicalFeatureMappingEngine.apply(root,data,NOW);assertTrue(out.path("akiRisk").path("creatinineChangePercent").isNull());assertEquals(2,out.path("clinicalFeatureData").path("current").path("creatinine").path("value").asDouble());assertTrue(out.path("clinicalFeatureData").path("current").path("creatinine").path("observedAt").isNull());
    }
    @Test void duplicateClinicalTimesDoNotProvideTwoPointsAndConflictsRequireSourceReview(){
        var first=normalized(Map.of("SerumCreatinine",1.0),NOW.minusSeconds(86400),NOW.minusSeconds(20));var same=normalized(Map.of("SerumCreatinine",1.0),NOW.minusSeconds(86400),NOW.minusSeconds(10));
        var duplicate=mapped(List.of(first,same));assertEquals(1,duplicate.path("clinicalFeatureData").path("history").path("creatinine").size());assertTrue(duplicate.path("akiRisk").path("creatinineChangePercent").isNull());
        var conflict=mapped(List.of(first,normalized(Map.of("SerumCreatinine",2.0),NOW.minusSeconds(86400),NOW)));assertEquals(0,conflict.path("clinicalFeatureData").path("history").path("creatinine").size());assertFalse(conflict.path("clinicalFeatureData").path("current").path("creatinine").path("available").asBoolean());assertFalse(conflict.path("clinicalFeatureData").path("excludedData").isEmpty());
    }
    @Test void hbDeclineRateUsesActualElapsedDaysAndKeepsForecastUnavailable(){
        var out=mapped(List.of(normalized(Map.of("HemoglobinLevels",12.0),NOW.minusSeconds(86400*11),NOW.minusSeconds(86400*11)),normalized(Map.of("HemoglobinLevels",10.0),NOW.minusSeconds(86400),NOW.minusSeconds(86400))));
        assertEquals(.2,out.path("anemia").path("clinicalAssessment").path("trend").path("declineRatePerDay").asDouble(),1e-9);assertTrue(out.path("anemia").path("forecast").isNull());
    }
    @Test void invalidZeroAndUnknownUnitsAreExcludedRatherThanMadeAvailable(){
        var out=mapped(List.of(normalized(Map.of("SerumCreatinine",0.0,"SerumElectrolytesPotassium",-1.0,"HemoglobinLevels",99.0),null,NOW)));
        for(String key:List.of("creatinine","potassium","hemoglobin"))assertFalse(out.path("clinicalFeatureData").path("current").path(key).path("available").asBoolean());
        var metadata=JSON.createObjectNode().put("unit","unknown");var f=ClinicalFeatureNormalizer.measurement(ClinicalFeatureNormalizer.definition("creatinine"),JSON.valueToTree(2.0),metadata,NOW.toString(),"MANUAL","a",null,NOW);assertTrue(f.path("value").isNull());
    }
    @Test void supportedUnitConversionsPreservePhysicalMeasurementsAndNoInputImputation(){
        String[] keys={"creatinine","hemoglobin","acr","potassium","hba1c","systolic"};String[] units={"µmol/L","g/L","mg/mmol","mEq/L","mmol/mol","mm[Hg]"};double[] values={176.8,100,10,5.5,53,120},expected={2,10,88.4,5.5,6.99844,120};
        for(int i=0;i<keys.length;i++)assertEquals(expected[i],ClinicalFeatureNormalizer.convert(keys[i],values[i],units[i]),1e-6);
        var out=mapped(List.of(normalized(Map.of("BUNLevels",30.0),null,NOW)));assertTrue(out.path("dialysisAdequacy").path("clinicalAssessment").path("currentValue").isNull());assertEquals(0,out.path("dialysisAdequacy").path("readiness").path("clinicalDataReadiness").path("availableCount").asInt());
    }
    @Test void futureDatesAreExcludedAndOldDatedValuesRemainExplicitlyHistorical(){
        var future=mapped(List.of(normalized(Map.of("SerumElectrolytesPotassium",5.8),NOW.plusSeconds(86400),NOW)));assertFalse(future.path("clinicalFeatureData").path("current").path("potassium").path("available").asBoolean());
        var old=mapped(List.of(normalized(Map.of("SerumElectrolytesPotassium",5.8),NOW.minusSeconds(86400*100),NOW)));assertEquals("STALE",old.path("clinicalFeatureData").path("current").path("potassium").path("state").asText());assertEquals("STALE",old.path("hyperkalemia").path("readiness").path("requirements").get(0).path("state").asText());
    }
    @Test void scopeMismatchFailsBeforeApplyingAnotherPatientsFeatures(){
        var root=mapped(List.of());assertThrows(IllegalArgumentException.class,()->ClinicalFeatureMappingEngine.apply(root,new ClinicalPredictionFeatureService.FeatureData(UUID.randomUUID(),CkdAssessmentFeatureBridgeTest.HOSPITAL,List.of(),List.of(),false),NOW));
    }
    @Test void truncatedHistorySuppressesAkiAndResearchForecastingWithoutDiscardingCurrentMonitoring(){
        var root=mapped(List.of());var snapshots=List.of(normalized(Map.of("SerumCreatinine",1.0,"SerumElectrolytesPotassium",5.8),NOW.minusSeconds(86400*3),NOW.minusSeconds(86400*3)),normalized(Map.of("SerumCreatinine",1.5,"SerumElectrolytesPotassium",5.9),NOW.minusSeconds(86400),NOW.minusSeconds(86400)));
        var out=ClinicalFeatureMappingEngine.apply(root,new ClinicalPredictionFeatureService.FeatureData(CkdAssessmentFeatureBridgeTest.PATIENT,CkdAssessmentFeatureBridgeTest.HOSPITAL,snapshots,List.of(),true),NOW);
        assertTrue(out.path("akiRisk").path("creatinineChangePercent").isNull());assertEquals("CALCULATED",out.path("hyperkalemia").path("clinicalAssessment").path("status").asText());assertFalse(out.path("hyperkalemia").path("canRun").asBoolean());
    }
    @Test void fractionalSecondClinicalDatesAreComparedAsInstantsRatherThanText(){
        Instant first=NOW.minusSeconds(60),second=first.plusMillis(500);var out=mapped(List.of(normalized(Map.of("SerumElectrolytesPotassium",5.0),first,NOW.minusSeconds(30)),normalized(Map.of("SerumElectrolytesPotassium",5.6),second,NOW.minusSeconds(20))));
        assertEquals(5.6,out.path("hyperkalemia").path("clinicalAssessment").path("currentValue").asDouble());assertTrue(out.path("hyperkalemia").path("clinicalAssessment").path("trend").path("ready").asBoolean());assertEquals(first.toString(),out.path("hyperkalemia").path("clinicalAssessment").path("trend").path("previousAt").asText());
    }
    @Test void acuteThresholdWindowsIncludeTheirBoundaryWithoutRoundingAnOutsideSampleIntoIt(){
        for(int hours:List.of(48,49,168,169)){double current=hours<100?1.4:1.5;var out=mapped(List.of(normalized(Map.of("SerumCreatinine",1.0),NOW.minusSeconds((hours+1)*3600L),NOW.minusSeconds((hours+1)*3600L)),normalized(Map.of("SerumCreatinine",current),NOW.minusSeconds(3600),NOW.minusSeconds(3600))));assertEquals(hours==48||hours==168,out.path("akiRisk").path("acuteReviewSignal").asBoolean());}
    }
    @Test void referenceRangeUsesItsActualSourceUnitAndNegativeIfccValuesCannotBecomePositiveMeasurements(){
        var m=JSON.createObjectNode().put("unit","mg/dL").put("referenceHigh",132.6).put("referenceHighUnit","µmol/L");var c=ClinicalFeatureNormalizer.measurement(ClinicalFeatureNormalizer.definition("creatinine"),JSON.valueToTree(2.0),m,NOW.toString(),"MANUAL","a",null,NOW);assertEquals(1.5,c.path("referenceHigh").asDouble(),1e-9);
        var bad=ClinicalFeatureNormalizer.measurement(ClinicalFeatureNormalizer.definition("hba1c"),JSON.valueToTree(-10),JSON.createObjectNode().put("unit","mmol/mol"),NOW.toString(),"MANUAL","a",null,NOW);assertFalse(bad.path("available").asBoolean());
    }
    @Test void unifiedExtremePotassiumSuppressesAllStoredResearchNumbersWhileMeasuredMonitoringRemainsAvailable(){
        var rows=List.of(normalized(Map.of("SerumElectrolytesPotassium",9.0),null,NOW));var out=mapped(rows);
        for(String key:List.of("hyperkalemia","anemia","dialysisAdequacy")){assertFalse(out.path(key).path("canRun").asBoolean());assertTrue(out.path(key).path("forecast").isNull());assertTrue(out.path(key).path("researchRiskScore").isNull());assertEquals("BLOCKED_BY_SAFETY_GATE",out.path(key).path("researchStatus").asText());}
        assertEquals(9,out.path("hyperkalemia").path("clinicalAssessment").path("currentValue").asDouble());
        assertFalse(ClinicalFeatureMappingEngine.forecastSafety(new ClinicalPredictionFeatureService.FeatureData(CkdAssessmentFeatureBridgeTest.PATIENT,CkdAssessmentFeatureBridgeTest.HOSPITAL,rows,List.of(),false),List.of(),NOW).isEmpty());
    }
}
