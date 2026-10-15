package lk.gov.health.govcare.staff;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public final class StaffDtos {
    private StaffDtos() {}

    public record CreateStaffRequest(
            String title,
            String firstName,
            String lastName,
            @NotBlank @Size(max = 150) String fullName,
            @Size(max = 100) String nationalId,
            LocalDate dateOfBirth,
            @Size(max = 30) String gender,
            @Size(max = 40) String phone,
            @NotBlank @Email @Size(max = 180) String email,
            @Size(max = 500) String address,
            @NotNull UUID hospitalId,
            UUID departmentId,
            @NotBlank String roleCode,
            @Size(max = 120) String professionalRegistrationNo,
            @Size(max = 120) String jobTitle,
            @NotBlank String employmentType,
            LocalDate joiningDate,
            @NotBlank @Size(min = 8, max = 100) String temporaryPassword,
            boolean mustChangePassword,
            boolean active
    ) {}

    public record UpdateStaffRequest(
            String title,
            String firstName,
            String lastName,
            @Size(min = 2, max = 150) String fullName,
            @Size(max = 100) String nationalId,
            LocalDate dateOfBirth,
            @Size(max = 30) String gender,
            @Size(max = 40) String phone,
            @Email @Size(max = 180) String email,
            @Size(max = 500) String address,
            @Size(max = 120) String professionalRegistrationNo,
            @Size(max = 120) String jobTitle,
            String employmentType,
            LocalDate joiningDate,
            String workStatus
    ) {}

    public record RoleChangeRequest(@NotBlank String roleCode) {}
    public record DepartmentChangeRequest(UUID departmentId) {}
    public record StatusChangeRequest(boolean active) {}
    public record TransferRequest(@NotNull UUID hospitalId, UUID departmentId) {}
    public record ResetPasswordRequest(@NotBlank @Size(min = 8, max = 100) String temporaryPassword) {}
}
