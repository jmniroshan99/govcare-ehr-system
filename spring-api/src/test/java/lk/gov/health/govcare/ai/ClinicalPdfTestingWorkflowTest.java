package lk.gov.health.govcare.ai;

import lk.gov.health.govcare.common.*;
import lk.gov.health.govcare.documents.*;
import lk.gov.health.govcare.security.*;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.font.*;
import org.apache.pdfbox.pdmodel.interactive.action.PDActionJavaScript;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.*;
import java.util.*;
import java.awt.image.BufferedImage;
import java.io.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class ClinicalPdfTestingWorkflowTest {
 static byte[] pdf(String[]... pages)throws Exception{
  try(var document=new PDDocument();var output=new ByteArrayOutputStream()){
   for(var lines:pages){var page=new PDPage();document.addPage(page);try(var stream=new PDPageContentStream(document,page)){stream.beginText();stream.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA),11);stream.newLineAtOffset(40,740);stream.showText("SYNTHETIC SOFTWARE QA - NOT FOR PATIENT CARE");for(String line:lines){stream.newLineAtOffset(0,-22);stream.showText(line);}stream.endText();}}
   document.save(output);return output.toByteArray();
  }
 }
 @Test void broadClinicalFieldsRemainDistinctAndNormalized()throws Exception{
  var extracted=new ClinicalPdfExtractionService(new LocalPdfExtractionService()).extract(pdf(new String[]{"PCV 0.32 L/L","RBC 3.9 10^12/L","WBC 6.5 10^3/uL","Platelets 180 10^9/L","Blood Urea 8 mmol/L","BUN 26 mg/dL","Sodium 140 mmol/L","Calcium 9.2 mg/dL","Serum Albumin 4 g/dL","Blood Glucose 7 mmol/L","Pre-HD Urea 20 mmol/L","Post-HD Urea 7 mmol/L"}),"UPLOADED_PDF");
  var values=(Map<String,Map<String,Object>>)extracted.get("extractedValues");assertEquals(12,values.size());assertEquals(32,((Number)values.get("PCV").get("value")).doubleValue(),.001);assertEquals(2.295,((Number)values.get("SerumCalcium").get("value")).doubleValue(),.001);assertEquals(40,((Number)values.get("SerumAlbumin").get("value")).doubleValue(),.001);assertFalse(values.containsKey("FastingBloodSugar"));assertEquals(8,((Number)values.get("BloodUrea").get("value")).doubleValue(),.001);assertEquals(26,((Number)values.get("BUNLevels").get("value")).doubleValue(),.001);
 }
 @Test void validPdfIsAcceptedWithoutDependingOnFilenameOrMime(@TempDir Path root)throws Exception{
  var storage=new DocumentStorageService(root.toString(),15*1024*1024);var file=new MockMultipartFile("file","Unusual laboratory export.data","application/octet-stream",pdf(new String[]{"No laboratory values are supplied."}));var stored=storage.store(UUID.randomUUID(),UUID.randomUUID(),"OTHER_CLINICAL_DOCUMENT",file);assertEquals("application/pdf",stored.mimeType());assertEquals(file.getOriginalFilename(),stored.originalFileName());assertTrue(storage.resource(stored.storageKey()).exists());
 }
 @Test void fakePdfAndActiveJavaScriptAreRejectedBeforePersistence()throws Exception{
  assertThrows(ApiException.class,()->ClinicalPdfFileValidation.validate("%PDF-not-a-real-document".getBytes()));
  try(var document=new PDDocument();var output=new ByteArrayOutputStream()){document.addPage(new PDPage());document.getDocumentCatalog().setOpenAction(new PDActionJavaScript("app.alert('unsafe');"));document.save(output);assertThrows(ApiException.class,()->ClinicalPdfFileValidation.validate(output.toByteArray()));}
 }
 @Test void syntheticIdentityExceptionRequiresStoredMarkersAndKeepsOriginalIdentifiers()throws Exception{
  var sql=mock(SqlSupport.class);var access=mock(ClinicalPatientAccess.class);var docs=mock(PatientDocumentService.class);var patient=UUID.randomUUID();var actor=new GovCarePrincipal(UUID.randomUUID(),UUID.randomUUID(),null,null,"qa@govcare.test","QA","doctor",Set.of("*"),true,false,1);
  when(access.clinicalScope(actor,patient,false)).thenReturn(actor);when(sql.required(contains("select patient_no,nic,full_name"),anyMap(),anyString())).thenReturn(Map.of("patient_no","SELECTED-1","full_name","Selected person"));
  var mapper=new ObjectMapper();var service=new ClinicalPdfImportService(sql,new JsonSupport(mapper),access,new ClinicalPdfExtractionService(new LocalPdfExtractionService()),docs,new ClinicalPersistenceService(sql,new JsonSupport(mapper),access));var file=new MockMultipartFile("file","different person.pdf","application/pdf",pdf(new String[]{"Patient: Another person","Patient ID: SOURCE-999","Hemoglobin 10.8 g/dL"}));
  var strict=service.preview(actor,patient,file);assertEquals("PATIENT_MISMATCH",strict.get("status"));assertEquals(0,strict.get("detectedCount"));
  when(sql.one(contains("risk_flags @>"),anyMap())).thenReturn(Optional.of(Map.of("synthetic",true)));
  var test=service.preview(actor,patient,file);assertEquals("TEST_DOCUMENT",test.get("documentClassification"));assertEquals("MISMATCH",test.get("identityStatus"));assertEquals(1,test.get("detectedCount"));assertEquals("SOURCE-999",((Map<?,?>)test.get("patientIdentity")).get("patientNumber"));verify(sql,never()).update(contains("insert into clinical_observations"),anyMap());
 }
 @Test void fixturesForRealApiVerification()throws Exception{
  Path folder=Path.of("../verification/pdf-workflow-v59/fixtures");Files.createDirectories(folder);
  Files.write(folder.resolve("01_mismatched_renal.pdf"),pdf(new String[]{"Patient: Source report person","Patient ID: SOURCE-999","Collection: 2026-10-20T08:30:00+05:30","Hemoglobin 10.8 g/dL","Serum Creatinine 3.4 mg/dL","Potassium 5.2 mmol/L"}));
  Files.write(folder.resolve("02_cbc_only.pdf"),pdf(new String[]{"Hemoglobin 10.8 g/dL","PCV 32 %","RBC 3.9 10^12/L","WBC 6.5 10^9/L","Platelets 180 10^9/L"}));
  Files.write(folder.resolve("03_creatinine_only.pdf"),pdf(new String[]{"Creatinine 3.4 mg/dL"}));
  Files.write(folder.resolve("04_missing_dates.pdf"),pdf(new String[]{"Serum Creatinine 1.4 mg/dL","Hemoglobin 13 g/dL","Potassium 4.6 mmol/L"}));
  Files.write(folder.resolve("05_unsupported_only.pdf"),pdf(new String[]{"CRP 9 mg/L","ALT 30 U/L"}));
  Files.write(folder.resolve("06_multi_page.pdf"),pdf(new String[]{"Hemoglobin 10.8 g/dL","WBC 6.5 10^9/L"},new String[]{"Serum Creatinine 3.4 mg/dL","Sodium 140 mmol/L","Serum Albumin 4 g/dL"}));
  try(var document=new PDDocument();var output=new ByteArrayOutputStream()){var page=new PDPage();document.addPage(page);var image=new BufferedImage(700,900,BufferedImage.TYPE_INT_RGB);var drawing=image.createGraphics();drawing.setColor(java.awt.Color.WHITE);drawing.fillRect(0,0,700,900);drawing.setColor(java.awt.Color.BLACK);drawing.setFont(new java.awt.Font("SansSerif",java.awt.Font.PLAIN,24));drawing.drawString("SYNTHETIC QA SCANNED REPORT",30,50);drawing.drawString("Hemoglobin 10.8 g/dL",30,120);drawing.dispose();try(var stream=new PDPageContentStream(document,page)){stream.drawImage(LosslessFactory.createFromImage(document,image),20,20,550,720);}document.save(output);Files.write(folder.resolve("07_image_only.pdf"),output.toByteArray());}
  Files.write(folder.resolve("08_fake.pdf"),"This is not PDF content.".getBytes());
  try(var document=new PDDocument();var output=new ByteArrayOutputStream()){document.addPage(new PDPage());document.getDocumentCatalog().setOpenAction(new PDActionJavaScript("app.alert('test');"));document.save(output);Files.write(folder.resolve("09_active_script.pdf"),output.toByteArray());}
  Files.write(folder.resolve("10_dialysis_pair.pdf"),pdf(new String[]{"Pre-HD Urea 20 mmol/L","Post-HD Urea 7 mmol/L"}));
 }
 @Test void protectedPagePreviewRendersActualPdfAndRejectsUnknownPages()throws Exception{
  var access=mock(ClinicalPatientAccess.class);var documents=mock(PatientDocumentService.class);var actor=ClinicalTestLibraryAccessTest.actor();var patient=UUID.randomUUID();var document=UUID.randomUUID();
  when(access.clinicalScope(actor,patient,false)).thenReturn(actor);when(documents.content(actor,patient,document,false,false)).thenReturn(new PatientDocumentService.DocumentContent(Map.of("mimeType","application/pdf"),new org.springframework.core.io.ByteArrayResource(pdf(new String[]{"Hemoglobin 10.8 g/dL"}))));
  var imports=new ClinicalPdfImportService(mock(SqlSupport.class),new JsonSupport(new ObjectMapper()),access,mock(ClinicalPdfExtractionService.class),documents,mock(ClinicalPersistenceService.class));
  var rendered=imports.previewPage(actor,patient,document,1);assertEquals(patient.toString(),rendered.get("patientId"));assertEquals(1,rendered.get("totalPages"));byte[] bytes=Base64.getDecoder().decode(rendered.get("imageBase64").toString());assertNotNull(javax.imageio.ImageIO.read(new ByteArrayInputStream(bytes)));assertThrows(ApiException.class,()->imports.previewPage(actor,patient,document,2));
 }
 @Test void pagePreviewChecksPatientAuthorizationBeforeReadingBytes(){var actor=ClinicalTestLibraryAccessTest.actor();var patient=UUID.randomUUID();var access=mock(ClinicalPatientAccess.class);var documents=mock(PatientDocumentService.class);when(access.clinicalScope(actor,patient,false)).thenThrow(ApiException.forbidden("denied"));var imports=new ClinicalPdfImportService(mock(SqlSupport.class),new JsonSupport(new ObjectMapper()),access,mock(ClinicalPdfExtractionService.class),documents,mock(ClinicalPersistenceService.class));assertThrows(ApiException.class,()->imports.previewPage(actor,patient,UUID.randomUUID(),1));verifyNoInteractions(documents);}
}
