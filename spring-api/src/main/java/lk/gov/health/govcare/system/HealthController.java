package lk.gov.health.govcare.system;
import org.springframework.jdbc.core.JdbcTemplate;import org.springframework.web.bind.annotation.*;import java.time.*;import java.util.*;
@RestController public class HealthController{private final JdbcTemplate jdbc;public HealthController(JdbcTemplate jdbc){this.jdbc=jdbc;}@GetMapping({"/health","/api/health"})public Map<String,Object> health(){Object db=jdbc.queryForObject("select now()",Object.class);return Map.of("status","ok","service","GovCare EHR Spring Boot API","database","PostgreSQL","databaseTime",db,"time",OffsetDateTime.now());}}
