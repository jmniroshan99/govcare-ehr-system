package lk.gov.health.govcare.ai;
import lk.gov.health.govcare.security.CurrentUser;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import java.util.UUID;
import java.io.IOException;
@RestController @RequestMapping("/api/ai-cdss/pdf/patients/{patient}/test-library")
public class ClinicalTestDocumentController {
 private final ClinicalTestDocumentLibrary library;private final CurrentUser current;
 public ClinicalTestDocumentController(ClinicalTestDocumentLibrary library,CurrentUser current){this.library=library;this.current=current;}
 @GetMapping public ResponseEntity<?> list(@PathVariable UUID patient){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(library.list(current.get(),patient));}
 @GetMapping("/{fixture}/content")public ResponseEntity<byte[]> content(@PathVariable UUID patient,@PathVariable String fixture)throws IOException{return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.APPLICATION_PDF).body(library.content(current.get(),patient,fixture));}
 @PostMapping("/{fixture}/use")public ResponseEntity<?> use(@PathVariable UUID patient,@PathVariable String fixture)throws IOException{return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(library.use(current.get(),patient,fixture));}
}
