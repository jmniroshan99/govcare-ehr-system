package lk.gov.health.govcare.audit;

import jakarta.servlet.http.HttpServletRequest;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.AppUserEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class LoginAuditService {
    private final SqlSupport sql;

    public LoginAuditService(SqlSupport sql) {
        this.sql = sql;
    }

    /**
     * Writes the authentication attempt in an independent transaction. Failed
     * authentication normally rolls back the controller transaction, so using
     * REQUIRES_NEW ensures that the security audit row is still retained.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String record(AppUserEntity user,
                         String attemptedEmail,
                         boolean success,
                         String failureReason,
                         HttpServletRequest request,
                         String deviceBrowser,
                         String operatingSystem,
                         String location) {
        String sessionId = UUID.randomUUID().toString();
        Map<String, Object> params = new HashMap<>();
        params.put("hospitalId", user == null || user.getHospitalId() == null ? "" : user.getHospitalId().toString());
        params.put("userId", user == null || user.getId() == null ? "" : user.getId().toString());
        params.put("departmentId", user == null || user.getDepartmentId() == null ? "" : user.getDepartmentId().toString());
        params.put("sessionId", sessionId);
        params.put("fullName", user == null ? "Unknown user" : user.getFullName());
        params.put("role", user == null || user.getRole() == null ? "" : user.getRole().name());
        params.put("email", attemptedEmail == null ? "" : attemptedEmail.trim().toLowerCase());
        params.put("loginStatus", success ? "success" : "failed");
        params.put("logoutStatus", success ? "active" : "unknown");
        params.put("ipAddress", clientIp(request));
        params.put("deviceBrowser", firstNonBlank(deviceBrowser, userAgent(request)));
        params.put("operatingSystem", blankToNull(operatingSystem));
        params.put("location", blankToNull(location));
        params.put("failureReason", blankToNull(failureReason));

        sql.update("""
            insert into login_activities(
                hospital_id,user_id,session_id,full_name,role,department_name,email,
                login_status,logout_status,ip_address,device_browser,operating_system,
                location,authentication_method,failure_reason,last_activity_time
            ) values(
                cast(nullif(:hospitalId,'') as uuid),
                cast(nullif(:userId,'') as uuid),
                :sessionId,
                :fullName,
                cast(nullif(:role,'') as user_role),
                (select name from departments where id=cast(nullif(:departmentId,'') as uuid)),
                :email,
                :loginStatus,
                :logoutStatus,
                :ipAddress,
                :deviceBrowser,
                :operatingSystem,
                :location,
                'email_password',
                :failureReason,
                now()
            )
            """, params);
        return sessionId;
    }

    private static String clientIp(HttpServletRequest request) {
        if (request == null) return null;
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return limit(forwarded.split(",")[0].trim(), 120);
        }
        return limit(request.getRemoteAddr(), 120);
    }

    private static String userAgent(HttpServletRequest request) {
        return request == null ? null : limit(request.getHeader("User-Agent"), 500);
    }

    private static String firstNonBlank(String preferred, String fallback) {
        String value = blankToNull(preferred);
        return value == null ? fallback : limit(value, 500);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String limit(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }
}
