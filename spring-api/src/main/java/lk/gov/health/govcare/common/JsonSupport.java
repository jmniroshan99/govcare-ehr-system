package lk.gov.health.govcare.common;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class JsonSupport {
    private final ObjectMapper mapper;

    public JsonSupport(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public String write(Object value) {
        try {
            return mapper.writeValueAsString(value == null ? Map.of() : value);
        } catch (JsonProcessingException e) {
            throw ApiException.badRequest("Unable to serialize JSON data.");
        }
    }

    public JsonNode tree(Object value) {
        return mapper.valueToTree(value);
    }

    @SuppressWarnings("unchecked")
    public List<String> stringList(Object value) {
        if (value == null) return List.of();
        if (value instanceof List<?> list) return list.stream().map(String::valueOf).toList();
        try {
            return mapper.readValue(String.valueOf(value), List.class).stream().map(String::valueOf).toList();
        } catch (Exception ignored) {
            return List.of();
        }
    }
}
