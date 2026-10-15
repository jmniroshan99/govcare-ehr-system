package lk.gov.health.govcare.fhir;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.parser.DataFormatException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.security.ClinicalPatientAccess;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.hl7.fhir.r4.model.Resource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class FHIRResourceManager {
    private final NamedParameterJdbcTemplate jdbc;
    private final ClinicalPatientAccess access;
    private final ObjectMapper mapper;
    private final FhirContext ctx = FhirContext.forR4Cached();

    public FHIRResourceManager(NamedParameterJdbcTemplate jdbc, ClinicalPatientAccess access, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.access = access;
        this.mapper = mapper;
    }

    @Transactional
    public Map<String, Object> validateAndStore(GovCarePrincipal actor, String type, String id, String json) {
        Resource resource;
        try { resource = (Resource) ctx.newJsonParser().parseResource(json); }
        catch (DataFormatException ex) { throw ApiException.badRequest("Invalid FHIR R4 JSON."); }
        if (!resource.fhirType().equals(type)) throw ApiException.badRequest("resourceType does not match URL.");
        if (id != null && resource.getIdElement().hasIdPart() && !id.equals(resource.getIdElement().getIdPart()))
            throw ApiException.badRequest("FHIR resource ID does not match URL.");
        String resourceId = id == null
                ? (resource.getIdElement().hasIdPart() ? resource.getIdElement().getIdPart() : UUID.randomUUID().toString()) : id;
        resource.setId(resourceId);
        String normalized = ctx.newJsonParser().encodeResourceToString(resource);
        UUID patientId = patientFor(actor, type, resourceId, normalized);
        access.requireClinicalWrite(actor, patientId);
        List<Stored> existing = find(actor.hospitalId(), type, resourceId);
        if (!existing.isEmpty() && !patientId.equals(existing.getFirst().patientId()))
            throw ApiException.forbidden("This FHIR resource belongs to another patient.");
        int updated = jdbc.update("""
                insert into fhir_resource(resource_type,resource_id,patient_id,hospital_id,json_data)
                values(:t,:id,:p,:h,cast(:j as jsonb))
                on conflict(hospital_id,resource_type,resource_id) do update set
                  version=fhir_resource.version+1,json_data=excluded.json_data,updated_date=now()
                where fhir_resource.patient_id=excluded.patient_id
                """, Map.of("t", type, "id", resourceId, "p", patientId, "h", actor.hospitalId(), "j", normalized));
        if (updated == 0) throw ApiException.forbidden("The FHIR patient association cannot be changed.");
        return Map.of("resourceType", type, "id", resourceId, "json", normalized);
    }

    public String read(GovCarePrincipal actor, String type, String id) {
        Stored row = required(actor.hospitalId(), type, id);
        if (row.patientId() == null) throw ApiException.forbidden("Unlinked FHIR resource is unavailable.");
        access.requireClinical(actor, row.patientId());
        return row.json();
    }

    @Transactional
    public void delete(GovCarePrincipal actor, String type, String id) {
        Stored row = required(actor.hospitalId(), type, id);
        if (row.patientId() == null) throw ApiException.forbidden("Unlinked FHIR resource is unavailable.");
        access.requireClinicalWrite(actor, row.patientId());
        jdbc.update("delete from fhir_resource where hospital_id=:h and resource_type=:t and resource_id=:id and patient_id=:p",
                Map.of("h", actor.hospitalId(), "t", type, "id", id, "p", row.patientId()));
    }

    private UUID patientFor(GovCarePrincipal actor, String type, String id, String json) {
        String reference;
        if ("Patient".equals(type)) {
            reference = id;
        } else {
            JsonNode tree;
            try { tree = mapper.readTree(json); }
            catch (Exception ex) { throw ApiException.badRequest("Invalid FHIR resource JSON."); }
            reference = tree.path("subject").path("reference").asText("");
            if (reference.isBlank()) reference = tree.path("patient").path("reference").asText("");
            if (!reference.startsWith("Patient/"))
                throw ApiException.badRequest("A local Patient reference is required for this FHIR resource.");
            reference = reference.substring("Patient/".length());
        }
        String candidate = reference.startsWith("patient-") ? reference.substring(8) : reference;
        try { return UUID.fromString(candidate); }
        catch (IllegalArgumentException ignored) {
            List<UUID> linked = jdbc.query("""
                    select patient_id from fhir_resource where hospital_id=:h
                      and resource_type='Patient' and resource_id=:id and patient_id is not null
                    """, Map.of("h", actor.hospitalId(), "id", reference),
                    (rs, n) -> rs.getObject("patient_id", UUID.class));
            if (linked.isEmpty()) throw ApiException.badRequest("The FHIR Patient reference is not linked to a local patient.");
            return linked.getFirst();
        }
    }

    private Stored required(UUID hospital, String type, String id) {
        List<Stored> rows = find(hospital, type, id);
        if (rows.isEmpty()) throw ApiException.notFound("FHIR resource not found.");
        return rows.getFirst();
    }

    private List<Stored> find(UUID hospital, String type, String id) {
        return jdbc.query("""
                select patient_id,json_data::text as json from fhir_resource
                where hospital_id=:h and resource_type=:t and resource_id=:id
                """, Map.of("h", hospital, "t", type, "id", id),
                (rs, n) -> new Stored(rs.getObject("patient_id", UUID.class), rs.getString("json")));
    }

    private record Stored(UUID patientId, String json) {}
}
