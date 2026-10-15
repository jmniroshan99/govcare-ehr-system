package lk.gov.health.govcare.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtService jwt;
    private final UserSecurityService users;

    public JwtAuthenticationFilter(JwtService jwt, UserSecurityService users) {
        this.jwt = jwt;
        this.users = users;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            chain.doFilter(request, response);
            return;
        }

        GovCarePrincipal principal;
        String token = header.substring(7).trim();
        try {
            var claims = jwt.parse(token);
            UUID userId = UUID.fromString(claims.getSubject());
            principal = users.load(userId);
            if (!principal.active()) throw new IllegalStateException("Account is inactive");
            Object version = claims.get("credentialsVersion");
            if (!(version instanceof Number number) || number.longValue() != principal.credentialsVersion())
                throw new IllegalStateException("Credentials have changed");
        } catch (Exception ex) {
            SecurityContextHolder.clearContext();
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"message\":\"Invalid or expired authentication token.\"}");
            return;
        }
        if (principal.mustChangePassword()
                && !request.getRequestURI().equals(request.getContextPath() + "/api/auth/me")
                && !request.getRequestURI().equals(request.getContextPath() + "/api/auth/change-password")) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"message\":\"Change your temporary password before accessing patient data.\"}");
            return;
        }
        var authentication = new UsernamePasswordAuthenticationToken(principal, token, principal.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(authentication);
        chain.doFilter(request, response);
    }
}
