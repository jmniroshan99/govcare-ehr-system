package lk.gov.health.govcare.audit;

import jakarta.servlet.http.HttpServletRequest;
import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.CurrentUser;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@RestController
@RequestMapping("/api/login-activities")
public class LoginActivityController {
    private static final Set<String> ALLOWED_LOGOUT_STATUSES = Set.of("logged_out", "timed_out");

    private final SqlSupport sql;
    private final CurrentUser current;

    public LoginActivityController(SqlSupport sql, CurrentUser current) {
        this.sql = sql;
        this.current = current;
    }

    /**
     * Records an authenticated external-provider login. Email/password attempts
     * are recorded by AuthController before a JWT exists, so this endpoint must
     * never trust a browser-supplied user identity or failed-login status.
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> create(@RequestBody Map<String, Object> input,
                                                       HttpServletRequest request) {
        GovCarePrincipal actor = current.get();
        String sessionId = Objects.toString(input.get("sessionId"), "").trim();
        if (sessionId.isEmpty()) {
            throw ApiException.badRequest("sessionId is required.");
        }

        Map<String, Object> user = sql.required("""
                select u.id::text,
                       u.hospital_id::text,
                       u.role::text,
                       u.full_name,
                       u.email,
                       d.name as department_name
                from app_users u
                left join departments d on d.id = u.department_id
                where u.id = :userId
                limit 1
                """, Map.of("userId", actor.id()), "Authenticated account profile was not found.");

        Map<String, Object> params = new HashMap<>();
        params.put("hospital", user.get("hospital_id"));
        params.put("user", user.get("id"));
        params.put("session", sessionId);
        params.put("name", user.get("full_name"));
        params.put("role", user.get("role"));
        params.put("department", user.get("department_name"));
        params.put("email", Objects.toString(user.get("email"), actor.email()).toLowerCase());
        params.put("device", input.get("deviceBrowser"));
        params.put("os", input.get("operatingSystem"));
        params.put("location", input.get("location"));
        params.put("method", Objects.toString(input.getOrDefault("authenticationMethod", "external_provider")));
        params.put("ip", clientIp(request));

        Map<String, Object> row = sql.required("""
                insert into login_activities(
                    hospital_id,user_id,session_id,full_name,role,department_name,email,
                    login_status,logout_status,ip_address,device_browser,operating_system,
                    location,authentication_method,last_activity_time
                ) values(
                    cast(:hospital as uuid),cast(:user as uuid),:session,:name,
                    cast(:role as user_role),:department,:email,'success','active',:ip,
                    :device,:os,:location,:method,now()
                )
                returning id::text
                """, params, "Unable to record login activity.");
        return ResponseEntity.status(HttpStatus.CREATED).body(row);
    }

    @GetMapping
    @PreAuthorize("hasAuthority('LOGIN_ACTIVITY_VIEW')")
    public Map<String, Object> list() {
        GovCarePrincipal actor = current.get();
        String where = actor.role().equals("super_admin") ? "" : " where la.hospital_id=:hospital";
        Map<String, Object> params = actor.role().equals("super_admin")
                ? Map.of()
                : Map.of("hospital", actor.hospitalId());
        return Map.of("items", sql.list("""
                select la.id::text id,
                       la.session_id "sessionId",
                       la.user_id::text "userId",
                       la.full_name "fullName",
                       la.role::text role,
                       la.hospital_id::text "hospitalId",
                       h.name "hospitalName",
                       u.department_id::text "departmentId",
                       la.department_name "departmentName",
                       la.email,
                       la.login_status "loginStatus",
                       la.logout_status "logoutStatus",
                       la.login_time "loginTime",
                       la.logout_time "logoutTime",
                       la.session_duration_seconds "sessionDurationSeconds",
                       la.ip_address "ipAddress",
                       la.device_browser "deviceBrowser",
                       la.operating_system "operatingSystem",
                       la.location,
                       la.authentication_method "authenticationMethod",
                       la.failure_reason "failureReason",
                       la.last_activity_time "lastActivityTime",
                       la.created_at timestamp,
                       la.created_at "createdAt"
                from login_activities la
                left join app_users u on u.id=la.user_id
                left join hospitals h on h.id=la.hospital_id
                """ + where + " order by la.login_time desc limit 1000", params));
    }

    @PostMapping("/session/close")
    public Map<String, Object> close(@RequestBody Map<String, Object> input) {
        GovCarePrincipal actor = current.get();
        String sessionId = Objects.toString(input.get("sessionId"), "").trim();
        if (sessionId.isEmpty()) {
            throw ApiException.badRequest("sessionId is required.");
        }
        String logoutStatus = Objects.toString(input.getOrDefault("logoutStatus", "logged_out"));
        if (!ALLOWED_LOGOUT_STATUSES.contains(logoutStatus)) {
            throw ApiException.badRequest("logoutStatus must be logged_out or timed_out.");
        }

        Map<String, Object> params = new HashMap<>();
        params.put("status", logoutStatus);
        params.put("device", input.get("deviceBrowser"));
        params.put("os", input.get("operatingSystem"));
        params.put("session", sessionId);
        params.put("user", actor.id());
        int updated = sql.update("""
                update login_activities
                set logout_status=:status,
                    logout_time=now(),
                    last_activity_time=now(),
                    session_duration_seconds=greatest(0,extract(epoch from(now()-login_time))::int),
                    device_browser=coalesce(:device,device_browser),
                    operating_system=coalesce(:os,operating_system)
                where session_id=:session
                  and user_id=:user
                  and logout_time is null
                """, params);
        if (updated == 0) {
            throw ApiException.notFound("Active login session was not found.");
        }
        return Map.of("ok", true);
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
