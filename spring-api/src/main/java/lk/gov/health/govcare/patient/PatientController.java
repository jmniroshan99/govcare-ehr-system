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
    private final NetworkPatientDirectory network;

    public PatientController(PatientService service, CurrentUser current, NetworkPatientDirectory network) {
        this.service=service; this.current=current; this.network=network;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PATIENT_VIEW') or hasAuthority('PATIENT_VIEW_SELF')")
    public Map<String,Object> list(@RequestParam(required=false) String search,
                                   @RequestParam(required=false) UUID wardId,
                                   @RequestParam(required=false) UUID hospitalId,
                                   @RequestParam(defaultValue="0") int page,
                                   @RequestParam(defaultValue="50") int pageSize) {
        var actor = current.get();
        if ("super_admin".equals(actor.role())) return network.browse(actor, search, hospitalId, wardId, page, pageSize, false);
        if (hospitalId != null && !hospitalId.equals(actor.hospitalId()))
            throw lk.gov.health.govcare.common.ApiException.forbidden("You cannot view another hospital's patients.");
        return Map.of("items", service.list(actor, search, wardId));
    }

    @GetMapping("/hospitals")
    @PreAuthorize("hasAuthority('PATIENT_VIEW')")
    public Map<String,Object> hospitals() { return Map.of("items", network.hospitals(current.get())); }

    @GetMapping("/identification-wards")
    @PreAuthorize("hasAuthority('PATIENT_VIEW')")
    public Map<String,Object> identificationWards(@RequestParam(required=false) UUID hospitalId) {
        return Map.of("items", service.identificationWards(current.get(), hospitalId));
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
