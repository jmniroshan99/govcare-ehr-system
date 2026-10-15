package lk.gov.health.govcare.workflow;
import lk.gov.health.govcare.security.CurrentUser;import org.springframework.security.access.prepost.PreAuthorize;import org.springframework.web.bind.annotation.*;import java.util.Map;
@RestController @RequestMapping("/api/pharmacy")
public class PharmacyController{private final PrescriptionService s;private final CurrentUser c;public PharmacyController(PrescriptionService s,CurrentUser c){this.s=s;this.c=c;}
@GetMapping("/prescriptions") @PreAuthorize("hasAnyRole('SUPER_ADMIN','HOSPITAL_ADMIN','PHARMACIST') and hasAuthority('PRESCRIPTION_VIEW')") public Map<String,Object> list(@RequestParam(required=false)String status){return Map.of("items",s.list(c.get(),status,null,"pharmacy"));}
@PatchMapping("/prescriptions/{id}/verify") @PreAuthorize("hasAuthority('PRESCRIPTION_VERIFY')") public Map<String,Object> verify(@PathVariable String id,@RequestBody Map<String,Object>in){return Map.of("prescription",s.verify(c.get(),id,in));}
@PatchMapping("/prescriptions/{id}/dispense") @PreAuthorize("hasAuthority('PRESCRIPTION_DISPENSE')") public Map<String,Object> dispense(@PathVariable String id,@RequestBody Map<String,Object>in){return s.dispense(c.get(),id,in);}}
