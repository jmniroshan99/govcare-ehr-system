package lk.gov.health.govcare.audit;

import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.CurrentUser;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/audit-logs")
public class AuditController {
    private final SqlSupport sql;
    private final CurrentUser current;
    private final AuditService audit;

    public AuditController(SqlSupport sql, CurrentUser current, AuditService audit) {
        this.sql = sql;
        this.current = current;
        this.audit = audit;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('AUDIT_VIEW')")
    public Map<String, Object> list() {
        GovCarePrincipal actor = current.get();
        String filter = actor.role().equals("super_admin") ? "" : " where hospital_id=:hospital";
        Map<String, Object> params = actor.role().equals("super_admin")
                ? Map.of() : Map.of("hospital", actor.hospitalId());
        return Map.of("items", sql.list("""
            select id::text,hospital_id::text,actor_id::text,actor_role::text,module,action,
                   entity_type,entity_id::text,before_state,after_state,ip_address,device_info,created_at
              from audit_logs
            """ + filter + " order by created_at desc limit 1000", params));
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(@RequestBody Map<String, Object> input) {
        GovCarePrincipal actor = current.get();
        // Client telemetry is never allowed to impersonate a server audit event.
        String module = required(input, "module");
        String action = required(input, "action");
        audit.record(actor, "client_telemetry", "CLIENT_EVENT", "client_event", null,
                null, Map.of("clientModule", module.substring(0, Math.min(module.length(), 80)),
                        "clientAction", action.substring(0, Math.min(action.length(), 80))));
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("ok", true));
    }

    private static String required(Map<String, Object> input, String key) {
        String value = Objects.toString(input.get(key), "").trim();
        if (value.isEmpty()) throw ApiException.badRequest(key + " is required.");
        return value;
    }

}
