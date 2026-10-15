package lk.gov.health.govcare.workflow;
import lk.gov.health.govcare.security.CurrentUser;
import org.springframework.http.*;import org.springframework.security.access.prepost.PreAuthorize;import org.springframework.web.bind.annotation.*;import java.util.Map;
@RestController @RequestMapping("/api/appointments")
public class AppointmentController{private final AppointmentService s;private final CurrentUser c;public AppointmentController(AppointmentService s,CurrentUser c){this.s=s;this.c=c;}
@GetMapping("/reference") @PreAuthorize("hasAuthority('APPOINTMENT_VIEW') or hasAuthority('QUEUE_VIEW')") public Map<String,Object> reference(){return s.reference(c.get());}
@GetMapping @PreAuthorize("hasAuthority('APPOINTMENT_VIEW')") public Map<String,Object> list(@RequestParam(required=false)String status,@RequestParam(required=false)String date,@RequestParam(required=false)String search){return Map.of("items",s.list(c.get(),status,date,search));}
@PostMapping @PreAuthorize("hasAuthority('APPOINTMENT_CREATE')") public ResponseEntity<Map<String,Object>> create(@RequestBody Map<String,Object> in){return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("appointment",s.create(c.get(),in)));}
@PatchMapping("/{id}/check-in") @PreAuthorize("hasAuthority('QUEUE_MANAGE')") public Map<String,Object> check(@PathVariable String id){return s.checkIn(c.get(),id);}
@PatchMapping("/{id}/status") @PreAuthorize("hasAuthority('APPOINTMENT_UPDATE')") public Map<String,Object> status(@PathVariable String id,@RequestBody Map<String,Object> in){return Map.of("appointment",s.status(c.get(),id,in));}}
