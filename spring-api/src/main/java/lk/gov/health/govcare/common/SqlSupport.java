package lk.gov.health.govcare.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.postgresql.util.PGobject;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Component
public class SqlSupport {
    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public SqlSupport(NamedParameterJdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public List<Map<String, Object>> list(String sql, Map<String, ?> params) {
        return jdbc.query(sql, params, (rs, rowNum) -> {
            var meta = rs.getMetaData();
            Map<String, Object> row = new LinkedHashMap<>();
            for (int i = 1; i <= meta.getColumnCount(); i++) {
                row.put(meta.getColumnLabel(i), normalizeJdbcValue(rs.getObject(i)));
            }
            return row;
        });
    }

    private Object normalizeJdbcValue(Object value) {
        if (!(value instanceof PGobject pg)) return value;
        String type = pg.getType();
        String raw = pg.getValue();
        if (raw == null || !("json".equalsIgnoreCase(type) || "jsonb".equalsIgnoreCase(type))) return raw;
        try {
            return mapper.readValue(raw, Object.class);
        } catch (Exception ignored) {
            // Preserve the raw value instead of failing an otherwise valid API request.
            return raw;
        }
    }

    public Optional<Map<String, Object>> one(String sql, Map<String, ?> params) {
        List<Map<String, Object>> rows = list(sql, params);
        return rows.stream().findFirst();
    }

    public Map<String, Object> required(String sql, Map<String, ?> params, String message) {
        return one(sql, params).orElseThrow(() -> ApiException.notFound(message));
    }

    public int update(String sql, Map<String, ?> params) {
        return jdbc.update(sql, params);
    }

    public UUID uuid(Object value, String field) {
        if (value == null || String.valueOf(value).isBlank()) return null;
        try { return UUID.fromString(String.valueOf(value)); }
        catch (IllegalArgumentException ex) { throw ApiException.badRequest(field + " must be a valid UUID."); }
    }

    public MapSqlParameterSource params() { return new MapSqlParameterSource(); }
}
