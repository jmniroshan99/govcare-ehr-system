package lk.gov.health.govcare.common;

import org.springframework.dao.EmptyResultDataAccessException;
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

    public SqlSupport(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Map<String, Object>> list(String sql, Map<String, ?> params) {
        return jdbc.query(sql, params, (rs, rowNum) -> {
            var meta = rs.getMetaData();
            Map<String, Object> row = new LinkedHashMap<>();
            for (int i = 1; i <= meta.getColumnCount(); i++) {
                row.put(meta.getColumnLabel(i), rs.getObject(i));
            }
            return row;
        });
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
