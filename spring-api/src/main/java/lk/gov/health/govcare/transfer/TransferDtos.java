package lk.gov.health.govcare.transfer;

import jakarta.validation.constraints.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public final class TransferDtos {
    private TransferDtos() {}

    public record CreateInterHospitalTransferRequest(
            @NotNull UUID sourceAdmissionId,
            @NotNull UUID destinationHospitalId,
            UUID requestedDestinationDepartmentId,
            String requestedWardType,
            String requestedSpecialty,
            UUID preferredConsultantId,
            @NotBlank String transferReason,
            @NotBlank String clinicalSummary,
            String currentDiagnosis,
            String currentCondition,
            String allergies,
            String currentMedication,
            String infectionStatus,
            boolean isolationRequired,
            boolean oxygenRequired,
            boolean ventilatorRequired,
            String mobilityStatus,
            String riskLevel,
            String requiredEquipment,
            String priority,
            OffsetDateTime estimatedDeparture,
            OffsetDateTime estimatedArrival,
            List<UUID> documentIds
    ) {}

    public record InformationRequest(@NotBlank String requestedInformation) {}
    public record RejectionRequest(@NotBlank String reason) {}
    public record DestinationBedRequest(@NotNull UUID bedId, Integer reservationMinutes) {}

    public record TransportRequest(
            @NotBlank String transportType,
            String ambulanceProvider,
            String vehicleNumber,
            String driverName,
            String driverContact,
            UUID escortDoctorId,
            UUID escortNurseId,
            OffsetDateTime estimatedDeparture,
            OffsetDateTime estimatedArrival,
            String transportNotes
    ) {}

    public record AttachDocumentRequest(@NotNull UUID patientDocumentId, @NotBlank String purpose) {}
    public record CancelRequest(@NotBlank String reason) {}
}
