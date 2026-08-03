package lk.gov.health.govcare.user;

import com.fasterxml.jackson.databind.ObjectMapper;
import lk.gov.health.govcare.audit.AuditService;
import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class UserService {
    private final AppUserRepository users;
    private final RoleRepository roles;
    private final UserSecurityService security;
    private final PasswordEncoder passwords;
    private final ObjectMapper mapper;
    private final SqlSupport sql;
    private final AuditService audit;

    public UserService(AppUserRepository users, RoleRepository roles, UserSecurityService security,
                       PasswordEncoder passwords, ObjectMapper mapper, SqlSupport sql, AuditService audit) {
        this.users=users; this.roles=roles; this.security=security; this.passwords=passwords; this.mapper=mapper; this.sql=sql; this.audit=audit;
    }

    public List<Map<String,Object>> departments(GovCarePrincipal actor) {
        return sql.list("select id::text,code,name,type,status::text from departments where hospital_id=:hospitalId and status<>'deleted' order by name", Map.of("hospitalId", actor.hospitalId()));
    }

    public Map<String,Object> byAuth(GovCarePrincipal actor, String uid) {
        AppUserEntity user = users.findByAuthUid(uid).orElseGet(() -> {
            try { return users.findByIdWithRole(UUID.fromString(uid)).orElse(null); } catch(Exception e) { return null; }
        });
        if(user==null) throw ApiException.notFound("User not found.");
        boolean self = user.getId().equals(actor.id());
        boolean canViewUsers = actor.permissions().contains("USER_VIEW") || actor.role().equals("super_admin");
        if (!self && !canViewUsers) throw ApiException.notFound("User not found.");
        if (!actor.role().equals("super_admin") && !Objects.equals(actor.hospitalId(), user.getHospitalId())) {
            throw ApiException.notFound("User not found.");
        }
        return profile(user, security.principal(user));
    }

    public List<Map<String,Object>> list(GovCarePrincipal actor, String search, String role, String status, int limit) {
        StringBuilder q=new StringBuilder("""
          select u.id::text,u.auth_uid,u.hospital_id::text,u.department_id::text,u.role::text,u.employee_no,u.job_title,u.must_change_password,u.full_name,u.email,u.phone,u.address,
                 u.profile_photo_url,u.permissions,u.mfa_enabled,u.last_login_at,u.status::text,u.created_at,u.updated_at,
                 h.name as hospital_name,d.name as department_name,r.default_route
          from app_users u left join hospitals h on h.id=u.hospital_id left join departments d on d.id=u.department_id left join roles r on r.id=u.role_id
          where (:allHospitals or u.hospital_id=:hospitalId)
        """);
        Map<String,Object> p=new HashMap<>(); p.put("allHospitals", actor.role().equals("super_admin")); p.put("hospitalId", actor.hospitalId());
        if(search!=null&&!search.isBlank()){q.append(" and (u.full_name ilike :search or u.email ilike :search or u.phone ilike :search)");p.put("search","%"+search.trim()+"%");}
        if(role!=null&&!role.isBlank()){q.append(" and u.role::text=:role");p.put("role",role);}
        if(status!=null&&!status.isBlank()){q.append(" and u.status::text=:status");p.put("status",status);}
        q.append(" order by u.created_at desc limit :limit");p.put("limit",Math.min(Math.max(limit,1),200));
        return sql.list(q.toString(),p).stream().map(this::rowToProfile).toList();
    }

    @Transactional
    public Map<String,Object> create(GovCarePrincipal actor, Map<String,Object> input) {
        String fullName=req(input,"fullName"), email=req(input,"email").toLowerCase(), roleCode=req(input,"role");
        if(users.findByEmailIgnoreCaseWithRole(email).isPresent()) throw ApiException.conflict("An account with this email already exists.");
        RoleEntity role=roles.findByCode(roleCode).orElseThrow(()->ApiException.badRequest("Unknown role."));
        if(!actor.role().equals("super_admin") && roleCode.equals("super_admin")) throw ApiException.forbidden("Only Super Admin can create another Super Admin.");
        AppUserEntity u=new AppUserEntity();
        u.setAuthUid("spring-"+UUID.randomUUID()); u.setEmployeeNo("STAFF-"+UUID.randomUUID().toString().substring(0,8).toUpperCase()); u.setWorkStatus("active"); u.setMustChangePassword(true); u.setHospitalId(actor.role().equals("super_admin") && input.get("hospitalId")!=null?UUID.fromString(String.valueOf(input.get("hospitalId"))):actor.hospitalId());
        u.setDepartmentId(uuid(input.get("departmentId"))); u.setRole(UserRole.valueOf(roleCode)); u.setRoleDefinition(role);
        u.setFullName(fullName);u.setEmail(email);u.setPasswordHash(passwords.encode(String.valueOf(input.getOrDefault("password","GovCare@123"))));
        u.setPhone(clean(input.get("phone")));u.setAddress(clean(input.get("address")));
        u.setPermissions(mapper.valueToTree(actor.role().equals("super_admin")
                ? input.getOrDefault("permissions",List.of()) : List.of()));
        u.setMfaEnabled(Boolean.TRUE.equals(input.get("mfaEnabled")));u.setStatus(UserStatus.active);users.saveAndFlush(u);
        Map<String,Object> out=profile(u,security.principal(u));audit.record(actor,"users","create","app_users",u.getId(),null,out);return out;
    }

    public Map<String,Object> detail(GovCarePrincipal actor,String id) {
        AppUserEntity u=findAccessible(actor,id);Map<String,Object> profile=profile(u,security.principal(u));
        Map<String,Object> summary=new LinkedHashMap<>();
        for(String key:List.of("loginCount","auditCount","visitCount","appointmentCount","prescriptionCount","labRequestCount","radiologyRequestCount","admissionCount"))summary.put(key,0);
        List<Map<String,Object>> activity=sql.list("""
          select id::text,'login' as type,concat('Login ',login_status) as title,coalesce(failure_reason,'') as detail,login_time as created_at
          from login_activities where user_id=:id order by login_time desc limit 20
        """,Map.of("id",u.getId())).stream().map(row->{Map<String,Object> m=new LinkedHashMap<>();m.put("id",row.get("id"));m.put("type",row.get("type"));m.put("title",row.get("title"));m.put("detail",row.get("detail"));m.put("createdAt",row.get("created_at"));return m;}).toList();
        return Map.of("user",profile,"summary",summary,"activity",activity);
    }

    @Transactional
    public Map<String,Object> update(GovCarePrincipal actor,String id,Map<String,Object> input) {
        AppUserEntity u=findAccessible(actor,id);Map<String,Object> before=profile(u,security.principal(u));
        if(input.containsKey("fullName"))u.setFullName(req(input,"fullName"));
        if(input.containsKey("email"))u.setEmail(req(input,"email").toLowerCase());
        if(input.containsKey("role")){String code=req(input,"role");if(!actor.role().equals("super_admin")&&code.equals("super_admin"))throw ApiException.forbidden("Only Super Admin can assign Super Admin.");u.setRole(UserRole.valueOf(code));u.setRoleDefinition(roles.findByCode(code).orElseThrow(()->ApiException.badRequest("Unknown role.")));}
        if(input.containsKey("departmentId"))u.setDepartmentId(uuid(input.get("departmentId")));
        if(input.containsKey("phone"))u.setPhone(clean(input.get("phone")));if(input.containsKey("address"))u.setAddress(clean(input.get("address")));
        if(input.containsKey("permissions")){
            if(!actor.role().equals("super_admin")) throw ApiException.forbidden("Only Super Admin can assign permission overrides.");
            u.setPermissions(mapper.valueToTree(input.get("permissions")));
        }
        if(input.containsKey("mfaEnabled"))u.setMfaEnabled(Boolean.TRUE.equals(input.get("mfaEnabled")));
        if(input.containsKey("status"))u.setStatus(UserStatus.valueOf(String.valueOf(input.get("status"))));users.saveAndFlush(u);
        Map<String,Object> after=profile(u,security.principal(u));audit.record(actor,"users","update","app_users",u.getId(),before,after);return after;
    }

    @Transactional
    public Map<String,Object> updateOwnProfile(GovCarePrincipal actor,String uid,Map<String,Object> input) {
        AppUserEntity u=users.findByAuthUid(uid).orElseGet(()->users.findByIdWithRole(actor.id()).orElseThrow());
        if(!u.getId().equals(actor.id())&&!actor.permissions().contains("USER_MANAGE"))throw ApiException.forbidden("You can update only your own profile.");
        if(input.containsKey("displayName"))u.setFullName(req(input,"displayName"));if(input.containsKey("phone"))u.setPhone(clean(input.get("phone")));if(input.containsKey("address"))u.setAddress(clean(input.get("address")));users.save(u);return profile(u,security.principal(u));
    }

    private AppUserEntity findAccessible(GovCarePrincipal actor,String id){UUID uuid;try{uuid=UUID.fromString(id);}catch(Exception e){AppUserEntity by=users.findByAuthUid(id).orElseThrow(()->ApiException.notFound("User not found."));uuid=by.getId();}AppUserEntity u=users.findByIdWithRole(uuid).orElseThrow(()->ApiException.notFound("User not found."));if(!actor.role().equals("super_admin")&&!Objects.equals(actor.hospitalId(),u.getHospitalId()))throw ApiException.notFound("User not found.");return u;}

    public Map<String,Object> profile(AppUserEntity u,GovCarePrincipal principal){Map<String,Object> m=new LinkedHashMap<>();m.put("id",u.getId().toString());m.put("uid",u.getAuthUid()==null?u.getId().toString():u.getAuthUid());m.put("hospitalId",u.getHospitalId()==null?null:u.getHospitalId().toString());m.put("departmentId",u.getDepartmentId()==null?null:u.getDepartmentId().toString());m.put("patientId",u.getPatientId()==null?null:u.getPatientId().toString());m.put("role",u.getRole().name());m.put("employeeNo",u.getEmployeeNo());m.put("jobTitle",u.getJobTitle());m.put("mustChangePassword",u.isMustChangePassword());m.put("displayName",u.getFullName());m.put("email",u.getEmail());m.put("phone",u.getPhone());m.put("address",u.getAddress());m.put("photoURL",u.getProfilePhotoUrl());m.put("permissions",principal.permissions());m.put("mfaEnabled",u.isMfaEnabled());m.put("status",u.getStatus().name());m.put("createdAt",u.getCreatedAt());m.put("updatedAt",u.getUpdatedAt());m.put("createdBy","spring-boot");m.put("updatedBy","spring-boot");if(u.getRoleDefinition()!=null)m.put("defaultRoute",u.getRoleDefinition().getDefaultRoute());if(u.getHospitalId()!=null)sql.one("select name from hospitals where id=:id",Map.of("id",u.getHospitalId())).ifPresent(r->m.put("hospitalName",r.get("name")));if(u.getDepartmentId()!=null)sql.one("select name from departments where id=:id",Map.of("id",u.getDepartmentId())).ifPresent(r->m.put("departmentName",r.get("name")));return m;}

    private Map<String,Object> rowToProfile(Map<String,Object> r){Map<String,Object> m=new LinkedHashMap<>();m.put("id",r.get("id"));m.put("uid",r.get("auth_uid")!=null?r.get("auth_uid"):r.get("id"));m.put("hospitalId",r.get("hospital_id"));m.put("departmentId",r.get("department_id"));m.put("role",r.get("role"));m.put("employeeNo",r.get("employee_no"));m.put("jobTitle",r.get("job_title"));m.put("mustChangePassword",r.get("must_change_password"));m.put("displayName",r.get("full_name"));m.put("email",r.get("email"));m.put("phone",r.get("phone"));m.put("address",r.get("address"));m.put("photoURL",r.get("profile_photo_url"));m.put("permissions",r.get("permissions"));m.put("mfaEnabled",r.get("mfa_enabled"));m.put("status",r.get("status"));m.put("lastLoginAt",r.get("last_login_at"));m.put("createdAt",r.get("created_at"));m.put("updatedAt",r.get("updated_at"));m.put("hospitalName",r.get("hospital_name"));m.put("departmentName",r.get("department_name"));m.put("defaultRoute",r.get("default_route"));m.put("createdBy","spring-boot");m.put("updatedBy","spring-boot");return m;}
    private static String req(Map<String,Object> m,String k){String s=clean(m.get(k));if(s==null)throw ApiException.badRequest(k+" is required.");return s;}
    private static String clean(Object o){if(o==null)return null;String s=String.valueOf(o).trim();return s.isEmpty()?null:s;}
    private static UUID uuid(Object o){String s=clean(o);if(s==null)return null;try{return UUID.fromString(s);}catch(Exception e){throw ApiException.badRequest("Invalid UUID.");}}
}
