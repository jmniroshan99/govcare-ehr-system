package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/** Actual migrated assessment rows -> actual mapping engine -> actual OpenPDF output / browser response. */
class ClinicalFeatureUiAndPdfTest {
    private static final UUID PATIENT=CkdAssessmentFeatureBridgeTest.PATIENT,HOSPITAL=CkdAssessmentFeatureBridgeTest.HOSPITAL,UNDATED=UUID.fromString("00000000-0000-4000-8000-000000000003");
    private record Case(SriLankanRenalIntelligenceService.Overview context,ObjectNode output,List<ObjectNode> snapshots){}
    private List<Map<String,Object>> rows()throws Exception{
        String path=System.getProperty("govcare.clinical.feature.persisted.fixtures");
        if(path!=null){var fixture=ClinicalFeatureMappingEngineTest.JSON.readTree(Files.readString(Path.of(path)));assertEquals(PATIENT.toString(),fixture.path("patientId").asText());return ClinicalFeatureMappingEngineTest.JSON.convertValue(fixture.path("rows"),new com.fasterxml.jackson.core.type.TypeReference<List<Map<String,Object>>>(){});}
        // Ordinary test runs remain deterministic without operational output files.
        var first=CkdAssessmentFeatureBridgeTest.savedAssessment(45.0,Instant.now().minusSeconds(86400*31));var second=CkdAssessmentFeatureBridgeTest.savedAssessment(35.0,Instant.now().minusSeconds(86400));var single=CkdAssessmentFeatureBridgeTest.savedAssessment(35.0,null);
        ((Map<String,Object>)first.get("raw_inputs")).put("SerumCreatinine",1.6);((Map<String,Object>)first.get("raw_inputs")).put("HemoglobinLevels",11.3);
        first.put("recorded_at",Instant.now().minusSeconds(86400*30));single.put("patient_id",UNDATED);
        return List.of(first,second,single);
    }
    private Case scenario(UUID patient,boolean dated)throws Exception{
        var snapshots=rows().stream().filter(row->patient.toString().equals(Objects.toString(row.get("patient_id")))).map(row->ClinicalFeatureNormalizer.assessment(row,Instant.now())).toList();assertEquals(dated?2:1,snapshots.size());
        var context=new SriLankanRenalIntelligenceService.Overview(patient,HOSPITAL,new SriLankanRenalIntelligenceService.RenalStatus(null,"Unconfirmed","Operational verification source; not a clinical subject"),List.of(),List.of(),null,true,false);
        var out=ClinicalFeatureMappingEngine.apply(RenalClinicalModules.assemble(context,RenalReadinessTest.registry(),Instant.now()),new ClinicalPredictionFeatureService.FeatureData(patient,HOSPITAL,snapshots,List.of(),false),Instant.now());
        out.put("snapshotId",UUID.randomUUID().toString());for(String key:RenalClinicalModules.ORDER)((ObjectNode)out.get(key)).put("moduleReviewState","AWAITING_REVIEW").put("moduleReviewVersion",0).putNull("clinicianReview");
        return new Case(context,out,snapshots);
    }
    @Test void migratedDatedCkdRowsProduceTheSixOutputsWithSourceLineage()throws Exception{
        var c=scenario(PATIENT,true);assertEquals(2,c.output.path("clinicalFeatureData").path("assessmentCount").asInt());
        assertEquals(25,c.output.path("akiRisk").path("creatinineChangePercent").asDouble(),1e-8);assertFalse(c.output.path("akiRisk").path("acuteReviewSignal").asBoolean());
        assertEquals("High",c.output.path("renalTrajectory").path("clinicalAssessment").path("riskLevel").asText());assertEquals(420,c.output.path("clinicalFeatureData").path("current").path("acr").path("value").asDouble());
        assertEquals(5.8,c.output.path("hyperkalemia").path("clinicalAssessment").path("currentValue").asDouble());assertEquals(9.8,c.output.path("anemia").path("clinicalAssessment").path("currentValue").asDouble());
        assertTrue(c.output.path("dialysisAdequacy").path("clinicalAssessment").path("currentValue").isNull());
        for(String key:RenalClinicalModules.ORDER){assertTrue(c.output.path(key).path("researchRiskScore").isNull());assertTrue(c.output.path(key).path("forecast").isNull());assertTrue(c.output.path(key).path("readiness").has("clinicalDataReadiness"));}
        saveResponses(c,scenario(UNDATED,false));
    }
    @Test void datedPdfIncludesAssessmentInputsCalculatedMonitoringCompletenessAndMissingSessionGuidance()throws Exception{
        var c=scenario(PATIENT,true);byte[] bytes=pdf(c);String text=text(bytes);
        for(String expected:List.of("CKD Progression","Monitoring inputs: 100% available","High potassium monitoring signal","Anemia monitoring signal","Measured creatinine change: 25","Requires hemodialysis session data","Clinical recommendations","Longitudinal forecasting requires repeated dated observations","Source: CKD_ASSESSMENT"))assertTrue(text.contains(expected),expected);
        assertFalse(text.contains("Research Risk Score:"));assertFalse(text.contains("0/0"));save("clinical-features-dated-v49.pdf",bytes);
        for(String expected:List.of("CKD Related Clinical Intelligence Summary","Anemia Monitoring","Hyperkalemia Risk Monitoring","Dialysis Effectiveness Monitoring","Renal Function Progression","CKD Cardiovascular Monitoring","Risk not estimated","Clinical diabetes status","Clinician notes:","AI explanation / clinical rule:"))assertTrue(text.contains(expected),expected);
    }
    @Test void undatedPdfShowsUsefulSnapshotResultsButNeverInventsAnAkiBaselineOrUrr()throws Exception{
        var c=scenario(UNDATED,false);byte[] bytes=pdf(c);String text=text(bytes);
        assertTrue(text.contains("Baseline creatinine required for AKI trend calculation"));assertTrue(text.contains("Single clinical snapshot available"));assertTrue(text.contains("Undated assessment snapshot"));assertTrue(text.contains("Dialysis verification required"));
        assertFalse(text.contains("Measured creatinine change:"));assertFalse(text.contains("Research Risk Score:"));save("clinical-features-undated-v49.pdf",bytes);
    }
    private byte[] pdf(Case c){
        List<Map<String,Object>> inputs=new ArrayList<>();var current=c.snapshots.stream().max(Comparator.comparing(s->s.path("recordedAt").asText())).orElseThrow();
        for(var d:ClinicalFeatureNormalizer.DEFINITIONS){var f=current.path("features").path(d.key());if(!f.path("available").asBoolean())continue;var row=new LinkedHashMap<String,Object>();row.put("feature_key",d.input());row.put("value_numeric",f.path("value").asDouble());row.put("unit",d.unit());row.put("source_type","MANUAL");row.put("effective_at",f.path("observedAt").asText(null));inputs.add(row);}
        return CkdAssessmentReportService.pdf(Map.of("patient_no","OPERATIONAL-FEATURE-QA","full_name","Operational software QA; not a clinical subject","model_version","Software verification only"),inputs,List.of(),List.of(),UUID.fromString(current.path("assessmentId").asText()),null,Map.of(),List.of(),c.context,c.output);
    }
    private String text(byte[] bytes)throws Exception{try(var doc=Loader.loadPDF(bytes)){return new PDFTextStripper().getText(doc).replaceAll("\\s+"," ");}}
    private void save(String name,byte[] bytes)throws Exception{String directory=System.getProperty("govcare.clinical.feature.qa.output");if(directory!=null){var target=Path.of(directory);Files.createDirectories(target);Files.write(target.resolve(name),bytes);}}
    private void saveResponses(Case dated,Case single)throws Exception{
        var responses=ClinicalFeatureMappingEngineTest.JSON.createObjectNode();responses.set("paired",dated.output);responses.set("single",single.output);
        var context=new SriLankanRenalIntelligenceService.Overview(UNDATED,HOSPITAL,single.context.currentRenalStatus(),List.of(RenalReadinessTest.row(1,true,RenalReadinessTest.labs())),List.of(),null,true,false);
        var paired=ClinicalFeatureMappingEngine.apply(RenalClinicalModules.assemble(context,RenalReadinessTest.registry(),Instant.now()),new ClinicalPredictionFeatureService.FeatureData(UNDATED,HOSPITAL,single.snapshots,List.of(),false),Instant.now());decorate(paired);responses.set("hdSession",paired);
        var status=new SriLankanRenalIntelligenceService.RenalStatus("G5D","Verified maintenance HD","Operational context",null,null,null,"MAINTENANCE_HD",Instant.now().minusSeconds(60),"Verified operational source",UUID.randomUUID());
        var verified=new SriLankanRenalIntelligenceService.Overview(UNDATED,HOSPITAL,status,List.of(),List.of(),null,true,false);var verifiedOutput=ClinicalFeatureMappingEngine.apply(RenalClinicalModules.assemble(verified,RenalReadinessTest.registry(),Instant.now()),new ClinicalPredictionFeatureService.FeatureData(UNDATED,HOSPITAL,single.snapshots,List.of(),false),Instant.now());decorate(verifiedOutput);responses.set("verified",verifiedOutput);
        String directory=System.getProperty("govcare.clinical.feature.qa.output");if(directory!=null){var target=Path.of(directory);Files.createDirectories(target);Files.writeString(target.resolve("clinical-feature-ui-fixtures-v49.json"),responses.toPrettyString());}
    }
    private void decorate(ObjectNode out){out.put("snapshotId",UUID.randomUUID().toString());for(String key:RenalClinicalModules.ORDER)((ObjectNode)out.get(key)).put("moduleReviewState","AWAITING_REVIEW").put("moduleReviewVersion",0).putNull("clinicianReview");}
}
