package lk.gov.health.govcare.dashboard;

import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Builds a single, role-selected dashboard payload. The client never chooses a
 * role; the authenticated principal controls both the dashboard profile and all
 * data scopes. One endpoint keeps refreshes inexpensive while every builder
 * remains independently testable and privacy scoped.
 */
@Service
public class DashboardIntelligenceService {
    private static final Logger log = LoggerFactory.getLogger(DashboardIntelligenceService.class);
    private static final ZoneId COLOMBO = ZoneId.of("Asia/Colombo");
    private static final int REFRESH_AFTER_SECONDS = 60;
    private static final Set<String> SUPPORTED_ROLES = Set.of(
            "super_admin", "hospital_admin", "doctor", "surgeon", "anesthetist", "nurse",
            "receptionist", "opd_officer", "ward_manager", "lab_technician", "lab_manager",
            "pathologist", "radiology_technician", "radiologist", "pharmacist",
            "inventory_officer", "finance_officer", "records_officer", "patient", "guardian",
            "emergency_staff", "quality_officer", "ict_admin", "mortuary_officer"
    );

    private final SqlSupport sql;

    public DashboardIntelligenceService(SqlSupport sql) {
        this.sql = sql;
    }

    public Map<String, Object> dashboard(GovCarePrincipal actor, UUID requestedHospitalId) {
        if (actor == null || !actor.active() || actor.mustChangePassword()) {
            throw ApiException.forbidden("An active account with a completed password change is required.");
        }
        if (!SUPPORTED_ROLES.contains(actor.role())) {
            throw ApiException.forbidden("No intelligence dashboard is configured for this role.");
        }
        if (!actor.permissions().contains("*") && !actor.permissions().contains("DASHBOARD_VIEW")) {
            throw ApiException.forbidden("DASHBOARD_VIEW permission is required.");
        }
        Scope scope = resolveScope(actor, requestedHospitalId);
        OffsetDateTime capturedAt = OffsetDateTime.now(COLOMBO);
        LocalDate today = capturedAt.toLocalDate();
        OffsetDateTime start = today.atStartOfDay(COLOMBO).toOffsetDateTime();
        OffsetDateTime end = today.plusDays(1).atStartOfDay(COLOMBO).toOffsetDateTime();
        Map<String, Object> params = baseParams(scope, today, start, end, actor);
        Payload payload = switch (profileFor(actor.role())) {
            case "super_admin" -> superAdmin(actor, scope, params);
            case "hospital_admin" -> hospitalAdmin(actor, scope, params);
            case "doctor" -> doctor(actor, scope, params);
            case "nurse" -> nurse(actor, scope, params);
            case "front_desk" -> frontDesk(actor, scope, params);
            case "opd" -> opd(actor, scope, params);
            case "ward" -> ward(actor, scope, params);
            case "laboratory" -> laboratory(actor, scope, params);
            case "radiology" -> radiology(actor, scope, params);
            case "pharmacy" -> pharmacy(actor, scope, params);
            case "inventory" -> inventory(actor, scope, params);
            case "finance" -> finance(actor);
            case "records" -> records(actor, scope, params);
            case "patient" -> patient(actor, scope, params);
            case "guardian" -> guardian();
            case "emergency" -> emergency(actor, scope, params);
            case "quality" -> quality(actor, scope, params);
            case "it" -> itAdmin(actor, scope, params);
            case "mortuary" -> mortuary();
            default -> throw ApiException.forbidden("No intelligence dashboard is configured for this role.");
        };

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("schemaVersion", 1);
        response.put("dashboardKey", payload.key);
        response.put("role", actor.role());
        response.put("title", payload.title);
        response.put("subtitle", payload.subtitle);
        response.put("date", today.toString());
        response.put("capturedAt", capturedAt.toString());
        response.put("refreshAfterSeconds", REFRESH_AFTER_SECONDS);
        response.put("scope", scopeMap(scope));
        response.put("metrics", payload.metrics);
        response.put("charts", payload.charts);
        response.put("worklists", payload.worklists);
        response.put("alerts", payload.alerts);
        response.put("unavailableCapabilities", payload.unavailableCapabilities);
        return response;
    }

    static String profileFor(String role) {
        return switch (role) {
            case "super_admin" -> "super_admin";
            case "hospital_admin" -> "hospital_admin";
            case "doctor", "surgeon", "anesthetist" -> "doctor";
            case "nurse" -> "nurse";
            case "receptionist" -> "front_desk";
            case "opd_officer" -> "opd";
            case "ward_manager" -> "ward";
            case "lab_technician", "lab_manager", "pathologist" -> "laboratory";
            case "radiology_technician", "radiologist" -> "radiology";
            case "pharmacist" -> "pharmacy";
            case "inventory_officer" -> "inventory";
            case "finance_officer" -> "finance";
            case "records_officer" -> "records";
            case "patient" -> "patient";
            case "guardian" -> "guardian";
            case "emergency_staff" -> "emergency";
            case "quality_officer" -> "quality";
            case "ict_admin" -> "it";
            case "mortuary_officer" -> "mortuary";
            default -> "unsupported";
        };
    }

    private Payload superAdmin(GovCarePrincipal actor, Scope scope, Map<String, Object> params) {
        if (!hasAll(actor, "USER_VIEW", "PATIENT_VIEW", "QUEUE_VIEW", "ADMISSION_VIEW",
                "AUDIT_VIEW", "LOGIN_ACTIVITY_VIEW", "LAB_REQUEST_VIEW"))
            return unauthorizedPayload(new Payload("super_admin", "National hospital network", "Network permissions are required."));
        if (scope.hospitalId != null) {
            Payload operational = hospitalAdmin(actor, scope, params);
            Payload selected = new Payload(
                    "super_admin",
                    scope.hospitalName + " · hospital command",
                    "Hospital-scoped operations intelligence selected from the national command dashboard."
            );
            selected.metrics.addAll(operational.metrics);
            selected.charts.addAll(operational.charts);
            selected.worklists.addAll(operational.worklists);
            selected.alerts.addAll(operational.alerts);
            selected.unavailableCapabilities.addAll(operational.unavailableCapabilities);
            return selected;
        }
        Payload p = new Payload("super_admin", "National hospital network", "Cross-hospital operations, adoption and security intelligence from verified PostgreSQL records.");
        Map<String, Object> row = safeOne("super-admin metrics", """
                select
                  (select count(*)::int from hospitals where status='active') total_hospitals,
                  (select count(*)::int from app_users where status='active') total_users,
                  (select count(*)::int from app_users where status='active' and role::text in ('doctor','surgeon','anesthetist')) active_doctors,
                  (select count(*)::int from app_users where status='active' and role::text='nurse') active_nurses,
                  (select count(*)::int from patients where status<>'deleted') total_patients,
                  (select count(*)::int from visits where created_at>=:startAt and created_at<:endAt and status<>'deleted') daily_visits,
                  (select count(*)::int from login_activities where login_status='failed' and login_time>=:startAt and login_time<:endAt) security_alerts
                """, params);
        addMetrics(p, row,
                spec("totalHospitals", "Total hospitals", "total_hospitals", null, "info", "Active hospitals in the network."),
                spec("totalUsers", "Total active users", "total_users", null, "neutral", "Active application accounts."),
                spec("activeDoctors", "Active doctors", "active_doctors", null, "success", "Active doctor, surgeon and anesthetist accounts."),
                spec("activeNurses", "Active nurses", "active_nurses", null, "success", "Active nurse accounts."),
                spec("totalPatients", "Total patients", "total_patients", null, "info", "Non-deleted patient records."),
                spec("dailyVisits", "Daily visits", "daily_visits", null, "success", "Visits created today in Sri Lanka time."),
                spec("securityAlerts", "Failed logins today", "security_alerts", null, "danger", "Failed authentication events recorded today."));
        p.metrics.add(unavailableMetric("systemAvailability", "System availability", "no_source", "%", "Uptime history is not persisted; actuator health alone cannot prove availability."));

        p.charts.add(chartQuery("hospitalPerformance", "Hospital performance today", "bar", "hospital", List.of(
                        series("opd", "OPD", "#14b8a6"), series("admissions", "Admissions", "#38bdf8"), series("discharges", "Discharges", "#a78bfa")),
                """
                with queue_counts as (
                  select hospital_id,count(*)::int opd from opd_queue
                  where created_at>=:startAt and created_at<:endAt group by hospital_id
                ), admission_counts as (
                  select hospital_id,count(*)::int admissions from admissions
                  where admitted_at>=:startAt and admitted_at<:endAt group by hospital_id
                ), discharge_counts as (
                  select hospital_id,count(*)::int discharges from admissions
                  where discharged_at>=:startAt and discharged_at<:endAt group by hospital_id
                )
                select h.name hospital,coalesce(q.opd,0) opd,coalesce(a.admissions,0) admissions,
                  coalesce(d.discharges,0) discharges from hospitals h
                left join queue_counts q on q.hospital_id=h.id
                left join admission_counts a on a.hospital_id=h.id
                left join discharge_counts d on d.hospital_id=h.id
                where h.status='active' order by opd desc,h.name limit 12
                """, params, "Emergency encounters are not charted because no triage encounter source exists.", List.of("Emergency cases")));
        p.charts.add(chartQuery("patientGrowth", "Patient registrations · daily", "line", "date", List.of(series("patients", "Patients", "#2dd4bf")),
                """
                with days as (select generate_series(cast(:today as date)-29,cast(:today as date),'1 day')::date activity_day)
                select to_char(days.activity_day,'Mon DD') date,count(p.id)::int patients
                from days left join patients p on (p.created_at at time zone 'Asia/Colombo')::date=days.activity_day and p.status<>'deleted'
                group by days.activity_day order by days.activity_day
                """, params, "New patient records by Sri Lanka calendar day.", List.of()));
        p.charts.add(chartQuery("patientGrowthWeekly", "Patient registrations · weekly", "line", "period", List.of(series("patients", "Patients", "#38bdf8")),
                """
                with weeks as (
                  select generate_series(
                    date_trunc('week',cast(:today as date))-interval '11 weeks',
                    date_trunc('week',cast(:today as date)),interval '1 week'
                  )::date week_start)
                select to_char(weeks.week_start,'Mon DD') period,count(p.id)::int patients
                from weeks left join patients p on (p.created_at at time zone 'Asia/Colombo')::date>=weeks.week_start
                  and (p.created_at at time zone 'Asia/Colombo')::date<weeks.week_start+7 and p.status<>'deleted'
                group by weeks.week_start order by weeks.week_start
                """, params, "New patient records grouped by Sri Lanka calendar week.", List.of()));
        p.charts.add(chartQuery("patientGrowthMonthly", "Patient registrations · monthly", "line", "period", List.of(series("patients", "Patients", "#a78bfa")),
                """
                with months as (
                  select generate_series(
                    date_trunc('month',cast(:today as date))-interval '11 months',
                    date_trunc('month',cast(:today as date)),interval '1 month'
                  )::date month_start)
                select to_char(months.month_start,'Mon YYYY') period,count(p.id)::int patients
                from months left join patients p on (p.created_at at time zone 'Asia/Colombo')::date>=months.month_start
                  and (p.created_at at time zone 'Asia/Colombo')::date<(months.month_start+interval '1 month') and p.status<>'deleted'
                group by months.month_start order by months.month_start
                """, params, "New patient records grouped by Sri Lanka calendar month.", List.of()));
        p.charts.add(networkActivityHeatmap(params));
        p.charts.add(chartQuery("systemActivity", "Authentication and audit activity · 7 days", "area", "date", List.of(
                        series("logins", "Successful logins", "#22c55e"), series("failed", "Failed logins", "#fb7185"), series("auditEvents", "Audit events", "#60a5fa")),
                """
                with days as (select generate_series(cast(:today as date)-6,cast(:today as date),'1 day')::date activity_day),
                logins as (select (login_time at time zone 'Asia/Colombo')::date activity_day,
                    count(*) filter(where login_status='success')::int logins,
                    count(*) filter(where login_status='failed')::int failed from login_activities group by 1),
                audits as (select (created_at at time zone 'Asia/Colombo')::date activity_day,count(*)::int audit_events from audit_logs group by 1)
                select to_char(days.activity_day,'Dy') date,coalesce(logins.logins,0)::int logins,
                       coalesce(logins.failed,0)::int failed,coalesce(audits.audit_events,0)::int "auditEvents"
                from days left join logins using(activity_day) left join audits using(activity_day) order by days.activity_day
                """, params, "API latency is unavailable because request-duration telemetry is not persisted.", List.of("API response time")));
        addNetworkAlerts(p, params);
        p.unavailableCapabilities.add(capability("emergencyTriage", "Emergency triage encounters", "no_source"));
        p.unavailableCapabilities.add(capability("apiLatency", "API response-time history", "no_source"));
        p.unavailableCapabilities.add(capability("uptimeHistory", "Historical availability", "no_source"));
        return p;
    }

    private Payload hospitalAdmin(GovCarePrincipal actor, Scope scope, Map<String, Object> params) {
        Payload p = new Payload("hospital_admin", "Hospital operations command", "Patient flow, capacity, diagnostics and stock intelligence for the assigned hospital.");
        if (!hasAll(actor, "QUEUE_VIEW", "ADMISSION_VIEW", "BED_VIEW", "USER_VIEW", "PRESCRIPTION_VIEW", "LAB_REQUEST_VIEW")) return unauthorizedPayload(p);
        Map<String, Object> row = safeOne("hospital-admin metrics", """
                select
                  (select count(distinct patient_id)::int from opd_queue where hospital_id=:hospitalId and created_at>=:startAt and created_at<:endAt) opd_today,
                  (select count(*)::int from admissions where hospital_id=:hospitalId and status='active' and discharged_at is null) active_admissions,
                  (select count(*)::int from beds where hospital_id=:hospitalId and upper(status)='AVAILABLE') available_beds,
                  (select count(*)::int from beds where hospital_id=:hospitalId and upper(status)='PENDING_DISCHARGE') pending_discharges,
                  (select case when count(*)=0 then null else round(100.0*count(*) filter(where upper(status) in ('OCCUPIED','PENDING_DISCHARGE'))/count(*),1) end from beds where hospital_id=:hospitalId and upper(status)<>'OUT_OF_SERVICE') bed_occupancy,
                  (select count(*)::int from (select m.id from medicines m left join pharmacy_stock s on s.medicine_id=m.id and s.hospital_id=m.hospital_id and s.status='active' and (s.expiry_date is null or s.expiry_date>=:today) where m.hospital_id=:hospitalId and m.status='active' and m.reorder_level>0 group by m.id,m.reorder_level having coalesce(sum(s.quantity),0)<m.reorder_level) low_stock
                """, params);
        addMetrics(p, row,
                spec("opdToday", "Today's OPD", "opd_today", null, "info", "Unique patients registered today."),
                spec("currentAdmissions", "Current admissions", "active_admissions", null, "success", "Active admissions without discharge."),
                spec("bedOccupancy", "Bed occupancy", "bed_occupancy", "%", "warning", "Occupied and pending-discharge beds as a percentage of serviceable beds."),
                spec("availableBeds", "Available beds", "available_beds", null, "success", "Beds currently marked available."),
                spec("pendingDischarges", "Pending discharges", "pending_discharges", null, "warning", "Beds marked pending discharge."),
                spec("lowStockMedicines", "Low-stock medicines", "low_stock", null, "danger", "Active medicines below reorder level; expired stock excluded."));
        p.metrics.add(unavailableMetric("staffAvailability", "Staff availability", "no_source", null, "No shift roster or attendance source is implemented."));
        p.charts.add(admissionTrend(params));
        p.charts.add(patientFlow(params));
        p.charts.add(departmentWorkload(params));
        addHospitalAlerts(p, params);
        p.unavailableCapabilities.add(capability("staffAvailability", "Shift-based staff availability", "no_source"));
        return p;
    }

    private Payload doctor(GovCarePrincipal actor, Scope scope, Map<String, Object> params) {
        Payload p = new Payload("doctor", "Clinical decision workspace", "Assigned patient workload, diagnostic follow-up and governed CKD AI-CDSS signals.");
        if (!hasAll(actor, "CONSULTATION_VIEW", "PATIENT_VIEW_CLINICAL", "APPOINTMENT_VIEW", "QUEUE_VIEW", "PRESCRIPTION_VIEW", "LAB_REQUEST_VIEW", "RADIOLOGY_REQUEST_VIEW")) return unauthorizedPayload(p);
        Map<String, Object> row = safeOne("doctor metrics", """
                select
                  (select count(*)::int from appointments where hospital_id=:hospitalId and doctor_id=:actorId and scheduled_at>=:startAt and scheduled_at<:endAt and status<>'cancelled') appointments_today,
                  (select count(*)::int from opd_queue where hospital_id=:hospitalId and doctor_id=:actorId and queue_status in ('waiting','called','checking','in-consultation','paused')) waiting_patients,
                  (select count(*)::int from consultations where hospital_id=:hospitalId and doctor_id=:actorId and coalesce(completed_at,created_at)>=:startAt and coalesce(completed_at,created_at)<:endAt and coalesce(workflow_status,status::text) in ('completed','complete')) completed_consultations,
                  (select count(*)::int from lab_requests where hospital_id=:hospitalId and requested_by=:actorId and workflow_status not in ('released','reviewed','cancelled'))+
                  (select count(*)::int from radiology_requests where hospital_id=:hospitalId and requested_by=:actorId and workflow_status not in ('released','reviewed','cancelled')) pending_reports,
                  (select count(distinct risk.patient_id)::int from ai_deterioration_assessments risk where risk.hospital_id=:hospitalId and risk.risk_level in ('HIGH','CRITICAL') and risk.created_at>=cast(:today as date)-1 and exists(select 1 from visits v where v.patient_id=risk.patient_id and v.doctor_id=:actorId)) critical_patients,
                  (select count(distinct ckd.patient_id)::int from ai_ckd_predictions ckd where ckd.hospital_id=:hospitalId and ckd.risk_category in ('HIGH','URGENT_REVIEW') and exists(select 1 from visits v where v.patient_id=ckd.patient_id and v.doctor_id=:actorId)) ckd_high_risk
                """, params);
        addMetrics(p, row,
                spec("todayAppointments", "Today's appointments", "appointments_today", null, "info", "Appointments assigned to the signed-in clinician."),
                spec("waitingPatients", "Waiting patients", "waiting_patients", null, "warning", "Open OPD tokens assigned to the signed-in clinician."),
                spec("completedConsultations", "Completed consultations", "completed_consultations", null, "success", "Consultations completed today by the signed-in clinician."),
                spec("pendingReports", "Pending reports", "pending_reports", null, "warning", "Laboratory and radiology orders placed by this clinician and not yet released/reviewed."),
                spec("criticalPatients", "High-risk assigned patients", "critical_patients", null, "danger", "Recent high/critical deterioration assessments for patients assigned through a visit."),
                spec("ckdHighRisk", "CKD high-risk patients", "ckd_high_risk", null, "danger", "High/urgent CKD predictions for visit-assigned patients."));
        p.charts.add(chartQuery("consultationTrend", "My consultations · 14 days", "line", "date", List.of(series("consultations", "Consultations", "#2dd4bf")),
                """
                with days as (select generate_series(cast(:today as date)-13,cast(:today as date),'1 day')::date activity_day)
                select to_char(days.activity_day,'Mon DD') date,count(c.id)::int consultations
                from days left join consultations c on c.doctor_id=:actorId and c.hospital_id=:hospitalId and (coalesce(c.completed_at,c.created_at) at time zone 'Asia/Colombo')::date=days.activity_day
                group by days.activity_day order by days.activity_day
                """, params, "Only consultations owned by the signed-in clinician.", List.of()));
        p.charts.add(chartQuery("diagnosisDistribution", "My diagnosis distribution", "donut", "diagnosis", List.of(series("count", "Diagnoses", "#38bdf8")),
                """
                select case
                  when lower(cd.description) like '%diabet%' or upper(coalesce(cd.code,'')) like 'E1%' then 'Diabetes'
                  when lower(cd.description) like '%chronic kidney%' or lower(cd.description) like '%ckd%' or upper(coalesce(cd.code,'')) like 'N18%' then 'CKD'
                  when lower(cd.description) like '%hypertension%' or upper(coalesce(cd.code,'')) like 'I1%' then 'Hypertension'
                  when lower(cd.description) similar to '%(cardiac|heart|coronary)%' then 'Cardiac'
                  when lower(cd.description) similar to '%(respiratory|asthma|copd|pneumonia)%' then 'Respiratory'
                  else 'Other' end diagnosis,count(*)::int count
                from consultation_diagnoses cd join consultations c on c.id=cd.consultation_id
                where c.hospital_id=:hospitalId and c.doctor_id=:actorId and cd.created_at>=cast(:today as date)-90
                group by 1 order by count desc
                """, params, "Recorded diagnoses grouped into the requested clinical categories; unmatched diagnoses remain Other.", List.of()));
        p.charts.add(chartQuery("treatmentOutcomes", "Consultation workflow outcomes", "bar", "status", List.of(series("count", "Consultations", "#a78bfa")),
                """
                select coalesce(nullif(workflow_status,''),status::text) status,count(*)::int count
                from consultations where hospital_id=:hospitalId and doctor_id=:actorId and created_at>=cast(:today as date)-30
                group by 1 order by count desc
                """, params, "Workflow completion states are shown; clinical outcome scoring is not implemented.", List.of("Clinical treatment outcome score")));
        p.worklists.add(worklistQuery("ckdRiskPanel", "Assigned CKD AI-CDSS review", List.of(
                        column("patient_no", "Patient"), column("patient_name", "Name"), column("risk_category", "Risk"), column("probability", "Risk score %"),
                        column("confidence", "Confidence %"), column("recommended_actions", "Recommended actions"), column("created_at", "Assessed")),
                """
                select p.patient_no,p.full_name patient_name,x.risk_category,
                       round((x.probability*100)::numeric,1) probability,
                       round((x.confidence*100)::numeric,1) confidence,
                       coalesce((select string_agg(action,'; ') from jsonb_array_elements_text(x.recommendations) actions(action)),'Not recorded') recommended_actions,
                       x.created_at
                from ai_ckd_predictions x join patients p on p.id=x.patient_id and p.hospital_id=x.hospital_id
                where x.hospital_id=:hospitalId and exists(select 1 from visits v where v.patient_id=x.patient_id and v.doctor_id=:actorId)
                order by x.created_at desc limit 8
                """, params, "Only patients assigned to this clinician through a visit are returned."));
        return p;
    }

    private Payload nurse(GovCarePrincipal actor, Scope scope, Map<String, Object> params) {
        Payload p = new Payload("nurse", "Nursing care command", "Ward context with explicit safeguards where nurse-to-patient assignments or task records do not yet exist.");
        p.metrics.add(unavailableMetric("assignedPatients", "Assigned patients", "no_source", null, "No nurse-to-ward or nurse-to-patient assignment table exists."));
        p.metrics.add(unavailableMetric("medicationRounds", "Medication rounds", "no_source", null, "Medication administration records are not persisted."));
        p.metrics.add(unavailableMetric("pendingObservations", "Pending observations", "no_source", null, "Observation schedules and completion states are not persisted."));
        p.metrics.add(unavailableMetric("criticalPatients", "Critical assigned patients", "no_source", null, "A safe assigned-patient scope cannot be constructed."));
        p.metrics.add(unavailableMetric("completedTasks", "Completed nursing tasks", "no_source", null, "Nursing task records are not persisted."));
        p.charts.add(unavailableChart("patientMonitoring", "Patient monitoring timeline", "no_source", "Requires nurse assignment and longitudinal vital-sign task data."));
        p.charts.add(unavailableChart("vitalSigns", "Vital signs overview", "no_source", "Cannot aggregate patient vitals without a safe nurse assignment scope."));
        p.charts.add(unavailableChart("medicationStatus", "Medication administration status", "no_source", "Medication administration records are not implemented."));
        p.worklists.add(unavailableWorklist("nursingTasks", "Today's nursing tasks", "no_source", "Shift rosters and nursing tasks are not implemented."));
        p.unavailableCapabilities.add(capability("nurseAssignment", "Nurse-to-patient assignment", "no_source"));
        p.unavailableCapabilities.add(capability("mar", "Medication administration record", "no_source"));
        return p;
    }

    private Payload frontDesk(GovCarePrincipal actor, Scope scope, Map<String, Object> params) {
        Payload p = new Payload("front_desk", "Front desk flow desk", "Registration activity, appointment handling and the live hospital queue.");
        if (!hasAll(actor, "QUEUE_VIEW", "APPOINTMENT_VIEW", "PATIENT_VIEW")) return unauthorizedPayload(p);
        addFrontDeskMetrics(p, params, true);
        p.charts.add(arrivalPattern(params));
        p.charts.add(waitTrend(params));
        p.charts.add(appointmentCompletion(params, actor.id()));
        p.worklists.add(liveQueue(params, true));
        return p;
    }

    private Payload opd(GovCarePrincipal actor, Scope scope, Map<String, Object> params) {
        Payload p = new Payload("opd", "OPD operations command", "Live queue pressure, wait time and completion performance for the assigned hospital.");
        if (!hasAll(actor, "QUEUE_VIEW", "APPOINTMENT_VIEW", "PATIENT_VIEW")) return unauthorizedPayload(p);
        addFrontDeskMetrics(p, params, false);
        p.charts.add(arrivalPattern(params));
        p.charts.add(waitTrend(params));
        p.charts.add(queueStatusChart(params));
        p.worklists.add(liveQueue(params, true));
        return p;
    }

    private Payload ward(GovCarePrincipal actor, Scope scope, Map<String, Object> params) {
        Payload p = new Payload("ward", "Ward capacity command", "Department-scoped bed occupancy, admissions, discharge readiness and transfer demand.");
        if (!hasAll(actor, "WARD_VIEW", "ADMISSION_VIEW", "BED_VIEW", "WARD_PATIENT_LIST", "PATIENT_VIEW_CLINICAL")) return unauthorizedPayload(p);
        Map<String, Object> scoped = new HashMap<>(params);
        String departmentFilter = actor.departmentId() == null ? "" : " and w.department_id=:departmentId";
        Map<String, Object> row = safeOne("ward metrics", """
                select count(*) filter(where upper(b.status)='OCCUPIED')::int occupied_beds,
                       count(*) filter(where upper(b.status)='AVAILABLE')::int available_beds,
                       count(*) filter(where upper(b.status)='PENDING_DISCHARGE')::int pending_discharges,
                       count(*) filter(where upper(b.status) in ('CLEANING','MAINTENANCE','BLOCKED','OUT_OF_SERVICE'))::int unavailable_beds
                from beds b join wards w on w.id=b.ward_id and w.hospital_id=b.hospital_id
                where b.hospital_id=:hospitalId %s
                """.formatted(departmentFilter), scoped);
        addMetrics(p, row,
                spec("occupiedBeds", "Occupied beds", "occupied_beds", null, "info", "Beds occupied in the manager's department when assigned."),
                spec("availableBeds", "Available beds", "available_beds", null, "success", "Beds available in scope."),
                spec("pendingDischarges", "Pending discharges", "pending_discharges", null, "warning", "Beds marked pending discharge."),
                spec("unavailableBeds", "Unavailable beds", "unavailable_beds", null, "danger", "Cleaning, maintenance, blocked and out-of-service beds."));
        p.charts.add(wardOccupancy(params, actor.departmentId()));
        p.charts.add(admissionTrend(params));
        if (actor.departmentId() == null) {
            p.worklists.add(unavailableWorklist("wardPatients", "Ward patient list", "not_assigned", "Assign a department to this Ward Manager account before patient-level data can be returned."));
            p.unavailableCapabilities.add(capability("wardAssignment", "Ward/department assignment", "not_assigned"));
        } else {
            p.worklists.add(worklistQuery("wardPatients", "Active ward patients", List.of(
                            column("admission_no", "Admission"), column("patient_no", "Patient"), column("patient_name", "Name"), column("ward_name", "Ward"), column("bed_no", "Bed"), column("priority", "Priority")),
                    """
                    select a.admission_no,p.patient_no,p.full_name patient_name,w.name ward_name,b.bed_no,a.priority::text,a.admitted_at
                    from admissions a join patients p on p.id=a.patient_id and p.hospital_id=a.hospital_id
                    join wards w on w.id=a.ward_id and w.hospital_id=a.hospital_id
                    left join beds b on b.id=a.bed_id and b.hospital_id=a.hospital_id
                    where a.hospital_id=:hospitalId and w.department_id=:departmentId and a.status='active' and a.discharged_at is null
                    order by case a.priority when 'critical' then 0 when 'stat' then 0 when 'urgent' then 1 else 2 end,a.admitted_at limit 12
                    """, scoped, "Patient identities are limited to the account's assigned department."));
        }
        return p;
    }

    private Payload laboratory(GovCarePrincipal actor, Scope scope, Map<String, Object> params) {
        Payload p = new Payload("laboratory", "Laboratory operations", "Request volume, critical-result workload and verified turnaround from the hospital laboratory workflow.");
        if (!hasAll(actor, "LAB_REQUEST_VIEW", "PATIENT_VIEW")) return unauthorizedPayload(p);
        Map<String, Object> row = safeOne("laboratory metrics", """
                select
                  count(*) filter(where lr.workflow_status in ('ordered','received','sample_collected','in_progress','result_entered'))::int pending_tests,
                  count(*) filter(where lr.workflow_status in ('verified','released','reviewed') and coalesce(lr.released_at,lr.verified_at,lr.updated_at)>=:startAt and coalesce(lr.released_at,lr.verified_at,lr.updated_at)<:endAt)::int completed_tests,
                  count(distinct res.id) filter(where res.critical_flag=true and res.created_at>=cast(:today as date)-30)::int critical_results,
                  round(avg(extract(epoch from (coalesce(lr.released_at,lr.verified_at)-lr.created_at))/60) filter(where coalesce(lr.released_at,lr.verified_at) is not null),1) avg_processing_minutes
                from lab_requests lr left join lab_results res on res.lab_request_id=lr.id and res.hospital_id=lr.hospital_id
                where lr.hospital_id=:hospitalId and lr.status not in ('cancelled','deleted')
                """, params);
        addMetrics(p, row,
                spec("pendingTests", "Pending tests", "pending_tests", null, "warning", "Orders not yet verified or released."),
                spec("completedTests", "Completed today", "completed_tests", null, "success", "Verified/released requests completed today."),
                spec("criticalResults", "Critical results · 30 days", "critical_results", null, "danger", "Persisted lab results flagged critical."),
                spec("averageProcessingTime", "Average processing time", "avg_processing_minutes", "min", "info", "Order creation to verification/release, when timestamps exist."));
        p.charts.add(chartQuery("testVolume", "Test volume · 30 days", "bar", "test", List.of(series("count", "Requests", "#38bdf8")),
                """
                select case
                  when upper(coalesce(test_code,'')) like '%CBC%' or lower(coalesce(test_type,'')) like '%blood count%' then 'CBC'
                  when lower(coalesce(test_type,'')) similar to '%(biochem|glucose|renal|liver|electrolyte)%' then 'Biochemistry'
                  when lower(coalesce(test_type,'')) similar to '%(urine|urinalysis)%' then 'Urine'
                  when lower(coalesce(test_type,'')) similar to '%(microbiology|culture|sensitivity)%' then 'Microbiology'
                  else 'Other' end test,count(*)::int count
                from lab_requests where hospital_id=:hospitalId and created_at>=cast(:today as date)-30 and status not in ('cancelled','deleted')
                group by 1 order by count desc
                """, params, "Persisted laboratory requests grouped into CBC, biochemistry, urine, microbiology and other.", List.of()));
        p.charts.add(chartQuery("labPipeline", "Laboratory workflow", "donut", "status", List.of(series("count", "Requests", "#2dd4bf")),
                """
                select workflow_status status,count(*)::int count from lab_requests
                where hospital_id=:hospitalId and created_at>=cast(:today as date)-30 and status not in ('cancelled','deleted')
                group by workflow_status order by count desc
                """, params, "Current persisted workflow states for the last 30 days.", List.of()));
        p.worklists.add(worklistQuery("labQueue", "Priority laboratory queue", List.of(
                        column("patient_no", "Patient"), column("patient_name", "Name"), column("test_type", "Test"), column("priority", "Priority"), column("workflow_status", "Status"), column("created_at", "Ordered")),
                """
                select p.patient_no,p.full_name patient_name,lr.test_type,lr.priority::text,lr.workflow_status,lr.created_at
                from lab_requests lr join patients p on p.id=lr.patient_id and p.hospital_id=lr.hospital_id
                where lr.hospital_id=:hospitalId and lr.workflow_status not in ('released','reviewed','cancelled') and lr.status not in ('cancelled','deleted')
                order by case lr.priority when 'critical' then 0 when 'stat' then 0 when 'urgent' then 1 else 2 end,lr.created_at limit 12
                """, params, "Patient names are returned only to laboratory roles with LAB_REQUEST_VIEW."));
        return p;
    }

    private Payload radiology(GovCarePrincipal actor, Scope scope, Map<String, Object> params) {
        Payload p = new Payload("radiology", "Radiology operations", "Scan workload, reporting queue and verified turnaround by imaging modality.");
        if (!hasAll(actor, "RADIOLOGY_REQUEST_VIEW", "PATIENT_VIEW")) return unauthorizedPayload(p);
        Map<String, Object> row = safeOne("radiology metrics", """
                select
                  count(*) filter(where workflow_status not in ('released','reviewed','cancelled'))::int pending_scans,
                  count(*) filter(where workflow_status in ('imaging_completed','report_drafted','verified','released','reviewed') and coalesce(imaging_completed_at,updated_at)>=:startAt and coalesce(imaging_completed_at,updated_at)<:endAt)::int completed_scans,
                  count(*) filter(where priority in ('critical','stat') and workflow_status not in ('released','reviewed','cancelled'))::int emergency_scans,
                  count(*) filter(where workflow_status in ('imaging_completed','report_drafted'))::int reporting_queue,
                  round(avg(extract(epoch from (imaging_completed_at-created_at))/60) filter(where imaging_completed_at is not null),1) avg_turnaround_minutes
                from radiology_requests where hospital_id=:hospitalId and status not in ('cancelled','deleted')
                """, params);
        addMetrics(p, row,
                spec("pendingScans", "Pending scans", "pending_scans", null, "warning", "Requests not released, reviewed or cancelled."),
                spec("completedScans", "Completed today", "completed_scans", null, "success", "Imaging completed today."),
                spec("emergencyScans", "STAT / critical queue", "emergency_scans", null, "danger", "Open critical or STAT imaging requests."),
                spec("reportingQueue", "Reporting queue", "reporting_queue", null, "warning", "Completed imaging awaiting final reporting/release."),
                spec("turnaroundTime", "Average scan turnaround", "avg_turnaround_minutes", "min", "info", "Request creation to imaging completion."));
        p.charts.add(chartQuery("modalityVolume", "Imaging modality volume · 30 days", "bar", "modality", List.of(series("count", "Scans", "#a78bfa")),
                """
                select case
                  when lower(coalesce(imaging_type,'')) similar to '%(x-ray|xray|radiograph)%' then 'X-Ray'
                  when lower(coalesce(imaging_type,'')) similar to '%(computed tomography|ct scan|^ct$)%' then 'CT'
                  when lower(coalesce(imaging_type,'')) similar to '%(magnetic resonance|mri)%' then 'MRI'
                  when lower(coalesce(imaging_type,'')) similar to '%(ultrasound|sonograph)%' then 'Ultrasound'
                  else 'Other' end modality,count(*)::int count
                from radiology_requests where hospital_id=:hospitalId and created_at>=cast(:today as date)-30 and status not in ('cancelled','deleted')
                group by 1 order by count desc
                """, params, "Persisted requests grouped into X-Ray, CT, MRI, ultrasound and other.", List.of()));
        p.charts.add(chartQuery("radiologyTurnaround", "Completed scan turnaround · 14 days", "line", "date", List.of(series("minutes", "Minutes", "#38bdf8")),
                """
                with days as (select generate_series(cast(:today as date)-13,cast(:today as date),'1 day')::date activity_day)
                select to_char(days.activity_day,'Mon DD') date,round(avg(extract(epoch from (r.imaging_completed_at-r.created_at))/60),1) minutes
                from days left join radiology_requests r on r.hospital_id=:hospitalId and r.imaging_completed_at is not null and (r.imaging_completed_at at time zone 'Asia/Colombo')::date=days.activity_day
                group by days.activity_day order by days.activity_day
                """, params, "Days without completed scans remain empty, not fabricated as zero.", List.of()));
        p.worklists.add(worklistQuery("radiologyQueue", "Priority imaging queue", List.of(
                        column("patient_no", "Patient"), column("patient_name", "Name"), column("imaging_type", "Study"), column("priority", "Priority"), column("workflow_status", "Status"), column("scheduled_at", "Scheduled")),
                """
                select p.patient_no,p.full_name patient_name,r.imaging_type,r.priority::text,r.workflow_status,r.scheduled_at,r.created_at
                from radiology_requests r join patients p on p.id=r.patient_id and p.hospital_id=r.hospital_id
                where r.hospital_id=:hospitalId and r.workflow_status not in ('released','reviewed','cancelled') and r.status not in ('cancelled','deleted')
                order by case r.priority when 'critical' then 0 when 'stat' then 0 when 'urgent' then 1 else 2 end,coalesce(r.scheduled_at,r.created_at) limit 12
                """, params, "Patient identities are limited to the assigned hospital and authorized radiology role."));
        return p;
    }

    private Payload pharmacy(GovCarePrincipal actor, Scope scope, Map<String, Object> params) {
        Payload p = new Payload("pharmacy", "Pharmacy command", "Prescription verification, dispensing throughput, medicine stock and expiry risk.");
        if (!hasAll(actor, "PRESCRIPTION_VIEW", "PATIENT_VIEW")) return unauthorizedPayload(p);
        addPharmacyMetrics(p, params);
        p.charts.add(medicineConsumption(params));
        p.charts.add(stockStatus(params));
        p.charts.add(expiryTrend(params));
        p.worklists.add(worklistQuery("prescriptionQueue", "Prescription queue", List.of(
                        column("prescription_no", "Prescription"), column("patient_no", "Patient"), column("patient_name", "Name"), column("priority", "Priority"), column("pharmacy_status", "Status"), column("created_at", "Created")),
                """
                select pr.prescription_no,p.patient_no,p.full_name patient_name,pr.priority::text,pr.pharmacy_status,pr.workflow_status,pr.created_at
                from prescriptions pr join patients p on p.id=pr.patient_id and p.hospital_id=pr.hospital_id
                where pr.hospital_id=:hospitalId and pr.status='active' and pr.pharmacy_status not in ('dispensed','cancelled','rejected')
                order by case pr.priority when 'critical' then 0 when 'stat' then 0 when 'urgent' then 1 else 2 end,pr.created_at limit 12
                """, params, "Patient identities are returned only to pharmacy roles with prescription access."));
        return p;
    }

    private Payload inventory(GovCarePrincipal actor, Scope scope, Map<String, Object> params) {
        Payload p = new Payload("inventory", "Inventory intelligence", "Medicine catalogue, usable stock, reorder exposure and expiry monitoring without patient data.");
        if (!hasAll(actor, "INVENTORY_VIEW")) return unauthorizedPayload(p);
        Map<String, Object> row = safeOne("inventory metrics", """
                select
                  (select count(*)::int from medicines where hospital_id=:hospitalId and status='active') total_items,
                  (select count(*)::int from (select m.id from medicines m left join pharmacy_stock s on s.medicine_id=m.id and s.hospital_id=m.hospital_id and s.status='active' and (s.expiry_date is null or s.expiry_date>=:today) where m.hospital_id=:hospitalId and m.status='active' group by m.id,m.reorder_level having coalesce(sum(s.quantity),0)<coalesce(m.reorder_level,0)) x) low_stock,
                  (select count(*)::int from pharmacy_stock where hospital_id=:hospitalId and status='active' and expiry_date<:today and quantity>0) expired_batches,
                  (select count(*)::int from pharmacy_stock where hospital_id=:hospitalId and status='active' and expiry_date between :today and cast(:today as date)+90 and quantity>0) expiring_batches
                """, params);
        addMetrics(p, row,
                spec("totalItems", "Active medicines", "total_items", null, "info", "Active medicine catalogue records."),
                spec("lowStockItems", "Low-stock items", "low_stock", null, "danger", "Usable quantity below reorder level."),
                spec("expiredItems", "Expired stock batches", "expired_batches", null, "danger", "Active batches with positive quantity past expiry."),
                spec("expiringItems", "Expiring within 90 days", "expiring_batches", null, "warning", "Active positive-quantity batches approaching expiry."));
        p.metrics.add(unavailableMetric("supplierOrders", "Supplier orders", "no_source", null, "Purchase-order and supplier-order tables are not implemented."));
        p.charts.add(stockStatus(params));
        p.charts.add(expiryTrend(params));
        p.charts.add(medicineConsumption(params));
        p.charts.add(unavailableChart("purchaseTrend", "Purchase trend", "no_source", "No purchase-order or goods-receipt transaction model is implemented."));
        p.unavailableCapabilities.add(capability("supplierOrders", "Supplier purchase orders", "no_source"));
        return p;
    }

    private Payload finance(GovCarePrincipal actor) {
        Payload p = new Payload("finance", "Finance intelligence", "Finance dashboard shell with explicit source readiness; no clinical or financial values are fabricated.");
        if (!hasAll(actor, "FINANCE_VIEW")) return unauthorizedPayload(p);
        p.metrics.add(unavailableMetric("revenueToday", "Revenue today", "no_source", null, "No billing, invoice or payment tables exist in the PostgreSQL schema."));
        p.metrics.add(unavailableMetric("outstandingClaims", "Outstanding claims", "no_source", null, "No payer/claim workflow is implemented."));
        p.metrics.add(unavailableMetric("paymentsToday", "Payments today", "no_source", null, "No payment transaction source is implemented."));
        p.metrics.add(unavailableMetric("refunds", "Refunds", "no_source", null, "No refund transaction source is implemented."));
        p.charts.add(unavailableChart("revenueTrend", "Revenue trend", "no_source", "Requires a governed billing and payment ledger."));
        p.charts.add(unavailableChart("payerMix", "Payer mix", "no_source", "Insurance and payer data are not implemented."));
        p.unavailableCapabilities.add(capability("billingLedger", "Billing and payment ledger", "no_source"));
        return p;
    }

    private Payload records(GovCarePrincipal actor, Scope scope, Map<String, Object> params) {
        Payload p = new Payload("records", "Records operations", "Patient registration throughput, demographic completion and document verification workload.");
        if (!hasAll(actor, "PATIENT_VIEW")) return unauthorizedPayload(p);
        Map<String, Object> row = safeOne("records metrics", """
                select
                  (select count(*)::int from patients where hospital_id=:hospitalId and created_by=:actorId and created_at>=:startAt and created_at<:endAt and status<>'deleted') my_registrations,
                  (select count(*)::int from patients where hospital_id=:hospitalId and status='active') active_patients,
                  (select count(*)::int from patients where hospital_id=:hospitalId and status='pending') pending_registrations,
                  (select count(*)::int from patient_documents where hospital_id=:hospitalId and document_status in ('DRAFT','SUBMITTED')) pending_documents
                """, params);
        addMetrics(p, row,
                spec("myRegistrations", "My registrations today", "my_registrations", null, "success", "Patient records created today by this account."),
                spec("activePatients", "Active patient records", "active_patients", null, "info", "Active patients in the assigned hospital."),
                spec("pendingRegistrations", "Pending registrations", "pending_registrations", null, "warning", "Patient records awaiting activation/review."),
                spec("pendingDocuments", "Documents pending verification", "pending_documents", null, "warning", "Draft or submitted patient documents."));
        p.charts.add(chartQuery("registrationTrend", "Patient registrations · 30 days", "line", "date", List.of(series("patients", "Patients", "#2dd4bf")),
                """
                with days as (select generate_series(cast(:today as date)-29,cast(:today as date),'1 day')::date activity_day)
                select to_char(days.activity_day,'Mon DD') date,count(p.id)::int patients
                from days left join patients p on p.hospital_id=:hospitalId and p.status<>'deleted' and (p.created_at at time zone 'Asia/Colombo')::date=days.activity_day
                group by days.activity_day order by days.activity_day
                """, params, "Registration volume by Sri Lanka calendar day.", List.of()));
        p.charts.add(chartQuery("districtDistribution", "Patient distribution by district", "bar", "district", List.of(series("patients", "Patients", "#38bdf8")),
                """
                select coalesce(nullif(district,''),'Not recorded') district,count(*)::int patients
                from patients where hospital_id=:hospitalId and status<>'deleted'
                group by 1 order by patients desc limit 12
                """, params, "Demographic aggregate only.", List.of()));
        p.worklists.add(worklistQuery("pendingRecords", "Pending registration review", List.of(
                        column("patient_no", "Patient"), column("full_name", "Name"), column("created_at", "Registered"), column("status", "Status")),
                """
                select patient_no,full_name,created_at,status::text from patients
                where hospital_id=:hospitalId and status='pending' order by created_at limit 12
                """, params, "Only demographic registration fields are included."));
        return p;
    }

    private Payload patient(GovCarePrincipal actor, Scope scope, Map<String, Object> params) {
        Payload p = new Payload("patient", "My health dashboard", "Only the signed-in patient's own released records are queried.");
        if (actor.patientId() == null) return patientUnlinked(p, "no_patient_link", "This portal account is not linked to a PostgreSQL patient record.");
        if (!hasAll(actor, "PATIENT_VIEW_SELF", "APPOINTMENT_VIEW", "PRESCRIPTION_VIEW", "LAB_REQUEST_VIEW", "RADIOLOGY_REQUEST_VIEW")) return unauthorizedPayload(p);
        Map<String, Object> row = safeOne("patient metrics", """
                select
                  (select count(*)::int from appointments where patient_id=:patientId and scheduled_at>=now() and status not in ('cancelled','deleted')) upcoming_appointments,
                  (select count(*)::int from prescriptions where patient_id=:patientId and release_status='released' and status='active') released_prescriptions,
                  (select count(*)::int from lab_results where patient_id=:patientId and release_status='released' and status not in ('cancelled','deleted')) released_lab_reports,
                  (select count(*)::int from radiology_reports where patient_id=:patientId and release_status='released' and status not in ('cancelled','deleted')) released_radiology_reports
                """, params);
        addMetrics(p, row,
                spec("myAppointments", "Upcoming appointments", "upcoming_appointments", null, "info", "Future appointments for this patient only."),
                spec("myPrescriptions", "Released prescriptions", "released_prescriptions", null, "success", "Prescriptions explicitly released to this patient."),
                spec("myLabReports", "Released lab reports", "released_lab_reports", null, "success", "Laboratory results explicitly released to this patient."),
                spec("myRadiologyReports", "Released radiology reports", "released_radiology_reports", null, "success", "Radiology reports explicitly released to this patient."));
        p.metrics.add(unavailableMetric("myCkdRisk", "My CKD risk", "no_source", null, "AI predictions have no patient-release state, so they are not exposed in the portal."));
        p.charts.add(chartQuery("healthTimeline", "My released health timeline", "timeline", "date", List.of(series("count", "Events", "#2dd4bf")),
                """
                select to_char(event_date at time zone 'Asia/Colombo','YYYY-MM-DD') date,count(*)::int count from (
                  select scheduled_at event_date from appointments where patient_id=:patientId and status not in ('cancelled','deleted')
                  union all select created_at from prescriptions where patient_id=:patientId and release_status='released' and status='active'
                  union all select coalesce(released_at,created_at) from lab_results where patient_id=:patientId and release_status='released' and status not in ('cancelled','deleted')
                  union all select coalesce(released_at,created_at) from radiology_reports where patient_id=:patientId and release_status='released' and status not in ('cancelled','deleted')
                ) events where event_date>=cast(:today as date)-180 group by 1 order by 1
                """, params, "Appointments and released clinical records for this patient only.", List.of()));
        p.worklists.add(worklistQuery("myUpcomingAppointments", "My upcoming appointments", List.of(
                        column("scheduled_at", "Date"), column("appointment_type", "Type"), column("department_name", "Department"), column("status", "Status")),
                """
                select a.scheduled_at,a.appointment_type,d.name department_name,a.status::text
                from appointments a left join departments d on d.id=a.department_id and d.hospital_id=a.hospital_id
                where a.patient_id=:patientId and a.scheduled_at>=now() and a.status not in ('cancelled','deleted')
                order by a.scheduled_at limit 8
                """, params, "Self-scoped appointment records."));
        p.worklists.add(worklistQuery("myPrescriptions", "My released prescriptions", List.of(
                        column("prescription_no", "Prescription"), column("diagnosis", "Diagnosis"), column("pharmacy_status", "Pharmacy status"), column("created_at", "Issued")),
                """
                select prescription_no,coalesce(nullif(diagnosis,''),'Not recorded') diagnosis,pharmacy_status,created_at
                from prescriptions where patient_id=:patientId and release_status='released' and status='active'
                order by created_at desc limit 8
                """, params, "Only prescriptions explicitly released to this patient are returned."));
        p.worklists.add(worklistQuery("myReports", "My released reports", List.of(
                        column("source", "Source"), column("report", "Report"), column("classification", "Classification"), column("released_at", "Released")),
                """
                select * from (
                  select 'Laboratory' source,coalesce(nullif(req.test_type,''),nullif(req.test_code,''),'Lab report') report,
                         coalesce(res.classification,'Not recorded') classification,coalesce(res.released_at,res.created_at) released_at
                  from lab_results res join lab_requests req on req.id=res.lab_request_id
                  where res.patient_id=:patientId and res.release_status='released' and res.status not in ('cancelled','deleted')
                  union all
                  select 'Radiology',coalesce(nullif(req.imaging_type,''),'Radiology report'),
                         coalesce(rep.classification,'Not recorded'),coalesce(rep.released_at,rep.created_at)
                  from radiology_reports rep join radiology_requests req on req.id=rep.radiology_request_id
                  where rep.patient_id=:patientId and rep.release_status='released' and rep.status not in ('cancelled','deleted')
                ) released_reports order by released_at desc limit 12
                """, params, "Only laboratory and radiology reports explicitly released to this patient are returned."));
        p.unavailableCapabilities.add(capability("patientCkdRelease", "Patient-visible CKD assessment release", "no_source"));
        return p;
    }

    private Payload guardian() {
        Payload p = new Payload("guardian", "Guardian care dashboard", "Linked-dependent access is withheld until a trusted account-to-guardian relationship is persisted.");
        return patientUnlinked(p, "no_guardian_link", "The schema has guardian records but no authenticated app-user-to-guardian link.");
    }

    private Payload emergency(GovCarePrincipal actor, Scope scope, Map<String, Object> params) {
        Payload p = new Payload("emergency", "Emergency operations", "Emergency admissions and critical OPD escalation without fabricating a triage encounter stream.");
        if (!hasAll(actor, "EMERGENCY_VIEW", "QUEUE_VIEW", "ADMISSION_VIEW", "BED_VIEW", "PATIENT_VIEW")) return unauthorizedPayload(p);
        Map<String, Object> row = safeOne("emergency metrics", """
                select
                  (select count(*)::int from admissions where hospital_id=:hospitalId and admission_type='EMERGENCY' and admitted_at>=:startAt and admitted_at<:endAt) emergency_admissions,
                  (select count(*)::int from opd_queue where hospital_id=:hospitalId and priority in ('critical','stat') and queue_status not in ('completed','cancelled','skipped')) critical_queue,
                  (select count(*)::int from beds b join wards w on w.id=b.ward_id where b.hospital_id=:hospitalId and upper(coalesce(w.ward_type,w.category,'')) in ('ICU','HDU') and upper(b.status)='AVAILABLE') critical_beds_available
                """, params);
        addMetrics(p, row,
                spec("emergencyAdmissions", "Emergency admissions today", "emergency_admissions", null, "danger", "Admissions explicitly classified EMERGENCY."),
                spec("criticalQueue", "Critical / STAT OPD queue", "critical_queue", null, "danger", "Open critical or STAT OPD tokens."),
                spec("criticalBedsAvailable", "Available ICU/HDU beds", "critical_beds_available", null, "warning", "Available beds in ICU/HDU wards."));
        p.metrics.add(unavailableMetric("triageCases", "Emergency triage cases", "no_source", null, "No persisted triage encounter, acuity or disposition model exists."));
        p.charts.add(chartQuery("emergencyAdmissionTrend", "Emergency admissions · 14 days", "line", "date", List.of(series("admissions", "Admissions", "#fb7185")),
                """
                with days as (select generate_series(cast(:today as date)-13,cast(:today as date),'1 day')::date activity_day)
                select to_char(days.activity_day,'Mon DD') date,count(a.id)::int admissions
                from days left join admissions a on a.hospital_id=:hospitalId and a.admission_type='EMERGENCY' and (a.admitted_at at time zone 'Asia/Colombo')::date=days.activity_day
                group by days.activity_day order by days.activity_day
                """, params, "Emergency-classified admissions; not a triage encounter count.", List.of()));
        p.charts.add(queuePriorityChart(params));
        p.worklists.add(liveQueue(params, true));
        p.unavailableCapabilities.add(capability("triage", "Emergency triage workflow", "no_source"));
        return p;
    }

    private Payload quality(GovCarePrincipal actor, Scope scope, Map<String, Object> params) {
        Payload p = new Payload("quality", "Quality and safety intelligence", "Operational quality indicators derived from auditable wait, cancellation and critical-result records.");
        if (!hasAll(actor, "QUALITY_VIEW", "AUDIT_VIEW")) return unauthorizedPayload(p);
        Map<String, Object> row = safeOne("quality metrics", """
                select
                  (select round(avg(greatest(0,extract(epoch from (coalesce(started_at,called_at,completed_at)-created_at))/60)),1) from opd_queue where hospital_id=:hospitalId and created_at>=:startAt and created_at<:endAt and coalesce(started_at,called_at,completed_at) is not null) avg_wait_minutes,
                  (select count(*)::int from appointments where hospital_id=:hospitalId and status='cancelled' and scheduled_at>=cast(:today as date)-30) cancelled_appointments,
                  (select count(*)::int from lab_results where hospital_id=:hospitalId and critical_flag=true and created_at>=cast(:today as date)-30) critical_lab_results,
                  (select count(*)::int from audit_logs where hospital_id=:hospitalId and created_at>=cast(:today as date)-30) audit_events
                """, params);
        addMetrics(p, row,
                spec("averageWait", "Average OPD wait today", "avg_wait_minutes", "min", "warning", "Check-in to first called/started/completed timestamp."),
                spec("cancelledAppointments", "Cancelled appointments · 30 days", "cancelled_appointments", null, "warning", "Persisted appointment cancellations."),
                spec("criticalLabResults", "Critical lab results · 30 days", "critical_lab_results", null, "danger", "Persisted critical laboratory flags."),
                spec("auditEvents", "Audit events · 30 days", "audit_events", null, "info", "Auditable system actions in the assigned hospital."));
        p.charts.add(waitTrend(params));
        p.charts.add(chartQuery("qualityEvents", "Quality event signals · 14 days", "area", "date", List.of(
                        series("cancelled", "Cancelled appointments", "#f59e0b"), series("criticalLabs", "Critical lab results", "#fb7185")),
                """
                with days as (select generate_series(cast(:today as date)-13,cast(:today as date),'1 day')::date activity_day),
                ap as (select (scheduled_at at time zone 'Asia/Colombo')::date activity_day,count(*)::int cancelled from appointments where hospital_id=:hospitalId and status='cancelled' group by 1),
                labs as (select (created_at at time zone 'Asia/Colombo')::date activity_day,count(*)::int critical_labs from lab_results where hospital_id=:hospitalId and critical_flag=true group by 1)
                select to_char(days.activity_day,'Mon DD') date,coalesce(ap.cancelled,0)::int cancelled,coalesce(labs.critical_labs,0)::int "criticalLabs"
                from days left join ap using(activity_day) left join labs using(activity_day) order by days.activity_day
                """, params, "Signals are operational indicators, not adjudicated safety incidents.", List.of()));
        p.charts.add(unavailableChart("clinicalOutcomes", "Clinical outcome benchmark", "no_source", "No governed outcome/risk-adjustment model exists."));
        p.unavailableCapabilities.add(capability("incidentManagement", "Patient-safety incident register", "no_source"));
        return p;
    }

    private Payload itAdmin(GovCarePrincipal actor, Scope scope, Map<String, Object> params) {
        Payload p = new Payload("it", "IT operations and security", "Account, authentication and audit telemetry from the assigned hospital.");
        if (!hasAll(actor, "SYSTEM_MONITOR_VIEW", "LOGIN_ACTIVITY_VIEW", "AUDIT_VIEW")) return unauthorizedPayload(p);
        Map<String, Object> row = safeOne("it metrics", """
                select
                  (select count(*)::int from app_users where hospital_id=:hospitalId and status='active') active_users,
                  (select count(*)::int from login_activities where hospital_id=:hospitalId and login_status='success' and login_time>=:startAt and login_time<:endAt) logins_today,
                  (select count(*)::int from login_activities where hospital_id=:hospitalId and login_status='failed' and login_time>=:startAt and login_time<:endAt) failed_logins,
                  (select count(*)::int from audit_logs where hospital_id=:hospitalId and created_at>=:startAt and created_at<:endAt) audit_events,
                  (select count(*)::int from audit_logs where hospital_id=:hospitalId and action='access_denied' and created_at>=cast(:today as date)-30) denied_access
                """, params);
        addMetrics(p, row,
                spec("activeUsers", "Active users", "active_users", null, "info", "Active accounts in the assigned hospital."),
                spec("loginsToday", "Successful logins today", "logins_today", null, "success", "Successful login audit records."),
                spec("failedLogins", "Failed logins today", "failed_logins", null, "danger", "Failed authentication records."),
                spec("auditEvents", "Audit events today", "audit_events", null, "info", "Persisted audit events."),
                spec("deniedAccess", "Denied access · 30 days", "denied_access", null, "warning", "Authorization denials recorded by the API."));
        p.metrics.add(unavailableMetric("apiResponseTime", "API response time", "no_source", "ms", "No request-duration metrics store is configured."));
        p.metrics.add(unavailableMetric("systemAvailability", "System availability", "no_source", "%", "No uptime history store is configured."));
        p.charts.add(systemActivityForHospital(params));
        p.charts.add(chartQuery("auditModules", "Audit events by module · 30 days", "bar", "module", List.of(series("events", "Events", "#60a5fa")),
                """
                select module,count(*)::int events from audit_logs where hospital_id=:hospitalId and created_at>=cast(:today as date)-30
                group by module order by events desc limit 12
                """, params, "Aggregated audit modules; no patient content is returned.", List.of()));
        p.worklists.add(worklistQuery("failedAuthentication", "Recent failed authentication", List.of(
                        column("login_time", "Time"), column("email", "Account"), column("failure_reason", "Reason"), column("ip_address", "IP")),
                """
                select login_time,email,coalesce(failure_reason,'Not recorded') failure_reason,ip_address
                from login_activities where hospital_id=:hospitalId and login_status='failed'
                order by login_time desc limit 12
                """, params, "Security audit data only; no passwords or tokens are returned."));
        p.unavailableCapabilities.add(capability("apiTelemetry", "API latency and uptime telemetry", "no_source"));
        return p;
    }

    private Payload mortuary() {
        Payload p = new Payload("mortuary", "Mortuary operations", "A dedicated dashboard is reserved, but no persisted mortuary case model exists in this source release.");
        p.metrics.add(unavailableMetric("activeCases", "Active cases", "no_source", null, "No mortuary case table exists."));
        p.metrics.add(unavailableMetric("pendingRelease", "Pending releases", "no_source", null, "No body-release workflow is persisted."));
        p.charts.add(unavailableChart("caseTrend", "Mortuary case trend", "no_source", "No mortuary case source is implemented."));
        p.unavailableCapabilities.add(capability("mortuaryCases", "Mortuary case workflow", "no_source"));
        return p;
    }

    private void addFrontDeskMetrics(Payload p, Map<String, Object> params, boolean ownRegistrations) {
        String registrationFilter = ownRegistrations ? " and created_by=:actorId" : "";
        Map<String, Object> row = safeOne("front desk metrics", """
                select
                  (select count(*)::int from patients where hospital_id=:hospitalId and created_at>=:startAt and created_at<:endAt and status<>'deleted' %s) registered_today,
                  (select count(*)::int from opd_queue where hospital_id=:hospitalId and queue_status in ('waiting','called','checking','in-consultation','paused')) queue_length,
                  (select round(avg(greatest(0,extract(epoch from (coalesce(started_at,called_at,completed_at)-created_at))/60)),1) from opd_queue where hospital_id=:hospitalId and created_at>=:startAt and created_at<:endAt and coalesce(started_at,called_at,completed_at) is not null) avg_wait,
                  (select count(*)::int from opd_queue where hospital_id=:hospitalId and completed_at>=:startAt and completed_at<:endAt and queue_status='completed') completed_visits,
                  (select count(*)::int from appointments where hospital_id=:hospitalId and scheduled_at>=:startAt and scheduled_at<:endAt and status='cancelled') cancelled_appointments
                """.formatted(registrationFilter), params);
        addMetrics(p, row,
                spec("registeredToday", ownRegistrations ? "My patient registrations" : "Registered patients today", "registered_today", null, "success", ownRegistrations ? "Records created today by this account." : "Hospital registrations today."),
                spec("queueLength", "Live queue length", "queue_length", null, "warning", "Open OPD tokens."),
                spec("averageWait", "Average waiting time", "avg_wait", "min", "warning", "Check-in to first called/started/completed timestamp."),
                spec("completedVisits", "Completed visits", "completed_visits", null, "success", "OPD tokens completed today."),
                spec("cancelledAppointments", "Cancelled appointments", "cancelled_appointments", null, "danger", "Appointments scheduled today and marked cancelled."));
    }

    private void addPharmacyMetrics(Payload p, Map<String, Object> params) {
        Map<String, Object> row = safeOne("pharmacy metrics", """
                select
                  (select count(*)::int from prescriptions where hospital_id=:hospitalId and created_at>=:startAt and created_at<:endAt and status='active') prescriptions_today,
                  (select count(*)::int from pharmacy_receipts where hospital_id=:hospitalId and created_at>=:startAt and created_at<:endAt and status='completed') dispensed_today,
                  (select count(*)::int from prescriptions where hospital_id=:hospitalId and status='active' and pharmacy_status not in ('dispensed','cancelled','rejected')) pending_orders,
                  (select count(*)::int from (select m.id from medicines m left join pharmacy_stock s on s.medicine_id=m.id and s.hospital_id=m.hospital_id and s.status='active' and (s.expiry_date is null or s.expiry_date>=:today) where m.hospital_id=:hospitalId and m.status='active' and m.reorder_level>0 group by m.id,m.reorder_level having coalesce(sum(s.quantity),0)<m.reorder_level) x) low_stock
                """, params);
        addMetrics(p, row,
                spec("prescriptionsToday", "Prescriptions today", "prescriptions_today", null, "info", "Active prescriptions created today."),
                spec("dispensedMedicines", "Dispensed prescriptions", "dispensed_today", null, "success", "Completed pharmacy receipts today."),
                spec("pendingOrders", "Pending orders", "pending_orders", null, "warning", "Active prescriptions not yet dispensed, cancelled or rejected."),
                spec("lowStockMedicines", "Low-stock medicines", "low_stock", null, "danger", "Usable stock below reorder level."));
    }

    private Map<String, Object> arrivalPattern(Map<String, Object> params) {
        return chartQuery("arrivalPattern", "Patient arrival pattern today", "area", "hour", List.of(series("patients", "Arrivals", "#2dd4bf")),
                """
                with hours as (select generate_series(0,23) hour), arrivals as (
                  select extract(hour from created_at at time zone 'Asia/Colombo')::int hour,count(*)::int patients
                  from opd_queue where hospital_id=:hospitalId and created_at>=:startAt and created_at<:endAt group by 1)
                select lpad(hours.hour::text,2,'0')||':00' hour,coalesce(arrivals.patients,0)::int patients
                from hours left join arrivals using(hour) order by hours.hour
                """, params, "OPD queue registrations by Sri Lanka hour.", List.of());
    }

    private Map<String, Object> waitTrend(Map<String, Object> params) {
        return chartQuery("waitTrend", "Average OPD wait · 14 days", "line", "date", List.of(series("minutes", "Minutes", "#f59e0b")),
                """
                with days as (select generate_series(cast(:today as date)-13,cast(:today as date),'1 day')::date activity_day)
                select to_char(days.activity_day,'Mon DD') date,
                  round(avg(greatest(0,extract(epoch from (coalesce(q.started_at,q.called_at,q.completed_at)-q.created_at))/60)) filter(where coalesce(q.started_at,q.called_at,q.completed_at) is not null),1) minutes
                from days left join opd_queue q on q.hospital_id=:hospitalId and (q.created_at at time zone 'Asia/Colombo')::date=days.activity_day
                group by days.activity_day order by days.activity_day
                """, params, "Days with no measurable wait remain empty rather than zero.", List.of());
    }

    private Map<String, Object> appointmentCompletion(Map<String, Object> params, UUID creator) {
        return chartQuery("appointmentCompletion", "Appointment completion · 30 days", "donut", "status", List.of(series("count", "Appointments", "#38bdf8")),
                """
                select coalesce(nullif(workflow_status,''),status::text) status,count(*)::int count
                from appointments where hospital_id=:hospitalId and created_by=:actorId and scheduled_at>=cast(:today as date)-30
                group by 1 order by count desc
                """, params, "Appointments created by this front-desk account.", List.of());
    }

    private Map<String, Object> queueStatusChart(Map<String, Object> params) {
        return chartQuery("queueStatus", "Live queue status", "donut", "status", List.of(series("count", "Tokens", "#2dd4bf")),
                """
                select queue_status status,count(*)::int count from opd_queue
                where hospital_id=:hospitalId and created_at>=:startAt and created_at<:endAt
                group by queue_status order by count desc
                """, params, "Today's queue states.", List.of());
    }

    private Map<String, Object> queuePriorityChart(Map<String, Object> params) {
        return chartQuery("queuePriority", "Open queue by priority", "donut", "priority", List.of(series("count", "Tokens", "#fb7185")),
                """
                select priority::text priority,count(*)::int count from opd_queue
                where hospital_id=:hospitalId and queue_status not in ('completed','cancelled','skipped')
                group by priority order by count desc
                """, params, "Open OPD tokens, not emergency-triage encounters.", List.of());
    }

    private Map<String, Object> liveQueue(Map<String, Object> params, boolean includePatient) {
        return worklistQuery("liveQueue", "Live priority queue", List.of(
                        column("token", "Token"), column("patient_name", "Patient"), column("patient_no", "Patient ID"), column("department", "Department"),
                        column("wait_minutes", "Wait (min)"), column("status", "Status")),
                """
                select q.token_no token,p.patient_no,p.full_name patient_name,d.name department,
                       greatest(0,floor(extract(epoch from (now()-q.created_at))/60))::int wait_minutes,
                       q.queue_status status,q.priority::text priority
                from opd_queue q join patients p on p.id=q.patient_id and p.hospital_id=q.hospital_id
                left join departments d on d.id=q.department_id and d.hospital_id=q.hospital_id
                where q.hospital_id=:hospitalId and q.queue_status in ('waiting','called','checking','in-consultation','paused')
                order by case q.priority when 'critical' then 0 when 'stat' then 0 when 'urgent' then 1 else 2 end,q.created_at limit 15
                """, params, "Patient identifiers are returned only to roles with queue/patient workflow access.");
    }

    private Map<String, Object> admissionTrend(Map<String, Object> params) {
        return chartQuery("admissionTrend", "Admissions and discharges · 14 days", "area", "date", List.of(
                        series("admissions", "Admissions", "#38bdf8"), series("discharges", "Discharges", "#a78bfa")),
                """
                with days as (select generate_series(cast(:today as date)-13,cast(:today as date),'1 day')::date activity_day),
                admitted as (select (admitted_at at time zone 'Asia/Colombo')::date activity_day,count(*)::int admissions from admissions where hospital_id=:hospitalId group by 1),
                discharged as (select (discharged_at at time zone 'Asia/Colombo')::date activity_day,count(*)::int discharges from admissions where hospital_id=:hospitalId and discharged_at is not null group by 1)
                select to_char(days.activity_day,'Mon DD') date,coalesce(admitted.admissions,0)::int admissions,coalesce(discharged.discharges,0)::int discharges
                from days left join admitted using(activity_day) left join discharged using(activity_day) order by days.activity_day
                """, params, "Admission and discharge timestamps in Sri Lanka time.", List.of());
    }

    private Map<String, Object> patientFlow(Map<String, Object> params) {
        return chartQuery("patientFlow", "Patient flow today", "bar", "stage", List.of(series("count", "Patients", "#2dd4bf")),
                """
                select 'Registration' stage,count(*)::int count from patients where hospital_id=:hospitalId and created_at>=:startAt and created_at<:endAt and status<>'deleted'
                union all select 'OPD',count(distinct patient_id)::int from opd_queue where hospital_id=:hospitalId and created_at>=:startAt and created_at<:endAt
                union all select 'Admission',count(*)::int from admissions where hospital_id=:hospitalId and admitted_at>=:startAt and admitted_at<:endAt
                union all select 'Treatment',count(*)::int from consultations where hospital_id=:hospitalId and coalesce(completed_at,created_at)>=:startAt and coalesce(completed_at,created_at)<:endAt
                union all select 'Discharge',count(*)::int from admissions where hospital_id=:hospitalId and discharged_at>=:startAt and discharged_at<:endAt
                """, params, "Independent stage counts; this is not a cohort-conversion funnel.", List.of());
    }

    private Map<String, Object> departmentWorkload(Map<String, Object> params) {
        return chartQuery("departmentWorkload", "Department workload today", "bar", "department", List.of(
                        series("opd", "OPD arrivals", "#2dd4bf"), series("consultations", "Doctor consultations", "#60a5fa"), series("labOrders", "Lab workload", "#f59e0b")),
                """
                select d.name department,
                  count(distinct q.id) filter(where q.created_at>=:startAt and q.created_at<:endAt)::int opd,
                  count(distinct c.id) filter(where c.created_at>=:startAt and c.created_at<:endAt)::int consultations,
                  count(distinct lr.id) filter(where lr.created_at>=:startAt and lr.created_at<:endAt)::int "labOrders"
                from departments d
                left join opd_queue q on q.department_id=d.id and q.hospital_id=d.hospital_id
                left join consultations c on c.visit_id=q.visit_id and c.hospital_id=d.hospital_id
                left join lab_requests lr on lr.visit_id=q.visit_id and lr.hospital_id=d.hospital_id
                where d.hospital_id=:hospitalId and d.status='active'
                group by d.id,d.name order by opd desc limit 12
                """, params, "Nurse workload is unavailable because shift and assignment records are not implemented.", List.of("Nurse workload"));
    }

    private Map<String, Object> wardOccupancy(Map<String, Object> params, UUID departmentId) {
        Map<String, Object> scoped = new HashMap<>(params);
        String filter = departmentId == null ? "" : " and w.department_id=:departmentId";
        return chartQuery("wardOccupancy", "Ward bed status", "bar", "ward", List.of(
                        series("occupied", "Occupied", "#f59e0b"), series("available", "Available", "#22c55e"), series("unavailable", "Unavailable", "#fb7185")),
                """
                select w.name ward,
                  count(*) filter(where upper(b.status) in ('OCCUPIED','PENDING_DISCHARGE'))::int occupied,
                  count(*) filter(where upper(b.status)='AVAILABLE')::int available,
                  count(*) filter(where upper(b.status) in ('CLEANING','BLOCKED','MAINTENANCE','OUT_OF_SERVICE','INFECTION_CONTROL'))::int unavailable
                from wards w left join beds b on b.ward_id=w.id and b.hospital_id=w.hospital_id
                where w.hospital_id=:hospitalId and w.status='active' %s
                group by w.id,w.name order by occupied desc,w.name
                """.formatted(filter), scoped, "Department scoped when the account has a department assignment.", List.of());
    }

    private Map<String, Object> medicineConsumption(Map<String, Object> params) {
        return chartQuery("medicineConsumption", "Medicine consumption · 30 days", "bar", "medicine", List.of(series("quantity", "Quantity", "#2dd4bf")),
                """
                select coalesce(item->>'medicineName',item->>'name','Recorded item') medicine,
                       sum(coalesce(nullif(item->>'quantity','')::numeric,1)) quantity
                from pharmacy_receipts r cross join lateral jsonb_array_elements(r.issued_items) item
                where r.hospital_id=:hospitalId and r.created_at>=cast(:today as date)-30 and r.status='completed'
                group by 1 order by quantity desc limit 10
                """, params, "Issued-item quantities recorded in completed pharmacy receipts.", List.of());
    }

    private Map<String, Object> stockStatus(Map<String, Object> params) {
        return chartQuery("stockStatus", "Medicine stock status", "bar", "medicine", List.of(
                        series("usable", "Usable stock", "#22c55e"), series("reorderLevel", "Reorder level", "#f59e0b")),
                """
                select m.name medicine,round(coalesce(sum(s.quantity) filter(where s.status='active' and (s.expiry_date is null or s.expiry_date>=:today)),0),2) usable,
                       round(coalesce(m.reorder_level,0),2) "reorderLevel"
                from medicines m left join pharmacy_stock s on s.medicine_id=m.id and s.hospital_id=m.hospital_id
                where m.hospital_id=:hospitalId and m.status='active'
                group by m.id,m.name,m.reorder_level order by usable asc limit 12
                """, params, "Expired batches are excluded from usable stock.", List.of());
    }

    private Map<String, Object> expiryTrend(Map<String, Object> params) {
        return chartQuery("expiryMonitoring", "Stock expiry monitoring", "bar", "window", List.of(series("batches", "Batches", "#fb7185")),
                """
                select window,count(*)::int batches from (
                  select case when expiry_date<:today then 'Expired'
                    when expiry_date<=cast(:today as date)+30 then '0–30 days'
                    when expiry_date<=cast(:today as date)+60 then '31–60 days'
                    when expiry_date<=cast(:today as date)+90 then '61–90 days'
                    else 'Over 90 days' end window
                  from pharmacy_stock where hospital_id=:hospitalId and status='active' and quantity>0 and expiry_date is not null
                ) x group by window order by min(case window when 'Expired' then 0 when '0–30 days' then 1 when '31–60 days' then 2 when '61–90 days' then 3 else 4 end)
                """, params, "Active stock batches with positive quantity.", List.of());
    }

    private Map<String, Object> systemActivityForHospital(Map<String, Object> params) {
        return chartQuery("systemActivity", "Authentication activity · 14 days", "area", "date", List.of(
                        series("success", "Successful", "#22c55e"), series("failed", "Failed", "#fb7185")),
                """
                with days as (select generate_series(cast(:today as date)-13,cast(:today as date),'1 day')::date activity_day), activity as (
                  select (login_time at time zone 'Asia/Colombo')::date activity_day,count(*) filter(where login_status='success')::int success,
                         count(*) filter(where login_status='failed')::int failed
                  from login_activities where hospital_id=:hospitalId group by 1)
                select to_char(days.activity_day,'Mon DD') date,coalesce(activity.success,0)::int success,coalesce(activity.failed,0)::int failed
                from days left join activity using(activity_day) order by days.activity_day
                """, params, "Persisted login activity only.", List.of());
    }

    private Map<String, Object> networkActivityHeatmap(Map<String, Object> params) {
        Map<String, Object> chart = chartQuery("departmentHeatmap", "Network activity heatmap · 7 days", "heatmap", "day",
                List.of(series("count", "Events", "#2dd4bf")), """
                with days as (select generate_series(cast(:today as date)-6,cast(:today as date),'1 day')::date activity_day), activity as (
                  select 'OPD' row,(created_at at time zone 'Asia/Colombo')::date activity_day,count(*)::int count from opd_queue group by 1,2
                  union all select 'ICU',(a.admitted_at at time zone 'Asia/Colombo')::date,count(*)::int from admissions a join wards w on w.id=a.ward_id where upper(coalesce(w.ward_type,w.category,'')) in ('ICU','HDU') group by 1,2
                  union all select 'Laboratory',(created_at at time zone 'Asia/Colombo')::date,count(*)::int from lab_requests group by 1,2
                  union all select 'Pharmacy',(created_at at time zone 'Asia/Colombo')::date,count(*)::int from pharmacy_receipts group by 1,2)
                select modules.row,to_char(days.activity_day,'Dy') "day",coalesce(activity.count,0)::int count
                from days cross join (values('OPD'),('ICU'),('Laboratory'),('Pharmacy')) modules(row)
                left join activity on activity.row=modules.row and activity.activity_day=days.activity_day order by modules.row,days.activity_day
                """, params, "Emergency activity is unavailable because no triage encounter model exists.", List.of("Emergency"));
        return chart;
    }

    private void addNetworkAlerts(Payload p, Map<String, Object> params) {
        List<Map<String, Object>> rows = safeList("network alerts", """
                select h.name hospital,
                  (select count(*) from login_activities l where l.hospital_id=h.id and l.login_status='failed' and l.login_time>=:startAt and l.login_time<:endAt)::int failed_logins,
                  (select count(*) from lab_results r where r.hospital_id=h.id and r.critical_flag=true and r.created_at>=cast(:today as date)-1)::int critical_labs
                from hospitals h where h.status='active' order by h.name
                """, params);
        if (rows == null) return;
        for (Map<String, Object> row : rows) {
            int failed = number(row.get("failed_logins"));
            int critical = number(row.get("critical_labs"));
            if (failed > 0) p.alerts.add(alert("failed-logins-" + row.get("hospital"), "warning", row.get("hospital") + ": " + failed + " failed login" + (failed == 1 ? "" : "s") + " today", "login_activities"));
            if (critical > 0) p.alerts.add(alert("critical-lab-" + row.get("hospital"), "danger", row.get("hospital") + ": " + critical + " critical lab result" + (critical == 1 ? "" : "s") + " in 24 hours", "lab_results"));
        }
    }

    private void addHospitalAlerts(Payload p, Map<String, Object> params) {
        Map<String, Object> row = safeOne("hospital alerts", """
                select
                  (select case when count(*)=0 then null else round(100.0*count(*) filter(where upper(b.status) in ('OCCUPIED','PENDING_DISCHARGE'))/count(*),1) end from beds b join wards w on w.id=b.ward_id where b.hospital_id=:hospitalId and upper(coalesce(w.ward_type,w.category,'')) in ('ICU','HDU') and upper(b.status)<>'OUT_OF_SERVICE') icu_occupancy,
                  (select count(*)::int from lab_requests where hospital_id=:hospitalId and workflow_status in ('ordered','received','sample_collected','in_progress','result_entered') and status not in ('cancelled','deleted')) pending_labs,
                  (select count(*)::int from lab_results where hospital_id=:hospitalId and critical_flag=true and created_at>=cast(:today as date)-1) critical_labs
                """, params);
        if (row == null) return;
        Object occupancy = row.get("icu_occupancy");
        if (occupancy instanceof Number n && n.doubleValue() >= 90) p.alerts.add(alert("icu-occupancy", "danger", "ICU/HDU occupancy reached " + n + "%", "beds"));
        int pending = number(row.get("pending_labs"));
        if (pending > 0) p.alerts.add(alert("pending-labs", "warning", pending + " laboratory report" + (pending == 1 ? " is" : "s are") + " pending", "lab_requests"));
        int critical = number(row.get("critical_labs"));
        if (critical > 0) p.alerts.add(alert("critical-labs", "danger", critical + " critical laboratory result" + (critical == 1 ? "" : "s") + " recorded in 24 hours", "lab_results"));
    }

    private Payload patientUnlinked(Payload p, String reason, String detail) {
        p.metrics.add(unavailableMetric("appointments", "Appointments", reason, null, detail));
        p.metrics.add(unavailableMetric("prescriptions", "Prescriptions", reason, null, detail));
        p.metrics.add(unavailableMetric("reports", "Reports", reason, null, detail));
        p.metrics.add(unavailableMetric("ckdRisk", "CKD risk information", reason, null, detail));
        p.charts.add(unavailableChart("healthTimeline", "Health history timeline", reason, detail));
        p.worklists.add(unavailableWorklist("careTimeline", "Care timeline", reason, detail));
        p.unavailableCapabilities.add(capability("identityLink", "Trusted portal identity link", reason));
        return p;
    }

    private Payload unauthorizedPayload(Payload p) {
        p.metrics.add(unavailableMetric("dashboardAccess", "Dashboard data", "not_authorized", null, "Required PostgreSQL role permission is not assigned."));
        p.charts.add(unavailableChart("dashboardAnalytics", "Role analytics", "not_authorized", "Required PostgreSQL role permission is not assigned."));
        return p;
    }

    private Scope resolveScope(GovCarePrincipal actor, UUID requested) {
        if ("super_admin".equals(actor.role())) {
            if (requested == null) return new Scope("network", null, "All hospitals");
            Map<String, Object> hospital = sql.required("select id::text,name from hospitals where id=:id and status='active'", Map.of("id", requested), "Hospital not found or inactive.");
            return new Scope("hospital", requested, String.valueOf(hospital.get("name")));
        }
        if (Set.of("patient", "guardian").contains(actor.role()) && actor.hospitalId() == null) {
            if (requested != null) throw ApiException.forbidden("Portal accounts cannot select a hospital scope.");
            return new Scope("patient", null, "Personal record");
        }
        if (actor.hospitalId() == null) throw ApiException.forbidden("No hospital is assigned to this account.");
        if (requested != null && !requested.equals(actor.hospitalId())) {
            throw ApiException.forbidden("You cannot view another hospital's dashboard.");
        }
        Map<String, Object> hospital = sql.required("select id::text,name from hospitals where id=:id and status='active'", Map.of("id", actor.hospitalId()), "Hospital not found or inactive.");
        return new Scope(Set.of("patient", "guardian").contains(actor.role()) ? "patient" : "hospital", actor.hospitalId(), String.valueOf(hospital.get("name")));
    }

    private Map<String, Object> baseParams(Scope scope, LocalDate today, OffsetDateTime start, OffsetDateTime end, GovCarePrincipal actor) {
        Map<String, Object> params = new HashMap<>();
        params.put("hospitalId", scope.hospitalId);
        params.put("today", today);
        params.put("startAt", start);
        params.put("endAt", end);
        params.put("actorId", actor.id());
        params.put("departmentId", actor.departmentId());
        params.put("patientId", actor.patientId());
        return params;
    }

    private Map<String, Object> scopeMap(Scope scope) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("level", scope.level);
        value.put("hospitalId", scope.hospitalId == null ? null : scope.hospitalId.toString());
        value.put("hospitalName", scope.hospitalName);
        return value;
    }

    private boolean hasAll(GovCarePrincipal actor, String... required) {
        return actor.permissions().contains("*") || java.util.Arrays.stream(required).allMatch(actor.permissions()::contains);
    }

    private boolean hasAny(GovCarePrincipal actor, String... permissions) {
        if (actor.permissions().contains("*")) return true;
        for (String permission : permissions) if (actor.permissions().contains(permission)) return true;
        return false;
    }

    private Map<String, Object> safeOne(String name, String query, Map<String, Object> params) {
        try {
            return sql.required(query, params, "Dashboard data is unavailable.");
        } catch (DataAccessException failure) {
            log.warn("Dashboard query failed: {}", name, failure);
            return null;
        }
    }

    private List<Map<String, Object>> safeList(String name, String query, Map<String, Object> params) {
        try {
            return sql.list(query, params);
        } catch (DataAccessException failure) {
            log.warn("Dashboard query failed: {}", name, failure);
            return null;
        }
    }

    private void addMetrics(Payload p, Map<String, Object> row, MetricSpec... specs) {
        for (MetricSpec spec : specs) {
            if (row == null) p.metrics.add(unavailableMetric(spec.id, spec.label, "data_error", spec.unit, spec.definition));
            else p.metrics.add(metric(spec.id, spec.label, row.get(spec.column), spec.unit, spec.tone, spec.definition));
        }
    }

    private Map<String, Object> metric(String id, String label, Object value, String unit, String tone, String definition) {
        if (value == null) return unavailableMetric(id, label, "no_data", unit, definition);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", id);
        result.put("label", label);
        result.put("available", true);
        result.put("value", normalizeNumber(value));
        result.put("unit", unit);
        result.put("tone", tone);
        result.put("definition", definition);
        return result;
    }

    private Map<String, Object> unavailableMetric(String id, String label, String reason, String unit, String definition) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", id);
        result.put("label", label);
        result.put("available", false);
        result.put("value", null);
        result.put("unit", unit);
        result.put("tone", "neutral");
        result.put("reason", reason);
        result.put("definition", definition);
        return result;
    }

    private Map<String, Object> chartQuery(String id, String title, String type, String xKey, List<Map<String, Object>> series,
                                           String query, Map<String, Object> params, String description, List<String> unavailableSeries) {
        List<Map<String, Object>> rows = safeList(id, query, params);
        if (rows == null) return unavailableChart(id, title, "data_error", description);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", id);
        result.put("title", title);
        result.put("type", type);
        result.put("xKey", xKey);
        result.put("available", true);
        result.put("description", description);
        result.put("series", series);
        result.put("data", rows);
        result.put("unavailableSeries", unavailableSeries);
        return result;
    }

    private Map<String, Object> unavailableChart(String id, String title, String reason, String description) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", id);
        result.put("title", title);
        result.put("type", "bar");
        result.put("xKey", "label");
        result.put("available", false);
        result.put("reason", reason);
        result.put("description", description);
        result.put("series", List.of());
        result.put("data", List.of());
        result.put("unavailableSeries", List.of());
        return result;
    }

    private Map<String, Object> worklistQuery(String id, String title, List<Map<String, Object>> columns,
                                              String query, Map<String, Object> params, String description) {
        List<Map<String, Object>> rows = safeList(id, query, params);
        if (rows == null) return unavailableWorklist(id, title, "data_error", description);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", id);
        result.put("title", title);
        result.put("available", true);
        result.put("description", description);
        result.put("columns", columns);
        result.put("rows", rows);
        return result;
    }

    private Map<String, Object> unavailableWorklist(String id, String title, String reason, String description) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", id);
        result.put("title", title);
        result.put("available", false);
        result.put("reason", reason);
        result.put("description", description);
        result.put("columns", List.of());
        result.put("rows", List.of());
        return result;
    }

    private Map<String, Object> series(String key, String label, String color) {
        return Map.of("key", key, "label", label, "color", color);
    }

    private Map<String, Object> column(String key, String label) {
        return Map.of("key", key, "label", label);
    }

    private Map<String, Object> alert(String id, String severity, String message, String source) {
        return Map.of("id", id, "severity", severity, "message", message, "source", source);
    }

    private Map<String, Object> capability(String id, String label, String reason) {
        return Map.of("id", id, "label", label, "reason", reason);
    }

    private MetricSpec spec(String id, String label, String column, String unit, String tone, String definition) {
        return new MetricSpec(id, label, column, unit, tone, definition);
    }

    private int number(Object value) {
        return value instanceof Number n ? n.intValue() : 0;
    }

    private Object normalizeNumber(Object value) {
        if (value instanceof BigDecimal decimal) return decimal.setScale(Math.min(Math.max(decimal.scale(), 0), 2), RoundingMode.HALF_UP);
        return value;
    }

    private record Scope(String level, UUID hospitalId, String hospitalName) {}
    private record MetricSpec(String id, String label, String column, String unit, String tone, String definition) {}

    private static final class Payload {
        private final String key;
        private final String title;
        private final String subtitle;
        private final List<Map<String, Object>> metrics = new ArrayList<>();
        private final List<Map<String, Object>> charts = new ArrayList<>();
        private final List<Map<String, Object>> worklists = new ArrayList<>();
        private final List<Map<String, Object>> alerts = new ArrayList<>();
        private final List<Map<String, Object>> unavailableCapabilities = new ArrayList<>();

        private Payload(String key, String title, String subtitle) {
            this.key = Objects.requireNonNull(key);
            this.title = Objects.requireNonNull(title);
            this.subtitle = Objects.requireNonNull(subtitle);
        }
    }
}
