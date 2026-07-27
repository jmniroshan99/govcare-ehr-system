package lk.gov.health.govcare.security;

import java.util.UUID;

public record RequestUser(
  UUID userId,
  UUID hospitalId,
  UUID patientId,
  String role,
  String fullName
) {
  public boolean hasAnyRole(String... allowedRoles) {
    for (String allowedRole : allowedRoles) {
      if (allowedRole.equals(role)) return true;
    }
    return false;
  }
}

