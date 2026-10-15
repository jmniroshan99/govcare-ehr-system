package lk.gov.health.govcare.laboratory;

import com.fasterxml.jackson.databind.ObjectMapper;
import lk.gov.health.govcare.audit.AuditService;
import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

@Service
public class BloodReportService {
    private static final Map<String, String> ABSOLUTE_SOURCE = Map.of(
            "ABS_NEUT", "NEUT_PCT",
            "ABS_LYMPH", "LYMPH_PCT",
            "ABS_EOS", "EOS_PCT",
            "ABS_MONO", "MONO_PCT",
            "ABS_BASO", "BASO_PCT"
    );

    private final SqlSupport sql;
    private final AuditService audit;
    private final ObjectMapper json;

    public BloodReportService(SqlSupport sql, AuditService audit, ObjectMapper json) {
        this.sql = sql;
        this.audit = audit;
        this.json = json;
    }

    public List<Map<String, Object>> list(GovCarePrincipal actor, String search, String status, String patientUuid, String from, String to) {
        StringBuilder q = new StringBuilder("""
                select br.id::text,br.report_number,br.patient_id::text,p.patient_no,p.full_name patient_name,
                       p.nic,p.phone,govcare_patient_age_years(p.date_of_birth) age_years,p.gender::text,
                       br.lab_request_id::text,coalesce(lr.test_type,'Complete Blood Count (CBC)') test_type,
                       br.specimen_type,br.sample_number,br.collected_at,br.reported_at,br.status,
                       creator.full_name technician_name,verifier.full_name verified_by_name,br.verified_at,
                       releaser.full_name released_by_name,br.released_at,br.created_at,br.updated_at
                from lab_blood_reports br
                join patients p on p.id=br.patient_id
                left join lab_requests lr on lr.id=br.lab_request_id
                left join app_users creator on creator.id=br.created_by
                left join app_users verifier on verifier.id=br.verified_by
                left join app_users releaser on releaser.id=br.released_by
                where br.hospital_id=:hospital
                """);
        Map<String, Object> p = map("hospital", actor.hospitalId());
        if (isPatientLike(actor)) {
            if (actor.patientId() == null) return List.of();
            q.append(" and br.patient_id=:ownPatient and br.status='RELEASED'");
            p.put("ownPatient", actor.patientId());
        } else if (Set.of("doctor", "nurse", "surgeon", "anesthetist").contains(actor.role())) {
            q.append(" and br.status='RELEASED'");
        }
        String patient = clean(patientUuid);
        if (patient != null && !isPatientLike(actor)) {
            q.append(" and br.patient_id=cast(:patient as uuid)");
            p.put("patient", patient);
        }
        String st = clean(status);
        if (st != null) {
            q.append(" and br.status=:status");
            p.put("status", st.toUpperCase(Locale.ROOT));
        }
        String term = clean(search);
        if (term != null) {
            q.append(" and (lower(br.report_number) like :search or lower(p.patient_no) like :search or lower(p.full_name) like :search or lower(coalesce(p.nic,'')) like :search or lower(coalesce(p.phone,'')) like :search)");
            p.put("search", "%" + term.toLowerCase(Locale.ROOT) + "%");
        }
        String f = clean(from);
        if (f != null) { q.append(" and br.created_at >= cast(:from as date)"); p.put("from", f); }
        String t = clean(to);
        if (t != null) { q.append(" and br.created_at < cast(:to as date) + interval '1 day'"); p.put("to", t); }
        q.append(" order by br.created_at desc limit 500");
        return sql.list(q.toString(), p);
    }

    public Map<String, Object> get(GovCarePrincipal actor, String id) {
        Map<String, Object> report = sql.required("""
                select br.id::text,br.hospital_id::text,br.report_number,br.patient_id::text,p.patient_no,p.full_name patient_name,
                       p.nic,p.phone,p.email,p.date_of_birth,govcare_patient_age_years(p.date_of_birth) age_years,p.gender::text,
                       br.lab_request_id::text,lr.test_type,lr.test_code,lr.clinical_reason,requester.full_name referred_by,
                       br.specimen_type,br.sample_number,br.collected_at,collector.full_name collected_by_name,br.received_at,
                       br.reported_at,br.status,br.interpretation,creator.full_name prepared_by_name,
                       verifier.full_name verified_by_name,br.verified_at,releaser.full_name released_by_name,br.released_at,
                       ward.name ward_name,ward.code ward_code,bed.bed_code,adm.admission_no,
                       br.created_at,br.updated_at
                from lab_blood_reports br
                join patients p on p.id=br.patient_id
                left join lab_requests lr on lr.id=br.lab_request_id
                left join app_users requester on requester.id=lr.requested_by
                left join app_users collector on collector.id=br.collected_by
                left join app_users creator on creator.id=br.created_by
                left join app_users verifier on verifier.id=br.verified_by
                left join app_users releaser on releaser.id=br.released_by
                left join lateral (
                  select a.* from admissions a where a.patient_id=br.patient_id and a.hospital_id=br.hospital_id
                  and a.status='active' order by a.admitted_at desc limit 1
                ) adm on true
                left join wards ward on ward.id=adm.ward_id
                left join beds bed on bed.id=adm.bed_id
                where br.id=cast(:id as uuid) and br.hospital_id=:hospital
                """, map("id", id, "hospital", actor.hospitalId()), "Blood report not found.");
        requireReportAccess(actor, report);
        if (Set.of("doctor", "nurse", "surgeon", "anesthetist").contains(actor.role()) && !"RELEASED".equals(String.valueOf(report.get("status")))) {
            throw ApiException.forbidden("Clinical users can only view released CBC reports.");
        }
        report.put("results", sql.list("""
                select id::text,test_code,test_name,category,result_value,min_reference,max_reference,critical_min,critical_max,
                       unit,abnormal_flag,manually_overridden,display_order
                from lab_blood_report_results where blood_report_id=cast(:id as uuid) order by display_order,test_name
                """, Map.of("id", id)));
        return report;
    }

    public List<Map<String, Object>> referenceRanges(GovCarePrincipal actor, String patientUuid) {
        Map<String, Object> patient = null;
        String patientId = clean(patientUuid);
        if (patientId != null) {
            patient = sql.required("""
                    select id::text,gender::text,govcare_patient_age_years(date_of_birth) age_years
                    from patients where id=cast(:id as uuid) and hospital_id=:hospital and status<>'deleted'
                    """, map("id", patientId, "hospital", actor.hospitalId()), "Patient not found.");
            if (isPatientLike(actor) && (actor.patientId() == null || !Objects.equals(actor.patientId().toString(), patientId))) {
                throw ApiException.forbidden("Patients can only view their own laboratory reference ranges.");
            }
        }
        String gender = patient == null ? null : clean(patient.get("gender"));
        Integer age = patient == null || patient.get("age_years") == null ? null : Integer.valueOf(String.valueOf(patient.get("age_years")));
        return resolveRanges(actor.hospitalId(), gender, age);
    }

    @Transactional
    public Map<String, Object> create(GovCarePrincipal actor, Map<String, Object> input) {
        String patientId = req(input, "patientUuid");
        Map<String, Object> patient = sql.required("""
                select id::text,gender::text,govcare_patient_age_years(date_of_birth) age_years
                from patients where id=cast(:id as uuid) and hospital_id=:hospital and status<>'deleted'
                """, map("id", patientId, "hospital", actor.hospitalId()), "Patient not found.");
        String labRequestId = clean(input.get("labRequestUuid"));
        if (labRequestId != null) validateLabRequest(actor, patientId, labRequestId);

        String reportNumber = String.valueOf(sql.required("""
                select 'CBC-' || to_char(current_date,'YYYYMMDD') || '-' || lpad(nextval('cbc_report_number_seq')::text,6,'0') report_number
                """, Map.of(), "Unable to generate CBC report number.").get("report_number"));
        String sample = clean(input.get("sampleNumber"));
        if (sample == null) sample = "S-" + reportNumber.substring(4);
        Map<String, Object> params = map(
                "hospital", actor.hospitalId(), "report", reportNumber, "patient", patientId, "lab", labRequestId,
                "specimen", Objects.toString(input.getOrDefault("specimenType", "EDTA Whole Blood"), "EDTA Whole Blood"),
                "sample", sample, "collectedAt", clean(input.get("collectedAt")), "receivedAt", clean(input.get("receivedAt")),
                "user", actor.id(), "interpretation", clean(input.get("interpretation"))
        );
        Map<String, Object> row = sql.required("""
                insert into lab_blood_reports(hospital_id,report_number,patient_id,lab_request_id,specimen_type,sample_number,
                  collected_at,collected_by,received_at,status,interpretation,created_by,updated_by)
                values(:hospital,:report,cast(:patient as uuid),cast(:lab as uuid),:specimen,:sample,
                  cast(:collectedAt as timestamptz),case when cast(:collectedAt as timestamptz) is null then null else :user end,cast(:receivedAt as timestamptz),
                  'DRAFT',:interpretation,:user,:user) returning id::text
                """, params, "Unable to create blood report.");
        String id = String.valueOf(row.get("id"));
        saveResults(actor, id, patient, input.get("results"));
        Map<String, Object> created = get(actor, id);
        audit.record(actor, "laboratory", "cbc_report_created", "lab_blood_reports", UUID.fromString(id), null, created);
        return created;
    }

    @Transactional
    public Map<String, Object> update(GovCarePrincipal actor, String id, Map<String, Object> input) {
        Map<String, Object> before = get(actor, id);
        String status = String.valueOf(before.get("status"));
        if (!Set.of("DRAFT", "COMPLETED").contains(status)) throw ApiException.conflict("Verified or released reports cannot be edited.");
        Map<String, Object> patient = map("id", before.get("patient_id"), "gender", before.get("gender"), "age_years", before.get("age_years"));
        String labRequestId = input.containsKey("labRequestUuid") ? clean(input.get("labRequestUuid")) : clean(before.get("lab_request_id"));
        if (labRequestId != null) validateLabRequest(actor, String.valueOf(before.get("patient_id")), labRequestId);
        Map<String, Object> params = map(
                "id", id, "hospital", actor.hospitalId(), "lab", labRequestId,
                "specimen", input.containsKey("specimenType") ? clean(input.get("specimenType")) : before.get("specimen_type"),
                "sample", input.containsKey("sampleNumber") ? clean(input.get("sampleNumber")) : before.get("sample_number"),
                "collectedAt", input.containsKey("collectedAt") ? clean(input.get("collectedAt")) : before.get("collected_at"),
                "receivedAt", input.containsKey("receivedAt") ? clean(input.get("receivedAt")) : before.get("received_at"),
                "interpretation", input.containsKey("interpretation") ? clean(input.get("interpretation")) : before.get("interpretation"),
                "user", actor.id()
        );
        sql.update("""
                update lab_blood_reports set lab_request_id=cast(:lab as uuid),specimen_type=coalesce(:specimen,'EDTA Whole Blood'),
                  sample_number=:sample,collected_at=cast(:collectedAt as timestamptz),
                  collected_by=case when cast(:collectedAt as timestamptz) is null then null else coalesce(collected_by,:user) end,
                  received_at=cast(:receivedAt as timestamptz),interpretation=:interpretation,updated_by=:user,updated_at=now()
                where id=cast(:id as uuid) and hospital_id=:hospital
                """, params);
        if (input.containsKey("results")) saveResults(actor, id, patient, input.get("results"));
        if ("COMPLETED".equals(status)) syncGenericLabResult(actor, id, "result_entered");
        Map<String, Object> after = get(actor, id);
        audit.record(actor, "laboratory", "cbc_report_updated", "lab_blood_reports", UUID.fromString(id), before, after);
        return after;
    }

    @Transactional
    public Map<String, Object> complete(GovCarePrincipal actor, String id) {
        Map<String, Object> before = get(actor, id);
        if (!Set.of("DRAFT", "COMPLETED").contains(String.valueOf(before.get("status")))) throw ApiException.conflict("Only draft reports can be completed.");
        @SuppressWarnings("unchecked") List<Map<String, Object>> results = (List<Map<String, Object>>) before.get("results");
        if (results == null || results.stream().noneMatch(r -> r.get("result_value") != null)) throw ApiException.badRequest("Enter at least one CBC result before completing the report.");
        sql.update("update lab_blood_reports set status='COMPLETED',reported_at=coalesce(reported_at,now()),updated_by=:user,updated_at=now() where id=cast(:id as uuid) and hospital_id=:hospital",
                map("id", id, "hospital", actor.hospitalId(), "user", actor.id()));
        syncGenericLabResult(actor, id, "result_entered");
        Map<String, Object> after = get(actor, id);
        audit.record(actor, "laboratory", "cbc_report_completed", "lab_blood_reports", UUID.fromString(id), before, after);
        return after;
    }

    @Transactional
    public Map<String, Object> verify(GovCarePrincipal actor, String id) {
        Map<String, Object> before = get(actor, id);
        if (!"COMPLETED".equals(String.valueOf(before.get("status")))) throw ApiException.conflict("Only completed reports can be verified.");
        sql.update("update lab_blood_reports set status='VERIFIED',verified_by=:user,verified_at=now(),updated_by=:user,updated_at=now() where id=cast(:id as uuid) and hospital_id=:hospital",
                map("id", id, "hospital", actor.hospitalId(), "user", actor.id()));
        syncGenericLabResult(actor, id, "verified");
        Map<String, Object> after = get(actor, id);
        audit.record(actor, "laboratory", "cbc_report_verified", "lab_blood_reports", UUID.fromString(id), before, after);
        return after;
    }

    @Transactional
    public Map<String, Object> release(GovCarePrincipal actor, String id) {
        Map<String, Object> before = get(actor, id);
        if (!"VERIFIED".equals(String.valueOf(before.get("status")))) throw ApiException.conflict("Only verified reports can be released.");
        sql.update("update lab_blood_reports set status='RELEASED',released_by=:user,released_at=now(),updated_by=:user,updated_at=now() where id=cast(:id as uuid) and hospital_id=:hospital",
                map("id", id, "hospital", actor.hospitalId(), "user", actor.id()));
        syncGenericLabResult(actor, id, "released");
        Map<String, Object> after = get(actor, id);
        audit.record(actor, "laboratory", "cbc_report_released", "lab_blood_reports", UUID.fromString(id), before, after);
        return after;
    }

    private void saveResults(GovCarePrincipal actor, String reportId, Map<String, Object> patient, Object resultsObject) {
        List<Map<String, Object>> ranges = resolveRanges(actor.hospitalId(), clean(patient.get("gender")), integer(patient.get("age_years")));
        Map<String, InputResult> incoming = parseResults(resultsObject);
        BigDecimal wbc = value(incoming.get("WBC"));

        for (Map<String, Object> range : ranges) {
            String code = String.valueOf(range.get("test_code"));
            InputResult input = incoming.get(code);
            BigDecimal resultValue = input == null ? null : input.value();
            boolean manual = input != null && input.manuallyOverridden();
            if (ABSOLUTE_SOURCE.containsKey(code) && !manual && wbc != null) {
                BigDecimal pct = value(incoming.get(ABSOLUTE_SOURCE.get(code)));
                resultValue = pct == null ? null : wbc.multiply(pct).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            }
            String flag = flag(resultValue, decimal(range.get("min_value")), decimal(range.get("max_value")), decimal(range.get("critical_min")), decimal(range.get("critical_max")));
            Map<String, Object> p = map(
                    "report", reportId, "code", code, "name", range.get("test_name"), "category", range.get("category"),
                    "value", resultValue, "min", range.get("min_value"), "max", range.get("max_value"),
                    "criticalMin", range.get("critical_min"), "criticalMax", range.get("critical_max"), "unit", range.get("unit"),
                    "flag", flag, "manual", manual, "order", range.get("display_order")
            );
            sql.update("""
                    insert into lab_blood_report_results(blood_report_id,test_code,test_name,category,result_value,min_reference,max_reference,
                      critical_min,critical_max,unit,abnormal_flag,manually_overridden,display_order)
                    values(cast(:report as uuid),:code,:name,:category,:value,:min,:max,:criticalMin,:criticalMax,:unit,:flag,:manual,:order)
                    on conflict(blood_report_id,test_code) do update set result_value=excluded.result_value,min_reference=excluded.min_reference,
                      max_reference=excluded.max_reference,critical_min=excluded.critical_min,critical_max=excluded.critical_max,unit=excluded.unit,
                      abnormal_flag=excluded.abnormal_flag,manually_overridden=excluded.manually_overridden,display_order=excluded.display_order,updated_at=now()
                    """, p);
        }
    }

    private void syncGenericLabResult(GovCarePrincipal actor, String reportId, String workflowStatus) {
        Map<String, Object> report = get(actor, reportId);
        String requestId = clean(report.get("lab_request_id"));
        if (requestId == null) return;
        @SuppressWarnings("unchecked") List<Map<String, Object>> results = (List<Map<String, Object>>) report.get("results");
        boolean critical = results.stream().anyMatch(r -> "C".equals(r.get("abnormal_flag")));
        boolean abnormal = critical || results.stream().anyMatch(r -> Set.of("L", "H").contains(String.valueOf(r.get("abnormal_flag"))));
        String classification = critical ? "critical" : abnormal ? "abnormal" : "normal";
        Map<String, Object> resultData = new LinkedHashMap<>();
        resultData.put("type", "CBC"); resultData.put("bloodReportId", reportId); resultData.put("reportNumber", report.get("report_number")); resultData.put("results", results);
        String data;
        try { data = json.writeValueAsString(resultData); } catch (Exception e) { throw new IllegalStateException("Unable to serialize CBC result data.", e); }
        Map<String, Object> p = map("hospital", actor.hospitalId(), "order", requestId, "patient", report.get("patient_id"), "user", actor.id(),
                "data", data, "classification", classification, "text", "Structured CBC report " + report.get("report_number"), "reportUrl", "/api/laboratory/blood-reports/" + reportId + "/pdf");
        Map<String, Object> existing = sql.one("select id::text from lab_results where lab_request_id=cast(:order as uuid) order by created_at desc limit 1", Map.of("order", requestId)).orElse(null);
        if (existing == null) {
            sql.update("""
                    insert into lab_results(hospital_id,lab_request_id,patient_id,entered_by,result_data,text_result,reference_range,classification,
                      abnormal_flag,critical_flag,report_url,release_status,status,created_by,updated_by)
                    values(:hospital,cast(:order as uuid),cast(:patient as uuid),:user,cast(:data as jsonb),:text,'See structured CBC report',:classification,
                      :classification<>'normal',:classification='critical',:reportUrl,case when :workflow='released' then 'released'::release_status else 'internal'::release_status end,
                      case when :workflow in ('verified','released') then 'completed'::record_status else 'pending'::record_status end,:user,:user)
                    """, with(p, "workflow", workflowStatus));
        } else {
            p.put("result", existing.get("id")); p.put("workflow", workflowStatus);
            sql.update("""
                    update lab_results set entered_by=:user,result_data=cast(:data as jsonb),numeric_result=null,text_result=:text,unit=null,reference_range='See structured CBC report',
                      classification=:classification,abnormal_flag=:classification<>'normal',critical_flag=:classification='critical',report_url=:reportUrl,
                      verified_by=case when :workflow in ('verified','released') then :user else verified_by end,
                      verified_at=case when :workflow in ('verified','released') then coalesce(verified_at,now()) else verified_at end,
                      release_status=case when :workflow='released' then 'released'::release_status else release_status end,
                      released_at=case when :workflow='released' then now() else released_at end,
                      status=case when :workflow in ('verified','released') then 'completed'::record_status else status end,updated_by=:user,updated_at=now()
                    where id=cast(:result as uuid)
                    """, p);
        }
        sql.update("""
                update lab_requests set workflow_status=:workflow,test_status=:workflow,
                  result_entered_at=case when :workflow='result_entered' then coalesce(result_entered_at,now()) else result_entered_at end,
                  verified_by=case when :workflow in ('verified','released') then :user else verified_by end,
                  verified_at=case when :workflow in ('verified','released') then coalesce(verified_at,now()) else verified_at end,
                  released_at=case when :workflow='released' then now() else released_at end,updated_by=:user,updated_at=now()
                where id=cast(:order as uuid) and hospital_id=:hospital
                """, with(p, "workflow", workflowStatus));
    }

    private List<Map<String, Object>> resolveRanges(UUID hospitalId, String gender, Integer age) {
        String resolvedGender = gender == null ? "" : gender;
        int resolvedAge = age == null ? -1 : age;
        Map<String, Object> p = map("hospital", hospitalId, "gender", resolvedGender, "age", resolvedAge);
        return sql.list("""
                select distinct on (test_code) id::text,test_code,test_name,category,min_value,max_value,critical_min,critical_max,unit,
                       gender,age_min,age_max,display_order
                from lab_test_reference_ranges
                where active=true and (hospital_id is null or hospital_id=:hospital)
                  and ((:gender='' and gender is null) or (:gender<>'' and (gender is null or lower(gender)=lower(:gender))))
                  and ((:age<0 and age_min is null and age_max is null) or (:age>=0 and (age_min is null or age_min<=:age) and (age_max is null or age_max>=:age)))
                order by test_code,(hospital_id is not null) desc,(gender is not null) desc,(age_min is not null or age_max is not null) desc,display_order
                """, p).stream().sorted(Comparator.comparingInt(r -> integer(r.get("display_order")) == null ? 0 : integer(r.get("display_order")))).toList();
    }

    private void validateLabRequest(GovCarePrincipal actor, String patientId, String requestId) {
        sql.required("""
                select id from lab_requests where id=cast(:id as uuid) and hospital_id=:hospital and patient_id=cast(:patient as uuid)
                  and status<>'deleted'
                  and (lower(coalesce(test_code,'')) in ('cbc','fbc') or lower(test_type) like '%complete blood%'
                       or lower(test_type) like '%full blood%' or lower(test_type) like '%cbc%' or lower(test_type) like '%fbc%')
                """, map("id", requestId, "hospital", actor.hospitalId(), "patient", patientId), "Laboratory request not found for this patient.");
    }

    private void requireReportAccess(GovCarePrincipal actor, Map<String, Object> report) {
        if (!isPatientLike(actor)) return;
        if (actor.patientId() == null || !Objects.equals(actor.patientId().toString(), String.valueOf(report.get("patient_id")))) {
            throw ApiException.forbidden("Patients can only view their own blood reports.");
        }
        if (!"RELEASED".equals(String.valueOf(report.get("status")))) throw ApiException.forbidden("This blood report has not been released to the patient.");
    }

    private static boolean isPatientLike(GovCarePrincipal actor) { return Set.of("patient", "guardian").contains(actor.role()); }

    private static Map<String, InputResult> parseResults(Object raw) {
        Map<String, InputResult> out = new HashMap<>();
        if (!(raw instanceof List<?> list)) return out;
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> m)) continue;
            String code = clean(m.get("testCode"));
            if (code == null) continue;
            BigDecimal v = decimal(m.get("value"));
            Object manualValue = m.containsKey("manuallyOverridden") ? m.get("manuallyOverridden") : Boolean.FALSE;
            boolean manual = Boolean.parseBoolean(String.valueOf(manualValue));
            out.put(code, new InputResult(v, manual));
        }
        return out;
    }

    private static String flag(BigDecimal v, BigDecimal min, BigDecimal max, BigDecimal criticalMin, BigDecimal criticalMax) {
        if (v == null) return null;
        if ((criticalMin != null && v.compareTo(criticalMin) < 0) || (criticalMax != null && v.compareTo(criticalMax) > 0)) return "C";
        if (min != null && v.compareTo(min) < 0) return "L";
        if (max != null && v.compareTo(max) > 0) return "H";
        return "N";
    }

    private static BigDecimal value(InputResult r) { return r == null ? null : r.value(); }
    private static BigDecimal decimal(Object value) {
        if (value == null || String.valueOf(value).isBlank()) return null;
        try { return new BigDecimal(String.valueOf(value)); } catch (NumberFormatException e) { throw ApiException.badRequest("CBC result values must be numeric."); }
    }
    private static Integer integer(Object value) {
        if (value == null || String.valueOf(value).isBlank()) return null;
        try { return Integer.valueOf(String.valueOf(value)); } catch (NumberFormatException e) { return null; }
    }
    private static String clean(Object value) { if (value == null) return null; String s = String.valueOf(value).trim(); return s.isBlank() ? null : s; }
    private static String req(Map<String, Object> input, String key) { String s = clean(input.get(key)); if (s == null) throw ApiException.badRequest(key + " is required."); return s; }
    private static Map<String, Object> map(Object... values) { Map<String, Object> out = new HashMap<>(); for (int i = 0; i < values.length; i += 2) out.put(String.valueOf(values[i]), values[i + 1]); return out; }
    private static Map<String, Object> with(Map<String, Object> source, String key, Object value) { Map<String, Object> out = new HashMap<>(source); out.put(key, value); return out; }
    private record InputResult(BigDecimal value, boolean manuallyOverridden) {}
}
