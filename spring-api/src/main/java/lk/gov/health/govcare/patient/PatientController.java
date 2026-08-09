package lk.gov.health.govcare.patient;

import jakarta.validation.Valid;
import lk.gov.health.govcare.security.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/patients")
public class PatientController {
    private final PatientService service;
    private final CurrentUser current;

    public PatientController(PatientService service, CurrentUser current) { this.service=service; this.current=current; }

    @GetMapping
    @PreAuthorize("hasAuthority('PATIENT_VIEW') or hasAuthority('PATIENT_VIEW_SELF')")
    public Map<String,Object> list(@RequestParam(required=false) String search,
                                   @RequestParam(required=false) UUID wardId) {
        return Map.of("items", service.list(current.get(), search, wardId));
    }

    @GetMapping("/identification-wards")
    @PreAuthorize("hasAuthority('PATIENT_VIEW')")
    public Map<String,Object> identificationWards() {
        return Map.of("items", service.identificationWards(current.get()));
    }

    @PostMapping("/duplicate-check")
    @PreAuthorize("hasAuthority('PATIENT_CREATE')")
    public Map<String,Object> duplicate(@RequestBody Map<String,Object> input) { return service.duplicateCheck(current.get(), input); }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('PATIENT_VIEW') or hasAuthority('PATIENT_VIEW_SELF')")
    public Map<String,Object> get(@PathVariable String id) { return Map.of("patient", service.get(current.get(), id)); }

    @PostMapping
    @PreAuthorize("hasAuthority('PATIENT_CREATE')")
    public ResponseEntity<Map<String,Object>> create(@RequestBody PatientService.PatientInput input) {
        Map<String,Object> result=service.create(current.get(), input);
        boolean duplicate=Boolean.TRUE.equals(result.get("duplicate"));
        return ResponseEntity.status(duplicate?HttpStatus.OK:HttpStatus.CREATED).body(result);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAuthority('PATIENT_UPDATE_DEMOGRAPHICS')")
    public Map<String,Object> update(@PathVariable String id,@RequestBody Map<String,Object> input) { return service.update(current.get(), id, input); }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('PATIENT_DELETE')")
    public ResponseEntity<Void> delete(@PathVariable String id) { service.delete(current.get(), id); return ResponseEntity.noContent().build(); }

    @PatchMapping("/care-summary")
    @PreAuthorize("hasAuthority('PATIENT_VIEW_SELF')")
    public Map<String,Object> careSummary() { return Map.of("ok", true); }
}
