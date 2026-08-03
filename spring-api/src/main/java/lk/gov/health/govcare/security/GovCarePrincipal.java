package lk.gov.health.govcare.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public record GovCarePrincipal(
        UUID id,
        UUID hospitalId,
        UUID departmentId,
        UUID patientId,
        String email,
        String fullName,
        String role,
        Set<String> permissions,
        boolean active
) implements UserDetails {
    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return Stream.concat(
                Stream.of("ROLE_" + role.toUpperCase()),
                permissions.stream()
        ).map(SimpleGrantedAuthority::new).collect(Collectors.toSet());
    }
    @Override public String getPassword() { return ""; }
    @Override public String getUsername() { return email; }
    @Override public boolean isAccountNonExpired() { return true; }
    @Override public boolean isAccountNonLocked() { return active; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled() { return active; }
}
