package lk.gov.health.govcare.media;

import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.documents.DocumentAccessService;
import lk.gov.health.govcare.documents.DocumentAuditService;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
public class MediaService {
    private final Path root;
    private final SqlSupport sql;
    private final DocumentAccessService documentAccess;
    private final DocumentAuditService documentAudit;

    public MediaService(
            @Value("${govcare.storage.root}") String root,
            SqlSupport sql,
            DocumentAccessService documentAccess,
            DocumentAuditService documentAudit
    ) {
        this.root = Path.of(root).toAbsolutePath().normalize();
        this.sql = sql;
        this.documentAccess = documentAccess;
        this.documentAudit = documentAudit;
    }

    @Transactional
    public Map<String, Object> store(
            GovCarePrincipal actor,
            MultipartFile file,
            UUID patientId,
            String module,
            String visibility
    ) throws IOException {
        if (file == null || file.isEmpty()) throw ApiException.badRequest("File is empty.");
        if (patientId != null) documentAccess.requirePatient(actor, patientId);
        if ("patient-released".equalsIgnoreCase(visibility == null ? "" : visibility.trim())) {
            throw ApiException.badRequest("A document must be verified and released through the document workflow.");
        }
        if (patientId != null)
            documentAccess.requireCreate(actor, documentType(safeModule(module)));

        UUID id = UUID.randomUUID();
        String original = StringUtils.cleanPath(Objects.requireNonNullElse(file.getOriginalFilename(), "upload.bin"));
        String extension = safeExtension(original);
        String safeModule = safeModule(module);
        Path folder = root.resolve(actor.hospitalId().toString())
                .resolve(safeModule)
                .resolve(patientId == null ? "general" : patientId.toString())
                .normalize();
        ensureInsideRoot(folder);
        Files.createDirectories(folder);
        Path target = folder.resolve(id + extension).normalize();
        ensureInsideRoot(target);

        MessageDigest digest = sha256();
        try (InputStream input = new DigestInputStream(file.getInputStream(), digest)) {
            Files.copy(input, target, StandardCopyOption.REPLACE_EXISTING);
        }

        String visibilityLevel = visibility == null || visibility.isBlank() ? "private" : visibility.trim();
        String releaseStatus = "internal";
        String mimeType = Objects.requireNonNullElse(file.getContentType(), "application/octet-stream");
        String checksum = HexFormat.of().formatHex(digest.digest());

        Map<String, Object> params = params(
                "id", id,
                "hospital", actor.hospitalId(),
                "patient", patientId,
                "user", actor.id(),
                "role", actor.role(),
                "module", safeModule,
                "url", "/api/media/" + id + "/download",
                "path", target.toString(),
                "file", id + extension,
                "original", original,
                "mime", mimeType,
                "size", file.getSize(),
                "checksum", checksum,
                "visibility", visibilityLevel,
                "release", releaseStatus
        );
        sql.update("""
                insert into global_media(
                  id,hospital_id,patient_id,uploaded_by,uploader_role,module,file_url,file_path,file_name,
                  original_file_name,mime_type,file_size_bytes,sha256_checksum,storage_provider,
                  visibility_level,release_status,status
                ) values(
                  :id,:hospital,:patient,:user,:role,:module,:url,:path,:file,:original,:mime,:size,
                  :checksum,'spring-local',:visibility,:release,'active'
                )
                """, params);

        // Patient media always enters the governed document registry before it can be viewed.
        if (patientId != null) {
            indexPatientMedia(actor, id, patientId, safeModule, original, id + extension, mimeType,
                    file.getSize(), target.toString(), checksum, visibilityLevel);
        }
        return get(actor, id);
    }

    public List<Map<String, Object>> list(GovCarePrincipal actor, UUID patientId) {
        boolean portal = "patient".equals(actor.role()) || "guardian".equals(actor.role());
        if (portal) {
            if (actor.patientId() == null) return List.of();
            if (patientId != null && !actor.patientId().equals(patientId))
                throw ApiException.forbidden("Only documents for the linked patient are available.");
            patientId = actor.patientId();
        }
        String query = """
                select id::text as "id",hospital_id::text as "hospitalId",patient_id::text as "patientId",
                       module,file_url as "fileUrl",file_name as "fileName",original_file_name as "originalFileName",
                       mime_type as "mimeType",file_size_bytes as "fileSizeBytes",sha256_checksum as "sha256Checksum",
                       visibility_level as "visibilityLevel",release_status as "releaseStatus",created_at as "createdAt"
                from global_media where hospital_id=:hospital and status='active'
                """ + (patientId != null ? " and patient_id=:patient" : "")
                + (portal ? " and release_status='released'" : "")
                + " order by created_at desc limit 100";
        Map<String, Object> values = new HashMap<>();
        values.put("hospital", actor.hospitalId());
        if (patientId != null) values.put("patient", patientId);
        return sql.list(query, values).stream().filter(media -> canViewMedia(actor, media)).toList();
    }

    public Map<String, Object> get(GovCarePrincipal actor, UUID id) {
        Map<String, Object> media = sql.required("""
                select id::text as "id",hospital_id::text as "hospitalId",patient_id::text as "patientId",module,
                       file_url as "fileUrl",file_path as "filePath",file_name as "fileName",
                       original_file_name as "originalFileName",mime_type as "mimeType",
                       file_size_bytes as "fileSizeBytes",sha256_checksum as "sha256Checksum",
                       visibility_level as "visibilityLevel",release_status as "releaseStatus",created_at as "createdAt"
                from global_media where id=:id and hospital_id=:hospital and status='active'
                """, Map.of("id", id, "hospital", actor.hospitalId()), "Media document not found.");
        if (!canViewMedia(actor, media)) throw ApiException.forbidden("Media document is unavailable to this account.");
        return media;
    }

    private boolean canViewMedia(GovCarePrincipal actor, Map<String, Object> media) {
        UUID patientId = parseUuid(media.get("patientId"));
        boolean portal = "patient".equals(actor.role()) || "guardian".equals(actor.role());
        if (portal && (!Objects.equals(actor.patientId(), patientId)
                || !"released".equals(media.get("releaseStatus")))) return false;
        if (patientId == null) return !portal;
        UUID id = parseUuid(media.get("id"));
        boolean indexed = sql.one("select id from patient_documents where id=:id and patient_id=:p and hospital_id=:h",
                Map.of("id", id, "p", patientId, "h", actor.hospitalId())).isPresent();
        if (!indexed) return false;
        Map<String, Object> document = documentAccess.requireDocument(actor, patientId, id);
        return documentAccess.canView(actor, document);
    }

    public Resource resource(GovCarePrincipal actor, UUID id) throws IOException {
        Map<String, Object> media = get(actor, id);
        Path path = Path.of(String.valueOf(media.get("filePath"))).toAbsolutePath().normalize();
        ensureInsideRoot(path);
        Resource resource = new UrlResource(path.toUri());
        if (!resource.exists() || !resource.isReadable()) throw new IOException("Stored file is not readable.");
        return resource;
    }

    @Transactional
    public Map<String, Object> release(GovCarePrincipal actor, UUID id) {
        Map<String, Object> media = get(actor, id);
        UUID patientId = parseUuid(media.get("patientId"));
        Map<String, Object> centralDocument = null;
        if (patientId != null && sql.one(
                "select id from patient_documents where id=:id and patient_id=:patient and hospital_id=:hospital",
                Map.of("id", id, "patient", patientId, "hospital", actor.hospitalId())
        ).isPresent()) {
            centralDocument = documentAccess.requireDocument(actor, patientId, id);
            // The legacy Media API must not bypass document verification or role-specific release rules.
            documentAccess.requireRelease(actor, centralDocument);
        }
        if (centralDocument == null) throw ApiException.forbidden("Only verified patient documents can be released.");

        int changed = sql.update("""
                update global_media set release_status='released',visibility_level='patient-released',
                  released_by=:user,released_at=now()
                where id=:id and hospital_id=:hospital
                """, params("user", actor.id(), "id", id, "hospital", actor.hospitalId()));
        if (changed == 0) throw ApiException.notFound("Media document not found.");
        if (centralDocument != null) {
            sql.update("""
                    update patient_documents set patient_release_status='RELEASED_TO_PATIENT',
                      visibility_level='PATIENT_RELEASED',released_at=now()
                    where id=:id and hospital_id=:hospital
                    """, Map.of("id", id, "hospital", actor.hospitalId()));
            Map<String, Object> updated = documentAccess.requireDocument(actor, patientId, id);
            documentAudit.record(actor, updated, "DOCUMENT_RELEASED", "SUCCESS");
        }
        return get(actor, id);
    }

    private void indexPatientMedia(
            GovCarePrincipal actor,
            UUID id,
            UUID patientId,
            String module,
            String original,
            String fileName,
            String mimeType,
            long size,
            String storageKey,
            String checksum,
            String visibility
    ) {
        String type = documentType(module);
        Map<String, Object> values = params(
                "id", id,
                "hospital", actor.hospitalId(),
                "patient", patientId,
                "department", actor.departmentId(),
                "type", type,
                "title", original.isBlank() ? defaultTitle(type) : original,
                "file", fileName,
                "original", original,
                "mime", mimeType,
                "size", size,
                "storage", storageKey,
                "checksum", checksum,
                "status", "SUBMITTED",
                "patientRelease", "NOT_RELEASED",
                "documentVisibility", normalizeVisibility(visibility),
                "user", actor.id()
        );
        sql.update("""
                insert into patient_documents(
                  id,hospital_id,patient_id,source_department_id,document_type,title,description,file_name,
                  original_file_name,mime_type,file_size_bytes,storage_key,sha256_checksum,document_status,
                  patient_release_status,visibility_level,created_by
                ) values(
                  :id,:hospital,:patient,:department,:type,:title,'Uploaded through GovCare Media',:file,
                  :original,:mime,:size,:storage,:checksum,:status,:patientRelease,:documentVisibility,:user
                ) on conflict (id) do nothing
                """, values);
    }

    private static String documentType(String module) {
        String value = module.toLowerCase(Locale.ROOT);
        if (value.contains("laboratory") || value.equals("lab")) return "LABORATORY_RESULT";
        if (value.contains("radiology")) return "RADIOLOGY_RESULT";
        if (value.contains("pharmacy") || value.contains("prescription")) return "PRESCRIPTION";
        if (value.contains("consult")) return "CONSULTATION_REPORT";
        if (value.contains("admission")) return "ADMISSION_REPORT";
        if (value.contains("ward") || value.contains("nurs")) return "NURSING_REPORT";
        if (value.contains("emergency")) return "EMERGENCY_REPORT";
        if (value.contains("operation") || value.contains("theatre")) return "OPERATION_THEATRE_REPORT";
        if (value.contains("registration") || value.contains("patient")) return "PATIENT_REGISTRATION";
        return "OTHER_CLINICAL_DOCUMENT";
    }

    private static String defaultTitle(String type) {
        return type.replace('_', ' ').toLowerCase(Locale.ROOT);
    }

    private static String normalizeVisibility(String visibility) {
        String value = visibility == null ? "DEPARTMENT" : visibility.trim().toUpperCase(Locale.ROOT).replace('-', '_');
        return switch (value) {
            case "PRIVATE", "DEPARTMENT", "CARE_TEAM", "ADMINISTRATIVE" -> value;
            default -> "DEPARTMENT";
        };
    }

    private static String safeModule(String module) {
        String value = module == null || module.isBlank() ? "other" : module;
        return value.replaceAll("[^A-Za-z0-9_-]", "_");
    }

    private static String safeExtension(String name) {
        int index = name.lastIndexOf('.');
        if (index < 0) return "";
        String extension = name.substring(index).replaceAll("[^A-Za-z0-9.]", "");
        return extension.length() > 12 ? "" : extension;
    }

    private void ensureInsideRoot(Path path) {
        if (!path.toAbsolutePath().normalize().startsWith(root)) {
            throw ApiException.forbidden("Invalid media storage path.");
        }
    }

    private static MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 is unavailable.", exception);
        }
    }

    private static UUID parseUuid(Object value) {
        if (value == null) return null;
        try {
            return UUID.fromString(String.valueOf(value));
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private static Map<String, Object> params(Object... values) {
        Map<String, Object> result = new HashMap<>();
        for (int index = 0; index < values.length; index += 2) {
            result.put(String.valueOf(values[index]), values[index + 1]);
        }
        return result;
    }
}
