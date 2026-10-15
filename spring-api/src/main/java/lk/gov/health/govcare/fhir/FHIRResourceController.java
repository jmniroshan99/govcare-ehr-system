package lk.gov.health.govcare.fhir;

import lk.gov.health.govcare.security.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/fhir")
public class FHIRResourceController {
    private final FHIRResourceManager resources;
    private final CurrentUser current;

    public FHIRResourceController(FHIRResourceManager resources, CurrentUser current) {
        this.resources = resources;
        this.current = current;
    }

    @GetMapping(value = "/{type}/{id}", produces = "application/fhir+json")
    @PreAuthorize("hasAuthority('PATIENT_VIEW_CLINICAL')")
    public ResponseEntity<String> get(@PathVariable String type, @PathVariable String id) {
        return ResponseEntity.ok(resources.read(current.get(), type, id));
    }

    @PostMapping(value = "/{type}", consumes = {"application/json", "application/fhir+json"}, produces = "application/json")
    @PreAuthorize("hasAnyAuthority('CONSULTATION_CREATE','CONSULTATION_UPDATE')")
    public Map<String, Object> post(@PathVariable String type, @RequestBody String json) {
        return resources.validateAndStore(current.get(), type, null, json);
    }

    @PutMapping(value = "/{type}/{id}", consumes = {"application/json", "application/fhir+json"})
    @PreAuthorize("hasAnyAuthority('CONSULTATION_CREATE','CONSULTATION_UPDATE')")
    public Map<String, Object> put(@PathVariable String type, @PathVariable String id, @RequestBody String json) {
        return resources.validateAndStore(current.get(), type, id, json);
    }

    @DeleteMapping("/{type}/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('CONSULTATION_UPDATE')")
    public void delete(@PathVariable String type, @PathVariable String id) {
        resources.delete(current.get(), type, id);
    }
}
