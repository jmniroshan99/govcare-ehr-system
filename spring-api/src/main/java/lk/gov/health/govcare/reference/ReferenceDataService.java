package lk.gov.health.govcare.reference;

import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.common.SriLankaLocationPolicy;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Collator;
import java.util.*;

@Service
public class ReferenceDataService {
    private final SqlSupport sql;

    public ReferenceDataService(SqlSupport sql) { this.sql = sql; }

    public List<Map<String,Object>> values(List<String> values) {
        return values.stream().map(value -> Map.<String,Object>of("value", value, "label", value)).toList();
    }

    public List<Map<String,Object>> provinces() { return values(SriLankaLocationPolicy.provinces()); }

    public List<Map<String,Object>> districts(String province) {
        List<String> districts = province == null || province.isBlank()
                ? SriLankaLocationPolicy.districts()
                : SriLankaLocationPolicy.districtsForProvince(province);
        return districts.stream().map(district -> Map.<String,Object>of(
                "value", district,
                "label", district,
                "province", SriLankaLocationPolicy.provinceForDistrict(district)
        )).toList();
    }

    public List<Map<String,Object>> countries(String query, int limit) {
        String term = clean(query).toLowerCase(Locale.ROOT);
        Collator collator = Collator.getInstance(Locale.ENGLISH);
        return Arrays.stream(Locale.getISOCountries())
                .map(code -> new Locale.Builder().setRegion(code).build())
                .map(locale -> Map.<String,Object>of("value", locale.getDisplayCountry(Locale.ENGLISH), "label", locale.getDisplayCountry(Locale.ENGLISH), "code", locale.getCountry()))
                .filter(item -> term.isBlank() || String.valueOf(item.get("label")).toLowerCase(Locale.ROOT).contains(term) || String.valueOf(item.get("code")).toLowerCase(Locale.ROOT).contains(term))
                .sorted((left,right) -> collator.compare(String.valueOf(left.get("label")), String.valueOf(right.get("label"))))
                .limit(clamp(limit, 1, 250))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String,Object>> hospitals(GovCarePrincipal actor, String query, int limit) {
        Map<String,Object> params = map("q", like(query), "limit", clamp(limit,1,50), "hospitalId", actor.hospitalId());
        String scope = "super_admin".equals(actor.role()) ? "" : " and h.id=:hospitalId ";
        return sql.list("""
          select h.id::text,h.code,h.name,h.type as description,h.city,h.district,h.province,h.status::text
          from hospitals h
          where h.status='active' %s
            and (h.name ilike :q or h.code ilike :q or coalesce(h.city,'') ilike :q or coalesce(h.district,'') ilike :q)
          order by h.name limit :limit
          """.formatted(scope), params);
    }

    @Transactional(readOnly = true)
    public List<Map<String,Object>> departments(GovCarePrincipal actor, UUID hospitalId) {
        UUID scopedHospital = hospital(actor, hospitalId);
        return sql.list("""
          select d.id::text,d.code,d.name,d.type as description,d.status::text
          from departments d where d.hospital_id=:hospitalId and d.status='active'
          order by d.name
          """, map("hospitalId", scopedHospital));
    }

    @Transactional(readOnly = true)
    public List<Map<String,Object>> wards(GovCarePrincipal actor, UUID departmentId) {
        Map<String,Object> department = sql.required("""
          select id::text,hospital_id::text from departments where id=:departmentId and status='active'
          """, map("departmentId", departmentId), "Department not found or inactive.");
        UUID departmentHospitalId = UUID.fromString(String.valueOf(department.get("hospital_id")));
        if (!"super_admin".equals(actor.role()) && !departmentHospitalId.equals(actor.hospitalId())) {
            throw ApiException.forbidden("The selected department does not belong to your hospital.");
        }
        return sql.list("""
          select w.id::text,coalesce(w.ward_code,w.ward_no,w.name) as code,w.name,
            concat_ws(' · ',w.ward_type,w.category,w.floor,replace(w.operational_status,'_',' ')) as description,
            case when w.status='active' and w.operational_status='ACTIVE'
                   and count(b.id) filter (where upper(coalesce(b.status,''))='AVAILABLE') > 0
                 then 'active' else 'inactive' end as status,
            count(b.id) filter (where upper(coalesce(b.status,''))='AVAILABLE')::int as available_beds
          from wards w
          left join beds b on b.ward_id=w.id
          where w.department_id=:departmentId and w.hospital_id=:hospitalId and w.status<>'deleted'
          group by w.id,w.ward_code,w.ward_no,w.name,w.ward_type,w.category,w.floor,w.status,w.operational_status
          order by w.name
          """, map("departmentId", departmentId, "hospitalId", departmentHospitalId));
    }

    @Transactional(readOnly = true)
    public List<Map<String,Object>> patients(GovCarePrincipal actor, String query, int limit) {
        String term = clean(query);
        if (term.length() < 2) return List.of();
        UUID scopedHospital = hospital(actor, null);
        return sql.list("""
          select p.id::text,p.patient_no as code,p.full_name as name,
            concat_ws(' · ',p.patient_no,p.nic,p.phone,govcare_patient_age_years(p.date_of_birth)||' years') as description,
            p.status::text
          from patients p
          where p.hospital_id=:hospitalId and p.status='active'
            and (p.full_name ilike :q or p.patient_no ilike :q or coalesce(p.nic,'') ilike :q or coalesce(p.passport_no,'') ilike :q or coalesce(p.phone,'') ilike :q)
          order by p.updated_at desc limit :limit
          """, map("hospitalId", scopedHospital, "q", like(term), "limit", clamp(limit,1,50)));
    }

    @Transactional(readOnly = true)
    public List<Map<String,Object>> admissions(GovCarePrincipal actor, String query, int limit) {
        String term = clean(query);
        if (term.length() < 2) return List.of();
        UUID scopedHospital = hospital(actor, null);
        return sql.list("""
          select a.id::text,a.admission_no as code,p.full_name as name,
            concat_ws(' · ',a.admission_no,p.patient_no,w.name,coalesce(b.bed_code,b.bed_no),to_char(a.admitted_at,'YYYY-MM-DD HH24:MI')) as description,
            a.status::text
          from admissions a
          join patients p on p.id=a.patient_id
          left join wards w on w.id=a.ward_id
          left join beds b on b.id=a.bed_id
          where a.hospital_id=:hospitalId and a.status='active' and a.discharged_at is null
            and (a.admission_no ilike :q or p.full_name ilike :q or p.patient_no ilike :q or coalesce(p.nic,'') ilike :q or coalesce(w.name,'') ilike :q or coalesce(b.bed_code,b.bed_no,'') ilike :q)
          order by a.admitted_at desc limit :limit
          """, map("hospitalId", scopedHospital, "q", like(term), "limit", clamp(limit,1,50)));
    }

    @Transactional(readOnly = true)
    public List<Map<String,Object>> staff(GovCarePrincipal actor, String query, UUID hospitalId, UUID departmentId, String role, String permission, int limit) {
        UUID scopedHospital = hospital(actor, hospitalId);
        StringBuilder filters = new StringBuilder();
        Map<String,Object> params = map("hospitalId", scopedHospital, "q", like(query), "limit", clamp(limit,1,50));
        if (departmentId != null) {
            if (sql.one("select id from departments where id=:departmentId and hospital_id=:hospitalId and status='active'", map("departmentId", departmentId, "hospitalId", scopedHospital)).isEmpty()) {
                throw ApiException.unprocessable("The selected department does not belong to the selected hospital or is inactive.");
            }
            filters.append(" and u.department_id=:departmentId"); params.put("departmentId", departmentId);
        }
        if (!clean(role).isBlank()) { filters.append(" and u.role::text=:role"); params.put("role", clean(role).toLowerCase(Locale.ROOT)); }
        if (!clean(permission).isBlank()) { filters.append(" and exists(select 1 from roles r join role_permissions rp on rp.role_id=r.id join permissions p on p.id=rp.permission_id where r.code=u.role::text and p.code=:permission)"); params.put("permission", clean(permission).toUpperCase(Locale.ROOT)); }
        return sql.list("""
          select u.id::text,coalesce(u.employee_no,u.auth_uid) as code,u.full_name as name,
            concat_ws(' · ',initcap(replace(u.role::text,'_',' ')),d.name,h.name) as description,
            u.role::text as role,d.id::text as department_id,d.name as department_name,h.id::text as hospital_id,h.name as hospital_name,u.status::text
          from app_users u
          left join departments d on d.id=u.department_id
          left join hospitals h on h.id=u.hospital_id
          where u.hospital_id=:hospitalId and u.status='active'
            and (u.full_name ilike :q or u.email ilike :q or coalesce(u.employee_no,'') ilike :q or u.role::text ilike :q or coalesce(d.name,'') ilike :q)
            %s
          order by u.full_name limit :limit
          """.formatted(filters), params);
    }

    @Transactional(readOnly = true)
    public List<Map<String,Object>> medicines(GovCarePrincipal actor, String query, int limit) {
        UUID scopedHospital = hospital(actor, null);
        return sql.list("""
          select m.id::text,coalesce(m.name,m.generic_name) as name,m.name as label,m.generic_name,m.category,m.dosage_form,m.strength,m.status::text,
            coalesce(sum(ps.quantity) filter (where ps.status='active' and (ps.expiry_date is null or ps.expiry_date>=current_date)),0)::numeric as stock,
            concat_ws(' · ',m.generic_name,m.strength,m.dosage_form,m.category) as description
          from medicines m left join pharmacy_stock ps on ps.medicine_id=m.id and ps.hospital_id=m.hospital_id
          where m.hospital_id=:hospitalId and m.status='active'
            and (m.name ilike :q or coalesce(m.generic_name,'') ilike :q or coalesce(m.category,'') ilike :q or coalesce(m.strength,'') ilike :q or coalesce(m.dosage_form,'') ilike :q)
          group by m.id,m.name,m.generic_name,m.category,m.dosage_form,m.strength,m.status
          order by coalesce(m.generic_name,m.name),m.strength limit :limit
          """, map("hospitalId", scopedHospital, "q", like(query), "limit", clamp(limit,1,50)));
    }

    @Transactional(readOnly = true)
    public List<Map<String,Object>> diagnoses(String query, int limit) {
        return sql.list("""
          select id::text,code,concat(code,' · ',description) as name,category,status,
            concat_ws(' · ',category,aliases) as description
          from diagnosis_reference where status='active'
            and (code ilike :q or description ilike :q or coalesce(aliases,'') ilike :q)
          order by code limit :limit
          """, map("q", like(query), "limit", clamp(limit,1,50)));
    }

    @Transactional(readOnly = true)
    public List<Map<String,Object>> laboratoryTests(String query, int limit) {
        return sql.list("""
          select id::text,code,name,specimen_type,turnaround_minutes,status,
            concat_ws(' · ',code,specimen_type,turnaround_minutes||' min') as description
          from laboratory_test_catalog where status='active'
            and (code ilike :q or name ilike :q or coalesce(specimen_type,'') ilike :q or coalesce(aliases,'') ilike :q)
          order by name limit :limit
          """, map("q", like(query), "limit", clamp(limit,1,50)));
    }

    @Transactional(readOnly = true)
    public List<Map<String,Object>> radiologyStudies(String query, int limit) {
        return sql.list("""
          select id::text,code,name,modality,body_region,status,
            concat_ws(' · ',code,modality,body_region) as description
          from radiology_study_catalog where status='active'
            and (code ilike :q or name ilike :q or modality ilike :q or coalesce(body_region,'') ilike :q or coalesce(aliases,'') ilike :q)
          order by modality,name limit :limit
          """, map("q", like(query), "limit", clamp(limit,1,50)));
    }


    private UUID hospital(GovCarePrincipal actor, UUID requested) {
        if (!"super_admin".equals(actor.role())) {
            if (actor.hospitalId() == null) throw ApiException.forbidden("The authenticated account is not assigned to a hospital.");
            if (requested != null && !actor.hospitalId().equals(requested)) throw ApiException.forbidden("You cannot select another hospital.");
            return actor.hospitalId();
        }
        UUID selected = requested != null ? requested : actor.hospitalId();
        if (selected == null) {
            Map<String,Object> first = sql.required("select id::text from hospitals where status='active' order by name limit 1", Map.of(), "No active hospital is configured.");
            selected = UUID.fromString(String.valueOf(first.get("id")));
        }
        if (sql.one("select id from hospitals where id=:hospitalId and status='active'", map("hospitalId", selected)).isEmpty()) {
            throw ApiException.notFound("Hospital not found or inactive.");
        }
        return selected;
    }

    private static String clean(String value) { return value == null ? "" : value.trim().replaceAll("\\s+", " "); }
    private static String like(String value) { return "%" + clean(value) + "%"; }
    private static int clamp(int value, int min, int max) { return Math.max(min, Math.min(max, value)); }
    private static Map<String,Object> map(Object... values) { Map<String,Object> out = new HashMap<>(); for (int i=0;i<values.length;i+=2) out.put(String.valueOf(values[i]), values[i+1]); return out; }
}
