package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Instant;
import java.util.*;

/** One calculation path for observation ingestion, clinical snapshots and exported measured URR. */
public final class UreaReductionRatio {
    private static final ObjectMapper JSON=new ObjectMapper();
    private UreaReductionRatio(){}
    public static ObjectNode evaluate(String patient,JsonNode row){
        var result=JSON.createObjectNode().put("status","MISSING_REQUIRED_INFORMATION").put("unit","%");result.putNull("value");
        result.set("rule",ClinicalRuleRegistry.rule("MEASURED_URR"));
        var reasons=result.putArray("reasons");var requirements=result.putArray("requirements");
        JsonNode values=row.path("measurements"),units=row.path("units"),context=row.path("sampling_context");
        Double pre=number(values.path("urea_pre")),post=number(values.path("urea_post"));
        Double canonicalPre=pre==null?null:convert(pre,units.path("urea_pre").asText()),canonicalPost=post==null?null:convert(post,units.path("urea_post").asText());
        String session=context.path("sessionId").asText("");
        Instant before=ClinicalFeatureNormalizer.instant(context.path("preCollectedAt").asText(null)),after=ClinicalFeatureNormalizer.instant(context.path("postCollectedAt").asText(null));
        boolean samePatient=patient!=null&&patient.equals(context.path("patientId").asText())&&(!context.hasNonNull("prePatientId")||patient.equals(context.path("prePatientId").asText()))&&(!context.hasNonNull("postPatientId")||patient.equals(context.path("postPatientId").asText()));
        boolean sameSession=!session.isBlank()&&(!context.hasNonNull("preSessionId")||session.equals(context.path("preSessionId").asText()))&&(!context.hasNonNull("postSessionId")||session.equals(context.path("postSessionId").asText()));
        boolean timing=before!=null&&after!=null&&before.isBefore(after)&&!after.isAfter(Instant.now())&&!before.isBefore(Instant.parse("1900-01-01T00:00:00Z"));
        boolean verified=context.path("sourceVerified").asBoolean()&&!row.path("source_note").asText("").isBlank();
        requirement(requirements,"urea_pre","Pre-dialysis urea",pre!=null,canonicalPre!=null&&canonicalPre>0,"A positive pre-dialysis urea measurement is required");
        requirement(requirements,"urea_post","Post-dialysis urea",post!=null,canonicalPost!=null&&canonicalPost>=0&&(canonicalPre==null||canonicalPost<=canonicalPre),"Post-dialysis urea must be nonnegative and no greater than pre-dialysis urea; reconcile the source");
        requirement(requirements,"session_id","Same patient and dialysis session",!session.isBlank(),samePatient&&sameSession,"Patient/session identifiers are missing or disagree");
        requirement(requirements,"pre_collected_at","Pre-dialysis collection time",before!=null,timing,"Actual ordered pre-/post-dialysis collection times are required");
        requirement(requirements,"post_collected_at","Post-dialysis collection time",after!=null,timing,"Post-dialysis collection must follow pre-dialysis collection and not be in the future");
        requirement(requirements,"compatible_units","Compatible urea units",!units.path("urea_pre").asText().isBlank()&&!units.path("urea_post").asText().isBlank(),canonicalPre!=null&&canonicalPost!=null,"Use urea mmol/L or urea mg/dL; unrelated BUN cannot substitute");
        requirement(requirements,"verified_source","Verified source record",context.has("sourceVerified"),verified,"Verify the source record and sampling context");
        for(JsonNode requirement:requirements)if(!requirement.path("satisfied").asBoolean())reasons.add(requirement.path("detail").asText());
        if(canonicalPre!=null&&canonicalPost!=null&&canonicalPost>canonicalPre)reasons.add("Post-dialysis urea exceeds pre-dialysis urea; reconcile the source. No clamping is applied.");
        if(reasons.isEmpty()){
            result.put("status","CALCULATED").put("value",100*(canonicalPre-canonicalPost)/canonicalPre);
            result.put("preValue",canonicalPre).put("postValue",canonicalPost).put("inputUnit","mmol/L").put("preCollectedAt",before.toString()).put("postCollectedAt",after.toString()).put("sessionId",session).put("sourceId",row.path("id").asText());
            result.put("targetApplicable",context.path("regimen").asText().equals("IN_CENTRE_HD_THREE_TIMES_WEEKLY"));
            result.put("targetNote",result.path("targetApplicable").asBoolean()?"Common URR reference >=65% for this recorded regimen; individual prescription may differ.":"[Confirm with the nephrologist] dialysis regimen and individual adequacy target; no universal target is applied.");
        }
        return result;
    }
    private static Double number(JsonNode value){return value.isNumber()&&Double.isFinite(value.asDouble())?value.asDouble():null;}
    private static Double convert(double value,String unit){return switch(unit){case "mmol/L"->value;case "mg/dL"->value/6.006;default->null;};}
    private static void requirement(com.fasterxml.jackson.databind.node.ArrayNode array,String key,String label,boolean recorded,boolean satisfied,String detail){
        array.addObject().put("key",key).put("groupKey",key).put("label",label).put("required",true).put("recorded",recorded).put("satisfied",satisfied).put("state",satisfied?"AVAILABLE":recorded?"UNVERIFIED":"MISSING").put("minimumCount",1).put("availableCount",satisfied?1:0).put("additionalCount",satisfied?0:1).put("detail",detail).put("action","ADD_LAB_RESULT").put("focusKey","urea_pre").putNull("latestAt").putNull("previousAt");
    }
}
