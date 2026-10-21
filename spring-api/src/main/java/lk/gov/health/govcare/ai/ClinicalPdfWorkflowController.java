package lk.gov.health.govcare.ai;
import lk.gov.health.govcare.security.CurrentUser;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.*;
import java.io.IOException;

@RestController @RequestMapping("/api/ai-cdss/pdf")
public class ClinicalPdfWorkflowController {
 private final ClinicalPdfImportService imports;private final ClinicalPdfVerificationService verification;private final CurrentUser current;
 public ClinicalPdfWorkflowController(ClinicalPdfImportService imports,ClinicalPdfVerificationService verification,CurrentUser current){this.imports=imports;this.verification=verification;this.current=current;}
 @GetMapping("/patients/{patient}/context") public ResponseEntity<?> context(@PathVariable UUID patient){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(imports.context(current.get(),patient));}
 @GetMapping("/patients/{patient}/documents/{document}/preview-page")public ResponseEntity<?> page(@PathVariable UUID patient,@PathVariable UUID document,@RequestParam(defaultValue="1")int page)throws IOException{return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(imports.previewPage(current.get(),patient,document,page));}
 @PostMapping(value="/patients/{patient}/upload",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) public ResponseEntity<?> upload(@PathVariable UUID patient,@RequestParam MultipartFile file)throws IOException{return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(imports.upload(current.get(),patient,file));}
 @PostMapping("/patients/{patient}/reports/{report}/verify") public ResponseEntity<?> verify(@PathVariable UUID patient,@PathVariable UUID report,@RequestBody ClinicalPdfVerificationService.Request request)throws IOException{return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(verification.verify(current.get(),patient,report,request));}
}
