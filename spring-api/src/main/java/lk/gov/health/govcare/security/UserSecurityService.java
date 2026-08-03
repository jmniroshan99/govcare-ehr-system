package lk.gov.health.govcare.security;

import com.fasterxml.jackson.databind.JsonNode;
import lk.gov.health.govcare.common.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

@Service
public class UserSecurityService {
    private final AppUserRepository users;
    private final PermissionRepository permissions;

    public UserSecurityService(AppUserRepository users, PermissionRepository permissions) {
        this.users = users;
        this.permissions = permissions;
    }

    @Transactional(readOnly = true)
    public GovCarePrincipal load(UUID id) {
        AppUserEntity user = users.findByIdWithRole(id).orElseThrow(() -> ApiException.unauthorized("Authenticated account no longer exists."));
        return principal(user);
    }

    @Transactional(readOnly = true)
    public GovCarePrincipal principal(AppUserEntity user) {
        String role = user.getRole().name();
        Set<String> allowed = new LinkedHashSet<>(permissions.findCodesByRole(role));
        JsonNode overrides = user.getPermissions();
        if (overrides != null && overrides.isArray()) {
            overrides.forEach(node -> {
                String value = node.asText("").trim();
                if (!value.isBlank()) allowed.add(value);
            });
        }
        return new GovCarePrincipal(
                user.getId(), user.getHospitalId(), user.getDepartmentId(), user.getPatientId(),
                user.getEmail(), user.getFullName(), role, Set.copyOf(allowed), user.getStatus() == UserStatus.active
        );
    }
}
