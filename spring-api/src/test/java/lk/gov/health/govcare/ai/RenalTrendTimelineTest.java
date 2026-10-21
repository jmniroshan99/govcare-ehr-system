package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lowagie.text.Document;
import com.lowagie.text.pdf.PdfWriter;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.junit.jupiter.api.Test;
import javax.imageio.ImageIO;
import java.io.ByteArrayOutputStream;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class RenalTrendTimelineTest {
    private static final ObjectMapper JSON=new ObjectMapper().findAndRegisterModules();
    private static final Instant NOW=Instant.now();
    private static final Path OUTPUT=Path.of("../verification/renal-trends-v56");
    private ObjectNode feature(String key,double value,String unit,Instant at,boolean verified,String id){
        var metadata=JSON.createObjectNode().put("unit",unit).put("sourceVerified",verified);
        if(at!=null)metadata.put("observedAt",at.toString());
        return ClinicalFeatureNormalizer.measurement(ClinicalFeatureNormalizer.definition(key),JSON.valueToTree(value),metadata,NOW.toString(),"CLINICIAN_ENTERED",id,null,NOW);
    }
    private ObjectNode snapshot(List<ObjectNode> observations,List<ObjectNode> assessments){
        var context=new SriLankanRenalIntelligenceService.Overview(UUID.fromString("00000000-0000-4000-8000-000000000001"),UUID.fromString("00000000-0000-4000-8000-000000000002"),new SriLankanRenalIntelligenceService.RenalStatus(null,"Unconfirmed","Operational QA source; not a clinical subject"),List.of(),List.of(),null,true,false);
        var out=ClinicalFeatureMappingEngine.apply(RenalClinicalModules.assemble(context,List.of(),NOW),
            new ClinicalPredictionFeatureService.FeatureData(context.patientId(),context.hospitalId(),assessments,observations,false),NOW);
        out.put("snapshotId",UUID.randomUUID().toString());
        for(String key:RenalClinicalModules.ORDER){var module=(ObjectNode)out.get(key);module.put("moduleReviewState","AWAITING_REVIEW").put("moduleReviewVersion",0).putNull("clinicianReview");}
        return out;
    }
    private ObjectNode timeline(ObjectNode... observations){return snapshot(List.of(observations),List.of()).withObject("renalTimeline");}
    @Test void realDatedHbHasOnePointThenTwoWithoutInventingForecastReadiness(){
        var first=feature("hemoglobin",108,"g/L",NOW.minusSeconds(86400*10),true,"first");
        var one=timeline(first);assertEquals(1,one.path("series").path("hemoglobin").size());assertEquals(10.8,one.path("series").path("hemoglobin").get(0).path("value").asDouble());
        var out=snapshot(List.of(first,feature("hemoglobin",10.2,"g/dL",NOW.minusSeconds(86400),true,"second")),List.of());
        assertEquals(2,out.path("renalTimeline").path("series").path("hemoglobin").size());assertFalse(out.path("anemia").path("canRun").asBoolean());
        assertTrue(out.path("anemia").path("forecast").isNull());
    }
    @Test void missingDatesInvalidUnitsAndUnverifiedResultsHaveDistinctExclusionReasons(){
        var t=timeline(feature("hemoglobin",10,"g/dL",null,true,"undated"),feature("hemoglobin",10,"unknown",NOW,true,"unit"),feature("hemoglobin",10,"g/dL",NOW,false,"manual"),feature("hemoglobin",-1,"g/dL",NOW,true,"negative"));
        assertEquals(0,t.path("verifiedDatedCount").asInt());assertTrue(t.path("latestObservedAt").isNull());
        Set<String> reasons=new HashSet<>();t.path("sources").forEach(r->reasons.add(r.path("exclusionReason").asText()));
        assertEquals(Set.of("MISSING_COLLECTION_DATE","INVALID_VALUE_OR_UNIT","SOURCE_NOT_VERIFIED"),reasons);
    }
    @Test void sameResultDeduplicatesAndConflictsAreExcluded(){
        var a=feature("creatinine",176.8,"umol/L",NOW,true,"a");var b=feature("creatinine",2,"mg/dL",NOW,true,"b");
        var same=timeline(a,b);assertEquals(1,same.path("verifiedDatedCount").asInt());assertEquals("DUPLICATE_SOURCE_RESULT",same.path("sources").get(1).path("exclusionReason").asText());
        var conflict=timeline(a,feature("creatinine",3,"mg/dL",NOW,true,"c"));assertEquals(0,conflict.path("verifiedDatedCount").asInt());assertEquals("CONFLICTING_RESULT",conflict.path("sources").get(0).path("exclusionReason").asText());
    }
    @Test void assessmentSubmissionTimeNeverBecomesCollectionOrVerification(){
        var row=new HashMap<String,Object>();row.put("id",UUID.randomUUID());row.put("recorded_at",NOW);row.put("raw_inputs",Map.of("HemoglobinLevels",10.0));
        var source=ClinicalFeatureNormalizer.assessment(row,NOW);var out=snapshot(List.of(),List.of(source));var t=out.path("renalTimeline");
        assertEquals(0,t.path("verifiedDatedCount").asInt());var r=t.path("sources").get(0);assertEquals("CKD_ASSESSMENT",r.path("source").asText());assertTrue(r.path("observedAt").isNull());assertFalse(r.path("sourceVerified").asBoolean());assertTrue(r.path("assessmentId").isTextual());
    }
    @Test void samplingContextsAreNeverJoinedOrConflictedAcrossSerumPreAndPost(){
        var pre=feature("potassium",5.2,"mmol/L",NOW,true,"pre").put("sampleContext","PRE_HD");var post=feature("potassium",3.8,"mmol/L",NOW,true,"post").put("sampleContext","POST_HD");
        var t=timeline(pre,post);assertEquals(2,t.path("verifiedDatedCount").asInt());
    }
    @Test void dialysisChemistryUsesExplicitCanonicalUnitsAndRejectsMissingUnits(){
        var root=JSON.createObjectNode();var r=root.putArray("observations").addObject().put("id","QA-RENAL").put("observed_at",NOW.minusSeconds(60).toString());
        r.putObject("measurements").put("creatinine_pre",2).put("urea_pre",60.06).put("potassium_post",4.0);
        r.putObject("units").put("creatinine_pre","mg/dL").put("urea_pre","mg/dL");
        var context=new ClinicalPredictionFeatureService.FeatureData(UUID.randomUUID(),UUID.randomUUID(),List.of(),List.of(),false);
        var t=RenalTrendTimeline.assemble(root,context,NOW);
        assertEquals(176.8,t.path("series").path("creatinine_pre").get(0).path("value").asDouble(),1e-9);
        assertEquals(10,t.path("series").path("urea_pre").get(0).path("value").asDouble(),1e-9);
        assertTrue(t.path("series").path("potassium_post").isMissingNode());assertEquals(2,t.path("verifiedDatedCount").asInt());
    }
    @Test void fhirComponentsRetainActualDatesAndFinalStatusDoesNotInventVerification(){
        var fhir=JSON.createObjectNode().put("resourceType","Observation").put("status","final").put("effectiveDateTime",NOW.minusSeconds(60).toString());
        fhir.putObject("subject").put("reference","Patient/QA");var component=fhir.putArray("component").addObject();component.putObject("code").put("text","Hemoglobin");component.putObject("valueQuantity").put("value",108).put("unit","g/L");
        var row=new HashMap<String,Object>();row.put("resource_id","QA-FHIR");row.put("json_data",fhir);row.put("created_date",NOW);
        var parsed=RenalTrendTimeline.fhirMeasurements(row,Set.of("Patient/QA"),NOW);assertEquals(1,parsed.size());assertEquals(10.8,parsed.getFirst().path("value").asDouble());assertFalse(parsed.getFirst().path("sourceVerified").asBoolean());
        row.put("source_verified",true);var wrong=RenalTrendTimeline.fhirMeasurements(row,Set.of("Patient/OTHER"),NOW);assertFalse(wrong.getFirst().path("available").asBoolean());
        fhir.remove("effectiveDateTime");var undated=RenalTrendTimeline.fhirMeasurements(row,Set.of("Patient/QA"),NOW);assertTrue(undated.getFirst().path("observedAt").isNull());
    }
    @Test void actualAssemblerProducesBrowserFixturesAndPdfGraphsFromVerifiedRecords()throws Exception{
        Files.createDirectories(OUTPUT);var fixtures=JSON.createObjectNode();fixtures.set("empty",snapshot(List.of(),List.of()));
        var first=feature("hemoglobin",10.8,"g/dL",NOW.minusSeconds(86400*40),true,"QA-HB-1");
        fixtures.set("one",snapshot(List.of(first),List.of()));
        var values=new ArrayList<ObjectNode>(List.of(first,feature("hemoglobin",10.2,"g/dL",NOW.minusSeconds(86400),true,"QA-HB-2")));
        for(String key:List.of("creatinine","egfr","potassium","urea")){
            var d=ClinicalFeatureNormalizer.definition(key);double value=key.equals("creatinine")?1.8:key.equals("egfr")?35:key.equals("potassium")?4.8:12;
            values.add(feature(key,value,d.unit(),NOW.minusSeconds(86400*8),true,"QA-"+key+"-1"));values.add(feature(key,value*.95,d.unit(),NOW.minusSeconds(86400),true,"QA-"+key+"-2"));
        }
        var paired=snapshot(values,List.of());fixtures.set("paired",paired);
        fixtures.set("excluded",snapshot(List.of(feature("hemoglobin",10,"g/dL",null,true,"QA-NO-DATE"),feature("hemoglobin",10,"unknown",NOW,true,"QA-UNIT"),feature("hemoglobin",10,"g/dL",NOW,false,"QA-UNVERIFIED")),List.of()));
        Files.writeString(OUTPUT.resolve("ui-fixtures.json"),fixtures.toPrettyString());
        var bytes=new ByteArrayOutputStream();var document=new Document();var writer=PdfWriter.getInstance(document,bytes);document.open();RenalTrendPdf.add(document,writer,paired);document.close();
        Files.write(OUTPUT.resolve("verified-trends.pdf"),bytes.toByteArray());
        try(var pdf=Loader.loadPDF(bytes.toByteArray())){
            String text=new PDFTextStripper().getText(pdf).replaceAll("\\s+"," ");Files.writeString(OUTPUT.resolve("pdf-text.txt"),text);
            assertTrue(text.contains("latest verified: 10.2 g/dL"),text);assertTrue(text.contains("Collection dates:"),text);assertTrue(text.contains("No inference runs during export"),text);assertFalse(text.contains("Research forecast: 0"));
            var renderer=new PDFRenderer(pdf);for(int page=0;page<pdf.getNumberOfPages();page++)ImageIO.write(renderer.renderImageWithDPI(page,115),"png",OUTPUT.resolve("pdf-page-"+(page+1)+".png").toFile());
        }
    }
}
