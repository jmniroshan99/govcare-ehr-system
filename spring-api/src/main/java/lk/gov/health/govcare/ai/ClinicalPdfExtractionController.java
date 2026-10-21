package lk.gov.health.govcare.ai;
import lk.gov.health.govcare.security.CurrentUser;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.util.*;

@RestController @RequestMapping("/api/ai-cdss/pdf")
public class ClinicalPdfExtractionController {
 private final ClinicalPdfImportService imports;private final CurrentUser current;
 public ClinicalPdfExtractionController(ClinicalPdfImportService imports,CurrentUser current){this.imports=imports;this.current=current;}
 @GetMapping("/patients/{patientId}/reports")
 public Map<String,Object> reports(@PathVariable UUID patientId){return Map.of("items",imports.sources(current.get(),patientId));}
 @PostMapping(value="/extract",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
 public Map<String,Object> upload(@RequestParam MultipartFile file,@RequestParam UUID patientId)throws IOException{return imports.preview(current.get(),patientId,file);}
 @PostMapping(value="/extract-multiple",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
 public Map<String,Object> uploadMultiple(@RequestParam("files") List<MultipartFile> files,@RequestParam UUID patientId){return imports.previewMultiple(current.get(),patientId,files);}
 @PostMapping("/patients/{patientId}/documents/{documentId}/extract")
 public Map<String,Object> existing(@PathVariable UUID patientId,@PathVariable UUID documentId)throws IOException{return imports.previewDocument(current.get(),patientId,documentId);}
 @GetMapping("/patients/{patientId}/documents/{documentId}/preview")
 public org.springframework.http.ResponseEntity<Map<String,Object>> previewContent(@PathVariable UUID patientId,@PathVariable UUID documentId)throws IOException{return org.springframework.http.ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore()).body(imports.previewContent(current.get(),patientId,documentId));}
 @PostMapping(value="/save",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
 public Map<String,Object> save(@RequestParam MultipartFile file,@RequestParam UUID patientId,@RequestParam boolean identityConfirmed,@RequestParam(required=false) UUID replacesReportId,@RequestParam(required=false) String revisionReason)throws IOException{return imports.save(current.get(),patientId,file,null,identityConfirmed,replacesReportId,revisionReason);}
 public record SaveSource(boolean identityConfirmed,UUID replacesReportId,String revisionReason){}
 @PostMapping("/patients/{patientId}/documents/{documentId}/save")
 public Map<String,Object> saveExisting(@PathVariable UUID patientId,@PathVariable UUID documentId,@RequestBody SaveSource body)throws IOException{return imports.save(current.get(),patientId,null,documentId,body.identityConfirmed(),body.replacesReportId(),body.revisionReason());}
}
