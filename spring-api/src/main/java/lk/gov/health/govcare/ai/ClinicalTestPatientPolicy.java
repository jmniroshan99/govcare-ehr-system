package lk.gov.health.govcare.ai;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.GovCarePrincipal;
import java.util.*;

/** Uses explicit stored non-real-patient markers, never a filename, patient name, URL or client test-mode flag. */
public final class ClinicalTestPatientPolicy {
 private ClinicalTestPatientPolicy(){}
 public static boolean synthetic(SqlSupport sql,GovCarePrincipal actor,UUID patient){
  return sql.one("select (risk_flags @> '[\"SYNTHETIC_RESEARCH_DEMONSTRATION\",\"NOT_A_REAL_PATIENT\"]'::jsonb) as synthetic from patients where id=:p and hospital_id=:h and status<>'deleted'",Map.of("p",patient,"h",actor.hospitalId()))
    .map(row->Boolean.TRUE.equals(row.get("synthetic"))).orElse(false);
 }
}
