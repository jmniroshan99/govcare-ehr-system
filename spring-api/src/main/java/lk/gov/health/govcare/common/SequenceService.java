package lk.gov.health.govcare.common;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementCallback;
import org.springframework.jdbc.core.PreparedStatementCreator;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Set;
import java.util.UUID;

@Service
public class SequenceService {

    private final JdbcTemplate jdbc;

    public SequenceService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Locks a sequence key during the current database transaction.
     * This prevents two requests from generating the same sequence number.
     */
    public void lock(String key) {
        jdbc.execute(
                (PreparedStatementCreator) connection -> {
                    var statement = connection.prepareStatement(
                            "SELECT pg_advisory_xact_lock(hashtext(?))"
                    );
                    statement.setString(1, key);
                    return statement;
                },
                (PreparedStatementCallback<Void>) statement -> {
                    statement.execute();
                    return null;
                }
        );
    }

    /**
     * Generates the next patient number.
     * Example: PAT-2026-000001
     */
    public String nextPatientNo(UUID hospitalId) {
        int year = LocalDate.now(ZoneOffset.UTC).getYear();
        String regex = "^PAT-" + year + "-[0-9]+$";

        String sql = """
                SELECT COALESCE(
                    MAX(SUBSTRING(patient_no FROM '([0-9]+)$')::INTEGER),
                    0
                )
                FROM patients
                WHERE hospital_id = ?
                  AND patient_no ~ ?
                """;

        Integer max = jdbc.queryForObject(
                sql,
                Integer.class,
                hospitalId,
                regex
        );

        int nextValue = (max == null ? 0 : max) + 1;
        return "PAT-" + year + "-" + String.format("%06d", nextValue);
    }

    /**
     * Generates the next number for an approved table and column.
     */
    public String nextNumber(
            UUID hospitalId,
            String table,
            String column,
            String prefix
    ) {
        if (!ListAllow.allowedTable(table)) {
            throw ApiException.badRequest("Unsupported sequence table: " + table);
        }

        if (!ListAllow.allowedColumn(column)) {
            throw ApiException.badRequest("Unsupported sequence column: " + column);
        }

        String pattern = "^" + prefix.replace("-", "\\-") + "[0-9]+$";

        String sql =
                "SELECT COALESCE(" +
                "MAX(SUBSTRING(" + column +
                " FROM '([0-9]+)$')::INTEGER), 0) " +
                "FROM " + table + " " +
                "WHERE hospital_id = ? " +
                "AND " + column + " ~ ?";

        Integer max = jdbc.queryForObject(
                sql,
                Integer.class,
                hospitalId,
                pattern
        );

        int nextValue = (max == null ? 0 : max) + 1;
        return prefix + String.format("%06d", nextValue);
    }

    /**
     * Generates a daily number.
     * Example: APT-20260802-000001
     */
    public String daily(
            UUID hospitalId,
            String table,
            String column,
            String prefix
    ) {
        String date = LocalDate
                .now(ZoneOffset.UTC)
                .format(DateTimeFormatter.BASIC_ISO_DATE);

        return nextNumber(
                hospitalId,
                table,
                column,
                prefix + date + "-"
        );
    }

    /**
     * Only these table and column names can be inserted into dynamic SQL.
     */
    private static final class ListAllow {

        private static final Set<String> ALLOWED_TABLES = Set.of(
                "appointments",
                "visits",
                "prescriptions",
                "pharmacy_receipts"
        );

        private static final Set<String> ALLOWED_COLUMNS = Set.of(
                "appointment_no",
                "visit_no",
                "prescription_no",
                "receipt_no"
        );

        private ListAllow() {
            // Utility class
        }

        private static boolean allowedTable(String value) {
            return value != null && ALLOWED_TABLES.contains(value);
        }

        private static boolean allowedColumn(String value) {
            return value != null && ALLOWED_COLUMNS.contains(value);
        }
    }
}
