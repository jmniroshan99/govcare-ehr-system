package lk.gov.health.govcare.facility;

import lk.gov.health.govcare.audit.AuditService;
import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.common.SriLankaLocationPolicy;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static lk.gov.health.govcare.facility.FacilityDtos.HospitalRequest;

@Service
public class FacilityAdministrationService {
    private static final Set<String> HOSPITAL_TYPES = Set.of(
            "government_hospital", "teaching_hospital", "national_hospital",
            "district_general_hospital", "base_hospital", "divisional_hospital",
            "specialized_hospital", "primary_medical_care_unit", "clinic"
    );

    private final SqlSupport sql;
    private final AuditService audit;

    public FacilityAdministrationService(SqlSupport sql, AuditService audit) {
        this.sql = sql;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> overview(GovCarePrincipal actor) {
        requireSuperAdmin(actor);
        List<Map<String, Object>> hospitals = sql.list("""
                select h.id::text id,h.code,h.name,h.type,h.city,h.district,h.province,h.address,h.phone,h.email,
                       h.director_name "directorName",h.status::text,h.created_at "createdAt",
                       count(distinct d.id)::int "departmentCount",
                       count(distinct w.id)::int "wardCount",
                       count(distinct b.id)::int "bedCount",
                       count(distinct b.id) filter(where b.status='AVAILABLE')::int "availableBedCount"
                from hospitals h
                left join departments d on d.hospital_id=h.id and d.status<>'deleted'
                left join wards w on w.hospital_id=h.id and w.status<>'deleted'
                left join beds b on b.hospital_id=h.id
                where h.status<>'deleted'
                group by h.id
                order by case when h.status='active' then 0 else 1 end,h.name
                """, Map.of());
        Map<String, Object> totals = sql.required("""
                select count(distinct h.id) filter(where h.status='active')::int "activeHospitals",
                       count(distinct w.id) filter(where w.status='active')::int "activeWards",
                       count(distinct b.id)::int "totalBeds",
                       count(distinct b.id) filter(where b.status='AVAILABLE')::int "availableBeds"
                from hospitals h
                left join wards w on w.hospital_id=h.id
                left join beds b on b.hospital_id=h.id
                where h.status<>'deleted'
                """, Map.of(), "Unable to load facility totals.");
        return Map.of("totals", totals, "hospitals", hospitals);
    }

    @Transactional
    public Map<String, Object> createHospital(GovCarePrincipal actor, HospitalRequest input) {
        requireSuperAdmin(actor);
        String type = clean(input.type()).toLowerCase(Locale.ROOT).replace(' ', '_').replace('-', '_');
        if (!HOSPITAL_TYPES.contains(type)) throw ApiException.badRequest("Unsupported hospital type.");
        SriLankaLocationPolicy.Location location = SriLankaLocationPolicy.resolve(input.province(), input.district());
        UUID hospitalId = UUID.randomUUID();
        Map<String, Object> params = new HashMap<>();
        params.put("id", hospitalId);
        params.put("code", input.code().trim().toUpperCase(Locale.ROOT));
        params.put("name", clean(input.name()));
        params.put("type", type);
        params.put("city", nullable(input.city()));
        params.put("district", location.district());
        params.put("province", location.province());
        params.put("address", nullable(input.address()));
        params.put("phone", nullable(input.phone()));
        params.put("email", nullable(input.email()));
        params.put("director", nullable(input.directorName()));
        sql.update("""
                insert into hospitals(id,code,name,type,city,district,province,address,phone,email,director_name,status)
                values(:id,:code,:name,:type,:city,:district,:province,:address,:phone,:email,:director,'active')
                """, params);

        int departmentsCreated = 0;
        if (input.provisionCoreDepartments()) {
            departmentsCreated = sql.update("""
                    insert into departments(hospital_id,code,name,type,description,status,created_by,updated_by)
                    select :hospital,core.code,core.name,core.type,core.description,'active'::record_status,:actor,:actor
                    from (values
                      ('OPD','Outpatient Department','clinical','Registration, triage and outpatient consultations'),
                      ('EMERGENCY','Emergency Department','clinical','Emergency and observation services'),
                      ('INPATIENT','Inpatient Services','clinical','Ward and admission services'),
                      ('LAB','Laboratory','diagnostic','Clinical laboratory services'),
                      ('RAD','Radiology','diagnostic','Radiology and imaging services'),
                      ('PHARM','Pharmacy','support','Dispensing and medicine services')
                    ) core(code,name,type,description)
                    on conflict(hospital_id,code) do nothing
                    """, Map.of("hospital", hospitalId, "actor", actor.id()));
        }

        Map<String, Object> hospital = hospital(hospitalId);
        Map<String, Object> after = new HashMap<>(hospital);
        after.put("coreDepartmentsCreated", departmentsCreated);
        audit.record(actor, "facility_administration", "HOSPITAL_CREATED", "hospitals", hospitalId, null, after);
        return Map.of("hospital", hospital, "coreDepartmentsCreated", departmentsCreated);
    }

    private Map<String, Object> hospital(UUID hospitalId) {
        return sql.required("""
                select id::text,code,name,type,city,district,province,address,phone,email,
                       director_name "directorName",status::text,created_at "createdAt",
                       (select count(*)::int from departments where hospital_id=h.id and status<>'deleted') "departmentCount",
                       (select count(*)::int from wards where hospital_id=h.id and status<>'deleted') "wardCount",
                       (select count(*)::int from beds where hospital_id=h.id) "bedCount",
                       (select count(*)::int from beds where hospital_id=h.id and status='AVAILABLE') "availableBedCount"
                from hospitals h where id=:id
                """, Map.of("id", hospitalId), "Hospital not found after creation.");
    }

    private static void requireSuperAdmin(GovCarePrincipal actor) {
        if (!"super_admin".equals(actor.role())) throw ApiException.forbidden("Only a Super Admin can manage the hospital network.");
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }

    private static String nullable(String value) {
        String cleaned = clean(value);
        return cleaned.isBlank() ? null : cleaned;
    }
}
