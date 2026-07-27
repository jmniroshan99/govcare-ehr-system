package lk.gov.health.govcare.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class AuthInterceptor implements HandlerInterceptor {
  @Override
  public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
    String userId = request.getHeader("X-User-Id");
    String hospitalId = request.getHeader("X-Hospital-Id");
    String role = request.getHeader("X-Role");

    if (userId == null || hospitalId == null || role == null) {
      response.setStatus(HttpStatus.UNAUTHORIZED.value());
      response.setContentType("application/json");
      response.getWriter().write("{\"message\":\"Authentication headers are required.\"}");
      return false;
    }

    String patientId = request.getHeader("X-Patient-Id");
    String fullName = request.getHeader("X-Full-Name");
    AuthContext.set(new RequestUser(
      UUID.fromString(userId),
      UUID.fromString(hospitalId),
      patientId == null || patientId.isBlank() ? null : UUID.fromString(patientId),
      role,
      fullName == null ? "Unknown User" : fullName
    ));
    return true;
  }

  @Override
  public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
    AuthContext.clear();
  }
}

