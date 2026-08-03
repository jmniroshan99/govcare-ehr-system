package lk.gov.health.govcare.user;

import lk.gov.health.govcare.security.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserService service; private final CurrentUser current;
    public UserController(UserService service,CurrentUser current){this.service=service;this.current=current;}

    @GetMapping("/departments")
    @PreAuthorize("hasAuthority('DEPARTMENT_VIEW') or hasAuthority('APPOINTMENT_VIEW') or hasAuthority('QUEUE_VIEW')")
    public Map<String,Object> departments(){return Map.of("items",service.departments(current.get()));}

    @GetMapping("/by-auth/{uid}")
    public Map<String,Object> byAuth(@PathVariable String uid){return service.byAuth(current.get(),uid);}

    @GetMapping
    @PreAuthorize("hasAuthority('USER_VIEW')")
    public Map<String,Object> list(@RequestParam(required=false)String search,@RequestParam(required=false)String role,@RequestParam(required=false)String status,@RequestParam(defaultValue="100")int limit){return Map.of("items",service.list(current.get(),search,role,status,limit));}

    @PostMapping
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ResponseEntity<Map<String,Object>> create(@RequestBody Map<String,Object> input){return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("user",service.create(current.get(),input)));}

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('USER_VIEW')")
    public Map<String,Object> detail(@PathVariable String id){return service.detail(current.get(),id);}

    @PatchMapping("/{id}")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public Map<String,Object> update(@PathVariable String id,@RequestBody Map<String,Object> input){return Map.of("user",service.update(current.get(),id,input));}

    @PatchMapping("/{uid}/profile")
    public Map<String,Object> profile(@PathVariable String uid,@RequestBody Map<String,Object> input){return service.updateOwnProfile(current.get(),uid,input);}
}
