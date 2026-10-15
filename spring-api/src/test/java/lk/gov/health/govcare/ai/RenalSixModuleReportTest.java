package lk.gov.health.govcare.ai;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
class RenalSixModuleReportTest {
    @Test void actualPdfRendersSixOrderedStoredModulesAndResearchDisclaimers() throws Exception {
        Instant now=Instant.now();var first=observation(now.minusSeconds(31*86400),10.8,4.8,20,7);var last=observation(now.minusSeconds(86400),10.2,5.6,22,9);
        var mapper=new ObjectMapper().findAndRegisterModules();var prediction=mapper.createObjectNode().put("model_key","hyperkalemia").put("status","AVAILABLE").put("model","LK-RENAL-HYPERK-1.0").put("model_version","1.0.0").put("method","RESEARCH_MODEL").put("algorithm","LogisticRegression").put("probability",.42).put("forecast_origin_date",last.observedAt().toString()).put("horizon_definition","Next observed measurement 14–62 days; display anchor +30 days");
        prediction.putObject("explanation").putArray("limitations").add("Research model – not clinically validated");
        var p=new SriLankanRenalIntelligenceService.PredictionView(UUID.randomUUID(),"hyperkalemia","AVAILABLE",prediction,now,"DEFER",1);
        var overview=new SriLankanRenalIntelligenceService.Overview(UUID.randomUUID(),UUID.randomUUID(),new SriLankanRenalIntelligenceService.RenalStatus("G5D","Kidney Failure on Dialysis","Verified maintenance hemodialysis"),List.of(first,last),List.of(p),null,true,false);
        var registry=List.<Map<String,Object>>of(Map.of("model_key","hyperkalemia","version","1.0.0","display_name","LK-RENAL-HYPERK-1.0","runtime_status","ACTIVE"),Map.of("model_key","hb","version","1.0.0","runtime_status","ACTIVE"),Map.of("model_key","urr","version","1.0.0","runtime_status","ACTIVE"));
        var output=RenalClinicalModules.assemble(overview,new RenalModelMetadata("").enrich(registry),now);output.put("snapshotId",UUID.randomUUID().toString());
        for(String key:RenalClinicalModules.ORDER) {var m=(com.fasterxml.jackson.databind.node.ObjectNode)output.get(key);m.put("moduleReviewState","AWAITING_REVIEW");m.put("moduleReviewVersion",0);}
        var identity=Map.<String,Object>of("patient_no","OPERATIONAL-UI-QA-ONLY","full_name","Operational fixture — not a clinical record","model_version","Test","probability",.1,"risk_category","LOW","confidence",.8);
        byte[] bytes=CkdAssessmentReportService.pdf(identity,List.of(),List.of(),List.of(),UUID.randomUUID(),null,Map.of(),List.of(p),overview,output);
        try(var pdf=Loader.loadPDF(bytes)) {
            String text=new PDFTextStripper().getText(pdf);int previous=-1;
            for(String label:List.of("Renal Clinical Trajectory","Kidney Failure / G5D","Hyperkalemia Monitoring","Anemia / Hb Deterioration","Dialysis Adequacy / URR","Renal Clinical Deterioration")){int at=text.indexOf(label);assertTrue(at>previous,label);previous=at;}
            assertTrue(text.contains("Research Risk Score: 42.0%"));assertTrue(text.contains("Persistence Baseline"));assertTrue(text.contains("No inference")||text.contains("no inference"));
            assertFalse(text.contains("RELATED DISEASE PROBABILITIES"));assertFalse(text.contains("Cardiovascular disease"));assertTrue(text.contains("Outputs require clinician interpretation"));assertTrue(pdf.getNumberOfPages()>=3);
        }
        String directory=System.getProperty("govcare.renal.qa.output");
        if(directory!=null){Path root=Paths.get(directory);Files.createDirectories(root);Files.write(root.resolve("six-module-report-v46.pdf"),bytes);Files.writeString(root.resolve("six-module-ui-fixture-v46.json"),output.toPrettyString());}
    }
    private static SriLankanRenalIntelligenceService.ObservationView observation(Instant time,double hb,double k,double pre,double post) {
        return new SriLankanRenalIntelligenceService.ObservationView(UUID.randomUUID(),time,true,Map.of("hb",hb,"albumin",38.0,"calcium",2.2,"sodium",138.0,"potassium_pre",k,"potassium_post",3.5,"creatinine_pre",700.0,"urea_pre",pre,"urea_post",post),Map.of("hb","g/dL","albumin","g/L","calcium","mmol/L","sodium","mmol/L","potassium_pre","mmol/L","potassium_post","mmol/L","creatinine_pre","umol/L","urea_pre","mmol/L","urea_post","mmol/L"),"Operational verified fixture — not a clinical record",List.of());
    }
}
