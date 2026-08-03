package lk.gov.health.govcare.staff;

import com.fasterxml.jackson.databind.ObjectMapper;
import lk.gov.health.govcare.audit.AuditService;
import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;

import static lk.gov.health.govcare.staff.StaffDtos.*;

@Service
public class StaffManagementService {
    private static final Set<String> STAFF_ROLES = Set.of(
            "hospital_admin", "records_officer", "receptionist", "doctor", "nurse",
            "lab_technician", "pathologist", "radiology_technician", "radiologist", "pharmacist"
    );
    private static final Set<String> EMPLOYMENT_TYPES = Set.of("permanent", "contract", "temporary", "visiting");
    private static final Set<String> WORK_STATUSES = Set.of("active", "on_leave", "suspended", "inactive");

    private final AppUserRepository users;
    private final RoleRepository roles;
    private final PasswordEncoder passwords;
    private final ObjectMapper mapper;
    private final SqlSupport sql;
    private final AuditService audit;
    private final UserSecurityService userSecurity;

    public StaffManagementService(AppUserRepository users, RoleRepository roles, PasswordEncoder passwords,
                                  ObjectMapper mapper, SqlSupport sql, AuditService audit,
                                  UserSecurityService userSecurity) {
        this.users = users;
        this.roles = roles;
        this.passwords = passwords;
        this.mapper = mapper;
        this.sql = sql;
        this.audit = audit;
        this.userSecurity = userSecurity;
    }

    public Map<String, Object> list(GovCarePrincipal actor, String search, UUID hospitalId, UUID departmentId,
                                    String role, String status, int page, int size) {
        requireManager(actor);
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        UUID scopedHospital = scopedHospital(actor, hospitalId);

        StringBuilder where = new StringBuilder(" where u.role::text not in ('patient','guardian') ");
        Map<String, Object> params = new HashMap<>();
        if (scopedHospital != null) {
            where.append(" and u.hospital_id=:hospitalId ");
            params.put("hospitalId", scopedHospital);
        }
        if (departmentId != null) {
            where.append(" and u.department_id=:departmentId ");
            params.put("departmentId", departmentId);
        }
        if (search != null && !search.isBlank()) {
            where.append(" and (u.full_name ilike :search or u.email ilike :search or u.employee_no ilike :search or u.phone ilike :search) ");
            params.put("search", "%" + search.trim() + "%");
        }
        if (role != null && !role.isBlank()) {
            where.append(" and u.role::text=:role ");
            params.put("role", normalizeRole(role));
        }
        if (status != null && !status.isBlank()) {
            String normalizedStatus = status.trim().toLowerCase(Locale.ROOT);
            if (normalizedStatus.equals("active")) where.append(" and u.status='active' ");
            else if (normalizedStatus.equals("inactive")) where.append(" and u.status<>'active' ");
            else {
                where.append(" and u.work_status=:workStatus ");
                params.put("workStatus", normalizeWorkStatus(normalizedStatus));
            }
        }

        String select = """
            select u.id::text,u.employee_no,u.title,u.first_name,u.last_name,u.full_name,u.email,u.phone,
                   u.hospital_id::text,u.department_id::text,u.role::text,u.status::text,u.work_status,
                   u.professional_registration_no,u.job_title,u.employment_type,u.joining_date,
                   u.must_change_password,u.profile_photo_url,u.last_login_at,u.created_at,u.updated_at,
                   h.name hospital_name,d.name department_name
            from app_users u
            left join hospitals h on h.id=u.hospital_id
            left join departments d on d.id=u.department_id
            """;
        Map<String, Object> countParams = new HashMap<>(params);
        long total = ((Number) sql.required("select count(*) total from app_users u " + where, countParams, "Unable to count staff.").get("total")).longValue();
        params.put("limit", safeSize);
        params.put("offset", safePage * safeSize);
        List<Map<String, Object>> items = sql.list(select + where + " order by u.created_at desc limit :limit offset :offset", params)
                .stream().map(this::rowToStaff).toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items);
        result.put("page", safePage);
        result.put("size", safeSize);
        result.put("totalElements", total);
        result.put("totalPages", (long) Math.ceil(total / (double) safeSize));
        result.put("summary", summary(actor, scopedHospital));
        return result;
    }

    public Map<String, Object> options(GovCarePrincipal actor) {
        requireManager(actor);
        List<Map<String, Object>> hospitals;
        if (isSuper(actor)) {
            hospitals = sql.list("select id::text,code,name,city,district from hospitals where status='active' order by name", Map.of());
        } else {
            hospitals = sql.list("select id::text,code,name,city,district from hospitals where id=:id and status='active'", Map.of("id", actor.hospitalId()));
        }
        List<Map<String, Object>> roleOptions = sql.list("""
            select code,name,description,default_route
            from roles
            where code in ('hospital_admin','records_officer','receptionist','doctor','nurse',
                           'lab_technician','pathologist','radiology_technician','radiologist','pharmacist')
            order by name
            """, Map.of());
        if (!isSuper(actor)) roleOptions = roleOptions.stream().filter(r -> !"hospital_admin".equals(String.valueOf(r.get("code")))).toList();
        return Map.of("hospitals", hospitals, "roles", roleOptions);
    }

    public List<Map<String, Object>> departments(GovCarePrincipal actor, UUID hospitalId) {
        requireManager(actor);
        UUID scoped = scopedHospital(actor, hospitalId);
        if (scoped == null) throw ApiException.badRequest("hospitalId is required.");
        return sql.list("select id::text,code,name,type,status::text from departments where hospital_id=:hospitalId and status='active' order by name", Map.of("hospitalId", scoped));
    }

    @Transactional
    public Map<String, Object> create(GovCarePrincipal actor, CreateStaffRequest input) {
        requireManager(actor);
        UUID hospitalId = scopedHospital(actor, input.hospitalId());
        validateHospital(hospitalId);
        validateDepartment(input.departmentId(), hospitalId);
        String roleCode = validateAssignableRole(actor, input.roleCode(), null);
        String email = normalizeEmail(input.email());
        if (users.existsByEmailIgnoreCase(email)) throw ApiException.conflict("A staff account with this email already exists.");
        String employmentType = normalizeEmploymentType(input.employmentType());
        RoleEntity role = roles.findByCode(roleCode).orElseThrow(() -> ApiException.badRequest("Unknown staff role."));

        AppUserEntity user = new AppUserEntity();
        user.setAuthUid("spring-" + UUID.randomUUID());
        user.setEmployeeNo(nextEmployeeNo());
        user.setHospitalId(hospitalId);
        user.setDepartmentId(input.departmentId());
        user.setRole(UserRole.valueOf(roleCode));
        user.setRoleDefinition(role);
        user.setTitle(clean(input.title()));
        user.setFirstName(clean(input.firstName()));
        user.setLastName(clean(input.lastName()));
        user.setFullName(input.fullName().trim());
        user.setNationalId(clean(input.nationalId()));
        user.setDateOfBirth(input.dateOfBirth());
        user.setGender(clean(input.gender()));
        user.setPhone(clean(input.phone()));
        user.setEmail(email);
        user.setAddress(clean(input.address()));
        user.setProfessionalRegistrationNo(clean(input.professionalRegistrationNo()));
        user.setJobTitle(clean(input.jobTitle()));
        user.setEmploymentType(employmentType);
        user.setJoiningDate(input.joiningDate() == null ? LocalDate.now() : input.joiningDate());
        user.setWorkStatus(input.active() ? "active" : "inactive");
        user.setPasswordHash(passwords.encode(input.temporaryPassword()));
        user.setMustChangePassword(input.mustChangePassword());
        user.setCreatedBy(actor.id());
        user.setPermissions(mapper.createArrayNode());
        user.setMfaEnabled(false);
        user.setStatus(input.active() ? UserStatus.active : UserStatus.inactive);
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        users.saveAndFlush(user);

        Map<String, Object> safe = detailMap(user);
        audit.record(actor, "staff", "STAFF_CREATED", "app_users", user.getId(), null, safe);
        Map<String, Object> result = new LinkedHashMap<>(safe);
        result.put("temporaryPassword", input.temporaryPassword());
        result.put("passwordShownOnce", true);
        return result;
    }

    public Map<String, Object> detail(GovCarePrincipal actor, UUID id) {
        requireManager(actor);
        return detailMap(findAccessible(actor, id));
    }

    @Transactional
    public Map<String, Object> update(GovCarePrincipal actor, UUID id, UpdateStaffRequest input) {
        requireManager(actor);
        AppUserEntity user = findAccessible(actor, id);
        protectAdminTarget(actor, user);
        Map<String, Object> before = detailMap(user);
        if (input.title() != null) user.setTitle(clean(input.title()));
        if (input.firstName() != null) user.setFirstName(clean(input.firstName()));
        if (input.lastName() != null) user.setLastName(clean(input.lastName()));
        if (input.fullName() != null) user.setFullName(input.fullName().trim());
        if (input.nationalId() != null) user.setNationalId(clean(input.nationalId()));
        if (input.dateOfBirth() != null) user.setDateOfBirth(input.dateOfBirth());
        if (input.gender() != null) user.setGender(clean(input.gender()));
        if (input.phone() != null) user.setPhone(clean(input.phone()));
        if (input.address() != null) user.setAddress(clean(input.address()));
        if (input.professionalRegistrationNo() != null) user.setProfessionalRegistrationNo(clean(input.professionalRegistrationNo()));
        if (input.jobTitle() != null) user.setJobTitle(clean(input.jobTitle()));
        if (input.employmentType() != null) user.setEmploymentType(normalizeEmploymentType(input.employmentType()));
        if (input.joiningDate() != null) user.setJoiningDate(input.joiningDate());
        if (input.workStatus() != null) user.setWorkStatus(normalizeWorkStatus(input.workStatus()));
        if (input.email() != null) {
            String email = normalizeEmail(input.email());
            if (!email.equalsIgnoreCase(user.getEmail()) && users.existsByEmailIgnoreCase(email)) throw ApiException.conflict("A staff account with this email already exists.");
            user.setEmail(email);
        }
        users.saveAndFlush(user);
        Map<String, Object> after = detailMap(user);
        audit.record(actor, "staff", "STAFF_UPDATED", "app_users", user.getId(), before, after);
        return after;
    }

    @Transactional
    public Map<String, Object> changeRole(GovCarePrincipal actor, UUID id, RoleChangeRequest input) {
        requireManager(actor);
        AppUserEntity user = findAccessible(actor, id);
        protectAdminTarget(actor, user);
        String roleCode = validateAssignableRole(actor, input.roleCode(), user);
        Map<String, Object> before = Map.of("role", user.getRole().name());
        RoleEntity role = roles.findByCode(roleCode).orElseThrow(() -> ApiException.badRequest("Unknown staff role."));
        user.setRole(UserRole.valueOf(roleCode));
        user.setRoleDefinition(role);
        users.saveAndFlush(user);
        Map<String, Object> after = detailMap(user);
        audit.record(actor, "staff", "STAFF_ROLE_CHANGED", "app_users", user.getId(), before, Map.of("role", roleCode));
        return after;
    }

    @Transactional
    public Map<String, Object> changeDepartment(GovCarePrincipal actor, UUID id, DepartmentChangeRequest input) {
        requireManager(actor);
        AppUserEntity user = findAccessible(actor, id);
        protectAdminTarget(actor, user);
        validateDepartment(input.departmentId(), user.getHospitalId());
        UUID before = user.getDepartmentId();
        user.setDepartmentId(input.departmentId());
        users.saveAndFlush(user);
        audit.record(actor, "staff", "STAFF_DEPARTMENT_CHANGED", "app_users", user.getId(), Map.of("departmentId", String.valueOf(before)), Map.of("departmentId", String.valueOf(input.departmentId())));
        return detailMap(user);
    }

    @Transactional
    public Map<String, Object> changeStatus(GovCarePrincipal actor, UUID id, StatusChangeRequest input) {
        requireManager(actor);
        AppUserEntity user = findAccessible(actor, id);
        if (actor.id().equals(user.getId()) && !input.active()) throw ApiException.badRequest("You cannot deactivate your own account.");
        protectAdminTarget(actor, user);
        if (user.getRole() == UserRole.super_admin && !input.active()) {
            long activeSuperAdmins = ((Number) sql.required("select count(*) total from app_users where role='super_admin' and status='active'", Map.of(), "Unable to validate Super Admin accounts.").get("total")).longValue();
            if (activeSuperAdmins <= 1) throw ApiException.badRequest("The final active Super Admin cannot be deactivated.");
        }
        String previous = user.getStatus().name();
        user.setStatus(input.active() ? UserStatus.active : UserStatus.inactive);
        user.setWorkStatus(input.active() ? "active" : "inactive");
        users.saveAndFlush(user);
        audit.record(actor, "staff", input.active() ? "STAFF_ACTIVATED" : "STAFF_DEACTIVATED", "app_users", user.getId(), Map.of("status", previous), Map.of("status", user.getStatus().name()));
        return detailMap(user);
    }

    @Transactional
    public Map<String, Object> transfer(GovCarePrincipal actor, UUID id, TransferRequest input) {
        requireManager(actor);
        if (!isSuper(actor)) throw ApiException.forbidden("Only Super Admin can transfer staff between hospitals.");
        AppUserEntity user = findAccessible(actor, id);
        validateHospital(input.hospitalId());
        validateDepartment(input.departmentId(), input.hospitalId());
        Map<String, Object> before = Map.of("hospitalId", String.valueOf(user.getHospitalId()), "departmentId", String.valueOf(user.getDepartmentId()));
        user.setHospitalId(input.hospitalId());
        user.setDepartmentId(input.departmentId());
        users.saveAndFlush(user);
        audit.record(actor, "staff", "STAFF_HOSPITAL_TRANSFERRED", "app_users", user.getId(), before, Map.of("hospitalId", String.valueOf(input.hospitalId()), "departmentId", String.valueOf(input.departmentId())));
        return detailMap(user);
    }

    @Transactional
    public Map<String, Object> resetPassword(GovCarePrincipal actor, UUID id, ResetPasswordRequest input) {
        requireManager(actor);
        AppUserEntity user = findAccessible(actor, id);
        protectAdminTarget(actor, user);
        user.setPasswordHash(passwords.encode(input.temporaryPassword()));
        user.setMustChangePassword(true);
        users.saveAndFlush(user);
        audit.record(actor, "staff", "STAFF_PASSWORD_RESET", "app_users", user.getId(), null, Map.of("mustChangePassword", true));
        return Map.of("staffId", user.getId().toString(), "temporaryPassword", input.temporaryPassword(), "passwordShownOnce", true);
    }

    public List<Map<String, Object>> audit(GovCarePrincipal actor, UUID id) {
        requireManager(actor);
        AppUserEntity user = findAccessible(actor, id);
        return sql.list("""
            select a.id::text,a.action,a.before_state::text,a.after_state::text,a.ip_address,a.created_at,
                   actor.full_name actor_name
            from audit_logs a left join app_users actor on actor.id=a.actor_id
            where a.entity_type='app_users' and a.entity_id=:id
            order by a.created_at desc limit 100
            """, Map.of("id", user.getId()));
    }

    private Map<String, Object> summary(GovCarePrincipal actor, UUID scopedHospital) {
        String scope = scopedHospital == null ? "" : " and hospital_id=:hospitalId ";
        Map<String, Object> params = scopedHospital == null ? Map.of() : Map.of("hospitalId", scopedHospital);
        Map<String, Object> row = sql.required("""
            select count(*) filter(where role::text not in ('patient','guardian')) total_staff,
                   count(*) filter(where role::text not in ('patient','guardian') and status='active') active_staff,
                   count(*) filter(where role::text not in ('patient','guardian') and status<>'active') inactive_staff,
                   count(*) filter(where role='doctor') doctors,
                   count(*) filter(where role='nurse') nurses,
                   count(*) filter(where role::text in ('lab_technician','lab_manager','pathologist')) laboratory_staff,
                   count(*) filter(where role='pharmacist') pharmacy_staff,
                   count(*) filter(where role::text in ('radiologist','radiology_technician')) radiology_staff
            from app_users where 1=1
            """ + scope, params, "Unable to load staff summary.");
        Map<String, Object> summary = new LinkedHashMap<>();
        row.forEach((k, v) -> summary.put(toCamel(k), v));
        return summary;
    }

    private Map<String, Object> detailMap(AppUserEntity user) {
        GovCarePrincipal principal = userSecurity.principal(user);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", user.getId().toString());
        m.put("employeeNo", user.getEmployeeNo());
        m.put("title", user.getTitle());
        m.put("firstName", user.getFirstName());
        m.put("lastName", user.getLastName());
        m.put("fullName", user.getFullName());
        m.put("email", user.getEmail());
        m.put("phone", user.getPhone());
        m.put("nationalId", user.getNationalId());
        m.put("dateOfBirth", user.getDateOfBirth());
        m.put("gender", user.getGender());
        m.put("address", user.getAddress());
        m.put("hospitalId", string(user.getHospitalId()));
        m.put("departmentId", string(user.getDepartmentId()));
        m.put("role", user.getRole().name());
        m.put("professionalRegistrationNo", user.getProfessionalRegistrationNo());
        m.put("jobTitle", user.getJobTitle());
        m.put("employmentType", user.getEmploymentType());
        m.put("joiningDate", user.getJoiningDate());
        m.put("workStatus", user.getWorkStatus());
        m.put("active", user.getStatus() == UserStatus.active);
        m.put("status", user.getStatus().name());
        m.put("mustChangePassword", user.isMustChangePassword());
        m.put("photoURL", user.getProfilePhotoUrl());
        m.put("lastLoginAt", user.getLastLoginAt());
        m.put("createdAt", user.getCreatedAt());
        m.put("updatedAt", user.getUpdatedAt());
        m.put("permissions", principal.permissions());
        if (user.getHospitalId() != null) sql.one("select name from hospitals where id=:id", Map.of("id", user.getHospitalId())).ifPresent(r -> m.put("hospitalName", r.get("name")));
        if (user.getDepartmentId() != null) sql.one("select name from departments where id=:id", Map.of("id", user.getDepartmentId())).ifPresent(r -> m.put("departmentName", r.get("name")));
        return m;
    }

    private Map<String, Object> rowToStaff(Map<String, Object> r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.get("id"));
        m.put("employeeNo", r.get("employee_no"));
        m.put("title", r.get("title"));
        m.put("firstName", r.get("first_name"));
        m.put("lastName", r.get("last_name"));
        m.put("fullName", r.get("full_name"));
        m.put("email", r.get("email"));
        m.put("phone", r.get("phone"));
        m.put("hospitalId", r.get("hospital_id"));
        m.put("departmentId", r.get("department_id"));
        m.put("hospitalName", r.get("hospital_name"));
        m.put("departmentName", r.get("department_name"));
        m.put("role", r.get("role"));
        m.put("status", r.get("status"));
        m.put("active", "active".equals(String.valueOf(r.get("status"))));
        m.put("workStatus", r.get("work_status"));
        m.put("professionalRegistrationNo", r.get("professional_registration_no"));
        m.put("jobTitle", r.get("job_title"));
        m.put("employmentType", r.get("employment_type"));
        m.put("joiningDate", r.get("joining_date"));
        m.put("mustChangePassword", r.get("must_change_password"));
        m.put("photoURL", r.get("profile_photo_url"));
        m.put("lastLoginAt", r.get("last_login_at"));
        m.put("createdAt", r.get("created_at"));
        m.put("updatedAt", r.get("updated_at"));
        return m;
    }

    private AppUserEntity findAccessible(GovCarePrincipal actor, UUID id) {
        AppUserEntity user = users.findByIdWithRole(id).orElseThrow(() -> ApiException.notFound("Staff account not found."));
        if (!isSuper(actor) && !Objects.equals(actor.hospitalId(), user.getHospitalId())) throw ApiException.notFound("Staff account not found.");
        return user;
    }

    private void protectAdminTarget(GovCarePrincipal actor, AppUserEntity user) {
        if (!isSuper(actor) && user.getRole() == UserRole.hospital_admin) throw ApiException.forbidden("Hospital Admin accounts can be modified only by Super Admin.");
        if (user.getRole() == UserRole.super_admin && !isSuper(actor)) throw ApiException.forbidden("Super Admin accounts are protected.");
    }

    private String validateAssignableRole(GovCarePrincipal actor, String input, AppUserEntity target) {
        String code = normalizeRole(input);
        if (!STAFF_ROLES.contains(code)) throw ApiException.badRequest("This role cannot be assigned through Staff Management.");
        if (!isSuper(actor) && code.equals("hospital_admin")) throw ApiException.forbidden("Hospital Admin cannot assign Hospital Admin or Super Admin roles.");
        if (target != null && target.getRole() == UserRole.super_admin) throw ApiException.forbidden("Super Admin role cannot be changed through Staff Management.");
        return code;
    }

    private UUID scopedHospital(GovCarePrincipal actor, UUID requested) {
        if (isSuper(actor)) return requested;
        if (actor.hospitalId() == null) throw ApiException.forbidden("Your account is not assigned to a hospital.");
        if (requested != null && !requested.equals(actor.hospitalId())) throw ApiException.forbidden("Hospital Admin can manage only staff from their own hospital.");
        return actor.hospitalId();
    }

    private void validateHospital(UUID hospitalId) {
        if (hospitalId == null) throw ApiException.badRequest("Hospital is required.");
        if (sql.one("select id from hospitals where id=:id and status='active'", Map.of("id", hospitalId)).isEmpty()) throw ApiException.badRequest("Selected hospital does not exist or is inactive.");
    }

    private void validateDepartment(UUID departmentId, UUID hospitalId) {
        if (departmentId == null) return;
        if (sql.one("select id from departments where id=:id and hospital_id=:hospitalId and status='active'", Map.of("id", departmentId, "hospitalId", hospitalId)).isEmpty()) {
            throw ApiException.badRequest("Selected department does not belong to the selected hospital.");
        }
    }

    private String nextEmployeeNo() {
        Object value = sql.required("select next_staff_employee_no() employee_no", Map.of(), "Unable to generate employee number.").get("employee_no");
        return String.valueOf(value);
    }

    private void requireManager(GovCarePrincipal actor) {
        if (!isSuper(actor) && !"hospital_admin".equals(actor.role())) throw ApiException.forbidden("Only Super Admin or Hospital Admin can manage staff.");
    }

    private boolean isSuper(GovCarePrincipal actor) { return "super_admin".equals(actor.role()); }

    private String normalizeRole(String value) {
        if (value == null || value.isBlank()) throw ApiException.badRequest("Role is required.");
        String code = value.trim().toLowerCase(Locale.ROOT);
        return switch (code) {
            case "laboratory_technician" -> "lab_technician";
            case "laboratory_pathologist" -> "pathologist";
            default -> code;
        };
    }

    private String normalizeEmploymentType(String value) {
        String normalized = value == null ? "permanent" : value.trim().toLowerCase(Locale.ROOT).replace(' ', '_');
        if (!EMPLOYMENT_TYPES.contains(normalized)) throw ApiException.badRequest("Invalid employment type.");
        return normalized;
    }

    private String normalizeWorkStatus(String value) {
        String normalized = value == null ? "active" : value.trim().toLowerCase(Locale.ROOT).replace(' ', '_');
        if (!WORK_STATUSES.contains(normalized)) throw ApiException.badRequest("Invalid work status.");
        return normalized;
    }

    private String normalizeEmail(String value) { return value.trim().toLowerCase(Locale.ROOT); }
    private static String clean(String value) { if (value == null) return null; String s = value.trim(); return s.isEmpty() ? null : s; }
    private static String string(Object value) { return value == null ? null : String.valueOf(value); }
    private static String toCamel(String value) {
        StringBuilder b = new StringBuilder(); boolean upper = false;
        for (char c : value.toCharArray()) { if (c == '_') upper = true; else { b.append(upper ? Character.toUpperCase(c) : c); upper = false; } }
        return b.toString();
    }
}
