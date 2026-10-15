package lk.gov.health.govcare.documents;

import lk.gov.health.govcare.security.CurrentUser;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/departments/{departmentId}")
public class DepartmentDocumentController {
    private final PatientDocumentService documents;
    private final CurrentUser current;

    public DepartmentDocumentController(PatientDocumentService documents, CurrentUser current) {
        this.documents = documents;
        this.current = current;
    }

    @GetMapping("/documents")
    @PreAuthorize("hasAuthority('DOCUMENT_VIEW_DEPARTMENT') or hasAuthority('DOCUMENT_VIEW_ALL_HOSPITAL')")
    public List<Map<String, Object>> documents(
            @PathVariable UUID departmentId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String documentType,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "newest") String sort
    ) {
        return documents.listDepartment(current.get(), departmentId, search, documentType, status, sort);
    }

    @GetMapping("/requests")
    @PreAuthorize("hasAuthority('DOCUMENT_VIEW_DEPARTMENT') or hasAuthority('LAB_REQUEST_VIEW') or hasAuthority('RADIOLOGY_REQUEST_VIEW') or hasAuthority('PRESCRIPTION_VIEW')")
    public List<Map<String, Object>> requests(@PathVariable UUID departmentId) {
        return documents.departmentRequests(current.get(), departmentId);
    }
}
