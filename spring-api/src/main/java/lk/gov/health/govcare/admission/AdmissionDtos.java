package lk.gov.health.govcare.admission;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public final class AdmissionDtos {
    private AdmissionDtos() {}

    public record IdentityConfirmationRequest(
            @NotBlank String patientIdentifier,
            UUID expectedWardId,
            UUID expectedBedId
    ) {}

    public record CreateAdmissionRequest(
            @NotNull UUID patientId,
            @NotNull UUID identityConfirmationId,
            @NotNull UUID wardId,
            @NotNull UUID bedId,
            UUID visitId,
            UUID referringDepartmentId,
            UUID admittingDoctorId,
            @NotBlank String admissionType,
            @NotBlank String admissionReason,
            String presentingComplaint,
            String provisionalDiagnosis,
            @NotBlank String priority,
            boolean isolationRequired,
            String specialNursingRequirement,
            String admissionNotes
    ) {}

    public record TransferAdmissionRequest(
            @NotNull UUID wardId,
            @NotNull UUID bedId,
            @NotBlank String reason,
            boolean isolationRequired
    ) {}

    public record DischargeAdmissionRequest(
            @NotBlank String reason,
            String notes
    ) {}
}
