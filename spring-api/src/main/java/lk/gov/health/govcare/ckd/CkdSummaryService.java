package lk.gov.health.govcare.ckd;

import org.springframework.stereotype.Service;
import java.util.UUID;

@Service
public class CkdSummaryService {

 public CkdSummaryDTO getPatientCkdSummary(UUID patientId){
   return new CkdSummaryDTO(
    patientId.toString(),
    "Unknown",
    "N18.9",
    null,
    null,
    "NOT_AVAILABLE",
    false,
    false,
    null
   );
 }

 public String calculateStage(Double egfr){
   if(egfr==null)return "Unknown";
   if(egfr>=90)return "Stage 1";
   if(egfr>=60)return "Stage 2";
   if(egfr>=45)return "Stage 3a";
   if(egfr>=30)return "Stage 3b";
   if(egfr>=15)return "Stage 4";
   return "Stage 5";
 }
}
