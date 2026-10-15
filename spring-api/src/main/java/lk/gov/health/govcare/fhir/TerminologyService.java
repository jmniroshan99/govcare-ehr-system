package lk.gov.health.govcare.fhir;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class TerminologyService {
 private final NamedParameterJdbcTemplate jdbc;
 public TerminologyService(NamedParameterJdbcTemplate jdbc){this.jdbc=jdbc;}
 public List<Map<String,Object>> search(String query,String system){
  String q=query==null?"":query.trim(); String sys=system==null?"":system.trim();
  return jdbc.queryForList("""
    select system,code,display,version,category from fhir_terminology
    where active=true and (:sys='' or system=:sys)
      and (:q='' or lower(code) like lower(:like) or lower(display) like lower(:like))
    order by case when lower(code)=lower(:q) then 0 else 1 end, display limit 50
    """,Map.of("q",q,"like","%"+q+"%","sys",sys));
 }
 public Map<String,Object> validate(String system,String code){
  if(system==null||system.isBlank()||code==null||code.isBlank()) return Map.of("valid",false,"message","system and code are required");
  var rows=jdbc.queryForList("select system,code,display,version,category from fhir_terminology where active=true and system=:s and code=:c",Map.of("s",system,"c",code));
  if(rows.isEmpty()) return Map.of("valid",false,"system",system,"code",code,"message","Code is not present in the configured GovCare terminology catalogue.");
  var r=rows.getFirst(); return Map.of("valid",true,"system",r.get("system"),"code",r.get("code"),"display",r.get("display"),"category",r.get("category"));
 }
}
