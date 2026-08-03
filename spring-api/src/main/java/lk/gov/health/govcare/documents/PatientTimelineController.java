package lk.gov.health.govcare.documents;

import lk.gov.health.govcare.security.CurrentUser;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/patients/{patientId}/timeline")
public class PatientTimelineController {
    private final PatientDocumentService documents;
    private final CurrentUser current;

    public PatientTimelineController(PatientDocumentService documents, CurrentUser current) {
        this.documents = documents;
        this.current = current;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PATIENT_VIEW') or hasAuthority('PATIENT_VIEW_SELF')")
    public List<Map<String, Object>> timeline(@PathVariable UUID patientId) {
        return documents.timeline(current.get(), patientId);
    }
}
