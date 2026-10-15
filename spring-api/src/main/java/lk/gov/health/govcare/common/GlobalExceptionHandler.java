package lk.gov.health.govcare.common;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.postgresql.util.PSQLException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> api(ApiException ex) {
        return ResponseEntity.status(ex.status()).body(Map.of("message", ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> validation(MethodArgumentNotValidException ex) {
        List<Map<String, String>> issues = ex.getBindingResult().getFieldErrors().stream()
                .map(error -> Map.of("path", error.getField(), "message", error.getDefaultMessage() == null ? "Invalid value" : error.getDefaultMessage()))
                .toList();
        return ResponseEntity.badRequest().body(Map.of("message", "Validation failed.", "issues", issues));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Map<String, Object>> constraintValidation(ConstraintViolationException ex) {
        List<Map<String, String>> issues = ex.getConstraintViolations().stream()
                .map(v -> Map.of("path", v.getPropertyPath().toString(), "message", v.getMessage()))
                .toList();
        return ResponseEntity.badRequest().body(Map.of("message", "Validation failed.", "issues", issues));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> denied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Access denied for this role or permission."));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> integrity(DataIntegrityViolationException ex) {
        Throwable root = ex.getMostSpecificCause();
        PSQLException psql = root instanceof PSQLException pg ? pg : null;
        String code = psql == null ? "" : psql.getSQLState();
        String constraint = psql == null || psql.getServerErrorMessage() == null
                ? null : psql.getServerErrorMessage().getConstraint();
        log.warn("Database integrity rejection sqlState={} constraint={} detail={}", code, constraint,
                psql == null || psql.getServerErrorMessage() == null ? null : psql.getServerErrorMessage().getDetail());
        String message = switch (code) {
            case "23505" -> "A record with the same unique value already exists.";
            case "23503" -> "This operation refers to a missing or protected related record.";
            case "23514" -> {
                if ("ck_ckd_disease_probability_snapshot".equals(constraint)
                        || "ck_ckd_disease_probability_snapshot_v2".equals(constraint)) {
                    yield "CKD assessment metadata did not match the installed database schema. Apply the latest Flyway migrations and retry.";
                }
                if ("ck_ai_ckd_probability_range".equals(constraint)
                        || "ai_ckd_predictions_probability_check".equals(constraint)) {
                    yield "The calculated CKD probability was outside the allowed database range.";
                }
                if ("ck_ai_ckd_risk_category".equals(constraint)
                        || "ai_ckd_predictions_risk_category_check".equals(constraint)) {
                    yield "The calculated CKD risk category is not recognized by the installed database schema.";
                }
                yield "The database rejected a workflow value"
                        + (constraint == null || constraint.isBlank() ? "." : " (constraint: " + constraint + ").");
            }
            case "22P02" -> "One of the supplied identifiers has an invalid format.";
            default -> "The database rejected this operation.";
        };
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("message", message);
        body.put("databaseCode", code);
        if (constraint != null && !constraint.isBlank()) body.put("databaseConstraint", constraint);
        return ResponseEntity.status(code.equals("22P02") ? HttpStatus.BAD_REQUEST : HttpStatus.CONFLICT)
                .body(body);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> generic(Exception ex, HttpServletRequest request) {
        String errorId = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        String method = request == null ? "UNKNOWN" : request.getMethod();
        String path = request == null ? "UNKNOWN" : request.getRequestURI();
        log.error("Unhandled API error id={} method={} path={}", errorId, method, path, ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of(
                        "message", "Internal server error. Use error ID " + errorId + " when checking the Spring Boot log.",
                        "errorId", errorId
                ));
    }
}
