package lk.gov.health.govcare.documents;

import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
public class PatientDocumentService {
    private final SqlSupport sql;
    private final DocumentAccessService access;
    private final DocumentStorageService storage;
    private final DocumentPdfService pdf;
    private final DocumentAuditService audit;

    public PatientDocumentService(
            SqlSupport sql,
            DocumentAccessService access,
            DocumentStorageService storage,
            DocumentPdfService pdf,
            DocumentAuditService audit
    ) {
        this.sql = sql;
        this.access = access;
        this.storage = storage;
        this.pdf = pdf;
        this.audit = audit;
    }

    public List<Map<String, Object>> listPatient(
            GovCarePrincipal actor,
            UUID patientId,
            String search,
            String documentType,
            String status,
            String releaseStatus,
            UUID departmentId,
            LocalDate from,
            LocalDate to,
            String sort
    ) {
        List<Map<String, Object>> visible = access.candidateDocuments(actor, patientId).stream()
                .filter(document -> access.canView(actor, document))
                .filter(document -> matches(document, search, documentType, status, releaseStatus, departmentId, from, to))
                .map(PatientDocumentService::safeDocument)
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
        if ("oldest".equalsIgnoreCase(sort)) java.util.Collections.reverse(visible);
        return visible;
    }

    public List<Map<String, Object>> listDepartment(
            GovCarePrincipal actor,
            UUID departmentId,
            String search,
            String documentType,
            String status,
            String sort
    ) {
        List<Map<String, Object>> visible = access.departmentCandidates(actor, departmentId).stream()
                .filter(document -> access.canView(actor, document))
                .filter(document -> matches(document, search, documentType, status, null, null, null, null))
                .map(PatientDocumentService::safeDocument)
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
        if ("oldest".equalsIgnoreCase(sort)) java.util.Collections.reverse(visible);
        return visible;
    }

    public Map<String, Object> get(GovCarePrincipal actor, UUID patientId, UUID documentId) {
        Map<String, Object> document = access.requireDocument(actor, patientId, documentId);
        access.requireView(actor, document, "DOCUMENT_VIEWED");
        audit.record(actor, document, "DOCUMENT_VIEWED", "SUCCESS");
        return safeDocument(document);
    }

    @Transactional
    public Map<String, Object> upload(
            GovCarePrincipal actor,
            UUID patientId,
            MultipartFile file,
            String documentType,
            String title,
            String description,
            String status,
            String visibility,
            UUID encounterId,
            UUID consultationId,
            UUID prescriptionId,
            UUID laboratoryRequestId,
            UUID radiologyRequestId,
            UUID admissionId
    ) throws IOException {
        access.requirePatient(actor, patientId);
        String type = DocumentPolicy.normalizeType(documentType);
        access.requireCreate(actor, type);
        validateLinks(actor, patientId, encounterId, consultationId, prescriptionId, laboratoryRequestId, radiologyRequestId, admissionId);

        String documentStatus = normalizeStatus(status, Set.of("DRAFT", "SUBMITTED"), "DRAFT");
        String visibilityLevel = normalizeVisibility(visibility);
        DocumentStorageService.StoredFile stored = storage.store(actor.hospitalId(), patientId, type, file);
        UUID id = UUID.randomUUID();
        insertDocument(actor, id, patientId, type, title, description, documentStatus, visibilityLevel, stored,
                encounterId, consultationId, prescriptionId, laboratoryRequestId, radiologyRequestId, admissionId);
        Map<String, Object> document = access.requireDocument(actor, patientId, id);
        audit.record(actor, document, "DOCUMENT_UPLOADED", "SUCCESS");
        return safeDocument(document);
    }

    @Transactional
    public Map<String, Object> generate(GovCarePrincipal actor, UUID patientId, DocumentDtos.GenerateDocumentRequest request) throws IOException {
        access.requirePatient(actor, patientId);
        String type = DocumentPolicy.normalizeType(request.documentType());
        access.requireCreate(actor, type);
        validateLinks(actor, patientId, request.encounterId(), request.consultationId(), request.prescriptionId(),
                request.laboratoryRequestId(), request.radiologyRequestId(), request.admissionId());
        String sourceKind = DocumentPdfService.sourceKind(type, request.sourceKind());
        validateGenerationSource(actor, patientId, sourceKind, request.sourceId());

        DocumentStorageService.StoredFile stored = pdf.generate(actor, patientId, type, sourceKind, request.sourceId());
        UUID id = UUID.randomUUID();
        insertDocument(actor, id, patientId, type, request.title(), request.description(), "SUBMITTED", "DEPARTMENT", stored,
                request.encounterId(), request.consultationId(), request.prescriptionId(), request.laboratoryRequestId(),
                request.radiologyRequestId(), request.admissionId());
        Map<String, Object> document = access.requireDocument(actor, patientId, id);
        audit.record(actor, document, "DOCUMENT_GENERATED", "SUCCESS");
        return safeDocument(document);
    }

    public DocumentContent content(
            GovCarePrincipal actor,
            UUID patientId,
            UUID documentId,
            boolean download,
            boolean print
    ) throws IOException {
        Map<String, Object> document = access.requireDocument(actor, patientId, documentId);
        String action;
        if (print) {
            access.requirePrint(actor, document);
            action = "DOCUMENT_PRINTED";
        } else if (download) {
            access.requireDownload(actor, document);
            action = "DOCUMENT_DOWNLOADED";
        } else {
            access.requireView(actor, document, "DOCUMENT_VIEWED");
            action = "DOCUMENT_VIEWED";
        }
        Resource resource = storage.resource(String.valueOf(document.get("storageKey")));
        audit.record(actor, document, action, "SUCCESS");
        return new DocumentContent(document, resource);
    }

    @Transactional
    public Map<String, Object> verify(GovCarePrincipal actor, UUID patientId, UUID documentId) {
        Map<String, Object> document = access.requireDocument(actor, patientId, documentId);
        access.requireVerify(actor, document);
        sql.update("""
                update patient_documents set document_status='VERIFIED',verified_by=:user,verified_at=now()
                where id=:document and hospital_id=:hospital
                """, Map.of("user", actor.id(), "document", documentId, "hospital", actor.hospitalId()));
        Map<String, Object> updated = access.requireDocument(actor, patientId, documentId);
        audit.record(actor, updated, "DOCUMENT_VERIFIED", "SUCCESS");
        notifyVerified(actor, updated);
        return safeDocument(updated);
    }

    @Transactional
    public Map<String, Object> reject(GovCarePrincipal actor, UUID patientId, UUID documentId, String reason) {
        Map<String, Object> document = access.requireDocument(actor, patientId, documentId);
        access.requireReject(actor, document);
        String message = reason == null || reason.isBlank() ? "Correction requested by verifier." : reason.trim();
        sql.update("""
                update patient_documents set document_status='REJECTED',verified_by=:user,verified_at=now(),
                  description=case when description is null or description='' then :reason else description || E'\nRejection: ' || :reason end
                where id=:document and hospital_id=:hospital
                """, Map.of("user", actor.id(), "reason", message, "document", documentId, "hospital", actor.hospitalId()));
        Map<String, Object> updated = access.requireDocument(actor, patientId, documentId);
        audit.record(actor, updated, "DOCUMENT_REJECTED", "SUCCESS");
        notifyCreator(actor, updated, "Patient document requires correction", message);
        return safeDocument(updated);
    }

    @Transactional
    public Map<String, Object> release(GovCarePrincipal actor, UUID patientId, UUID documentId) {
        Map<String, Object> document = access.requireDocument(actor, patientId, documentId);
        access.requireRelease(actor, document);
        sql.update("""
                update patient_documents set patient_release_status='RELEASED_TO_PATIENT',
                  visibility_level='PATIENT_RELEASED',released_at=now()
                where id=:document and hospital_id=:hospital
                """, Map.of("document", documentId, "hospital", actor.hospitalId()));
        Map<String, Object> updated = access.requireDocument(actor, patientId, documentId);
        audit.record(actor, updated, "DOCUMENT_RELEASED", "SUCCESS");
        notifyPatient(actor, updated);
        return safeDocument(updated);
    }

    @Transactional
    public Map<String, Object> revokeRelease(GovCarePrincipal actor, UUID patientId, UUID documentId) {
        Map<String, Object> document = access.requireDocument(actor, patientId, documentId);
        if (!(actor.permissions().contains("*") || actor.permissions().contains("DOCUMENT_REVOKE_PATIENT_RELEASE"))) {
            audit.denied(actor, document, "DOCUMENT_RELEASE_REVOKED");
            throw ApiException.forbidden("Your role cannot revoke patient document access.");
        }
        sql.update("""
                update patient_documents set patient_release_status='REVOKED',visibility_level='DEPARTMENT'
                where id=:document and hospital_id=:hospital
                """, Map.of("document", documentId, "hospital", actor.hospitalId()));
        Map<String, Object> updated = access.requireDocument(actor, patientId, documentId);
        audit.record(actor, updated, "DOCUMENT_RELEASE_REVOKED", "SUCCESS");
        return safeDocument(updated);
    }

    @Transactional
    public Map<String, Object> archive(GovCarePrincipal actor, UUID patientId, UUID documentId) {
        Map<String, Object> document = access.requireDocument(actor, patientId, documentId);
        if (!(actor.permissions().contains("*") || actor.permissions().contains("DOCUMENT_ARCHIVE"))) {
            throw ApiException.forbidden("Document archive permission is required.");
        }
        sql.update("update patient_documents set document_status='ARCHIVED',archived_at=now() where id=:document and hospital_id=:hospital",
                Map.of("document", documentId, "hospital", actor.hospitalId()));
        Map<String, Object> updated = access.requireDocument(actor, patientId, documentId);
        audit.record(actor, updated, "DOCUMENT_ARCHIVED", "SUCCESS");
        return safeDocument(updated);
    }

    public List<Map<String, Object>> audit(GovCarePrincipal actor, UUID patientId, UUID documentId) {
        Map<String, Object> document = access.requireDocument(actor, patientId, documentId);
        access.requireAudit(actor, document);
        return audit.list(actor, patientId, documentId);
    }

    public List<Map<String, Object>> timeline(GovCarePrincipal actor, UUID patientId) {
        access.requirePatient(actor, patientId);
        List<Map<String, Object>> rows = sql.list("""
                select * from (
                  select p.created_at as "eventAt",'PATIENT_REGISTERED' as "eventType",'Registration' as "department",
                         coalesce(u.full_name,'System') as "staffName",'Patient profile created' as "title",null::text as "documentId"
                    from patients p left join app_users u on u.id=p.created_by
                    where p.id=:patient and p.hospital_id=:hospital
                  union all
                  select v.created_at,'VISIT_STARTED',coalesce(d.name,'OPD'),coalesce(u.full_name,'Hospital staff'),
                         'Visit ' || v.visit_no,null::text
                    from visits v left join departments d on d.id=v.department_id left join app_users u on u.id=v.created_by
                    where v.patient_id=:patient and v.hospital_id=:hospital
                  union all
                  select c.created_at,'CONSULTATION_COMPLETED',coalesce(d.name,'Clinical'),coalesce(u.full_name,'Doctor'),
                         'Consultation completed',null::text
                    from consultations c left join visits v on v.id=c.visit_id left join departments d on d.id=v.department_id
                    left join app_users u on u.id=c.doctor_id where c.patient_id=:patient and c.hospital_id=:hospital
                  union all
                  select rx.created_at,'PRESCRIPTION_ISSUED','Pharmacy',coalesce(u.full_name,'Doctor'),
                         'Prescription ' || rx.prescription_no,null::text
                    from prescriptions rx left join app_users u on u.id=rx.doctor_id
                    where rx.patient_id=:patient and rx.hospital_id=:hospital
                  union all
                  select lr.created_at,'LABORATORY_REQUEST_SENT','Laboratory',coalesce(u.full_name,'Doctor'),
                         'Laboratory request: ' || lr.test_type,null::text
                    from lab_requests lr left join app_users u on u.id=lr.requested_by
                    where lr.patient_id=:patient and lr.hospital_id=:hospital
                  union all
                  select rr.created_at,'RADIOLOGY_REQUEST_SENT','Radiology',coalesce(u.full_name,'Doctor'),
                         'Radiology request: ' || rr.imaging_type,null::text
                    from radiology_requests rr left join app_users u on u.id=rr.requested_by
                    where rr.patient_id=:patient and rr.hospital_id=:hospital
                  union all
                  select a.admitted_at,'PATIENT_ADMITTED',coalesce(w.name,'Ward'),coalesce(u.full_name,'Hospital staff'),
                         'Admission ' || a.admission_no,null::text
                    from admissions a left join wards w on w.id=a.ward_id left join app_users u on u.id=a.created_by
                    where a.patient_id=:patient and a.hospital_id=:hospital
                  union all
                  select pd.created_at,case when pd.document_status='VERIFIED' then 'REPORT_VERIFIED' else 'DOCUMENT_ADDED' end,
                         coalesce(d.name,'Documents'),coalesce(u.full_name,'Hospital staff'),pd.title,pd.id::text
                    from patient_documents pd left join departments d on d.id=pd.source_department_id
                    left join app_users u on u.id=pd.created_by
                    where pd.patient_id=:patient and pd.hospital_id=:hospital and pd.document_status<>'ARCHIVED'
                ) events order by "eventAt" desc limit 250
                """, Map.of("patient", patientId, "hospital", actor.hospitalId()));
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Object documentId = row.get("documentId");
            if (documentId == null) {
                result.add(row);
                continue;
            }
            try {
                Map<String, Object> document = access.requireDocument(actor, patientId, UUID.fromString(String.valueOf(documentId)));
                if (access.canView(actor, document)) result.add(row);
            } catch (RuntimeException ignored) {
                // Do not expose timeline events for documents the current role cannot access.
            }
        }
        return result;
    }

    public List<Map<String, Object>> departmentRequests(GovCarePrincipal actor, UUID departmentId) {
        access.requireDepartment(actor, departmentId);
        String departmentType = String.valueOf(sql.required("select lower(coalesce(type,'')) as type,lower(name) as name from departments where id=:id and hospital_id=:hospital",
                Map.of("id", departmentId, "hospital", actor.hospitalId()), "Department not found.").get("name"));
        if (departmentType.contains("laboratory")) {
            return sql.list("""
                    select lr.id::text as "id",lr.patient_id::text as "patientId",p.patient_no as "patientNo",p.full_name as "patientName",
                           'LABORATORY' as "requestModule",lr.test_type as "requestType",lr.priority::text as "priority",
                           lr.sample_status as "workflowStatus",lr.created_at as "createdAt",u.full_name as "requestedByName"
                    from lab_requests lr join patients p on p.id=lr.patient_id left join app_users u on u.id=lr.requested_by
                    where lr.hospital_id=:hospital and lr.status<>'deleted' order by lr.created_at desc limit 200
                    """, Map.of("hospital", actor.hospitalId()));
        }
        if (departmentType.contains("radiology")) {
            return sql.list("""
                    select rr.id::text as "id",rr.patient_id::text as "patientId",p.patient_no as "patientNo",p.full_name as "patientName",
                           'RADIOLOGY' as "requestModule",rr.imaging_type as "requestType",rr.priority::text as "priority",
                           rr.scan_status as "workflowStatus",rr.created_at as "createdAt",u.full_name as "requestedByName"
                    from radiology_requests rr join patients p on p.id=rr.patient_id left join app_users u on u.id=rr.requested_by
                    where rr.hospital_id=:hospital and rr.status<>'deleted' order by rr.created_at desc limit 200
                    """, Map.of("hospital", actor.hospitalId()));
        }
        if (departmentType.contains("pharmacy")) {
            return sql.list("""
                    select rx.id::text as "id",rx.patient_id::text as "patientId",p.patient_no as "patientNo",p.full_name as "patientName",
                           'PHARMACY' as "requestModule",rx.prescription_no as "requestType",rx.priority::text as "priority",
                           rx.pharmacy_status as "workflowStatus",rx.created_at as "createdAt",u.full_name as "requestedByName"
                    from prescriptions rx join patients p on p.id=rx.patient_id left join app_users u on u.id=rx.doctor_id
                    where rx.hospital_id=:hospital and rx.status<>'deleted' order by rx.created_at desc limit 200
                    """, Map.of("hospital", actor.hospitalId()));
        }
        return List.of();
    }

    private void insertDocument(
            GovCarePrincipal actor,
            UUID id,
            UUID patientId,
            String type,
            String title,
            String description,
            String documentStatus,
            String visibility,
            DocumentStorageService.StoredFile stored,
            UUID encounterId,
            UUID consultationId,
            UUID prescriptionId,
            UUID laboratoryRequestId,
            UUID radiologyRequestId,
            UUID admissionId
    ) {
        Map<String, Object> params = new HashMap<>();
        params.put("id", id);
        params.put("hospital", actor.hospitalId());
        params.put("patient", patientId);
        params.put("encounter", encounterId);
        params.put("consultation", consultationId);
        params.put("prescription", prescriptionId);
        params.put("lab", laboratoryRequestId);
        params.put("radiology", radiologyRequestId);
        params.put("admission", admissionId);
        params.put("department", actor.departmentId());
        params.put("type", type);
        params.put("title", title == null || title.isBlank() ? DocumentPolicy.defaultTitle(type) : title.trim());
        params.put("description", description == null || description.isBlank() ? null : description.trim());
        params.put("fileName", stored.fileName());
        params.put("original", stored.originalFileName());
        params.put("mime", stored.mimeType());
        params.put("size", stored.size());
        params.put("storage", stored.storageKey());
        params.put("checksum", stored.checksum());
        params.put("status", documentStatus);
        params.put("visibility", visibility);
        params.put("user", actor.id());
        sql.update("""
                insert into patient_documents(
                  id,hospital_id,patient_id,encounter_id,consultation_id,prescription_id,laboratory_request_id,
                  radiology_request_id,admission_id,source_department_id,document_type,title,description,file_name,
                  original_file_name,mime_type,file_size_bytes,storage_key,sha256_checksum,document_status,
                  patient_release_status,visibility_level,created_by
                ) values(
                  :id,:hospital,:patient,:encounter,:consultation,:prescription,:lab,:radiology,:admission,:department,
                  :type,:title,:description,:fileName,:original,:mime,:size,:storage,:checksum,:status,'NOT_RELEASED',:visibility,:user
                )
                """, params);
    }

    private void validateGenerationSource(
            GovCarePrincipal actor,
            UUID patientId,
            String sourceKind,
            String sourceId
    ) {
        if (sourceId == null || sourceId.isBlank()) {
            throw ApiException.badRequest("A source record ID is required to generate the PDF.");
        }
        Map<String, Object> params = Map.of(
                "source", sourceId.trim(),
                "patient", patientId,
                "hospital", actor.hospitalId()
        );
        String query = switch (sourceKind) {
            case "patients" -> """
                    select id from patients
                    where hospital_id=:hospital and id=:patient
                      and (id::text=:source or patient_no=:source or nic=:source)
                      and status<>'deleted'
                    """;
            case "consultations" -> """
                    select id from consultations
                    where hospital_id=:hospital and patient_id=:patient and id::text=:source
                    """;
            case "pharmacy" -> """
                    select id from prescriptions
                    where hospital_id=:hospital and patient_id=:patient and id::text=:source
                    """;
            case "laboratory" -> """
                    select id from lab_requests
                    where hospital_id=:hospital and patient_id=:patient and id::text=:source
                    """;
            case "radiology" -> """
                    select id from radiology_requests
                    where hospital_id=:hospital and patient_id=:patient and id::text=:source
                    """;
            default -> throw ApiException.badRequest("Unsupported PDF source type.");
        };
        if (sql.one(query, params).isEmpty()) {
            throw ApiException.badRequest("The PDF source record does not belong to this patient and hospital.");
        }
    }

    private void validateLinks(GovCarePrincipal actor, UUID patientId, UUID encounterId, UUID consultationId,
                               UUID prescriptionId, UUID labId, UUID radiologyId, UUID admissionId) {
        validateLink(actor, patientId, "visits", encounterId);
        validateLink(actor, patientId, "consultations", consultationId);
        validateLink(actor, patientId, "prescriptions", prescriptionId);
        validateLink(actor, patientId, "lab_requests", labId);
        validateLink(actor, patientId, "radiology_requests", radiologyId);
        validateLink(actor, patientId, "admissions", admissionId);
    }

    private void validateLink(GovCarePrincipal actor, UUID patientId, String table, UUID id) {
        if (id == null) return;
        if (!Set.of("visits", "consultations", "prescriptions", "lab_requests", "radiology_requests", "admissions").contains(table)) {
            throw ApiException.badRequest("Unsupported document source link.");
        }
        boolean found = sql.one("select id from " + table + " where id=:id and patient_id=:patient and hospital_id=:hospital",
                Map.of("id", id, "patient", patientId, "hospital", actor.hospitalId())).isPresent();
        if (!found) throw ApiException.badRequest("A linked source record does not belong to this patient and hospital.");
    }

    private void notifyVerified(GovCarePrincipal actor, Map<String, Object> document) {
        UUID target = null;
        UUID sourceId = null;
        String type = String.valueOf(document.get("documentType"));
        if (DocumentPolicy.LAB_TYPES.contains(type)) sourceId = uuid(document.get("laboratoryRequestId"));
        if (DocumentPolicy.RADIOLOGY_TYPES.contains(type)) sourceId = uuid(document.get("radiologyRequestId"));
        if (sourceId != null) {
            String table = DocumentPolicy.LAB_TYPES.contains(type) ? "lab_requests" : "radiology_requests";
            target = sql.one("select requested_by::text as id from " + table + " where id=:id", Map.of("id", sourceId))
                    .map(row -> uuid(row.get("id"))).orElse(null);
        }
        if (target == null) target = uuid(document.get("createdBy"));
        insertNotification(actor, target, "New verified patient report",
                "A verified " + type + " is available for " + document.get("patientNo") + ".",
                "/patients/" + document.get("patientId") + "/documents", "document-verified-" + document.get("id"));
    }

    private void notifyCreator(GovCarePrincipal actor, Map<String, Object> document, String title, String message) {
        insertNotification(actor, uuid(document.get("createdBy")), title, message,
                "/patients/" + document.get("patientId") + "/documents", "document-correction-" + document.get("id"));
    }

    private void notifyPatient(GovCarePrincipal actor, Map<String, Object> document) {
        UUID patientId = uuid(document.get("patientId"));
        UUID userId = sql.one("select id::text as id from app_users where patient_id=:patient and hospital_id=:hospital and status='active' limit 1",
                        Map.of("patient", patientId, "hospital", actor.hospitalId()))
                .map(row -> uuid(row.get("id"))).orElse(null);
        insertNotification(actor, userId, "New report released",
                document.get("title") + " is now available in your patient portal.",
                "/patients/" + patientId + "/documents", "document-released-" + document.get("id"));
    }

    private void insertNotification(GovCarePrincipal actor, UUID targetUser, String title, String message, String url, String groupKey) {
        if (targetUser == null) return;
        sql.update("""
                insert into notifications(hospital_id,target_user_id,title,message,module,priority,action_url,group_key,created_by)
                values(:hospital,:target,:title,:message,'documents','routine',:url,:groupKey,:actor)
                """, Map.of("hospital", actor.hospitalId(), "target", targetUser, "title", title,
                "message", message, "url", url, "groupKey", groupKey, "actor", actor.id()));
    }

    private static boolean matches(Map<String, Object> document, String search, String type, String status,
                                   String release, UUID department, LocalDate from, LocalDate to) {
        if (search != null && !search.isBlank()) {
            String needle = search.trim().toLowerCase(Locale.ROOT);
            String haystack = String.join(" ",
                    Objects.toString(document.get("title"), ""), Objects.toString(document.get("patientName"), ""),
                    Objects.toString(document.get("patientNo"), ""), Objects.toString(document.get("documentType"), ""),
                    Objects.toString(document.get("sourceDepartmentName"), ""), Objects.toString(document.get("originalFileName"), "")
            ).toLowerCase(Locale.ROOT);
            if (!haystack.contains(needle)) return false;
        }
        if (type != null && !type.isBlank() && !Objects.equals(type.trim().toUpperCase(Locale.ROOT), document.get("documentType"))) return false;
        if (status != null && !status.isBlank() && !Objects.equals(status.trim().toUpperCase(Locale.ROOT), document.get("documentStatus"))) return false;
        if (release != null && !release.isBlank() && !Objects.equals(release.trim().toUpperCase(Locale.ROOT), document.get("patientReleaseStatus"))) return false;
        if (department != null && !Objects.equals(department.toString(), String.valueOf(document.get("sourceDepartmentId")))) return false;
        Object created = document.get("createdAt");
        if (created instanceof OffsetDateTime time) {
            if (from != null && time.toLocalDate().isBefore(from)) return false;
            if (to != null && time.toLocalDate().isAfter(to)) return false;
        }
        return true;
    }

    private static Map<String, Object> safeDocument(Map<String, Object> source) {
        Map<String, Object> safe = new LinkedHashMap<>(source);
        safe.remove("storageKey");
        return safe;
    }

    private static String normalizeStatus(String value, Set<String> allowed, String fallback) {
        if (value == null || value.isBlank()) return fallback;
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        if (!allowed.contains(normalized)) throw ApiException.badRequest("Invalid document status.");
        return normalized;
    }

    private static String normalizeVisibility(String value) {
        if (value == null || value.isBlank()) return "DEPARTMENT";
        String normalized = value.trim().toUpperCase(Locale.ROOT).replace('-', '_');
        if (!Set.of("PRIVATE", "DEPARTMENT", "CARE_TEAM", "ADMINISTRATIVE").contains(normalized)) {
            throw ApiException.badRequest("Invalid document visibility level.");
        }
        return normalized;
    }

    private static UUID uuid(Object value) {
        if (value == null) return null;
        if (value instanceof UUID uuid) return uuid;
        try { return UUID.fromString(String.valueOf(value)); }
        catch (IllegalArgumentException ex) { return null; }
    }

    public record DocumentContent(Map<String, Object> document, Resource resource) {}
}
