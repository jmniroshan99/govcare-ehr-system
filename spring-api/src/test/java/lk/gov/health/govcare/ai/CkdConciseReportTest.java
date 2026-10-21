package lk.gov.health.govcare.ai;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import java.util.*;
import java.nio.file.*;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;

class CkdConciseReportTest {
 @Test void scoresArePercentagesWithoutImplyingCalibration(){assertEquals("99.99%",ClinicalScoreDisplay.percent(.9999));assertEquals("99.97%",ClinicalScoreDisplay.percent(.9997));assertEquals("75.00%",ClinicalScoreDisplay.percent(.75));for(Object invalid:List.of(-.01,1.01,Double.NaN,Double.POSITIVE_INFINITY,"0.9"))assertEquals("Unavailable",ClinicalScoreDisplay.percent(invalid));assertEquals("Unavailable",ClinicalScoreDisplay.percent(null));}
 static ObjectNode snapshot(){var s=CkdEstablishedEvidenceTest.mapped(CkdEstablishedEvidenceTest.demoSnapshots(false),"NO_KNOWN_DIABETES",false,List.of());s.put("snapshotId","SYNTHETIC-SUMMARY-TEST");return s;}
 static Map<String,Object> patient(){return Map.ofEntries(Map.entry("full_name","SYNTHETIC CLINICAL SUMMARY PATIENT"),Map.entry("patient_no","SYNTH-SUMMARY"),Map.entry("synthetic",true),Map.entry("created_at",java.sql.Timestamp.from(Instant.parse("2026-10-20T10:00:00Z"))),Map.entry("probability",.9999),Map.entry("confidence",.9997),Map.entry("risk_category","URGENT_REVIEW"),Map.entry("hospital_name","SYNTHETIC QA HOSPITAL"),Map.entry("model_version","GOVCARE-CKD-LOGISTIC-1.0"),Map.entry("review_status","AWAITING_REVIEW"),Map.entry("suggested_ckd_g_category","G3a"));}
 @Test void sourceReferencesKeepAssessmentIdentityRatherThanRemovedFeaturePayload(){var data=snapshot().path("clinicalFeatureData").path("assessmentSources");assertFalse(data.isEmpty());for(JsonNode source:data){assertTrue(source.path("assessmentId").isTextual());assertFalse(source.path("assessmentId").asText().isBlank());assertFalse(source.has("features"));}}
 @Test void productionSummaryIsConciseAndPreservesSavedScoreContext()throws Exception{
  var s=snapshot();var inputs=List.<Map<String,Object>>of(Map.of("feature_key","HemoglobinLevels","value_numeric",10.8,"unit","g/dL","source_type","EHR","source_report","SYNTHETIC-CBC.pdf","source_metadata","{\"clinicalDate\":\"2026-10-19T03:00:00Z\"}"));
  byte[] bytes=CkdConciseReportPdf.render(patient(),inputs,List.of(),List.of(),UUID.randomUUID(),s,false);try(var pdf=Loader.loadPDF(bytes)){assertEquals(4,pdf.getNumberOfPages());String text=new PDFTextStripper().getText(pdf);assertTrue(text.contains("99.99%"));assertTrue(text.contains("99.97%"));assertTrue(text.contains("Uncalibrated model scores"));assertTrue(text.contains("SYNTHETIC TEST DATA"));assertTrue(text.contains("10.8 g/dL"));assertFalse(text.contains("TECHNICAL EVIDENCE APPENDIX"));for(int i=1;i<=4;i++){var stripper=new PDFTextStripper();stripper.setStartPage(i);stripper.setEndPage(i);assertTrue(stripper.getText(pdf).length()>350,"Avoid sparse report pages");}}
  Path folder=Path.of("../verification/clinical-workspace-v60");Files.createDirectories(folder);Files.write(folder.resolve("layout-test-summary.pdf"),bytes);
 }
 @Test void conflictCountsUseUniqueSourceRecordsAndAppendixPreservesDetails()throws Exception{
  var s=snapshot();var rows=((ObjectNode)s.path("clinicalFeatureData")).putArray("excludedData");for(int i=0;i<13;i++)for(int copy=0;copy<3;copy++)rows.addObject().put("key","creatinine").put("sourceId","SOURCE-"+i).put("observedAt","2026-10-19T03:00:00Z").put("originalValue",i+1).put("unit","mg/dL").putArray("qualityFlags").add("CONFLICTING_RESULT");
  assertEquals(13,CkdConciseReportPdf.excluded(s).get("creatinine").size());
  byte[] bytes=CkdConciseReportPdf.render(patient(),List.of(),List.of(),List.of(),UUID.randomUUID(),s,true);try(var pdf=Loader.loadPDF(bytes)){String text=new PDFTextStripper().getText(pdf);assertTrue(text.contains("TECHNICAL EVIDENCE APPENDIX"));assertTrue(text.contains("SOURCE-12"));assertTrue(text.contains("CONFLICTING_RESULT"));}assertEquals(39,s.path("clinicalFeatureData").path("excludedData").size());
 }
 @Test void allLibraryFixturesAreRealSafePdfsWithAnImageOnlyScan()throws Exception{
  for(String key:List.of("comprehensive","renal","cbc","electrolytes","hemodialysis","urine-acr","multipage","scanned")){byte[] bytes;try(var input=getClass().getResourceAsStream("/clinical-test-documents/"+key+".pdf")){assertNotNull(input);bytes=input.readAllBytes();}lk.gov.health.govcare.documents.ClinicalPdfFileValidation.validate(bytes);try(var pdf=Loader.loadPDF(bytes)){String text=new PDFTextStripper().getText(pdf);if(key.equals("scanned"))assertTrue(text.isBlank());else assertTrue(text.contains("SYNTHETIC SOFTWARE TEST"));if(key.equals("multipage"))assertEquals(2,pdf.getNumberOfPages());}}
 }
}
