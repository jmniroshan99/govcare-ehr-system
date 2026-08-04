package lk.gov.health.govcare.ward;

import jakarta.validation.constraints.*;

import java.time.OffsetDateTime;
import java.util.UUID;

public final class WardDtos {
    private WardDtos() {}

    public record WardRequest(
            UUID hospitalId,
            UUID departmentId,
            @NotBlank String wardCode,
            @NotBlank String wardName,
            @NotBlank String wardType,
            String building,
            String floor,
            String genderRestriction,
            String ageRestriction,
            boolean isolationCapable,
            String nurseStation,
            UUID wardManagerId,
            UUID responsibleConsultantId,
            String phone,
            String status
    ) {}

    public record RoomRequest(
            @NotBlank String roomNumber,
            String roomName,
            @NotBlank String roomType,
            String floor,
            @Min(1) int maximumBeds,
            String genderRestriction,
            boolean isolationRoom,
            boolean negativePressureRoom,
            boolean oxygenAvailable,
            boolean ventilatorSupport,
            boolean bathroomAvailable,
            String status
    ) {}

    public record BedRequest(
            UUID roomId,
            @NotBlank String bedNumber,
            String bedCode,
            @NotBlank String bedType,
            String genderRestriction,
            String ageRestriction,
            boolean isolationSupport,
            boolean oxygenSupport,
            boolean ventilatorSupport,
            boolean monitorSupport,
            boolean electricBed,
            boolean accessibleBed
    ) {}

    public record BedStatusRequest(@NotBlank String status, String reason) {}

    public record BedSuggestionRequest(
            String requiredWardType,
            String genderRestriction,
            String ageRestriction,
            boolean isolationRequired,
            boolean oxygenRequired,
            boolean ventilatorRequired,
            boolean accessibleRequired
    ) {}

    public record ReserveBedRequest(
            @NotNull UUID bedId,
            String priority,
            @Min(5) @Max(1440) Integer reservationMinutes,
            String overrideReason
    ) {}

    public record AllocateBedRequest(@NotNull UUID bedId, UUID reservationId) {}

    public record ReleaseBedRequest(String reason, boolean discharge) {}

    public record InternalTransferRequest(
            @NotNull UUID admissionId,
            UUID destinationDepartmentId,
            @NotNull UUID destinationWardId,
            UUID destinationBedId,
            @NotBlank String transferReason,
            String priority,
            String clinicalNotes,
            boolean isolationRequired,
            boolean transportAssistanceRequired
    ) {}

    public record TransferBedRequest(@NotNull UUID bedId, Integer reservationMinutes) {}
    public record TransferReasonRequest(String reason) {}
}
