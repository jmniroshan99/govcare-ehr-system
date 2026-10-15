package lk.gov.health.govcare.facility;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class FacilityDtos {
    private FacilityDtos() {}

    public record HospitalRequest(
            @NotBlank
            @Pattern(regexp = "[A-Za-z0-9][A-Za-z0-9_-]{1,19}", message = "must contain 2 to 20 letters, numbers, underscores or hyphens")
            String code,
            @NotBlank @Size(max = 160) String name,
            @NotBlank String type,
            @Size(max = 120) String city,
            @NotBlank String district,
            @NotBlank String province,
            @Size(max = 500) String address,
            @Size(max = 40) String phone,
            @Email @Size(max = 180) String email,
            @Size(max = 160) String directorName,
            boolean provisionCoreDepartments
    ) {}
}
