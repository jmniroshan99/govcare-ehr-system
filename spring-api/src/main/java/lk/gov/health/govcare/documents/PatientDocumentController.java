package lk.gov.health.govcare.documents;

import lk.gov.health.govcare.security.CurrentUser;
import org.springframework.core.io.Resource;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@RestController
@RequestMapping("/api/patients/{patientId}/documents")
public class PatientDocumentController {
    private final PatientDocumentService documents;
    private final DepartmentSharingService sharing;
    private final CurrentUser current;

    public PatientDocumentController(PatientDocumentService documents, DepartmentSharingService sharing, CurrentUser current) {
        this.documents = documents;
        this.sharing = sharing;
        this.current = current;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('DOCUMENT_VIEW')")
    public List<Map<String, Object>> list(
            @PathVariable UUID patientId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String documentType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String releaseStatus,
            @RequestParam(required = false) UUID departmentId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "newest") String sort
    ) {
        return documents.listPatient(current.get(), patientId, search, documentType, status, releaseStatus, departmentId, from, to, sort);
    }

    @GetMapping("/{documentId}")
    @PreAuthorize("hasAuthority('DOCUMENT_VIEW')")
    public Map<String, Object> get(@PathVariable UUID patientId, @PathVariable UUID documentId) {
        return documents.get(current.get(), patientId, documentId);
    }

    @GetMapping("/{documentId}/content")
    @PreAuthorize("hasAuthority('DOCUMENT_VIEW')")
    public ResponseEntity<Resource> content(
            @PathVariable UUID patientId,
            @PathVariable UUID documentId,
            @RequestParam(defaultValue = "false") boolean download,
            @RequestParam(defaultValue = "false") boolean print
    ) throws IOException {
        PatientDocumentService.DocumentContent content = documents.content(current.get(), patientId, documentId, download, print);
        Map<String, Object> metadata = content.document();
        String mime = Objects.toString(metadata.get("mimeType"), MediaType.APPLICATION_OCTET_STREAM_VALUE);
        String filename = Objects.toString(metadata.get("originalFileName"), Objects.toString(metadata.get("fileName"), "patient-document"));
        ContentDisposition disposition = download
                ? ContentDisposition.attachment().filename(filename).build()
                : ContentDisposition.inline().filename(filename).build();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(mime))
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(content.resource());
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('DOCUMENT_CREATE')")
    public Map<String, Object> upload(
            @PathVariable UUID patientId,
            @RequestParam MultipartFile file,
            @RequestParam String documentType,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String description,
            @RequestParam(defaultValue = "DRAFT") String status,
            @RequestParam(defaultValue = "DEPARTMENT") String visibilityLevel,
            @RequestParam(required = false) UUID encounterId,
            @RequestParam(required = false) UUID consultationId,
            @RequestParam(required = false) UUID prescriptionId,
            @RequestParam(required = false) UUID laboratoryRequestId,
            @RequestParam(required = false) UUID radiologyRequestId,
            @RequestParam(required = false) UUID admissionId
    ) throws IOException {
        return documents.upload(current.get(), patientId, file, documentType, title, description, status, visibilityLevel,
                encounterId, consultationId, prescriptionId, laboratoryRequestId, radiologyRequestId, admissionId);
    }

    @PostMapping("/generate")
    @PreAuthorize("hasAuthority('DOCUMENT_CREATE')")
    public Map<String, Object> generate(@PathVariable UUID patientId, @RequestBody DocumentDtos.GenerateDocumentRequest request) throws IOException {
        return documents.generate(current.get(), patientId, request);
    }

    @PatchMapping("/{documentId}/verify")
    @PreAuthorize("hasAuthority('DOCUMENT_VERIFY')")
    public Map<String, Object> verify(@PathVariable UUID patientId, @PathVariable UUID documentId) {
        return documents.verify(current.get(), patientId, documentId);
    }

    @PatchMapping("/{documentId}/reject")
    @PreAuthorize("hasAuthority('DOCUMENT_REJECT')")
    public Map<String, Object> reject(
            @PathVariable UUID patientId,
            @PathVariable UUID documentId,
            @RequestBody(required = false) DocumentDtos.RejectDocumentRequest request
    ) {
        return documents.reject(current.get(), patientId, documentId, request == null ? null : request.reason());
    }

    @PatchMapping("/{documentId}/release")
    @PreAuthorize("hasAuthority('DOCUMENT_RELEASE_TO_PATIENT')")
    public Map<String, Object> release(@PathVariable UUID patientId, @PathVariable UUID documentId) {
        return documents.release(current.get(), patientId, documentId);
    }

    @PatchMapping("/{documentId}/revoke-release")
    @PreAuthorize("hasAuthority('DOCUMENT_REVOKE_PATIENT_RELEASE')")
    public Map<String, Object> revokeRelease(@PathVariable UUID patientId, @PathVariable UUID documentId) {
        return documents.revokeRelease(current.get(), patientId, documentId);
    }

    @PatchMapping("/{documentId}/archive")
    @PreAuthorize("hasAuthority('DOCUMENT_ARCHIVE')")
    public Map<String, Object> archive(@PathVariable UUID patientId, @PathVariable UUID documentId) {
        return documents.archive(current.get(), patientId, documentId);
    }

    @PostMapping("/{documentId}/share")
    @PreAuthorize("hasAuthority('DOCUMENT_SHARE')")
    public List<Map<String, Object>> share(
            @PathVariable UUID patientId,
            @PathVariable UUID documentId,
            @RequestBody DocumentDtos.ShareDocumentRequest request
    ) {
        return sharing.share(current.get(), patientId, documentId, request.departmentId(), request.accessType(), request.expiresAt());
    }

    @DeleteMapping("/{documentId}/share/{departmentId}")
    @PreAuthorize("hasAuthority('DOCUMENT_SHARE')")
    public ResponseEntity<Void> revokeShare(
            @PathVariable UUID patientId,
            @PathVariable UUID documentId,
            @PathVariable UUID departmentId
    ) {
        sharing.revoke(current.get(), patientId, documentId, departmentId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{documentId}/shares")
    @PreAuthorize("hasAuthority('DOCUMENT_AUDIT_VIEW')")
    public List<Map<String, Object>> shares(@PathVariable UUID patientId, @PathVariable UUID documentId) {
        return sharing.shares(current.get(), patientId, documentId);
    }

    @GetMapping("/{documentId}/audit")
    @PreAuthorize("hasAuthority('DOCUMENT_AUDIT_VIEW')")
    public List<Map<String, Object>> audit(@PathVariable UUID patientId, @PathVariable UUID documentId) {
        return documents.audit(current.get(), patientId, documentId);
    }
}
