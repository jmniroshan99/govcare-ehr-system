package lk.gov.health.govcare.documents;

import jakarta.servlet.http.HttpServletRequest;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
public class DocumentAuditService {
    private final SqlSupport sql;
    private final HttpServletRequest request;

    public DocumentAuditService(SqlSupport sql, HttpServletRequest request) {
        this.sql = sql;
        this.request = request;
    }

    public void record(GovCarePrincipal actor, Map<String, Object> document, String action, String result) {
        try {
            Map<String, Object> params = new HashMap<>();
            params.put("document", uuid(document.get("id")));
            params.put("patient", uuid(document.get("patientId")));
            params.put("user", actor.id());
            params.put("hospital", actor.hospitalId());
            params.put("department", actor.departmentId());
            params.put("role", actor.role());
            params.put("action", action);
            params.put("result", result);
            params.put("ip", clientIp());
            params.put("agent", Objects.toString(request.getHeader("User-Agent"), ""));
            sql.update("""
                    insert into document_access_logs(
                      document_id,patient_id,user_id,hospital_id,department_id,role,action,result,ip_address,user_agent
                    ) values(:document,:patient,:user,:hospital,:department,:role,:action,:result,:ip,:agent)
                    """, params);
        } catch (Exception ex) {
            System.err.println("[document-audit] Unable to write document access log: " + ex.getMessage());
        }
    }

    public void denied(GovCarePrincipal actor, Map<String, Object> document, String action) {
        record(actor, document, action, "DENIED");
    }

    public List<Map<String, Object>> list(GovCarePrincipal actor, UUID patientId, UUID documentId) {
        return sql.list("""
                select l.id::text as "id",l.action,l.result,l.role,l.ip_address as "ipAddress",
                       l.user_agent as "userAgent",l.accessed_at as "accessedAt",
                       u.full_name as "userName",d.name as "departmentName"
                from document_access_logs l
                left join app_users u on u.id=l.user_id
                left join departments d on d.id=l.department_id
                where l.hospital_id=:hospital and l.patient_id=:patient and l.document_id=:document
                order by l.accessed_at desc limit 250
                """, Map.of("hospital", actor.hospitalId(), "patient", patientId, "document", documentId));
    }

    private String clientIp() {
        String forwarded = request.getHeader("X-Forwarded-For");
        return forwarded == null || forwarded.isBlank() ? request.getRemoteAddr() : forwarded.split(",")[0].trim();
    }

    private static UUID uuid(Object value) {
        if (value == null) return null;
        if (value instanceof UUID uuid) return uuid;
        try {
            return UUID.fromString(String.valueOf(value));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
