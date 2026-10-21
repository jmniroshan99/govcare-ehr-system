package lk.gov.health.govcare.ai;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import java.nio.file.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class CkdEstablishedEvidencePdfTest {
    @Test void reportShowsVerifiedContextAvailabilityAndMeasuredHistoryWithoutForecastingAHistoryLine() throws Exception {
        var output=CkdEstablishedEvidenceTest.mapped(CkdEstablishedEvidenceTest.demoSnapshots(false),"NO_KNOWN_DIABETES",false,List.of());
        output.put("snapshotId",UUID.randomUUID().toString());
        byte[] bytes=CkdAssessmentReportService.pdf(Map.of("patient_no","SYNTH-CKD-ND-PDF","full_name","SYNTHETIC SOFTWARE DEMONSTRATION - NOT A REAL PATIENT","model_version","Existing GovCare CKD model; software QA"),List.of(),List.of(),List.of(),UUID.randomUUID(),null,Map.of(),List.of(),null,output);
        try(var doc=Loader.loadPDF(bytes)) {
            String text=new PDFTextStripper().getText(doc).replaceAll("\\s+"," ");
            for(String expected:List.of("CKD Related Clinical Intelligence Summary","Recorded-input coverage: 1 of 1 listed inputs recorded","Cardiovascular event risk not estimated","Observed dated pair:","SYNTHETIC","Cardiovascular Surveillance"))assertTrue(text.contains(expected),expected);
            assertFalse(text.contains("% Ready"));assertFalse(text.contains("Projected eGFR"));assertTrue(doc.getNumberOfPages()>1);
        }
        String directory=System.getProperty("govcare.ckd.evidence.qa.output");if(directory!=null){Path p=Path.of(directory);Files.createDirectories(p);Files.write(p.resolve("synthetic-evidence-summary-v55.pdf"),bytes);}
    }
}
