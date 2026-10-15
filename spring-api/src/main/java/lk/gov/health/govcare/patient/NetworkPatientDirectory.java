package lk.gov.health.govcare.patient;

import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.ClinicalPatientAccess;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/** Network browsing is available only to an active, permission-bearing Super Admin. */
@Service
public class NetworkPatientDirectory {
    private final SqlSupport sql;
    private final ClinicalPatientAccess access;

    public NetworkPatientDirectory(SqlSupport sql, ClinicalPatientAccess access) {
        this.sql = sql;
        this.access = access;
    }

    private static final String FILTER = """
        where p.status<>'deleted'
          and (cast(:hospital as uuid) is null or p.hospital_id=cast(:hospital as uuid))
          and (cast(:ward as uuid) is null or exists(
            select 1 from admissions admitted where admitted.patient_id=p.id
              and admitted.hospital_id=p.hospital_id and admitted.ward_id=cast(:ward as uuid)
              and admitted.status='active' and admitted.discharged_at is null))
          and (:q='' or p.id::text=:q or p.patient_no ilike :like or p.full_name ilike :like
            or coalesce(p.nic,'') ilike :like or coalesce(p.passport_no,'') ilike :like
            or coalesce(p.birth_certificate_no,'') ilike :like or coalesce(p.phone,'') ilike :like
            or coalesce(p.qr_payload,'')=:raw)
        """;

    @Transactional(readOnly = true)
    public Map<String, Object> browse(GovCarePrincipal actor, String search, UUID hospital,
                                     UUID ward, int page, int size, boolean clinical) {
        requireNetwork(actor);
        if (clinical) access.requireClinicalListAccess(actor);
        if (page < 0 || size < 1 || size > 200) throw ApiException.badRequest("Use page >= 0 and a page size from 1 to 200.");
        if (hospital != null) sql.required("select id from hospitals where id=:id and status<>'deleted'",
                Map.of("id", hospital), "Hospital not found.");
        if (ward != null) {
            Map<String, Object> selected = sql.required("select hospital_id from wards where id=:id and status<>'deleted'",
                    Map.of("id", ward), "Ward not found.");
            if (hospital != null && !hospital.equals(selected.get("hospital_id")))
                throw ApiException.badRequest("The selected ward does not belong to the selected hospital.");
        }
        String term = search == null ? "" : search.trim();
        Map<String, Object> params = new HashMap<>();
        params.put("hospital", hospital); params.put("ward", ward);
        params.put("q", term.toLowerCase(Locale.ROOT)); params.put("raw", term);
        params.put("like", "%" + term + "%"); params.put("limit", size); params.put("offset", (long) page * size);
        long total = ((Number) sql.required("select count(*) total from patients p " + FILTER,
                params, "Unable to count network patients.").get("total")).longValue();
        List<Map<String, Object>> rows = sql.list("""
            select p.*,h.name hospital_name,h.code hospital_code,
              care.admission_id,care.admission_no,care.admitted_at,care.ward_id,care.ward_code,
              care.ward_name,care.bed_id,care.bed_code
            from patients p join hospitals h on h.id=p.hospital_id
            left join lateral (
              select a.id::text admission_id,a.admission_no,a.admitted_at,w.id::text ward_id,
                w.ward_code,w.name ward_name,b.id::text bed_id,b.bed_code
              from admissions a join wards w on w.id=a.ward_id and w.hospital_id=a.hospital_id
              left join beds b on b.id=a.bed_id and b.hospital_id=a.hospital_id
              where a.patient_id=p.id and a.hospital_id=p.hospital_id
                and a.status='active' and a.discharged_at is null
              order by a.admitted_at desc,a.id limit 1
            ) care on true
            """ + FILTER + " order by p.created_at desc,p.id limit :limit offset :offset", params);
        List<Map<String,Object>> items = new ArrayList<>();
        for (var row : rows) {
            Map<String,Object> item = new LinkedHashMap<>(row);
            if (!actor.permissions().contains("PATIENT_VIEW_CLINICAL") && !actor.permissions().contains("*"))
                for (String key : List.of("allergies", "chronic_diseases", "disabilities", "family_history", "risk_flags")) item.remove(key);
            items.add(item);
        }
        return Map.of("items", items, "total", total, "page", page, "pageSize", size,
                "hasNext", ((long) page + 1) * size < total, "scope", "network");
    }

    public List<Map<String, Object>> hospitals(GovCarePrincipal actor) {
        requireNetwork(actor);
        return sql.list("""
            select h.id::text,h.code,h.name,h.city,h.status::text,count(p.id)::int patient_count
            from hospitals h left join patients p on p.hospital_id=h.id and p.status<>'deleted'
            where h.status<>'deleted' group by h.id order by h.name,h.id
            """, Map.of());
    }

    public void requireNetwork(GovCarePrincipal actor) {
        if (!access.canAccessNetwork(actor)) throw ApiException.forbidden("Network patient access requires Super Admin and PATIENT_VIEW permission.");
    }
}
