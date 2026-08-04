package lk.gov.health.govcare.ward;

import lk.gov.health.govcare.audit.AuditService;
import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class WardWorkflowSupport {
    private final SqlSupport sql;
    private final AuditService audit;

    public WardWorkflowSupport(SqlSupport sql, AuditService audit) {
        this.sql = sql;
        this.audit = audit;
    }

    public boolean isSuper(GovCarePrincipal actor) {
        return "super_admin".equals(actor.role());
    }

    public UUID scopedHospital(GovCarePrincipal actor, UUID requested) {
        if (isSuper(actor)) {
            if (requested != null) {
                hospital(requested);
                return requested;
            }
            if (actor.hospitalId() != null) return actor.hospitalId();
            Map<String, Object> first = sql.required(
                    "select id from hospitals where status='active' order by name limit 1",
                    Map.of(),
                    "No active hospital is configured."
            );
            return uuid(first.get("id"));
        }
        if (actor.hospitalId() == null) throw ApiException.forbidden("The authenticated account is not assigned to a hospital.");
        if (requested != null && !actor.hospitalId().equals(requested)) {
            throw ApiException.forbidden("You cannot manage another hospital's ward or transfer data.");
        }
        return actor.hospitalId();
    }

    public void requireHospitalAccess(GovCarePrincipal actor, UUID hospitalId) {
        if (!isSuper(actor) && !Objects.equals(actor.hospitalId(), hospitalId)) {
            throw ApiException.forbidden("You cannot access this hospital's ward or transfer data.");
        }
    }

    public Map<String, Object> hospital(UUID hospitalId) {
        return sql.required("select id,name,code from hospitals where id=:id and status='active'", Map.of("id", hospitalId), "Hospital not found or inactive.");
    }

    public Map<String, Object> ward(UUID wardId) {
        return sql.required("select id,hospital_id,department_id,ward_code,ward_type,name,status from wards where id=:id", Map.of("id", wardId), "Ward not found.");
    }

    public Map<String, Object> bed(UUID bedId, boolean lock) {
        String suffix = lock ? " for update" : "";
        return sql.required("""
            select b.id,b.hospital_id,b.ward_id,b.room_id,b.bed_no,b.bed_code,b.bed_type,b.status,
                   b.current_patient_id,b.current_admission_id,b.reserved_patient_id,b.reserved_until,
                   b.gender_restriction,b.age_restriction,b.isolation_support,b.oxygen_support,
                   b.ventilator_support,b.accessible_bed,b.version
            from beds b where b.id=:id
            """ + suffix, Map.of("id", bedId), "Bed not found.");
    }

    public void notifyRole(UUID hospitalId, String role, String title, String message, String actionUrl, GovCarePrincipal actor) {
        Map<String, Object> p = new HashMap<>();
        p.put("hospital", hospitalId);
        p.put("role", role);
        p.put("title", title);
        p.put("message", message);
        p.put("url", actionUrl);
        p.put("actor", actor.id());
        sql.update("""
            insert into notifications(hospital_id,target_role,title,message,module,priority,action_url,status,created_by)
            values(:hospital,cast(:role as user_role),:title,:message,'ward_transfer','routine',:url,'active',:actor)
            """, p);
    }

    public void movement(UUID patientId, UUID admissionId, UUID transferId, String type,
                         UUID sourceHospitalId, UUID destinationHospitalId,
                         UUID sourceWardId, UUID destinationWardId,
                         UUID sourceBedId, UUID destinationBedId,
                         GovCarePrincipal actor, String notes) {
        Map<String, Object> p = new HashMap<>();
        p.put("patient", patientId);
        p.put("admission", admissionId);
        p.put("transfer", transferId);
        p.put("type", type);
        p.put("sourceHospital", sourceHospitalId);
        p.put("destinationHospital", destinationHospitalId);
        p.put("sourceWard", sourceWardId);
        p.put("destinationWard", destinationWardId);
        p.put("sourceBed", sourceBedId);
        p.put("destinationBed", destinationBedId);
        p.put("actor", actor.id());
        p.put("notes", notes);
        sql.update("""
            insert into patient_movement_history(patient_id,admission_id,transfer_id,movement_type,
              source_hospital_id,destination_hospital_id,source_ward_id,destination_ward_id,
              source_bed_id,destination_bed_id,moved_by,notes)
            values(:patient,:admission,:transfer,:type,:sourceHospital,:destinationHospital,
              :sourceWard,:destinationWard,:sourceBed,:destinationBed,:actor,:notes)
            """, p);
    }

    public void audit(GovCarePrincipal actor, String action, String entityType, UUID entityId, Object before, Object after) {
        audit.record(actor, "ward_transfer", action, entityType, entityId, before, after);
    }

    public String upper(String value, String fallback) {
        if (value == null || value.isBlank()) return fallback;
        return value.trim().toUpperCase(Locale.ROOT).replace(' ', '_').replace('-', '_');
    }

    public String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public UUID uuid(Object value) {
        if (value == null) return null;
        if (value instanceof UUID id) return id;
        return UUID.fromString(value.toString());
    }
}
