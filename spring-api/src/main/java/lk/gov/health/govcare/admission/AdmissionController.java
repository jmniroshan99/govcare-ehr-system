package lk.gov.health.govcare.admission;

import jakarta.validation.Valid;
import lk.gov.health.govcare.security.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static lk.gov.health.govcare.admission.AdmissionDtos.*;

@RestController
@RequestMapping("/api")
public class AdmissionController {
    private final AdmissionService admissions;
    private final CurrentUser current;

    public AdmissionController(AdmissionService admissions, CurrentUser current) {
        this.admissions = admissions;
        this.current = current;
    }

    @GetMapping("/admissions/reference")
    @PreAuthorize("hasAuthority('ADMISSION_VIEW')")
    public Map<String, Object> reference() {
        return admissions.reference(current.get());
    }

    @GetMapping("/admissions")
    @PreAuthorize("hasAuthority('ADMISSION_VIEW')")
    public Map<String, Object> list(@RequestParam(required = false) String status,
                                    @RequestParam(required = false) String search) {
        return Map.of("items", admissions.list(current.get(), status, search));
    }

    @GetMapping("/admissions/{admissionId}")
    @PreAuthorize("hasAuthority('ADMISSION_VIEW')")
    public Map<String, Object> detail(@PathVariable UUID admissionId) {
        return Map.of("admission", admissions.detail(current.get(), admissionId));
    }

    @GetMapping("/patients/{patientIdentifier}/active-admission")
    @PreAuthorize("hasAuthority('ADMISSION_VIEW')")
    public Map<String, Object> activeAdmission(@PathVariable String patientIdentifier) {
        Map<String, Object> response = new LinkedHashMap<>();
        admissions.activeAdmission(current.get(), patientIdentifier).ifPresentOrElse(
                value -> {
                    response.put("active", true);
                    response.put("admission", value);
                },
                () -> {
                    response.put("active", false);
                    response.put("admission", null);
                }
        );
        return response;
    }

    @PostMapping("/patients/confirm-identity")
    @PreAuthorize("hasAuthority('PATIENT_IDENTITY_CONFIRM')")
    public Map<String, Object> confirmIdentity(@Valid @RequestBody IdentityConfirmationRequest input) {
        return admissions.confirmIdentity(current.get(), input);
    }

    @PostMapping("/admissions")
    @PreAuthorize("hasAuthority('ADMISSION_CREATE')")
    public ResponseEntity<Map<String, Object>> create(@Valid @RequestBody CreateAdmissionRequest input) {
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("admission", admissions.create(current.get(), input)));
    }

    @PostMapping("/admissions/{admissionId}/assign-bed")
    @PreAuthorize("hasAuthority('ADMISSION_CREATE')")
    public Map<String, Object> assignBedAlias(@PathVariable UUID admissionId) {
        // Admissions created through the atomic endpoint are already assigned to a bed.
        return Map.of("admission", admissions.detail(current.get(), admissionId), "alreadyAssigned", true);
    }

    @PostMapping("/admissions/{admissionId}/transfer")
    @PreAuthorize("hasAuthority('ADMISSION_TRANSFER')")
    public Map<String, Object> transfer(@PathVariable UUID admissionId,
                                        @Valid @RequestBody TransferAdmissionRequest input) {
        return Map.of("admission", admissions.transfer(current.get(), admissionId, input));
    }

    @PostMapping("/admissions/{admissionId}/discharge")
    @PreAuthorize("hasAuthority('ADMISSION_DISCHARGE')")
    public Map<String, Object> discharge(@PathVariable UUID admissionId,
                                         @Valid @RequestBody DischargeAdmissionRequest input) {
        return Map.of("admission", admissions.discharge(current.get(), admissionId, input));
    }
}
