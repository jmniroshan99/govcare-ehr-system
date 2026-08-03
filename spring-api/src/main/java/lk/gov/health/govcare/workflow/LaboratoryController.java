package lk.gov.health.govcare.workflow;
import lk.gov.health.govcare.security.CurrentUser;import org.springframework.http.*;import org.springframework.security.access.prepost.PreAuthorize;import org.springframework.web.bind.annotation.*;import java.util.*;
@RestController @RequestMapping("/api/laboratory")
public class LaboratoryController{private final LaboratoryService s;private final CurrentUser c;public LaboratoryController(LaboratoryService s,CurrentUser c){this.s=s;this.c=c;}
@GetMapping("/orders") @PreAuthorize("hasAuthority('LAB_REQUEST_VIEW')") public Map<String,Object> list(@RequestParam(required=false)String status,@RequestParam(required=false)String patientUuid){return Map.of("items",s.list(c.get(),status,patientUuid));}
@PostMapping("/orders") @PreAuthorize("hasAuthority('LAB_REQUEST_CREATE')") public ResponseEntity<Map<String,Object>> create(@RequestBody Map<String,Object> in){return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("items",s.create(c.get(),in)));}
@PatchMapping("/orders/{id}/status") @PreAuthorize("hasAuthority('LAB_SAMPLE_UPDATE')") public Map<String,Object> status(@PathVariable String id,@RequestBody Map<String,Object> in){return Map.of("order",s.status(c.get(),id,in));}
@PostMapping("/orders/{id}/results") @PreAuthorize("hasAuthority('LAB_RESULT_CREATE')") public ResponseEntity<Map<String,Object>> result(@PathVariable String id,@RequestBody Map<String,Object> in){return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("result",s.result(c.get(),id,in)));}
@PatchMapping("/results/{id}/verify") @PreAuthorize("hasAuthority('LAB_RESULT_VERIFY')") public Map<String,Object> verify(@PathVariable String id,@RequestBody Map<String,Object> in){return Map.of("result",s.verify(c.get(),id,in));}
@PatchMapping("/results/{id}/review") @PreAuthorize("hasAuthority('LAB_RESULT_REVIEW')") public Map<String,Object> review(@PathVariable String id){return Map.of("result",s.review(c.get(),id));}}
