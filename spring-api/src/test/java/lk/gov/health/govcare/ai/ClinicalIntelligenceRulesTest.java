package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class ClinicalIntelligenceRulesTest {
    static final UUID PATIENT=CkdAssessmentFeatureBridgeTest.PATIENT,HOSPITAL=CkdAssessmentFeatureBridgeTest.HOSPITAL;
    static final Instant NOW=Instant.parse("2026-10-20T08:00:00Z");
    static ObjectNode snapshot(double potassium,boolean dated){
        var values=Map.of("SerumElectrolytesPotassium",potassium,"HemoglobinLevels",13.8,"Age",39.0,"GFR",72.0,"ACR",55.0,"SerumCreatinine",1.4,"SystolicBP",146.0,"DiastolicBP",92.0);
        var metadata=ClinicalFeatureMappingEngineTest.JSON.createObjectNode();
        if(dated)for(String key:values.keySet())metadata.putObject(key).put("observedAt",NOW.minusSeconds(86400).toString());
        return ClinicalFeatureNormalizer.assessment(Map.of("id",UUID.randomUUID(),"raw_inputs",values,"feature_metadata",metadata,"recorded_at",NOW.minusSeconds(20)),NOW);
    }
    static ObjectNode mapped(List<ObjectNode> sources,ObjectNode context){
        var overview=new SriLankanRenalIntelligenceService.Overview(PATIENT,HOSPITAL,new SriLankanRenalIntelligenceService.RenalStatus(null,"Unconfirmed","Synthetic clinical-rules verification"),List.of(),List.of(),null,true,false);
        var output=ClinicalFeatureMappingEngine.apply(RenalClinicalModules.assemble(overview,RenalReadinessTest.registry(),NOW),new ClinicalPredictionFeatureService.FeatureData(PATIENT,HOSPITAL,sources,List.of(),false,context),NOW);
        output.put("snapshotId","SYNTHETIC-CLINICAL-RULES-V2");ClinicalIntelligenceRules.bindSnapshot(output,output.path("snapshotId").asText());return output;
    }
    static ObjectNode context(){var context=ClinicalFeatureMappingEngineTest.JSON.createObjectNode();context.putObject("demographics").put("sex","MALE").put("ageYears",39);return context;}
    @ParameterizedTest @CsvSource({"2.0,SEVERE_HYPOKALEMIA","2.499999,SEVERE_HYPOKALEMIA","2.5,MODERATE_HYPOKALEMIA","2.999999,MODERATE_HYPOKALEMIA","3.0,MILD_HYPOKALEMIA","3.499999,MILD_HYPOKALEMIA","3.5,NO_ADOPTED_POTASSIUM_BAND","5.499999,NO_ADOPTED_POTASSIUM_BAND","5.5,MILD_HYPERKALEMIA","5.999999,MILD_HYPERKALEMIA","6.0,MODERATE_HYPERKALEMIA","6.499999,MODERATE_HYPERKALEMIA","6.5,SEVERE_HYPERKALEMIA"})
    void potassiumBoundariesUseUnroundedValuesAndNeverCreateProbabilities(double value,String code){
        var c=mapped(List.of(snapshot(value,false)),context()).path("hyperkalemia").path("clinicalAssessment");
        assertEquals(code,c.path("clinicalSignal").path("code").asText());assertTrue(c.path("clinicalSignal").path("eventProbability").isNull());assertTrue(c.path("prediction").path("eventProbability").isNull());
    }
    @Test void screenshotPotassiumTwoRemainsProminentWhenItsDateAndPredictionAreUnavailable(){
        var out=mapped(List.of(snapshot(2,false)),context());var module=out.path("hyperkalemia");var c=module.path("clinicalAssessment");
        assertEquals(2,c.path("currentValue").asDouble());assertTrue(c.path("currentAt").isNull());
        assertEquals("PROMPT_VERIFICATION_AND_REVIEW",c.path("clinicalSignal").path("reviewPriority").asText());
        assertEquals("MEASUREMENT_DATE_UNVERIFIED",c.path("clinicalSignal").path("currentRelevance").asText());
        assertEquals(1,c.path("coverage").path("recordedCount").asInt());assertEquals(1,c.path("coverage").path("requiredCount").asInt());
        assertFalse(c.path("prediction").path("ready").asBoolean());assertFalse(module.path("canRun").asBoolean());
        assertEquals("hyperkalemia",out.path("patientReviewSummary").get(0).path("module").asText());
        assertFalse(c.path("message").asText().contains("low hyperkalemia risk"));
    }
    @ParameterizedTest @CsvSource({"MALE,12.999,true","MALE,13.0,false","FEMALE,11.999,true","FEMALE,12.0,false"})
    void adultHemoglobinReferenceIsSexSpecific(String sex,double hb,boolean below){
        var source=snapshot(4,false);((ObjectNode)source.path("features").path("hemoglobin")).put("value",hb);
        var context=context();((ObjectNode)context.path("demographics")).put("sex",sex);
        var c=mapped(List.of(source),context).path("anemia").path("clinicalAssessment");
        assertEquals(below,c.path("clinicalSignal").path("abnormal").asBoolean());assertTrue(c.path("prediction").path("eventProbability").isNull());
        assertEquals(5,c.path("supportingInvestigations").size());
    }
    @Test void missingSexAndPediatricContextWithholdAdultAnemiaClassification(){
        for(var context:List.of(ClinicalFeatureMappingEngineTest.JSON.createObjectNode(),context())){
            if(context.has("demographics"))((ObjectNode)context.path("demographics")).put("ageYears",17);
            var c=mapped(List.of(snapshot(4,false)),context).path("anemia").path("clinicalAssessment");
            assertEquals("POPULATION_CONTEXT_REQUIRED",c.path("clinicalSignal").path("code").asText());assertEquals(13.8,c.path("currentValue").asDouble());
        }
    }
    @Test void oneRenalObservationHasNoMeasuredProgressionCategoryAndCoverageMatchesItsChecklist(){
        var c=mapped(List.of(snapshot(4,false)),context()).path("renalTrajectory").path("clinicalAssessment");
        assertEquals("Trend not established",c.path("resultTitle").asText());assertTrue(c.path("riskLevel").isNull());assertFalse(c.path("trend").path("ready").asBoolean());
        assertEquals(4,c.path("coverage").path("requiredCount").asInt());assertEquals(4,c.path("coverage").path("requiredInputs").size());assertEquals(1,c.path("coverage").path("recordedCount").asInt());
    }
    @Test void datedHistoricalPairSurvivesANewerUndatedValueWithoutClaimingItIsCurrent(){
        var a=snapshot(4,true);var b=snapshot(4,true);var undated=snapshot(4,false);
        for(var entry:List.of(a,b)){var f=(ObjectNode)entry.path("features").path("creatinine");f.put("observedAt",entry==a?NOW.minusSeconds(31*86400).toString():NOW.minusSeconds(86400).toString()).put("value",entry==a?1:1.5);}
        var c=mapped(List.of(a,b,undated),context()).path("renalTrajectory").path("clinicalAssessment");
        assertTrue(c.path("trend").path("ready").asBoolean());assertTrue(c.path("trend").path("snapshotUndated").asBoolean());assertEquals(50,c.path("trend").path("percentChange").asDouble(),1e-8);assertEquals(30,c.path("trend").path("intervalDays").asDouble(),1e-8);
    }
    @Test void cardiovascularFourOfFiveIsCoverageAndUnpairedBloodPressuresNeverBecomeOneReading(){
        var c=mapped(List.of(snapshot(4,false)),context()).path("cardiovascularMonitoring");
        assertEquals(4,c.path("coverage").path("recordedCount").asInt());assertEquals(80,c.path("coverage").path("percent").asInt());
        assertTrue(c.path("prediction").path("eventProbability").isNull());assertFalse(c.path("bloodPressurePair").path("verified").asBoolean());assertTrue(c.path("bloodPressurePair").path("value").isNull());
        assertTrue(c.path("bloodPressurePair").path("systolic").has("sourceId"));assertTrue(c.path("bloodPressurePair").path("diastolic").has("sourceId"));
    }
    @Test void differentEncountersNeverBecomeAVerifiedBloodPressurePair(){
        var source=snapshot(4,true);
        ((ObjectNode)source.path("features").path("systolic")).put("encounterId","SYNTHETIC-A");
        ((ObjectNode)source.path("features").path("diastolic")).put("encounterId","SYNTHETIC-B");
        assertFalse(mapped(List.of(source),context()).path("cardiovascularMonitoring").path("bloodPressurePair").path("verified").asBoolean());
        ((ObjectNode)source.path("features").path("diastolic")).put("encounterId","SYNTHETIC-A");
        assertTrue(mapped(List.of(source),context()).path("cardiovascularMonitoring").path("bloodPressurePair").path("verified").asBoolean());
    }
    @Test void incompatibleDialysisSamplingContextsNeverEstablishACreatinineTrend(){
        var first=snapshot(4,true);var second=snapshot(4,true);
        first.put("recordedAt",NOW.minusSeconds(86400*3).toString());
        ((ObjectNode)first.path("features").path("creatinine")).put("observedAt",NOW.minusSeconds(86400*3).toString()).put("sampleContext","PRE_HD");
        ((ObjectNode)second.path("features").path("creatinine")).put("observedAt",NOW.minusSeconds(86400).toString()).put("sampleContext","POST_HD");
        var out=mapped(List.of(first,second),context());
        assertFalse(out.path("renalTrajectory").path("trend").path("ready").asBoolean());
        assertTrue(out.path("clinicalFeatureData").path("current").path("creatinine").path("available").asBoolean());
    }
    @Test void unreliablePotassiumSampleCannotGenerateAReassuringSeverity(){
        var metadata=ClinicalFeatureMappingEngineTest.JSON.createObjectNode().put("unit","mmol/L").put("sampleQuality","HEMOLYSED");
        var measurement=ClinicalFeatureNormalizer.measurement(ClinicalFeatureNormalizer.definition("potassium"),ClinicalFeatureMappingEngineTest.JSON.valueToTree(4.0),metadata,NOW.toString(),"MANUAL","SYNTHETIC-HEMOLYSED",null,NOW);
        assertFalse(measurement.path("available").asBoolean());assertTrue(measurement.path("value").isNull());assertEquals(4,measurement.path("originalValue").asDouble());
    }
    @Test void explicitForeignPatientEvidenceIsRejected(){var source=snapshot(4,false);source.put("patientId",UUID.randomUUID().toString());assertThrows(IllegalArgumentException.class,()->mapped(List.of(source),context()));}
    @Test void everyGfrAndAcrBoundaryPreservesTheProvisionalGridWithoutInventingATrend(){
        double[] gfr={14.99999,15,29.99999,30,44.99999,45,59.99999,60,89.99999,90};
        String[] groups={"G5","G4","G4","G3b","G3b","G3a","G3a","G2","G2","G1"};
        double[] acr={29.99999,30,300,300.00001};String[] albumin={"A1","A2","A2","A3"};
        String[][] expected={{"Very high","Very high","Very high","Very high"},{"Very high","Very high","Very high","Very high"},{"Very high","Very high","Very high","Very high"},{"High","Very high","Very high","Very high"},{"High","Very high","Very high","Very high"},{"Moderately increased","High","High","Very high"},{"Moderately increased","High","High","Very high"},{"Low","Moderately increased","Moderately increased","High"},{"Low","Moderately increased","Moderately increased","High"},{"Low","Moderately increased","Moderately increased","High"}};
        for(int g=0;g<gfr.length;g++)for(int a=0;a<acr.length;a++){
            var source=snapshot(4,false);((ObjectNode)source.path("features").path("egfr")).put("value",gfr[g]);((ObjectNode)source.path("features").path("acr")).put("value",acr[a]);
            var c=mapped(List.of(source),context()).path("renalTrajectory").path("clinicalAssessment");var category=c.path("prognosticClassification");
            assertEquals(groups[g],category.path("gCategory").asText());assertEquals(albumin[a],category.path("aCategory").asText());assertEquals(expected[g][a],category.path("category").asText());
            assertTrue(category.path("eventProbability").isNull());assertFalse(c.path("trend").path("ready").asBoolean());assertTrue(c.path("riskLevel").isNull());
        }
    }
    @Test void urineAcrIsRequiredForPrognosticClassificationAndNotReplacedBySerumAlbumin(){
        var source=snapshot(4,false);((ObjectNode)source.path("features")).remove("acr");
        var result=mapped(List.of(source),context()).path("renalTrajectory").path("clinicalAssessment").path("prognosticClassification");
        assertTrue(result.path("category").isNull());assertTrue(result.path("eventProbability").isNull());
    }
    static ObjectNode ureaPair(){
        var row=ClinicalFeatureMappingEngineTest.JSON.createObjectNode().put("id",UUID.randomUUID().toString()).put("source_note","SYNTHETIC verified same-session source");
        row.putObject("measurements").put("urea_pre",60).put("urea_post",20);row.putObject("units").put("urea_pre","mg/dL").put("urea_post","mg/dL");
        row.putObject("sampling_context").put("patientId",PATIENT.toString()).put("sessionId","SYNTHETIC-HD-001").put("preCollectedAt",NOW.minusSeconds(5*3600).toString()).put("postCollectedAt",NOW.minusSeconds(3600).toString()).put("sourceVerified",true);
        return row;
    }
    @Test void validMeasuredUrrIsTwoThirdsAndNeverAnEventProbability(){var result=UreaReductionRatio.evaluate(PATIENT.toString(),ureaPair());assertEquals(66.6666667,result.path("value").asDouble(),1e-6);assertFalse(result.has("probability"));}
    @Test void incompleteImpossibleOrMismatchedUreaSourcesAreWithheld(){
        for(String problem:List.of("zero","negative","post_exceeds_pre","patient","session","time","unit","missing")){
            var row=ureaPair();var v=(ObjectNode)row.path("measurements");var c=(ObjectNode)row.path("sampling_context");
            switch(problem){case "zero"->v.put("urea_pre",0);case "negative"->v.put("urea_post",-1);case "post_exceeds_pre"->v.put("urea_post",61);case "patient"->c.put("postPatientId",UUID.randomUUID().toString());case "session"->c.put("postSessionId","ANOTHER-SESSION");case "time"->c.put("postCollectedAt",c.path("preCollectedAt").asText());case "unit"->((ObjectNode)row.path("units")).put("urea_post","BUN mg/dL");default->row.remove("sampling_context");}
            var result=UreaReductionRatio.evaluate(PATIENT.toString(),row);assertTrue(result.path("value").isNull(),problem);assertFalse(result.path("reasons").isEmpty(),problem);
        }
    }
}
