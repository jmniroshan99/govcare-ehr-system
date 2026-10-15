package lk.gov.health.govcare.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

@Service
public class JwtService {
    private final SecretKey key;
    private final long expirationMinutes;

    public JwtService(@Value("${govcare.jwt.secret}") String secret,
                      @Value("${govcare.jwt.expiration-minutes:480}") long expirationMinutes) {
        byte[] bytes;
        if (secret == null || secret.isBlank()) {
            bytes = new byte[32];
            new SecureRandom().nextBytes(bytes);
        } else {
            try {
                bytes = Decoders.BASE64.decode(secret);
                if (bytes.length < 32) bytes = secret.getBytes(StandardCharsets.UTF_8);
            } catch (Exception ex) {
                bytes = secret.getBytes(StandardCharsets.UTF_8);
            }
            if (bytes.length < 32) throw new IllegalArgumentException("JWT_SECRET must contain at least 32 bytes.");
        }
        this.key = Keys.hmacShaKeyFor(bytes);
        this.expirationMinutes = expirationMinutes;
    }

    public String generate(GovCarePrincipal principal) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(principal.id().toString())
                .claims(Map.of(
                        "role", principal.role(),
                        "hospitalId", principal.hospitalId() == null ? "" : principal.hospitalId().toString(),
                        "departmentId", principal.departmentId() == null ? "" : principal.departmentId().toString(),
                        "patientId", principal.patientId() == null ? "" : principal.patientId().toString(),
                        "permissions", principal.permissions(),
                        "credentialsVersion", principal.credentialsVersion()
                ))
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(expirationMinutes, ChronoUnit.MINUTES)))
                .signWith(key)
                .compact();
    }

    public UUID subject(String token) {
        return UUID.fromString(parse(token).getSubject());
    }

    public Claims parse(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }
}
