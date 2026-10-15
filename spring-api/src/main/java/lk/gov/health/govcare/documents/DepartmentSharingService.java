package lk.gov.health.govcare.documents;

import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class DepartmentSharingService {
    private static final Set<String> ACCESS_TYPES = Set.of("VIEW", "DOWNLOAD", "PRINT", "VERIFY", "SHARE");

    private final SqlSupport sql;
    private final DocumentAccessService access;
    private final DocumentAuditService audit;

    public DepartmentSharingService(SqlSupport sql, DocumentAccessService access, DocumentAuditService audit) {
        this.sql = sql;
        this.access = access;
        this.audit = audit;
    }

    @Transactional
    public List<Map<String, Object>> share(GovCarePrincipal actor, UUID patientId, UUID documentId,
                                           UUID departmentId, String requestedAccess, OffsetDateTime expiresAt) {
        Map<String, Object> document = access.requireDocument(actor, patientId, documentId);
        access.requireShare(actor, document);
        Map<String, Object> department = sql.required("""
                select id::text as "id",name from departments
                where id=:department and hospital_id=:hospital and status='active'
                """, Map.of("department", departmentId, "hospital", actor.hospitalId()), "Receiving department not found.");

        String accessType = requestedAccess == null || requestedAccess.isBlank()
                ? "VIEW" : requestedAccess.trim().toUpperCase(Locale.ROOT);
        if (!ACCESS_TYPES.contains(accessType)) throw ApiException.badRequest("Unsupported department access type.");

        grant(actor, documentId, departmentId, "VIEW", expiresAt);
        if (!"VIEW".equals(accessType)) grant(actor, documentId, departmentId, accessType, expiresAt);

        Map<String, Object> notify = new HashMap<>();
        notify.put("hospital", actor.hospitalId());
        notify.put("department", departmentId);
        notify.put("title", "Patient document shared");
        notify.put("message", "A verified " + document.get("documentType") + " is available for " + document.get("patientNo") + ".");
        notify.put("url", "/patients/" + patientId + "/documents");
        notify.put("actor", actor.id());
        sql.update("""
                insert into notifications(hospital_id,target_user_id,title,message,module,priority,action_url,group_key,created_by)
                select :hospital,u.id,:title,:message,'documents','routine',:url,
                       'document-share-' || cast(:department as text),:actor
                from app_users u
                where u.hospital_id=:hospital and u.department_id=:department and u.status='active'
                """, notify);

        audit.record(actor, document, "DOCUMENT_SHARED", "SUCCESS");
        return shares(actor, patientId, documentId);
    }

    @Transactional
    public void revoke(GovCarePrincipal actor, UUID patientId, UUID documentId, UUID departmentId) {
        Map<String, Object> document = access.requireDocument(actor, patientId, documentId);
        access.requireShare(actor, document);
        int changed = sql.update("""
                update document_department_access set revoked_at=now()
                where document_id=:document and department_id=:department and revoked_at is null
                """, Map.of("document", documentId, "department", departmentId));
        if (changed == 0) throw ApiException.notFound("Active department sharing was not found.");
        audit.record(actor, document, "DOCUMENT_SHARE_REVOKED", "SUCCESS");
    }

    public List<Map<String, Object>> shares(GovCarePrincipal actor, UUID patientId, UUID documentId) {
        Map<String, Object> document = access.requireDocument(actor, patientId, documentId);
        access.requireAudit(actor, document);
        return sql.list("""
                select da.id::text as "id",da.department_id::text as "departmentId",d.name as "departmentName",
                       da.access_type as "accessType",da.granted_at as "grantedAt",da.expires_at as "expiresAt",
                       da.revoked_at as "revokedAt",u.full_name as "grantedByName"
                from document_department_access da
                join departments d on d.id=da.department_id
                join app_users u on u.id=da.granted_by
                where da.document_id=:document order by da.granted_at desc
                """, Map.of("document", documentId));
    }

    private void grant(GovCarePrincipal actor, UUID documentId, UUID departmentId, String accessType, OffsetDateTime expiresAt) {
        Map<String, Object> params = new HashMap<>();
        params.put("document", documentId);
        params.put("department", departmentId);
        params.put("access", accessType);
        params.put("user", actor.id());
        params.put("expires", expiresAt);
        sql.update("""
                insert into document_department_access(document_id,department_id,access_type,granted_by,expires_at)
                values(:document,:department,:access,:user,:expires)
                on conflict (document_id,department_id,access_type) where revoked_at is null
                do update set granted_by=excluded.granted_by,granted_at=now(),expires_at=excluded.expires_at,revoked_at=null
                """, params);
    }
}
