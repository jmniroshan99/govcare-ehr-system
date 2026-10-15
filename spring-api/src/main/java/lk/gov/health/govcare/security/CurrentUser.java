package lk.gov.health.govcare.security;

import lk.gov.health.govcare.common.ApiException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class CurrentUser {
    public GovCarePrincipal get() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof GovCarePrincipal principal)) {
            throw ApiException.unauthorized("Authentication required.");
        }
        return principal;
    }
}
