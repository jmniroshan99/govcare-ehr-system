package lk.gov.health.govcare.documents;

import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.CurrentUser;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/documents")
public class DocumentDirectoryController {
    private final SqlSupport sql;
    private final CurrentUser current;

    public DocumentDirectoryController(SqlSupport sql, CurrentUser current) {
        this.sql = sql;
        this.current = current;
    }

    @GetMapping("/shareable-departments")
    @PreAuthorize("hasAuthority('DOCUMENT_SHARE')")
    public List<Map<String, Object>> shareableDepartments() {
        return sql.list("""
                select id::text as "id",code,name,coalesce(type,'') as "type"
                from departments
                where hospital_id=:hospital and status='active'
                order by name
                """, Map.of("hospital", current.get().hospitalId()));
    }
}
