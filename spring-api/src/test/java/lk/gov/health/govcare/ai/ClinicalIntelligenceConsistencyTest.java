package lk.gov.health.govcare.ai;

import ca.uhn.fhir.context.FhirContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import java.nio.file.*;
import java.util.*;
import javax.imageio.ImageIO;
import static org.junit.jupiter.api.Assertions.*;

class ClinicalIntelligenceConsistencyTest {
    private static final String SNAPSHOT="00000000-0000-4000-8000-000000000054";
    private ObjectNode screenshotOutput()throws Exception{
        var source=ClinicalIntelligenceRulesTest.snapshot(2,false);
        source=(ObjectNode)ClinicalFeatureMappingEngineTest.JSON.readTree(source.toString().replace(source.path("assessmentId").asText(),"00000000-0000-4000-8000-000000000064"));
        return decorated(ClinicalIntelligenceRulesTest.mapped(List.of(source),ClinicalIntelligenceRulesTest.context()));
    }
    static ObjectNode decorated(ObjectNode output){
        output.put("snapshotId",SNAPSHOT);ClinicalIntelligenceRules.bindSnapshot(output,SNAPSHOT);
        for(String key:RenalClinicalModules.ORDER)((ObjectNode)output.path(key)).put("moduleReviewState","AWAITING_REVIEW").put("moduleReviewVersion",0).putNull("clinicianReview");
        return output;
    }
    @Test void screenshotApiPdfAndFhirUseTheSameSavedResultAndVersions()throws Exception{
        var output=screenshotOutput();
        var contract=ClinicalIntelligenceRules.fhirContract(output);
        assertEquals(output.path("hyperkalemia").path("clinicalAssessment").path("clinicalSignal"),contract.path("results").path("hyperkalemia").path("clinicalSignal"));
        assertEquals(output.path("hyperkalemia").path("clinicalAssessment").path("coverage"),contract.path("results").path("hyperkalemia").path("coverage"));
        var identity=new HashMap<String,Object>();identity.put("patient_no","SYNTHETIC-CLINICAL-REVIEW");identity.put("full_name","SYNTHETIC SOFTWARE FIXTURE - NOT A REAL PATIENT");identity.put("model_version","Software demonstration only");identity.put("date_of_birth","1987-01-01");identity.put("gender","male");identity.put("created_at",ClinicalIntelligenceRulesTest.NOW);
        byte[] bytes=CkdAssessmentReportService.pdf(identity,List.of(),List.of(),List.of(),UUID.fromString(SNAPSHOT),null,Map.of(),List.of(),null,output);
        try(var document=Loader.loadPDF(bytes)){
            String text=new PDFTextStripper().getText(document).replaceAll("\\s+"," ");
            for(String expected:List.of("Recorded potassium: 2 mmol/L","Severe low potassium","Measurement date unverified","1 of 1 listed inputs recorded","Trend not established",ClinicalRuleRegistry.VERSION,SNAPSHOT,"Cardiovascular event risk not estimated"))assertTrue(text.contains(expected),expected);
            assertFalse(text.contains("Missing information: Listed monitoring inputs recorded"));assertFalse(text.contains("low hyperkalemia risk"));
            assertTrue(text.contains("Same patient and dialysis session"));assertTrue(text.contains("Pre-dialysis collection time"));
            String directory=System.getProperty("govcare.clinical.rules.qa.output");
            if(directory!=null){
                Path target=Path.of(directory);Files.createDirectories(target);Files.write(target.resolve("govcare-clinical-intelligence-synthetic.pdf"),bytes);Files.writeString(target.resolve("pdf-text.txt"),text);
                var stripper=new PDFTextStripper();for(int page=0;page<document.getNumberOfPages();page++){stripper.setStartPage(page+1);stripper.setEndPage(page+1);if(stripper.getText(document).contains("CKD Related Clinical Intelligence Summary")||stripper.getText(document).contains("CKD clinical intelligence summary - continued"))ImageIO.write(new PDFRenderer(document).renderImageWithDPI(page,120),"PNG",target.resolve("summary-page-"+(page+1)+".png").toFile());}
                Files.writeString(target.resolve("saved-fhir-contract.json"),contract.toPrettyString());
            }
        }
    }
    @Test void uncalibratedResearchClassifierNeverPopulatesFhirProbabilityAndContinuousForecastIsNotRiskAssessment(){
        for(String key:List.of("hyperkalemia","hb","urr")){
            var out=ClinicalFeatureMappingEngineTest.JSON.createObjectNode().put("status","AVAILABLE").put("model_key",key).put("model","SYNTHETIC-RESEARCH-MODEL").put("model_version","1.0").put("method",key.equals("hb")?"PERSISTENCE_BASELINE":"RESEARCH_MODEL").put("unit",key.equals("hb")?"g/dL":"%").put("forecast_origin_date","2026-10-19T08:00:00Z");
            out.putObject("explanation").putArray("limitations").add("Synthetic verification only; clinical validation incomplete");
            if(key.equals("hyperkalemia"))out.put("probability",.42);else out.put("prediction",key.equals("hb")?13.8:66.67);
            var resource=RenalPredictionFhir.resource("Patient/synthetic-patient",SNAPSHOT,out,List.of(Map.of("id",UUID.randomUUID())));
            assertTrue(resource.findValues("probabilityDecimal").isEmpty());assertTrue(resource.findValues("probabilityRange").isEmpty());
            assertEquals(key.equals("hyperkalemia")?"RiskAssessment":"ClinicalImpression",resource.path("resourceType").asText());
            assertDoesNotThrow(()->FhirContext.forR4Cached().newJsonParser().parseResource(resource.toString()));
            assertEquals("Patient/synthetic-patient",resource.path("subject").path("reference").asText());
            if(key.equals("hyperkalemia")){assertEquals(14,resource.path("prediction").get(0).path("whenRange").path("low").path("value").asInt());assertEquals(62,resource.path("prediction").get(0).path("whenRange").path("high").path("value").asInt());}
        }
    }
    @Test void exportSyntheticBrowserFixturesWithoutChangingClinicalData()throws Exception{
        var fixture=ClinicalFeatureMappingEngineTest.JSON.createObjectNode();
        var screenshot=screenshotOutput();fixture.set("screenshot",screenshot);
        fixture.set("dated",decorated(ClinicalIntelligenceRulesTest.mapped(List.of(ClinicalIntelligenceRulesTest.snapshot(4.2,true)),ClinicalIntelligenceRulesTest.context())));
        var error=screenshot.deepCopy();((ObjectNode)error.path("hyperkalemia").path("clinicalAssessment").path("prediction")).put("status","ERROR").put("reason","Inference service unavailable; existing recorded measurements remain visible.");fixture.set("serviceError",error);
        var baseline=decorated(ClinicalIntelligenceRulesTest.mapped(List.of(ClinicalIntelligenceRulesTest.snapshot(4.2,true)),ClinicalIntelligenceRulesTest.context()));
        ((ObjectNode)baseline.path("anemia").path("clinicalAssessment").path("prediction")).put("outputType","PREDICTED_VALUE").put("value",13.8).put("explanationMethod","BASELINE").put("baselineExplanation","Persistence baseline repeats the latest eligible recorded measurement. It is not an anemia-event probability.");fixture.set("baseline",baseline);
        assertTrue(screenshot.path("hyperkalemia").path("clinicalAssessment").path("prediction").path("eventProbability").isNull());
        String directory=System.getProperty("govcare.clinical.rules.qa.output");if(directory!=null){Path target=Path.of(directory);Files.createDirectories(target);Files.writeString(target.resolve("ui-fixtures.json"),fixture.toPrettyString());Files.writeString(target.resolve("rule-registry.json"),ClinicalRuleRegistry.manifest().toPrettyString());}
    }
}
