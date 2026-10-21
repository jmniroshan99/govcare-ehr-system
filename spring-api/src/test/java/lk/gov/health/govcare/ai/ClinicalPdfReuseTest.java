package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import lk.gov.health.govcare.common.*;
import lk.gov.health.govcare.documents.*;
import lk.gov.health.govcare.security.*;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import java.nio.file.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class ClinicalPdfReuseTest {
 private final UUID patient=UUID.randomUUID(),hospital=UUID.randomUUID(),user=UUID.randomUUID();
 private final GovCarePrincipal actor=new GovCarePrincipal(user,hospital,null,null,"qa@govcare.test","Synthetic QA","doctor",Set.of("*"),true,false,1);
 private final SqlSupport sql=mock(SqlSupport.class);private final ClinicalPatientAccess access=mock(ClinicalPatientAccess.class);private final PatientDocumentService documents=mock(PatientDocumentService.class);
 private final ObjectMapper mapper=new ObjectMapper();
 private ClinicalPdfImportService service(){when(access.clinicalScope(actor,patient,false)).thenReturn(actor);when(access.clinicalScope(actor,patient,true)).thenReturn(actor);when(sql.required(contains("select patient_no,nic,full_name"),anyMap(),anyString())).thenReturn(Map.of("patient_no","TEST-PAT-001","full_name","TEST PATIENT"));return new ClinicalPdfImportService(sql,new JsonSupport(mapper),access,new ClinicalPdfExtractionService(new LocalPdfExtractionService()),documents,new ClinicalPersistenceService(sql,new JsonSupport(mapper),access));}
 private MockMultipartFile fixture(String name)throws Exception{var bytes=Files.readAllBytes(Path.of("../verification/pdf-reuse-v57/fixtures",name));var text=new LocalPdfExtractionService().extract(bytes).pages().stream().map(LocalPdfExtractionService.PageText::text).reduce("",(a,b)->a+"\n"+b);Files.writeString(Path.of("../verification/pdf-reuse-v57",name+".txt"),text);return new MockMultipartFile("file",name,"application/pdf",bytes);}
 @Test void providedFivePdfsAreReadIndependentlyAndNoClinicalWritesOccur()throws Exception{
  var files=new ArrayList<org.springframework.web.multipart.MultipartFile>();var evidence=new LinkedHashMap<String,Object>();
  for(String name:List.of("01_full_ckd_text_report.pdf","02_partial_ckd_text_report.pdf","03_unit_conversion_and_unrecognized_report.pdf","04_image_only_scanned_ckd_report.pdf","05_no_ckd_values_report.pdf"))files.add(fixture(name));
  var output=service().previewMultiple(actor,patient,files);var reports=(List<Map<String,Object>>)output.get("reports");assertEquals(5,reports.size());
  for(int i=0;i<reports.size();i++){var r=reports.get(i);evidence.put(files.get(i).getOriginalFilename(),r);}
  Path out=Path.of("../verification/pdf-reuse-v57/extraction-fixtures.json");Files.writeString(out,mapper.writerWithDefaultPrettyPrinter().writeValueAsString(evidence));
  var first=(Map<String,Object>)reports.get(0).get("extractedValues");assertEquals(7,first.size());assertTrue(first.containsKey("SerumCreatinine"));assertTrue(first.containsKey("GFR"));assertTrue(first.containsKey("HbA1c"));assertFalse(first.containsKey("Edema"));assertFalse(first.containsKey("NSAIDsUse"));
  assertEquals("2026-09-28",((Map<?,?>)reports.get(0).get("reportDates")).get("reportDate"));assertFalse(((Map<?,?>)first.get("GFR")).containsKey("clinicalDate"));
  assertEquals(13.8,((Number)((Map<?,?>)((Map<?,?>)reports.get(4).get("extractedValues")).get("HemoglobinLevels")).get("value")).doubleValue());
  assertEquals("OCR_REQUIRED",reports.get(3).get("status"));assertEquals(0,reports.get(3).get("detectedCount"));
  var alternate=(Map<String,Map<String,Object>>)reports.get(2).get("extractedValues");assertEquals("mg/dL",alternate.get("SerumCreatinine").get("unit"));assertEquals(1.403,((Number)alternate.get("SerumCreatinine").get("value")).doubleValue(),.001);assertEquals(48,((Number)alternate.get("GFR").get("value")).intValue());assertFalse(alternate.containsKey("CRP"));assertFalse(alternate.containsKey("ALT"));
  verify(sql,never()).required(contains("insert into clinical_reports"),anyMap(),anyString());verify(sql,never()).update(contains("insert into clinical_observations"),anyMap());verify(sql,never()).update(contains("insert into fhir_resource"),anyMap());verify(documents,never()).upload(any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any());
 }
 @Test void repeatedDuplicatePreviewUsesStableReferencesWithoutPersistence()throws Exception{
  var report=UUID.randomUUID();var document=UUID.randomUUID();when(sql.one(contains("from clinical_reports"),anyMap())).thenReturn(Optional.of(Map.of("id",report,"patient_document_id",document,"version",1)));when(documents.get(actor,patient,document)).thenReturn(Map.of("id",document.toString(),"mimeType","application/pdf"));
  var service=service();for(int i=0;i<3;i++){var result=service.preview(actor,patient,fixture("01_full_ckd_text_report.pdf"));assertEquals(true,result.get("duplicate"));assertEquals(report.toString(),result.get("clinicalReportId"));assertTrue(((Number)result.get("detectedCount")).intValue()>0);}
  verify(sql,never()).update(contains("insert into clinical_observations"),anyMap());verify(sql,never()).required(contains("insert into clinical_reports"),anyMap(),anyString());
 }
 @Test void malformedFileDoesNotDiscardOtherPdfResults()throws Exception{
  var bad=new MockMultipartFile("file","broken.pdf","application/pdf","not a PDF".getBytes());
  var result=service().previewMultiple(actor,patient,List.of(bad,fixture("02_partial_ckd_text_report.pdf")));
  var rows=(List<Map<String,Object>>)result.get("reports");assertEquals("EXTRACTION_FAILED",rows.getFirst().get("status"));assertTrue(((Number)rows.getLast().get("detectedCount")).intValue()>0);
 }
 @Test void authorizationPrecedesFileReadOrDatabaseQueries()throws Exception{
  var service=service();when(access.clinicalScope(actor,patient,false)).thenThrow(ApiException.forbidden("Denied"));
  assertThrows(ApiException.class,()->service.preview(actor,patient,fixture("01_full_ckd_text_report.pdf")));verifyNoInteractions(sql,documents);
 }
 @Test void protectedPreviewPreservesPdfBytesAndChecksPatientBeforeDocumentAccess()throws Exception{
  var service=service();var document=UUID.randomUUID();var file=fixture("01_full_ckd_text_report.pdf");
  when(documents.content(actor,patient,document,false,false)).thenReturn(new PatientDocumentService.DocumentContent(Map.of("mimeType","application/pdf","originalFileName",file.getOriginalFilename()),new org.springframework.core.io.ByteArrayResource(file.getBytes())));
  var preview=service.previewContent(actor,patient,document);assertArrayEquals(file.getBytes(),Base64.getDecoder().decode(preview.get("contentBase64").toString()));assertEquals(patient.toString(),preview.get("patientId"));assertEquals(document.toString(),preview.get("documentId"));
  clearInvocations(documents);when(access.clinicalScope(actor,patient,false)).thenThrow(ApiException.forbidden("Denied"));assertThrows(ApiException.class,()->service.previewContent(actor,patient,document));verifyNoInteractions(documents);
 }
 @Test void savingDuplicateRequiresIdentityReviewAndDoesNotAddResources()throws Exception{
  var service=service();assertThrows(ApiException.class,()->service.save(actor,patient,fixture("01_full_ckd_text_report.pdf"),null,false,null,null));
  var report=UUID.randomUUID();when(sql.one(contains("from clinical_reports"),anyMap())).thenReturn(Optional.of(Map.of("id",report,"version",1)));
  var result=service.save(actor,patient,fixture("01_full_ckd_text_report.pdf"),null,true,null,null);assertEquals(true,result.get("duplicate"));assertEquals(report.toString(),result.get("clinicalReportId"));
  verify(sql).required(contains("pg_advisory_xact_lock"),anyMap(),anyString());verify(sql,never()).update(contains("insert into clinical_observations"),anyMap());verify(sql,never()).update(contains("insert into fhir_resource"),anyMap());
 }
 @Test void printedPatientMismatchBlocksAssociationEvenAfterCheckboxConfirmation()throws Exception{
  var service=service();when(sql.required(contains("select patient_no,nic,full_name"),anyMap(),anyString())).thenReturn(Map.of("patient_no","ANOTHER-PATIENT","full_name","Different patient"));
  var read=service.preview(actor,patient,fixture("01_full_ckd_text_report.pdf"));assertEquals("PATIENT_MISMATCH",read.get("status"));assertEquals(0,read.get("detectedCount"));
  assertThrows(ApiException.class,()->service.save(actor,patient,fixture("01_full_ckd_text_report.pdf"),null,true,null,null));verify(sql,never()).required(contains("insert into clinical_reports"),anyMap(),anyString());
 }
 @Test void qualifiedNumbersAndMissingUnitsNeverBecomeExactMeasurements()throws Exception{
  byte[] bytes;
  try(var document=new org.apache.pdfbox.pdmodel.PDDocument();var output=new java.io.ByteArrayOutputStream()){
   var page=new org.apache.pdfbox.pdmodel.PDPage();document.addPage(page);
   try(var content=new org.apache.pdfbox.pdmodel.PDPageContentStream(document,page)){
    content.beginText();content.setFont(new org.apache.pdfbox.pdmodel.font.PDType1Font(org.apache.pdfbox.pdmodel.font.Standard14Fonts.FontName.HELVETICA),12);content.newLineAtOffset(48,740);
    for(String line:List.of("SYNTHETIC SOFTWARE QA","eGFR >=60 mL/min/1.73m2","Serum Creatinine: 1.4","Hemoglobin: 138 g/L")){content.showText(line);content.newLineAtOffset(0,-22);}content.endText();
   }document.save(output);bytes=output.toByteArray();
  }
  var read=new ClinicalPdfExtractionService(new LocalPdfExtractionService()).extract(bytes,"UPLOADED_PDF");var values=(Map<?,?>)read.get("extractedValues");assertFalse(values.containsKey("GFR"));assertFalse(values.containsKey("SerumCreatinine"));assertEquals(13.8,((Number)((Map<?,?>)values.get("HemoglobinLevels")).get("value")).doubleValue());
 }
 @Test void reviewedRevisionStoresSourceProvenanceWithoutLaboratoryObservations()throws Exception{
  byte[] bytes;
  try(var document=new org.apache.pdfbox.pdmodel.PDDocument();var output=new java.io.ByteArrayOutputStream()){
   var page=new org.apache.pdfbox.pdmodel.PDPage();document.addPage(page);
   try(var content=new org.apache.pdfbox.pdmodel.PDPageContentStream(document,page)){
    content.beginText();content.setFont(new org.apache.pdfbox.pdmodel.font.PDType1Font(org.apache.pdfbox.pdmodel.font.Standard14Fonts.FontName.HELVETICA),12);content.newLineAtOffset(48,740);
    for(String line:List.of("SYNTHETIC SOFTWARE QA - NOT FOR CLINICAL USE","Patient ID: TEST-PAT-001","Report Date: 28/09/2026","Reviewed correction: serum creatinine transcription","Serum Creatinine: 1.55 mg/dL")){content.showText(line);content.newLineAtOffset(0,-22);}content.endText();
   }document.save(output);bytes=output.toByteArray();
  }
  Files.write(Path.of("../verification/pdf-reuse-v57/reviewed-correction.pdf"),bytes);
  var service=service();UUID previous=UUID.randomUUID(),report=UUID.randomUUID(),doc=UUID.randomUUID();
  when(sql.required(contains("select version,sha256_hash"),anyMap(),anyString())).thenReturn(Map.of("version",1));
  when(sql.required(contains("insert into clinical_reports"),anyMap(),anyString())).thenReturn(Map.of("id",report.toString()));
  when(documents.upload(any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any())).thenReturn(Map.of("id",doc.toString()));
  when(documents.get(actor,patient,doc)).thenReturn(Map.of("fileSizeBytes",(long)bytes.length));
  var saved=service.save(actor,patient,new MockMultipartFile("file","01_full_ckd_text_report.pdf","application/pdf",bytes),null,true,previous,"Reviewed correction of a synthetic transcription");
  assertEquals(2,saved.get("version"));assertEquals(false,saved.get("duplicate"));
  var statements=org.mockito.ArgumentCaptor.forClass(String.class);var parameters=org.mockito.ArgumentCaptor.forClass(Map.class);verify(sql,atLeastOnce()).update(statements.capture(),parameters.capture());
  var parser=ca.uhn.fhir.context.FhirContext.forR4Cached().newJsonParser();int resources=0;
  for(int i=0;i<statements.getAllValues().size();i++)if(statements.getAllValues().get(i).contains("insert into fhir_resource")){
   var data=parameters.getAllValues().get(i);var parsed=parser.parseResource(data.get("body").toString());assertTrue(Set.of("DocumentReference","Provenance").contains(parsed.fhirType()));resources++;
   if(parsed instanceof org.hl7.fhir.r4.model.DocumentReference reference){assertEquals(org.hl7.fhir.r4.model.DocumentReference.ReferredDocumentStatus.PRELIMINARY,reference.getDocStatus());assertEquals("DocumentReference/clinical-report-"+previous,reference.getRelatesToFirstRep().getTarget().getReference());}
  }
  assertEquals(2,resources);verify(sql,never()).update(contains("insert into clinical_observations"),anyMap());
 }
}
