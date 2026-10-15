package lk.gov.health.govcare.ai;

import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.documents.PatientDocumentService;
import lk.gov.health.govcare.security.CurrentUser;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.security.MessageDigest;
import java.util.*;
import java.util.HexFormat;

@RestController @RequestMapping("/api/ai-cdss/pdf")
public class ClinicalPdfExtractionController {
 private final ClinicalPdfExtractionService extraction; private final MultiReportClinicalExtractionService multi; private final PatientDocumentService documents; private final ClinicalPersistenceService persistence; private final CurrentUser current; private final lk.gov.health.govcare.security.ClinicalPatientAccess access;
 public ClinicalPdfExtractionController(ClinicalPdfExtractionService e,MultiReportClinicalExtractionService m,PatientDocumentService d,ClinicalPersistenceService p,CurrentUser c,lk.gov.health.govcare.security.ClinicalPatientAccess access){extraction=e;multi=m;documents=d;persistence=p;current=c;this.access=access;}
 @PostMapping(value="/extract",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
 public Map<String,Object> upload(@RequestParam MultipartFile file,@RequestParam UUID patientId) throws IOException {
  GovCarePrincipal a=access.clinicalScope(current.get(),patientId,true); if(file==null||file.isEmpty())throw ApiException.badRequest("Select a PDF report first.");
  String ct=Objects.toString(file.getContentType(),""); if(!ct.isBlank()&&!ct.equalsIgnoreCase(MediaType.APPLICATION_PDF_VALUE))throw ApiException.badRequest("Only PDF clinical reports are supported.");
  String checksum=sha256(file.getBytes()); if(persistence.existsChecksum(a,patientId,checksum))throw ApiException.conflict("This clinical report has already been saved for the selected patient.");
  Map<String,Object> savedDoc=documents.upload(a,patientId,file,"OTHER_CLINICAL_DOCUMENT",Objects.toString(file.getOriginalFilename(),"Clinical report"),"AI-CDSS clinical source report","SUBMITTED","CARE_TEAM",null,null,null,null,null,null);
  UUID documentId=UUID.fromString(String.valueOf(savedDoc.get("id")));
  Map<String,Object> out=new LinkedHashMap<>(extraction.extract(file.getBytes(),"UPLOADED_PDF"));
  UUID reportId=persistence.persistExtraction(a,patientId,documentId,Objects.toString(file.getOriginalFilename(),"clinical-report.pdf"),"LOCAL_UPLOAD",Objects.toString(savedDoc.get("sha256Checksum"),null),file.getSize(),out);
  out.put("patientId",patientId.toString());out.put("clinicalReportId",reportId.toString());out.put("report",savedDoc);return out;
 }
 @PostMapping(value="/extract-multiple",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
 public Map<String,Object> uploadMultiple(@RequestParam("files") List<MultipartFile> files,@RequestParam UUID patientId) throws IOException {
  GovCarePrincipal a=access.clinicalScope(current.get(),patientId,true);
  if(files==null||files.isEmpty())throw ApiException.badRequest("Select at least one PDF clinical report.");
  if(files.size()>10)throw ApiException.badRequest("A maximum of 10 reports can be processed in one assessment.");
  List<MultiReportClinicalExtractionService.ReportInput> inputs=new ArrayList<>();
  for(MultipartFile file:files){
   if(file==null||file.isEmpty())continue; String ct=Objects.toString(file.getContentType(),"");
   if(!ct.isBlank()&&!ct.equalsIgnoreCase(MediaType.APPLICATION_PDF_VALUE))throw ApiException.badRequest("Only PDF clinical reports are supported.");
   String checksum=sha256(file.getBytes()); if(persistence.existsChecksum(a,patientId,checksum))throw ApiException.conflict("Clinical report already saved: "+Objects.toString(file.getOriginalFilename(),"report.pdf"));
   Map<String,Object> savedDoc=documents.upload(a,patientId,file,"OTHER_CLINICAL_DOCUMENT",Objects.toString(file.getOriginalFilename(),"Clinical report"),"AI-CDSS clinical source report","SUBMITTED","CARE_TEAM",null,null,null,null,null,null);
   inputs.add(new MultiReportClinicalExtractionService.ReportInput(file.getBytes(),Objects.toString(file.getOriginalFilename(),"clinical-report.pdf"),"UPLOADED_PDF",String.valueOf(savedDoc.get("id"))));
  }
  Map<String,Object> out=new LinkedHashMap<>(multi.extract(inputs));
  @SuppressWarnings("unchecked") List<Map<String,Object>> reports=(List<Map<String,Object>>)out.getOrDefault("reports",List.of());
  for(Map<String,Object> report:reports){UUID documentId=UUID.fromString(String.valueOf(report.get("reportId")));Map<String,Object> doc=documents.get(a,patientId,documentId);UUID clinicalReportId=persistence.persistExtraction(a,patientId,documentId,Objects.toString(report.get("fileName"),"clinical-report.pdf"),"LOCAL_UPLOAD",Objects.toString(doc.get("sha256Checksum"),null),((Number)doc.getOrDefault("fileSizeBytes",0)).longValue(),report);report.put("clinicalReportId",clinicalReportId.toString());}
  out.put("patientId",patientId.toString());return out;
 }
 @PostMapping("/patients/{patientId}/documents/{documentId}/extract")
 public Map<String,Object> existing(@PathVariable UUID patientId,@PathVariable UUID documentId) throws IOException {
  GovCarePrincipal a=access.clinicalScope(current.get(),patientId,true); PatientDocumentService.DocumentContent content=documents.content(a,patientId,documentId,false,false);
  String mime=Objects.toString(content.document().get("mimeType"),"");if(!mime.equalsIgnoreCase(MediaType.APPLICATION_PDF_VALUE))throw ApiException.badRequest("The selected patient document is not a PDF.");
  try(var in=content.resource().getInputStream()){Map<String,Object>out=new LinkedHashMap<>(extraction.extract(in.readAllBytes(),"EHR_REPORT"));Map<String,Object> doc=content.document();UUID reportId=persistence.persistExtraction(a,patientId,documentId,Objects.toString(doc.get("originalFileName"),Objects.toString(doc.get("fileName"),"ehr-report.pdf")),"EHR_REPORT",Objects.toString(doc.get("sha256Checksum"),null),((Number)doc.getOrDefault("fileSizeBytes",0)).longValue(),out);out.put("patientId",patientId.toString());out.put("clinicalReportId",reportId.toString());out.put("report",doc);return out;}
 }
 private static String sha256(byte[] bytes){try{MessageDigest d=MessageDigest.getInstance("SHA-256");return HexFormat.of().formatHex(d.digest(bytes));}catch(Exception e){throw new IllegalStateException("SHA-256 unavailable",e);}}
}
