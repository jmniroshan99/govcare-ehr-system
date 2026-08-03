package lk.gov.health.govcare.integration;

import lk.gov.health.govcare.audit.AuditService;
import lk.gov.health.govcare.security.CurrentUser;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Compatibility endpoints used by the existing React client while the old Express API is retired.
 * They keep non-critical queued/client integration actions auditable without trusting client identity fields.
 */
@RestController
@RequestMapping("/api")
public class CompatibilityController {
    private final CurrentUser current;
    private final AuditService audit;

    public CompatibilityController(CurrentUser current, AuditService audit) {
        this.current = current;
        this.audit = audit;
    }

    @PatchMapping("/integration/{collection}/{id}")
    public Map<String, Object> integration(@PathVariable String collection,
                                           @PathVariable String id,
                                           @RequestBody(required = false) Map<String, Object> body) {
        GovCarePrincipal actor = current.get();
        audit.record(actor, "integration", "client_sync", collection, null,
                null, Map.of("externalId", id, "payload", body == null ? Map.of() : body));
        return Map.of("ok", true, "collection", collection, "id", id);
    }

    @PostMapping("/offline-actions/{name}")
    public ResponseEntity<Map<String, Object>> offlineAction(@PathVariable String name,
                                                              @RequestBody(required = false) Map<String, Object> body) {
        GovCarePrincipal actor = current.get();
        audit.record(actor, "offline_queue", name, "offline_action", null,
                null, body == null ? Map.of() : body);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("ok", true, "accepted", true));
    }
}
