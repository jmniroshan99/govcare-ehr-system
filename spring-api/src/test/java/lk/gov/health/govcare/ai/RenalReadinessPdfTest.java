package lk.gov.health.govcare.ai;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import java.nio.file.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class RenalReadinessPdfTest {
    @Test void insufficientPdfNamesMissingRequirementsAndNeverPrintsZeroOfZeroAsStable() throws Exception {
        var context=RenalReadinessTest.data(List.of());var out=RenalClinicalModules.assemble(context,RenalReadinessTest.registry(),RenalReadinessTest.NOW);out.put("snapshotId",UUID.randomUUID().toString());
        byte[] bytes=pdf(context,out);
        try(var document=Loader.loadPDF(bytes)){String text=new PDFTextStripper().getText(document).replaceAll("\\s+"," ");
            assertTrue(text.contains("Result not calculated - insufficient longitudinal data."));assertTrue(text.contains("0 of 6 domains currently evaluable"));
            assertTrue(text.contains("Creatinine"));assertTrue(text.contains("Complete renal trend data"));assertFalse(text.contains("0/0"));
            assertFalse(text.contains("Directional composite: 0%"));assertFalse(text.contains("Research Risk Score:"));
        }save("readiness-empty-v48.pdf",bytes);
    }
    @Test void pairedUreaPdfSeparatesMeasuredUrrFromNotReadyForecast() throws Exception {
        var context=RenalReadinessTest.data(List.of(RenalReadinessTest.row(1,true,RenalReadinessTest.labs())));var out=RenalClinicalModules.assemble(context,RenalReadinessTest.registry(),RenalReadinessTest.NOW);out.put("snapshotId",UUID.randomUUID().toString());
        byte[] bytes=pdf(context,out);
        try(var document=Loader.loadPDF(bytes)){String text=new PDFTextStripper().getText(document).replaceAll("\\s+"," ");
            assertTrue(text.contains("Current measured URR: 65"));assertTrue(text.contains("Next-period forecast: Not ready / not run"));
            assertTrue(text.contains("Dated verified HD observations"));assertTrue(text.contains("no inference"));assertFalse(text.contains("Research Risk Score:"));
        }save("readiness-paired-v48.pdf",bytes);
    }
    private byte[] pdf(SriLankanRenalIntelligenceService.Overview context,com.fasterxml.jackson.databind.JsonNode out){
        return CkdAssessmentReportService.pdf(Map.of("patient_no","OPERATIONAL-QA-ONLY","full_name","Operational QA; not a clinical subject","model_version","Software verification"),List.of(),List.of(),List.of(),UUID.randomUUID(),null,Map.of(),List.of(),context,out);
    }
    private void save(String name,byte[] bytes)throws Exception{String directory=System.getProperty("govcare.renal.readiness.qa.output");if(directory!=null){Path target=Path.of(directory);Files.createDirectories(target);Files.write(target.resolve(name),bytes);}}
}
