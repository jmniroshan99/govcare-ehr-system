package lk.gov.health.govcare.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class AuditService {
 private final NamedParameterJdbcTemplate jdbc; private final ObjectMapper mapper; private final HttpServletRequest request;
 public AuditService(NamedParameterJdbcTemplate jdbc,ObjectMapper mapper,HttpServletRequest request){this.jdbc=jdbc;this.mapper=mapper;this.request=request;}
 public void record(GovCarePrincipal actor,String module,String action,String entityType,UUID entityId,Object before,Object after){
  try{Map<String,Object> p=new HashMap<>();p.put("hospitalId",actor.hospitalId());p.put("actorId",actor.id());p.put("role",actor.role());p.put("module",module);p.put("action",action);p.put("entityType",entityType);p.put("entityId",entityId);p.put("before",mapper.writeValueAsString(before==null?Map.of():before));p.put("after",mapper.writeValueAsString(after==null?Map.of():after));p.put("ip",clientIp());p.put("device",Objects.toString(request.getHeader("User-Agent"),""));
   jdbc.update("insert into audit_logs(hospital_id,actor_id,actor_role,module,action,entity_type,entity_id,before_state,after_state,ip_address,device_info) values(:hospitalId,:actorId,cast(:role as user_role),:module,:action,:entityType,:entityId,cast(:before as jsonb),cast(:after as jsonb),:ip,:device)",p);
  }catch(Exception e){System.err.println("[audit] Unable to write audit record: "+e.getMessage());}
 }
 public void denied(GovCarePrincipal actor,String path){record(actor,"security","access_denied","endpoint",null,Map.of(),Map.of("path",path,"result","denied"));}
 private String clientIp(){String x=request.getHeader("X-Forwarded-For");return x==null||x.isBlank()?request.getRemoteAddr():x.split(",")[0].trim();}
}
