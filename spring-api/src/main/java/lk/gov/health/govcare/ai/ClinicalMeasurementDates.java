package lk.gov.health.govcare.ai;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;

/** Only explicitly recorded instants can support longitudinal calculations. */
final class ClinicalMeasurementDates {
    private ClinicalMeasurementDates() {}
    static Timestamp explicit(Object value) {
        if (value == null || String.valueOf(value).isBlank()) return null;
        try {
            Instant instant = OffsetDateTime.parse(String.valueOf(value)).toInstant();
            return instant.isAfter(Instant.now()) ? null : Timestamp.from(instant);
        } catch (RuntimeException ignored) {
            // Date-only, ambiguous/free text and future dates remain unavailable, not guessed.
            return null;
        }
    }
}
