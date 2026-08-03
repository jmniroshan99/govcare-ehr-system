package lk.gov.health.govcare.common;

import jakarta.validation.ConstraintViolationException;
import org.postgresql.util.PSQLException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.List;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

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
        String code = root instanceof PSQLException psql ? psql.getSQLState() : "";
        String message = switch (code) {
            case "23505" -> "A record with the same unique value already exists.";
            case "23503" -> "This operation refers to a missing or protected related record.";
            case "23514" -> "The database rejected a workflow value.";
            case "22P02" -> "One of the supplied identifiers has an invalid format.";
            default -> "The database rejected this operation.";
        };
        return ResponseEntity.status(code.equals("22P02") ? HttpStatus.BAD_REQUEST : HttpStatus.CONFLICT)
                .body(Map.of("message", message, "databaseCode", code));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> generic(Exception ex) {
        ex.printStackTrace();
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("message", "Internal server error. Check the Spring Boot terminal for details."));
    }
}
