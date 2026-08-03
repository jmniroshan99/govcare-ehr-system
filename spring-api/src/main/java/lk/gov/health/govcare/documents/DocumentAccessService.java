package lk.gov.health.govcare.documents;

import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
public class DocumentAccessService {
    private static final Set<String> GOVERNANCE_ROLES = Set.of("super_admin", "hospital_admin", "ict_admin");
    private static final Set<String> ADMIN_ROLES = Set.of("super_admin", "hospital_admin", "records_officer", "receptionist", "ict_admin");
    private static final Set<String> DOCTOR_ROLES = Set.of("doctor", "surgeon", "anesthetist");
    private static final Set<String> LAB_ROLES = Set.of("lab_technician", "lab_manager", "pathologist");
    private static final Set<String> RADIOLOGY_ROLES = Set.of("radiology_technician", "radiologist");

    private final SqlSupport sql;
    private final DocumentAuditService audit;

    public DocumentAccessService(SqlSupport sql, DocumentAuditService audit) {
        this.sql = sql;
        this.audit = audit;
    }

    public Map<String, Object> requirePatient(GovCarePrincipal actor, UUID patientId) {
        Map<String, Object> patient = sql.required("""
                select id::text as "id",hospital_id::text as "hospitalId",patient_no as "patientNo",
                       full_name as "fullName",status::text as "status"
                from patients where id=:patient and hospital_id=:hospital and status<>'deleted'
                """, Map.of("patient", patientId, "hospital", actor.hospitalId()), "Patient not found.");
        if (Set.of("patient", "guardian").contains(actor.role()) && !Objects.equals(actor.patientId(), patientId)) {
            throw ApiException.notFound("Patient not found.");
        }
        return patient;
    }

    public Map<String, Object> requireDocument(GovCarePrincipal actor, UUID patientId, UUID documentId) {
        requirePatient(actor, patientId);
        return sql.required(documentSelect() + " where pd.id=:document and pd.patient_id=:patient and pd.hospital_id=:hospital",
                Map.of("document", documentId, "patient", patientId, "hospital", actor.hospitalId()),
                "Patient document not found.");
    }

    public List<Map<String, Object>> candidateDocuments(GovCarePrincipal actor, UUID patientId) {
        requirePatient(actor, patientId);
        return sql.list(documentSelect() + " where pd.patient_id=:patient and pd.hospital_id=:hospital and pd.document_status<>'ARCHIVED' order by pd.created_at desc limit 500",
                Map.of("patient", patientId, "hospital", actor.hospitalId()));
    }

    public List<Map<String, Object>> departmentCandidates(GovCarePrincipal actor, UUID departmentId) {
        requireDepartment(actor, departmentId);
        // Load hospital-scoped candidates and apply the full role/relationship policy in canView().
        // This lets requesting doctors and active ward staff receive newly verified reports even
        // when the source document was created by Laboratory or Radiology.
        return sql.list(documentSelect() + """
                 where pd.hospital_id=:hospital and pd.document_status<>'ARCHIVED'
                 order by pd.created_at desc limit 1000
                """, Map.of("hospital", actor.hospitalId()));
    }

    public void requireDepartment(GovCarePrincipal actor, UUID departmentId) {
        if (departmentId == null) throw ApiException.badRequest("Department is required.");
        boolean exists = sql.one("select id from departments where id=:department and hospital_id=:hospital and status='active'",
                Map.of("department", departmentId, "hospital", actor.hospitalId())).isPresent();
        if (!exists) throw ApiException.notFound("Department not found.");
        if (!GOVERNANCE_ROLES.contains(actor.role()) && !Objects.equals(actor.departmentId(), departmentId)) {
            throw ApiException.forbidden("You can only access documents assigned to your department.");
        }
    }

    public boolean canView(GovCarePrincipal actor, Map<String, Object> document) {
        if (!actor.active() || !has(actor, "DOCUMENT_VIEW")) return false;
        if (!Objects.equals(actor.hospitalId().toString(), String.valueOf(document.get("hospitalId")))) return false;

        UUID patientId = uuid(document.get("patientId"));
        String type = String.valueOf(document.get("documentType"));
        String status = String.valueOf(document.get("documentStatus"));
        String release = String.valueOf(document.get("patientReleaseStatus"));
        UUID creator = uuid(document.get("createdBy"));
        UUID sourceDepartment = uuid(document.get("sourceDepartmentId"));

        if (Set.of("patient", "guardian").contains(actor.role())) {
            return actor.patientId() != null
                    && actor.patientId().equals(patientId)
                    && "VERIFIED".equals(status)
                    && "RELEASED_TO_PATIENT".equals(release);
        }

        if (DocumentPolicy.ADMINISTRATIVE_TYPES.contains(type)) {
            return ADMIN_ROLES.contains(actor.role()) || has(actor, "DOCUMENT_VIEW_CLINICAL");
        }

        // Governance users can administer document policies and metadata, but cannot open clinical content.
        if (GOVERNANCE_ROLES.contains(actor.role()) && !has(actor, "DOCUMENT_VIEW_CLINICAL")) return false;

        boolean creatorAccess = Objects.equals(actor.id(), creator);
        boolean sourceDepartmentAccess = actor.departmentId() != null && Objects.equals(actor.departmentId(), sourceDepartment)
                && roleCanUseType(actor.role(), type);
        if (creatorAccess || sourceDepartmentAccess) return true;

        // Other departments can consume only verified records.
        if (!"VERIFIED".equals(status)) return false;
        if (hasAnyDepartmentShare(actor, uuid(document.get("id")))) return true;

        if (LAB_ROLES.contains(actor.role())) return DocumentPolicy.LAB_TYPES.contains(type);
        if (RADIOLOGY_ROLES.contains(actor.role())) return DocumentPolicy.RADIOLOGY_TYPES.contains(type);
        if ("pharmacist".equals(actor.role())) return DocumentPolicy.PHARMACY_TYPES.contains(type);
        if (DOCTOR_ROLES.contains(actor.role())) {
            return DocumentPolicy.DOCTOR_TYPES.contains(type) && hasClinicalRelationship(actor, patientId);
        }
        if ("nurse".equals(actor.role())) {
            return DocumentPolicy.WARD_TYPES.contains(type) && hasWardRelationship(actor, patientId);
        }
        return false;
    }

    public void requireView(GovCarePrincipal actor, Map<String, Object> document, String action) {
        if (!canView(actor, document)) {
            audit.denied(actor, document, action);
            throw ApiException.forbidden("You do not have permission to view this clinical document.");
        }
    }

    public void requireDownload(GovCarePrincipal actor, Map<String, Object> document) {
        if (!has(actor, "DOCUMENT_DOWNLOAD")) {
            audit.denied(actor, document, "DOCUMENT_DOWNLOADED");
            throw ApiException.forbidden("You do not have permission to download this document.");
        }
        requireView(actor, document, "DOCUMENT_DOWNLOADED");
        if (actor.departmentId() != null && !Objects.equals(actor.departmentId(), uuid(document.get("sourceDepartmentId")))
                && !canViewByRoleWithoutShare(actor, document)
                && !hasDepartmentShare(actor, uuid(document.get("id")), "DOWNLOAD")) {
            audit.denied(actor, document, "DOCUMENT_DOWNLOADED");
            throw ApiException.forbidden("This department has not been granted download access.");
        }
    }

    public void requirePrint(GovCarePrincipal actor, Map<String, Object> document) {
        if (!has(actor, "DOCUMENT_PRINT")) {
            audit.denied(actor, document, "DOCUMENT_PRINTED");
            throw ApiException.forbidden("You do not have permission to print this document.");
        }
        requireView(actor, document, "DOCUMENT_PRINTED");
        if (actor.departmentId() != null && !Objects.equals(actor.departmentId(), uuid(document.get("sourceDepartmentId")))
                && !canViewByRoleWithoutShare(actor, document)
                && !hasDepartmentShare(actor, uuid(document.get("id")), "PRINT")) {
            audit.denied(actor, document, "DOCUMENT_PRINTED");
            throw ApiException.forbidden("This department has not been granted print access.");
        }
    }

    public void requireCreate(GovCarePrincipal actor, String type) {
        if (!has(actor, "DOCUMENT_CREATE") || !roleCanCreateType(actor.role(), type)) {
            throw ApiException.forbidden("Your role cannot create this type of patient document.");
        }
    }

    public void requireVerify(GovCarePrincipal actor, Map<String, Object> document) {
        if (!has(actor, "DOCUMENT_VERIFY") || !roleCanVerifyType(actor.role(), String.valueOf(document.get("documentType")))) {
            audit.denied(actor, document, "DOCUMENT_VERIFIED");
            throw ApiException.forbidden("Your role cannot verify this document type.");
        }
        if (!Set.of("DRAFT", "SUBMITTED", "REJECTED").contains(String.valueOf(document.get("documentStatus")))) {
            throw ApiException.conflict("The document cannot be verified from its current status.");
        }
    }

    public void requireReject(GovCarePrincipal actor, Map<String, Object> document) {
        if (!has(actor, "DOCUMENT_REJECT") || !roleCanVerifyType(actor.role(), String.valueOf(document.get("documentType")))) {
            audit.denied(actor, document, "DOCUMENT_REJECTED");
            throw ApiException.forbidden("Your role cannot reject this document type.");
        }
    }

    public void requireRelease(GovCarePrincipal actor, Map<String, Object> document) {
        if (!has(actor, "DOCUMENT_RELEASE_TO_PATIENT")) {
            audit.denied(actor, document, "DOCUMENT_RELEASED");
            throw ApiException.forbidden("Your role cannot release this document to the patient.");
        }
        if (!"VERIFIED".equals(String.valueOf(document.get("documentStatus")))) {
            throw ApiException.conflict("Only verified documents can be released to the patient.");
        }
        if (!roleCanVerifyType(actor.role(), String.valueOf(document.get("documentType")))
                && !DOCTOR_ROLES.contains(actor.role())) {
            throw ApiException.forbidden("Your role cannot release this document type.");
        }
    }

    public void requireShare(GovCarePrincipal actor, Map<String, Object> document) {
        if (!has(actor, "DOCUMENT_SHARE")) {
            audit.denied(actor, document, "DOCUMENT_SHARED");
            throw ApiException.forbidden("Your role cannot share patient documents.");
        }
        if (!"VERIFIED".equals(String.valueOf(document.get("documentStatus")))) {
            throw ApiException.conflict("Only verified documents can be shared with another department.");
        }
        // Governance roles may configure sharing without gaining access to the clinical content.
        if (!GOVERNANCE_ROLES.contains(actor.role())) requireView(actor, document, "DOCUMENT_SHARED");
    }

    public void requireAudit(GovCarePrincipal actor, Map<String, Object> document) {
        if (!has(actor, "DOCUMENT_AUDIT_VIEW")) throw ApiException.forbidden("Document audit permission is required.");
        if (!GOVERNANCE_ROLES.contains(actor.role())) requireView(actor, document, "DOCUMENT_AUDIT_VIEWED");
    }

    public boolean roleCanCreateType(String role, String type) {
        if (Set.of("records_officer", "receptionist", "hospital_admin", "super_admin").contains(role)) {
            return DocumentPolicy.ADMINISTRATIVE_TYPES.contains(type);
        }
        if (DOCTOR_ROLES.contains(role)) return DocumentPolicy.DOCTOR_TYPES.contains(type);
        if ("nurse".equals(role)) return Set.of("NURSING_REPORT", "ADMISSION_REPORT", "DISCHARGE_SUMMARY", "EMERGENCY_REPORT").contains(type);
        if (LAB_ROLES.contains(role)) return DocumentPolicy.LAB_TYPES.contains(type);
        if (RADIOLOGY_ROLES.contains(role)) return DocumentPolicy.RADIOLOGY_TYPES.contains(type);
        if ("pharmacist".equals(role)) return DocumentPolicy.PHARMACY_TYPES.contains(type);
        return false;
    }

    private boolean roleCanUseType(String role, String type) {
        return roleCanCreateType(role, type)
                || (DOCTOR_ROLES.contains(role) && DocumentPolicy.DOCTOR_TYPES.contains(type))
                || ("nurse".equals(role) && DocumentPolicy.WARD_TYPES.contains(type));
    }

    private boolean roleCanVerifyType(String role, String type) {
        if (Set.of("pathologist", "lab_manager").contains(role)) return DocumentPolicy.LAB_TYPES.contains(type);
        if ("radiologist".equals(role)) return DocumentPolicy.RADIOLOGY_TYPES.contains(type);
        return DOCTOR_ROLES.contains(role) && Set.of(
                "CONSULTATION_REPORT", "PRESCRIPTION", "REFERRAL_LETTER", "MEDICAL_CERTIFICATE",
                "ADMISSION_REPORT", "DISCHARGE_SUMMARY", "EMERGENCY_REPORT", "OPERATION_THEATRE_REPORT"
        ).contains(type);
    }

    private boolean canViewByRoleWithoutShare(GovCarePrincipal actor, Map<String, Object> document) {
        String type = String.valueOf(document.get("documentType"));
        if (Set.of("patient", "guardian").contains(actor.role())) return true;
        if (DocumentPolicy.ADMINISTRATIVE_TYPES.contains(type)) return ADMIN_ROLES.contains(actor.role());
        if (LAB_ROLES.contains(actor.role())) return DocumentPolicy.LAB_TYPES.contains(type);
        if (RADIOLOGY_ROLES.contains(actor.role())) return DocumentPolicy.RADIOLOGY_TYPES.contains(type);
        if ("pharmacist".equals(actor.role())) return DocumentPolicy.PHARMACY_TYPES.contains(type);
        if (DOCTOR_ROLES.contains(actor.role())) return hasClinicalRelationship(actor, uuid(document.get("patientId")));
        if ("nurse".equals(actor.role())) return hasWardRelationship(actor, uuid(document.get("patientId")));
        return false;
    }

    private boolean hasAnyDepartmentShare(GovCarePrincipal actor, UUID documentId) {
        if (actor.departmentId() == null || documentId == null) return false;
        return sql.one("""
                select id from document_department_access
                where document_id=:document and department_id=:department and revoked_at is null
                  and (expires_at is null or expires_at>now()) limit 1
                """, Map.of("document", documentId, "department", actor.departmentId())).isPresent();
    }

    private boolean hasDepartmentShare(GovCarePrincipal actor, UUID documentId, String accessType) {
        if (actor.departmentId() == null || documentId == null) return false;
        return sql.one("""
                select id from document_department_access
                where document_id=:document and department_id=:department and revoked_at is null
                  and (expires_at is null or expires_at>now()) and access_type=:access limit 1
                """, Map.of("document", documentId, "department", actor.departmentId(), "access", accessType)).isPresent();
    }

    private boolean hasClinicalRelationship(GovCarePrincipal actor, UUID patientId) {
        if (patientId == null) return false;
        Map<String, Object> params = Map.of("hospital", actor.hospitalId(), "patient", patientId, "user", actor.id());
        Object related = sql.required("""
                select (
                  exists(select 1 from visits where hospital_id=:hospital and patient_id=:patient and doctor_id=:user) or
                  exists(select 1 from consultations where hospital_id=:hospital and patient_id=:patient and doctor_id=:user) or
                  exists(select 1 from prescriptions where hospital_id=:hospital and patient_id=:patient and doctor_id=:user) or
                  exists(select 1 from lab_requests where hospital_id=:hospital and patient_id=:patient and requested_by=:user) or
                  exists(select 1 from radiology_requests where hospital_id=:hospital and patient_id=:patient and requested_by=:user) or
                  exists(select 1 from admissions where hospital_id=:hospital and patient_id=:patient and consultant_id=:user and status in ('active','pending'))
                ) as related
                """, params, "Unable to evaluate patient relationship.").get("related");
        return Boolean.TRUE.equals(related);
    }

    private boolean hasWardRelationship(GovCarePrincipal actor, UUID patientId) {
        if (patientId == null || actor.departmentId() == null) return false;
        Object related = sql.required("""
                select exists(
                  select 1 from admissions a join wards w on w.id=a.ward_id
                  where a.hospital_id=:hospital and a.patient_id=:patient and w.department_id=:department
                    and a.status in ('active','pending')
                ) as related
                """, Map.of("hospital", actor.hospitalId(), "patient", patientId, "department", actor.departmentId()),
                "Unable to evaluate ward relationship.").get("related");
        return Boolean.TRUE.equals(related);
    }

    private boolean has(GovCarePrincipal actor, String permission) {
        return actor.permissions().contains("*") || actor.permissions().contains(permission);
    }

    private static UUID uuid(Object value) {
        if (value == null) return null;
        if (value instanceof UUID uuid) return uuid;
        try { return UUID.fromString(String.valueOf(value)); }
        catch (IllegalArgumentException ex) { return null; }
    }

    private static String documentSelect() {
        return """
                select pd.id::text as "id",pd.hospital_id::text as "hospitalId",pd.patient_id::text as "patientId",
                       p.patient_no as "patientNo",p.full_name as "patientName",
                       pd.encounter_id::text as "encounterId",pd.consultation_id::text as "consultationId",
                       pd.prescription_id::text as "prescriptionId",pd.laboratory_request_id::text as "laboratoryRequestId",
                       pd.radiology_request_id::text as "radiologyRequestId",pd.admission_id::text as "admissionId",
                       pd.source_department_id::text as "sourceDepartmentId",d.name as "sourceDepartmentName",
                       pd.document_type as "documentType",pd.title,pd.description,pd.file_name as "fileName",
                       pd.original_file_name as "originalFileName",pd.mime_type as "mimeType",
                       pd.file_size_bytes as "fileSizeBytes",pd.storage_key as "storageKey",
                       pd.sha256_checksum as "sha256Checksum",pd.document_status as "documentStatus",
                       pd.patient_release_status as "patientReleaseStatus",pd.visibility_level as "visibilityLevel",
                       pd.created_by::text as "createdBy",cu.full_name as "createdByName",
                       pd.verified_by::text as "verifiedBy",vu.full_name as "verifiedByName",
                       pd.created_at as "createdAt",pd.updated_at as "updatedAt",pd.verified_at as "verifiedAt",
                       pd.released_at as "releasedAt",pd.archived_at as "archivedAt"
                from patient_documents pd
                join patients p on p.id=pd.patient_id
                left join departments d on d.id=pd.source_department_id
                left join app_users cu on cu.id=pd.created_by
                left join app_users vu on vu.id=pd.verified_by
                """;
    }
}
