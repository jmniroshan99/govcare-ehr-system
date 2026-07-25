package lk.gov.health.govcare.system;

import java.io.IOException;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
  @ExceptionHandler(SecurityException.class)
  public ResponseEntity<Map<String, String>> handleSecurity(SecurityException error) {
    return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", error.getMessage()));
  }

  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<Map<String, String>> handleBadRequest(IllegalArgumentException error) {
    return ResponseEntity.badRequest().body(Map.of("message", error.getMessage()));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException error) {
    return ResponseEntity.badRequest().body(Map.of("message", "Validation failed."));
  }

  @ExceptionHandler(IOException.class)
  public ResponseEntity<Map<String, String>> handleIo(IOException error) {
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("message", "File storage operation failed."));
  }
}

