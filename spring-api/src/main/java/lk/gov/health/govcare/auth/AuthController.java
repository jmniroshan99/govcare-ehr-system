package lk.gov.health.govcare.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lk.gov.health.govcare.audit.LoginAuditService;
import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.OffsetDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private static final Logger log = LoggerFactory.getLogger(AuthController.class);
    private final AppUserRepository users;
    private final RoleRepository roles;
    private final UserSecurityService userSecurity;
    private final PasswordEncoder passwords;
    private final JwtService jwt;
    private final SqlSupport sql;
    private final ObjectMapper mapper;
    private final CurrentUser current;
    private final LoginAuditService loginAudit;

    public AuthController(AppUserRepository users, RoleRepository roles, UserSecurityService userSecurity,
                          PasswordEncoder passwords, JwtService jwt, SqlSupport sql, ObjectMapper mapper,
                          CurrentUser current, LoginAuditService loginAudit) {
        this.users = users;
        this.roles = roles;
        this.userSecurity = userSecurity;
        this.passwords = passwords;
        this.jwt = jwt;
        this.sql = sql;
        this.mapper = mapper;
        this.current = current;
        this.loginAudit = loginAudit;
    }

    public record LoginRequest(@Email @NotBlank String email, @NotBlank String password,
                               String deviceBrowser, String operatingSystem, String location) {}
    public record RegisterPatientRequest(@Email @NotBlank String email, @Size(min=8) String password, @Size(min=2,max=150) String displayName) {}
    public record PatientProfileRequest(@NotBlank String uid, @Email String email, @NotBlank String displayName, String photoURL) {}
    public record ChangePasswordRequest(@NotBlank String currentPassword, @Size(min=8,max=100) String newPassword) {}

    @PostMapping("/local-login")
    public Map<String, Object> login(@Valid @RequestBody LoginRequest input, HttpServletRequest request) {
        String email = input.email().trim().toLowerCase();
        Optional<AppUserEntity> matched = users.findByEmailIgnoreCaseWithRole(email);
        if (matched.isEmpty()) {
            recordLoginSafely(null, email, false, "Invalid email or password.", input.deviceBrowser(), input.operatingSystem(), input.location(), request);
            throw ApiException.unauthorized("Invalid email or password.");
        }

        AppUserEntity user = matched.get();
        if (!passwords.matches(input.password(), user.getPasswordHash())) {
            recordLoginSafely(user, email, false, "Invalid email or password.", input.deviceBrowser(), input.operatingSystem(), input.location(), request);
            throw ApiException.unauthorized("Invalid email or password.");
        }
        if (user.getStatus() != UserStatus.active) {
            String reason = "Account is " + user.getStatus().name() + ".";
            recordLoginSafely(user, email, false, reason, input.deviceBrowser(), input.operatingSystem(), input.location(), request);
            throw ApiException.forbidden("This account is " + user.getStatus().name() + ".");
        }

        user.setLastLoginAt(OffsetDateTime.now());
        users.saveAndFlush(user);
        GovCarePrincipal principal = userSecurity.principal(user);
        Map<String, Object> userProfile = profile(user, principal);
        String sessionId = recordLoginSafely(user, email, true, null, input.deviceBrowser(), input.operatingSystem(), input.location(), request);
        return Map.of(
                "token", jwt.generate(principal),
                "sessionId", sessionId,
                "user", userProfile
        );
    }

    @GetMapping("/me")
    @Transactional(readOnly = true)
    public Map<String, Object> currentUserProfile() {
        GovCarePrincipal actor = current.get();

        AppUserEntity user = users.findByIdWithRole(actor.id())
                .orElseThrow(() -> ApiException.unauthorized(
                        "Authenticated account profile was not found."
                ));

        if (user.getStatus() != UserStatus.active) {
            throw ApiException.forbidden(
                    "This account is " + user.getStatus().name() + "."
            );
        }

        GovCarePrincipal principal = userSecurity.principal(user);
        return profile(user, principal);
    }

    @PostMapping("/register-patient")
    public ResponseEntity<Map<String, Object>> registerPatient(@Valid @RequestBody RegisterPatientRequest input, HttpServletRequest request) {
        if (users.findByEmailIgnoreCaseWithRole(input.email()).isPresent()) throw ApiException.conflict("An account with this email already exists.");
        UUID hospitalId = sql.one("select id::text as id from hospitals where status='active' order by created_at limit 1", Map.of())
                .map(r -> UUID.fromString(String.valueOf(r.get("id"))))
                .orElseThrow(() -> new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "No active hospital is configured in PostgreSQL."));
        roles.findByCode("patient").orElseThrow(() -> ApiException.badRequest("Patient role is not configured."));
        AppUserEntity user = new AppUserEntity();
        user.setAuthUid("spring-" + UUID.randomUUID());
        user.setEmployeeNo("PORTAL-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        user.setWorkStatus("active");
        user.setMustChangePassword(false);
        user.setHospitalId(hospitalId);
        user.setRole(UserRole.patient);
        user.setFullName(input.displayName().trim());
        user.setEmail(input.email().trim().toLowerCase());
        user.setPasswordHash(passwords.encode(input.password()));
        user.setPermissions(mapper.createArrayNode());
        user.setMfaEnabled(false);
        user.setStatus(UserStatus.active);
        users.saveAndFlush(user);
        AppUserEntity savedUser = users.findByIdWithRole(user.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "The patient account was created but could not be reloaded."));
        GovCarePrincipal principal = userSecurity.principal(savedUser);
        Map<String, Object> userProfile = profile(savedUser, principal);
        String sessionId = recordLoginSafely(savedUser, savedUser.getEmail(), true, null, null, null, null, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "token", jwt.generate(principal),
                "sessionId", sessionId,
                "user", userProfile
        ));
    }

    @PostMapping("/patient-profile")
    @Transactional
    public Map<String, Object> patientProfile(@Valid @RequestBody PatientProfileRequest input) {
        AppUserEntity user = users.findByAuthUid(input.uid()).orElseGet(() -> {
            if (input.email() != null) return users.findByEmailIgnoreCaseWithRole(input.email()).orElse(null);
            return null;
        });
        if (user == null) throw ApiException.notFound("Patient portal account was not found. Register the patient account first.");
        GovCarePrincipal actor = current.get();
        boolean self = actor.id().equals(user.getId());
        boolean canViewUsers = actor.permissions().contains("USER_VIEW") || actor.role().equals("super_admin");
        if (!self && !canViewUsers) throw ApiException.notFound("Patient portal account was not found.");
        if (!actor.role().equals("super_admin") && !Objects.equals(actor.hospitalId(), user.getHospitalId())) {
            throw ApiException.notFound("Patient portal account was not found.");
        }
        GovCarePrincipal principal = userSecurity.principal(user);
        return profile(user, principal);
    }

    @PostMapping("/change-password")
    @Transactional
    public Map<String, Object> changePassword(@Valid @RequestBody ChangePasswordRequest input) {
        GovCarePrincipal actor = current.get();
        AppUserEntity user = users.findByIdWithRole(actor.id())
                .orElseThrow(() -> ApiException.unauthorized("Authenticated account profile was not found."));
        if (!passwords.matches(input.currentPassword(), user.getPasswordHash())) {
            throw ApiException.unauthorized("Current password is incorrect.");
        }
        if (passwords.matches(input.newPassword(), user.getPasswordHash())) {
            throw ApiException.badRequest("The new password must be different from the current password.");
        }
        user.setPasswordHash(passwords.encode(input.newPassword()));
        user.setMustChangePassword(false);
        users.saveAndFlush(user);
        return Map.of("ok", true, "message", "Password changed successfully.");
    }

    @PostMapping({"/password-reset/request", "/email-otp/request"})
    public ResponseEntity<Map<String, Object>> securityRequest() {
        return ResponseEntity.accepted().body(Map.of("ok", true, "message", "Request accepted."));
    }

    private Map<String, Object> profile(AppUserEntity user, GovCarePrincipal principal) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("id", user.getId().toString());
        details.put("uid", user.getAuthUid() == null ? user.getId().toString() : user.getAuthUid());
        details.put("email", user.getEmail());
        details.put("employeeNo", user.getEmployeeNo());
        details.put("mustChangePassword", user.isMustChangePassword());
        details.put("jobTitle", user.getJobTitle());
        details.put("displayName", user.getFullName());
        details.put("role", principal.role());
        details.put("hospitalId", user.getHospitalId() == null ? null : user.getHospitalId().toString());
        details.put("departmentId", user.getDepartmentId() == null ? null : user.getDepartmentId().toString());
        details.put("patientId", user.getPatientId() == null ? null : user.getPatientId().toString());
        details.put("phone", user.getPhone());
        details.put("address", user.getAddress());
        details.put("photoURL", user.getProfilePhotoUrl());
        details.put("permissions", principal.permissions());
        details.put("mfaEnabled", user.isMfaEnabled());
        details.put("status", user.getStatus().name());
        details.put("createdAt", user.getCreatedAt());
        details.put("updatedAt", user.getUpdatedAt());
        details.put("createdBy", "spring-boot");
        details.put("updatedBy", "spring-boot");
        details.put("defaultRoute", user.getRoleDefinition() == null ? "/" : user.getRoleDefinition().getDefaultRoute());
        if (user.getHospitalId() != null) {
            sql.one("select name,city,district from hospitals where id=:id", Map.of("id", user.getHospitalId())).ifPresent(row -> {
                details.put("hospitalName", row.get("name"));
                details.put("hospitalCity", row.get("city"));
                details.put("district", row.get("district"));
            });
        }
        if (user.getDepartmentId() != null) {
            sql.one("select name from departments where id=:id", Map.of("id", user.getDepartmentId())).ifPresent(row -> details.put("departmentName", row.get("name")));
        }
        return details;
    }

    private String recordLoginSafely(AppUserEntity user, String email, boolean success, String reason,
                                     String deviceBrowser, String operatingSystem, String location,
                                     HttpServletRequest request) {
        try {
            return loginAudit.record(
                    user,
                    email,
                    success,
                    reason,
                    request,
                    deviceBrowser,
                    operatingSystem,
                    location
            );
        } catch (Exception ex) {
            String fallbackSessionId = UUID.randomUUID().toString();
            log.warn("Unable to write login audit record for {} (success={}). Session {} will continue without an audit row.",
                    email, success, fallbackSessionId, ex);
            return fallbackSessionId;
        }
    }

}
