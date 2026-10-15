package lk.gov.health.govcare.security;

import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/** Enforces the tenant, role and patient relationship at the data boundary. */
@Service
public class ClinicalPatientAccess {
    private static final Set<String> CLINICIANS = Set.of("doctor", "surgeon", "anesthetist");
    private final SqlSupport sql;

    public ClinicalPatientAccess(SqlSupport sql) { this.sql = sql; }

    public void requireDemographics(GovCarePrincipal actor, UUID patientId) {
        requirePatient(actor, patientId);
        if (Set.of("patient", "guardian").contains(actor.role())) {
            if (!Objects.equals(actor.patientId(), patientId) || !has(actor, "PATIENT_VIEW_SELF"))
                throw ApiException.notFound("Patient not found.");
        } else if (!has(actor, "PATIENT_VIEW")) {
            throw ApiException.forbidden("Patient view permission is required.");
        }
    }

    public void requireClinical(GovCarePrincipal actor, UUID patientId) {
        requirePatient(actor, patientId);
        if (canAccessNetwork(actor) && has(actor, "PATIENT_VIEW_CLINICAL")) return;
        if (!has(actor, "PATIENT_VIEW_CLINICAL") || !CLINICIANS.contains(actor.role()))
            throw ApiException.forbidden("Clinical access requires an assigned clinician.");
        boolean related = Boolean.TRUE.equals(sql.required("""
                select (
                  exists(select 1 from visits where hospital_id=:h and patient_id=:p and doctor_id=:u) or
                  exists(select 1 from consultations where hospital_id=:h and patient_id=:p and doctor_id=:u) or
                  exists(select 1 from prescriptions where hospital_id=:h and patient_id=:p and doctor_id=:u) or
                  exists(select 1 from lab_requests where hospital_id=:h and patient_id=:p and requested_by=:u) or
                  exists(select 1 from radiology_requests where hospital_id=:h and patient_id=:p and requested_by=:u) or
                  exists(select 1 from admissions where hospital_id=:h and patient_id=:p and consultant_id=:u and status in ('active','pending'))
                ) related
                """, Map.of("h", actor.hospitalId(), "p", patientId, "u", actor.id()),
                "Unable to evaluate clinical relationship.").get("related"));
        if (!related) throw ApiException.forbidden("This patient is not assigned to your clinical care.");
    }

    public void requireClinicalWrite(GovCarePrincipal actor, UUID patientId) {
        requireClinical(actor, patientId);
        if (!has(actor, "CONSULTATION_CREATE") && !has(actor, "CONSULTATION_UPDATE"))
            throw ApiException.forbidden("Clinical write permission is required.");
    }

    public List<UUID> visiblePatientIds(GovCarePrincipal actor) {
        requireClinicalListAccess(actor);
        if (canAccessNetwork(actor)) {
            return sql.list("select p.id from patients p where p.status<>'deleted'", Map.of()).stream()
                    .map(row -> (UUID) row.get("id")).toList();
        }
        if (actor == null || !actor.active() || actor.hospitalId() == null
                || !has(actor, "PATIENT_VIEW_CLINICAL") || !CLINICIANS.contains(actor.role()))
            throw ApiException.forbidden("Clinical access requires an assigned clinician.");
        return sql.list("""
                select p.id from patients p where p.hospital_id=:h and p.status<>'deleted' and (
                  exists(select 1 from visits v where v.hospital_id=:h and v.patient_id=p.id and v.doctor_id=:u) or
                  exists(select 1 from consultations c where c.hospital_id=:h and c.patient_id=p.id and c.doctor_id=:u) or
                  exists(select 1 from prescriptions rx where rx.hospital_id=:h and rx.patient_id=p.id and rx.doctor_id=:u) or
                  exists(select 1 from lab_requests lr where lr.hospital_id=:h and lr.patient_id=p.id and lr.requested_by=:u) or
                  exists(select 1 from radiology_requests rr where rr.hospital_id=:h and rr.patient_id=p.id and rr.requested_by=:u) or
                  exists(select 1 from admissions a where a.hospital_id=:h and a.patient_id=p.id and a.consultant_id=:u and a.status in ('active','pending'))
                )
                """, Map.of("h", actor.hospitalId(), "u", actor.id())).stream()
                .map(row -> (UUID) row.get("id")).toList();
    }

    public boolean canAccessNetwork(GovCarePrincipal actor) {
        return actor != null && actor.active() && !actor.mustChangePassword()
                && "super_admin".equals(actor.role()) && has(actor, "PATIENT_VIEW");
    }

    public void requireClinicalListAccess(GovCarePrincipal actor) {
        if (actor == null || !actor.active() || actor.mustChangePassword()
                || !has(actor, "PATIENT_VIEW_CLINICAL")
                || (!canAccessNetwork(actor) && (actor.hospitalId() == null || !CLINICIANS.contains(actor.role()))))
            throw ApiException.forbidden("Clinical access requires an assigned clinician or an authorized Super Admin.");
    }

    /** Resolve the stored patient's tenant. Client hospital/role values never authorize access. */
    public GovCarePrincipal scopeToPatient(GovCarePrincipal actor, UUID patientId) {
        UUID hospital = requirePatient(actor, patientId);
        if (Objects.equals(hospital, actor.hospitalId())) return actor;
        // A department from the operator's home hospital must not be written into this tenant.
        return new GovCarePrincipal(actor.id(), hospital, null, actor.patientId(), actor.email(),
                actor.fullName(), actor.role(), actor.permissions(), actor.active(),
                actor.mustChangePassword(), actor.credentialsVersion());
    }

    public GovCarePrincipal clinicalScope(GovCarePrincipal actor, UUID patientId, boolean write) {
        if (write) requireClinicalWrite(actor, patientId); else requireClinical(actor, patientId);
        return scopeToPatient(actor, patientId);
    }

    private UUID requirePatient(GovCarePrincipal actor, UUID patientId) {
        if (actor == null || !actor.active() || actor.mustChangePassword() || patientId == null)
            throw ApiException.notFound("Patient not found.");
        Map<String, Object> row;
        if (canAccessNetwork(actor)) {
            row = sql.required("select id,hospital_id from patients where id=:p and status<>'deleted'",
                    Map.of("p", patientId), "Patient not found.");
        } else {
            if (actor.hospitalId() == null) throw ApiException.notFound("Patient not found.");
            row = sql.required("select id,hospital_id from patients where id=:p and hospital_id=:h and status<>'deleted'",
                    Map.of("p", patientId, "h", actor.hospitalId()), "Patient not found.");
        }
        if (Set.of("patient", "guardian").contains(actor.role()) && !Objects.equals(actor.patientId(), patientId))
            throw ApiException.notFound("Patient not found.");
        return UUID.fromString(String.valueOf(row.get("hospital_id")));
    }

    private static boolean has(GovCarePrincipal actor, String permission) {
        return actor.permissions().contains(permission) || actor.permissions().contains("*");
    }
}
