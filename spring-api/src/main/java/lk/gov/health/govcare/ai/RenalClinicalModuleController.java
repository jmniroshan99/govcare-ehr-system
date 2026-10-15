package lk.gov.health.govcare.ai;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.MediaType;
import lk.gov.health.govcare.security.CurrentUser;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/ai-cdss/ckd/patients/{patientId}/predictive-intelligence")
public class RenalClinicalModuleController {
    private final RenalClinicalModuleService service;private final CurrentUser current;
    public RenalClinicalModuleController(RenalClinicalModuleService service,CurrentUser current){this.service=service;this.current=current;}
    // A dedicated serializer retains contractual nulls despite the application's legacy NON_NULL policy.
    @GetMapping
    public ResponseEntity<String> overview(@PathVariable UUID patientId){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.APPLICATION_JSON).body(service.overview(current.get(),patientId).toString());}
    @PostMapping("/reviews") public ResponseEntity<?> review(@PathVariable UUID patientId,@RequestBody RenalClinicalModuleService.ReviewRequest request){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.review(current.get(),patientId,request));}
}
