package lk.gov.health.govcare.workflow;
import lk.gov.health.govcare.security.CurrentUser;import org.springframework.http.*;import org.springframework.security.access.prepost.PreAuthorize;import org.springframework.web.bind.annotation.*;import java.util.Map;
@RestController @RequestMapping({"/api/doctor-queue","/api/queue"})
public class QueueController{private final QueueService s;private final CurrentUser c;public QueueController(QueueService s,CurrentUser c){this.s=s;this.c=c;}
@GetMapping @PreAuthorize("hasAuthority('QUEUE_VIEW')") public Map<String,Object> list(@RequestParam(required=false)String status){return Map.of("items",s.list(c.get(),status));}
@PostMapping @PreAuthorize("hasAuthority('QUEUE_MANAGE')") public ResponseEntity<Map<String,Object>> create(@RequestBody Map<String,Object>in){return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("queue",s.create(c.get(),in)));}
@PatchMapping("/{id}/assign") @PreAuthorize("hasAuthority('QUEUE_MANAGE')") public Map<String,Object> assign(@PathVariable String id,@RequestBody Map<String,Object>in){return Map.of("queue",s.assign(c.get(),id,in));}
@PatchMapping("/{id}/call") @PreAuthorize("hasAuthority('QUEUE_MANAGE')") public Map<String,Object> call(@PathVariable String id){return Map.of("queue",s.transition(c.get(),id,"call"));}
@PatchMapping("/{id}/recall") @PreAuthorize("hasAuthority('QUEUE_MANAGE')") public Map<String,Object> recall(@PathVariable String id){return Map.of("queue",s.transition(c.get(),id,"recall"));}
@PatchMapping("/{id}/no-show") @PreAuthorize("hasAuthority('QUEUE_MANAGE')") public Map<String,Object> noShow(@PathVariable String id){return Map.of("queue",s.transition(c.get(),id,"no-show"));}
@PatchMapping("/{id}/return-waiting") @PreAuthorize("hasAuthority('QUEUE_MANAGE')") public Map<String,Object> waiting(@PathVariable String id){return Map.of("queue",s.transition(c.get(),id,"return-waiting"));}
@PatchMapping("/{id}/complete") @PreAuthorize("hasAuthority('CONSULTATION_COMPLETE')") public Map<String,Object> complete(@PathVariable String id){return Map.of("queue",s.transition(c.get(),id,"complete"));}
@PatchMapping("/{id}/start") @PreAuthorize("hasAuthority('CONSULTATION_CREATE')") public Map<String,Object> start(@PathVariable String id){return s.start(c.get(),id);}}
