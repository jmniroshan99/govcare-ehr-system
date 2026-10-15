package lk.gov.health.govcare.dashboard;

import lk.gov.health.govcare.security.CurrentUser;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {
    private final DashboardService dashboard;
    private final DashboardIntelligenceService intelligence;
    private final CurrentUser current;

    public DashboardController(DashboardService dashboard, DashboardIntelligenceService intelligence, CurrentUser current) {
        this.dashboard = dashboard;
        this.intelligence = intelligence;
        this.current = current;
    }

    @GetMapping("/overview")
    public ResponseEntity<Map<String, Object>> overview(@RequestParam(required = false) UUID hospitalId) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(dashboard.overview(current.get(), hospitalId));
    }

    @GetMapping("/intelligence")
    public ResponseEntity<Map<String, Object>> intelligence(@RequestParam(required = false) UUID hospitalId) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(intelligence.dashboard(current.get(), hospitalId));
    }
}
