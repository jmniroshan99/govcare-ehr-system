package lk.gov.health.govcare.workflow;
import lk.gov.health.govcare.security.CurrentUser;import org.springframework.http.*;import org.springframework.security.access.prepost.PreAuthorize;import org.springframework.web.bind.annotation.*;import java.util.*;
@RestController @RequestMapping("/api/radiology")
public class RadiologyController{private final RadiologyService s;private final CurrentUser c;public RadiologyController(RadiologyService s,CurrentUser c){this.s=s;this.c=c;}
@GetMapping("/orders") @PreAuthorize("hasAuthority('RADIOLOGY_REQUEST_VIEW')") public Map<String,Object> list(@RequestParam(required=false)String status,@RequestParam(required=false)String patientUuid){return Map.of("items",s.list(c.get(),status,patientUuid));}
@PostMapping("/orders") @PreAuthorize("hasAuthority('RADIOLOGY_REQUEST_CREATE')") public ResponseEntity<Map<String,Object>> create(@RequestBody Map<String,Object> in){return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("items",s.create(c.get(),in)));}
@PatchMapping("/orders/{id}/status") @PreAuthorize("hasAuthority('RADIOLOGY_STATUS_UPDATE')") public Map<String,Object> status(@PathVariable String id,@RequestBody Map<String,Object> in){return Map.of("order",s.status(c.get(),id,in));}
@PostMapping("/orders/{id}/report") @PreAuthorize("hasAuthority('RADIOLOGY_RESULT_CREATE')") public ResponseEntity<Map<String,Object>> report(@PathVariable String id,@RequestBody Map<String,Object> in){return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("report",s.report(c.get(),id,in)));}
@PatchMapping("/reports/{id}/verify") @PreAuthorize("hasAuthority('RADIOLOGY_RESULT_VERIFY')") public Map<String,Object> verify(@PathVariable String id,@RequestBody Map<String,Object> in){return Map.of("report",s.verify(c.get(),id,in));}
@PatchMapping("/reports/{id}/review") @PreAuthorize("hasAuthority('RADIOLOGY_RESULT_REVIEW')") public Map<String,Object> review(@PathVariable String id){return Map.of("report",s.review(c.get(),id));}}
