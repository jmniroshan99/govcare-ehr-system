package lk.gov.health.govcare.workflow;
import lk.gov.health.govcare.security.CurrentUser;import org.springframework.http.*;import org.springframework.security.access.prepost.PreAuthorize;import org.springframework.web.bind.annotation.*;import java.util.Map;
@RestController @RequestMapping("/api/consultations")
public class ConsultationController{private final ConsultationService s;private final CurrentUser c;public ConsultationController(ConsultationService s,CurrentUser c){this.s=s;this.c=c;}
@GetMapping("/patient/{id}") @PreAuthorize("hasAuthority('CONSULTATION_VIEW')") public Map<String,Object> patient(@PathVariable String id){return Map.of("items",s.patient(c.get(),id));}
@GetMapping("/visit/{id}") @PreAuthorize("hasAuthority('CONSULTATION_VIEW')") public Map<String,Object> visit(@PathVariable String id){return Map.of("consultation",s.byVisit(c.get(),id));}
@GetMapping("/{id}") @PreAuthorize("hasAuthority('CONSULTATION_VIEW')") public Map<String,Object> get(@PathVariable String id){return Map.of("consultation",s.get(c.get(),id));}
@PostMapping @PreAuthorize("hasAuthority('CONSULTATION_CREATE')") public ResponseEntity<Map<String,Object>> create(@RequestBody Map<String,Object>in){return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("consultation",s.create(c.get(),in)));}
@PatchMapping("/{id}") @PreAuthorize("hasAuthority('CONSULTATION_UPDATE')") public Map<String,Object> update(@PathVariable String id,@RequestBody Map<String,Object>in){return Map.of("consultation",s.update(c.get(),id,in,false));}
@PatchMapping("/{id}/complete") @PreAuthorize("hasAuthority('CONSULTATION_COMPLETE')") public Map<String,Object> complete(@PathVariable String id,@RequestBody Map<String,Object>in){return Map.of("consultation",s.update(c.get(),id,in,true));}}
