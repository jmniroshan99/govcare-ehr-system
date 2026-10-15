package lk.gov.health.govcare.dashboard;

import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class DashboardService {
    private static final Logger log = LoggerFactory.getLogger(DashboardService.class);
    private static final ZoneId COLOMBO = ZoneId.of("Asia/Colombo");
    private static final Set<String> STAFF_ROLES = Set.of(
            "super_admin", "hospital_admin", "doctor", "surgeon", "anesthetist", "nurse",
            "pharmacist", "pathologist", "lab_manager", "lab_technician", "radiologist",
            "radiology_technician", "receptionist", "opd_officer", "ward_manager",
            "inventory_officer", "finance_officer", "emergency_staff", "quality_officer",
            "mortuary_officer", "ict_admin", "records_officer"
    );
    private final SqlSupport sql;

    public DashboardService(SqlSupport sql) {
        this.sql = sql;
    }

    public Map<String, Object> overview(GovCarePrincipal actor, UUID requestedHospitalId) {
        // The legacy endpoint contains hospital aggregates. Clinical and support
        // roles must use the role/assignment-scoped intelligence endpoint.
        if (!STAFF_ROLES.contains(actor.role()) || !Set.of("super_admin", "hospital_admin").contains(actor.role()))
            throw ApiException.forbidden("Use your role-scoped dashboard. Hospital aggregate access requires an administrator.");
        UUID hospitalId = hospital(actor, requestedHospitalId);
        Map<String, Object> hospital = sql.required(
                "select id::text, name from hospitals where id=:id and status='active'",
                Map.of("id", hospitalId), "Hospital not found or inactive.");

        OffsetDateTime capturedAt = OffsetDateTime.now(COLOMBO);
        LocalDate today = capturedAt.toLocalDate();
        OffsetDateTime start = today.atStartOfDay(COLOMBO).toOffsetDateTime();
        OffsetDateTime end = today.plusDays(1).atStartOfDay(COLOMBO).toOffsetDateTime();
        Map<String, Object> params = Map.of("hospitalId", hospitalId, "startAt", start, "endAt", end, "today", today);
        boolean queue = can(actor, "QUEUE_VIEW");
        boolean admissions = can(actor, "ADMISSION_VIEW") || can(actor, "WARD_PATIENT_LIST");
        boolean lab = can(actor, "LAB_REQUEST_VIEW");
        boolean pharmacy = can(actor, "PRESCRIPTION_VIEW");

        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("opdToday", queue ? safeMetric("opdToday", """
                select count(distinct patient_id)::int as value from opd_queue
                where hospital_id=:hospitalId and created_at>=:startAt and created_at<:endAt
                """, params) : unavailable("not_authorized"));
        metrics.put("activeAdmissions", admissions ? safeMetric("activeAdmissions", """
                select count(*)::int as value from admissions
                where hospital_id=:hospitalId and status='active' and discharged_at is null
                """, params) : unavailable("not_authorized"));
        // No persisted emergency triage encounter or triage status exists in the schema.
        metrics.put("emergencyTriage", unavailable("no_source"));
        metrics.put("labPending", lab ? safeMetric("labPending", """
                select count(*)::int as value from lab_requests
                where hospital_id=:hospitalId and status not in ('cancelled','deleted')
                  and workflow_status in ('ordered','received','sample_collected','in_progress','result_entered','verified')
                """, params) : unavailable("not_authorized"));
        metrics.put("lowStockMeds", pharmacy ? safeMetric("lowStockMeds", """
                select count(*)::int as value from (
                  select m.id from medicines m
                  left join pharmacy_stock s on s.medicine_id=m.id and s.hospital_id=m.hospital_id
                    and s.status='active' and (s.expiry_date is null or s.expiry_date>=:today)
                  where m.hospital_id=:hospitalId and m.status='active' and m.reorder_level>0
                  group by m.id,m.reorder_level
                  having coalesce(sum(s.quantity),0)<m.reorder_level
                ) low_stock
                """, params) : unavailable("not_authorized"));
        // Notifications do not provide a reliable, acknowledged clinical alert count.
        metrics.put("criticalAlerts", unavailable("no_source"));

        List<Map<String, Object>> flow = List.of();
        List<Map<String, Object>> priorityQueue = List.of();
        String flowReason = queue ? null : "not_authorized";
        String queueReason = queue ? null : "not_authorized";
        if (queue) {
            try {
                flow = hourlyFlow(params);
            } catch (DataAccessException failure) {
                log.warn("Dashboard flow query failed", failure);
                flowReason = "data_error";
            }
            try {
                priorityQueue = priorityQueue(actor, params);
            } catch (DataAccessException failure) {
                log.warn("Dashboard priority queue query failed", failure);
                queueReason = "data_error";
            }
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("hospitalId", hospital.get("id"));
        response.put("hospitalName", hospital.get("name"));
        response.put("date", today.toString());
        response.put("capturedAt", capturedAt.toString());
        response.put("metrics", metrics);
        response.put("flowAvailable", flowReason == null);
        response.put("flowReason", flowReason);
        response.put("flow", flow);
        response.put("queueAvailable", queueReason == null);
        response.put("queueReason", queueReason);
        response.put("priorityQueue", priorityQueue);
        return response;
    }

    private UUID hospital(GovCarePrincipal actor, UUID requested) {
        if (!"super_admin".equals(actor.role())) {
            if (actor.hospitalId() == null) throw ApiException.forbidden("No hospital is assigned to this account.");
            if (requested != null && !requested.equals(actor.hospitalId())) {
                throw ApiException.forbidden("You cannot view another hospital's dashboard.");
            }
            return actor.hospitalId();
        }
        if (requested != null) return requested;
        if (actor.hospitalId() != null) return actor.hospitalId();
        Map<String, Object> first = sql.required(
                "select id::text from hospitals where status='active' order by name limit 1",
                Map.of(), "No active hospital is configured.");
        return UUID.fromString(String.valueOf(first.get("id")));
    }

    private boolean can(GovCarePrincipal actor, String permission) {
        return actor.permissions().contains(permission) || actor.permissions().contains("*");
    }

    private Map<String, Object> safeMetric(String key, String query, Map<String, Object> params) {
        try {
            Number count = (Number) sql.required(query, params, "Dashboard metric is unavailable.").get("value");
            return Map.of("value", count.intValue(), "available", true);
        } catch (DataAccessException failure) {
            log.warn("Dashboard metric {} query failed", key, failure);
            return unavailable("data_error");
        }
    }

    private Map<String, Object> unavailable(String reason) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("available", false);
        result.put("value", null);
        result.put("reason", reason);
        return result;
    }

    private List<Map<String, Object>> hourlyFlow(Map<String, Object> params) {
        List<Map<String, Object>> rows = sql.list("""
                select extract(hour from created_at at time zone 'Asia/Colombo')::int as hour,
                       count(*)::int as count
                from opd_queue
                where hospital_id=:hospitalId and created_at>=:startAt and created_at<:endAt
                group by 1 order by 1
                """, params);
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            result.add(Map.of("hour", ((Number) row.get("hour")).intValue(),
                    "count", ((Number) row.get("count")).intValue()));
        }
        return result;
    }

    private List<Map<String, Object>> priorityQueue(GovCarePrincipal actor, Map<String, Object> params) {
        Map<String, Object> scoped = new HashMap<>(params);
        String doctorScope = "";
        if ("doctor".equals(actor.role())) {
            scoped.put("doctorId", actor.id());
            scoped.put("departmentId", actor.departmentId());
            doctorScope = " and (q.doctor_id=:doctorId or (:departmentId is not null and q.department_id=:departmentId))";
        }
        String nameColumn = can(actor, "PATIENT_VIEW") ? "p.full_name as patient_name," : "";
        return sql.list("""
                select q.id::text as id,q.token_no as token,q.queue_status as status,
                       q.priority::text as priority,d.name as unit,
                       %s
                       greatest(0,floor(extract(epoch from (now()-q.created_at))/60))::int as elapsed_minutes
                from opd_queue q
                join patients p on p.id=q.patient_id and p.hospital_id=q.hospital_id
                left join departments d on d.id=q.department_id and d.hospital_id=q.hospital_id
                where q.hospital_id=:hospitalId and q.queue_status in ('waiting','called','checking','in-consultation','paused')
                  and p.status<>'deleted' %s
                order by case q.priority when 'critical' then 0 when 'stat' then 0 when 'urgent' then 1 else 2 end,
                         q.created_at asc limit 8
                """.formatted(nameColumn, doctorScope), scoped);
    }
}
