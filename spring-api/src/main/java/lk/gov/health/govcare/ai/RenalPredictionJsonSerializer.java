package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;

import java.io.IOException;

/** Preserves the renal output contract without changing the application's legacy NON_NULL policy. */
public final class RenalPredictionJsonSerializer extends JsonSerializer<JsonNode> {
    @Override
    public void serialize(JsonNode value, JsonGenerator generator, SerializerProvider provider) throws IOException {
        writeNode(value, generator, provider);
    }

    private static void writeNode(JsonNode node, JsonGenerator generator, SerializerProvider provider) throws IOException {
        if (node == null || node.isNull() || node.isMissingNode()) {
            generator.writeNull();
        } else if (node.isObject()) {
            // ObjectNode.serialize filters null properties under Jackson 2.19 configuration.
            // Writing the fields directly also preserves nulls inside factors and nested objects.
            generator.writeStartObject(node);
            for (var field : node.properties()) {
                generator.writeFieldName(field.getKey());
                writeNode(field.getValue(), generator, provider);
            }
            generator.writeEndObject();
        } else if (node.isArray()) {
            generator.writeStartArray(node);
            for (JsonNode element : node) writeNode(element, generator, provider);
            generator.writeEndArray();
        } else {
            // Retain Jackson's numeric precision, escaping, booleans and other scalar behavior.
            node.serialize(generator, provider);
        }
    }
}
