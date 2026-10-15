package lk.gov.health.govcare.workflow;
import lk.gov.health.govcare.security.CurrentUser;import org.springframework.http.*;import org.springframework.security.access.prepost.PreAuthorize;import org.springframework.web.bind.annotation.*;import java.util.Map;
@RestController @RequestMapping("/api/prescriptions")
public class PrescriptionController{private final PrescriptionService s;private final CurrentUser c;public PrescriptionController(PrescriptionService s,CurrentUser c){this.s=s;this.c=c;}
@GetMapping("/medicines") @PreAuthorize("hasAuthority('PRESCRIPTION_VIEW') or hasAuthority('PRESCRIPTION_CREATE')") public Map<String,Object> medicines(){return Map.of("items",s.medicines(c.get()));}
@GetMapping @PreAuthorize("hasAuthority('PRESCRIPTION_VIEW')") public Map<String,Object> list(@RequestParam(required=false)String status,@RequestParam(required=false)String patientUuid){return Map.of("items",s.list(c.get(),status,patientUuid,null));}
@GetMapping("/{id}") @PreAuthorize("hasAuthority('PRESCRIPTION_VIEW')") public Map<String,Object> get(@PathVariable String id){return Map.of("prescription",s.get(c.get(),id));}
@PostMapping @PreAuthorize("hasAuthority('PRESCRIPTION_CREATE')") public ResponseEntity<Map<String,Object>> create(@RequestBody Map<String,Object>in){return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("prescription",s.create(c.get(),in)));}
@PatchMapping("/{id}/sign") @PreAuthorize("hasAuthority('PRESCRIPTION_SIGN')") public Map<String,Object> sign(@PathVariable String id,@RequestBody Map<String,Object>in){return Map.of("prescription",s.sign(c.get(),id,in));}
@PatchMapping("/{id}/send-pharmacy") @PreAuthorize("hasAuthority('PRESCRIPTION_SIGN')") public Map<String,Object> send(@PathVariable String id){return Map.of("prescription",s.send(c.get(),id));}
@PatchMapping("/{id}/pharmacy-status") @PreAuthorize("hasAuthority('PRESCRIPTION_VERIFY')") public Map<String,Object> status(@PathVariable String id,@RequestBody Map<String,Object>in){return Map.of("prescription",s.pharmacyStatus(c.get(),id,in));}}
