package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/** FHIR R4 separates uncalibrated classifier scores and continuous forecasts from event probabilities. */
final class RenalPredictionFhir {
    private static final ObjectMapper JSON=new ObjectMapper();
    static ObjectNode resource(String patientReference,String id,JsonNode output,List<Map<String,Object>> sources){
        boolean classifier=output.path("model_key").asText().equals("hyperkalemia");
        var body=JSON.createObjectNode().put("resourceType",classifier?"RiskAssessment":"ClinicalImpression").put("id",id).put("status",classifier?"final":"completed");
        body.putObject("subject").put("reference",patientReference);body.putArray("identifier").addObject().put("system","urn:govcare:predictive-snapshot").put("value",id);
        String at=output.path("forecast_origin_date").asText(Instant.now().toString());
        String horizon="Immediate next observation within 14-62 days; +30 days is a display anchor";
        var extensions=body.putArray("extension");
        for(String key:List.of("model","model_version","method","status","clinical_validation","validation_status","dataset_permission_status"))extensions.addObject().put("url","urn:govcare:renal-"+key.replace('_','-')).put("valueString",output.path(key).asText("NOT_ESTABLISHED"));
        extensions.addObject().put("url","urn:govcare:renal-horizon-definition").put("valueString",horizon);
        extensions.addObject().put("url","urn:govcare:renal-explanation").put("valueString",output.path("explanation").toString());
        for(String field:List.of("interval","data_quality","artifact_revision","training_run_id"))if(output.hasNonNull(field))extensions.addObject().put("url","urn:govcare:renal-"+field.replace('_','-')).put("valueString",output.path(field).toString());
        extensions.addObject().put("url","urn:govcare:requires-clinician-review").put("valueBoolean",true);
        if(classifier){
            body.put("occurrenceDateTime",at);body.putObject("method").put("text",output.path("model").asText()+" | "+output.path("method").asText()+" | uncalibrated research classifier");
            var prediction=body.putArray("prediction").addObject();prediction.putObject("outcome").put("text","Next-observed pre-dialysis potassium >=5.5 mmol/L; research outcome, clinical probability not established");
            var range=prediction.putObject("whenRange");for(String edge:List.of("low","high"))range.putObject(edge).put("value",edge.equals("low")?14:62).put("unit","days").put("system","http://unitsofmeasure.org").put("code","d");
            // R4 probability[x] means likelihood. Internal uncalibrated scores never populate it.
            if(output.path("probability").isNumber())extensions.addObject().put("url","urn:govcare:renal-research-score").put("valueDecimal",output.path("probability").asDouble());
            for(var source:sources)body.withArray("basis").addObject().putObject("identifier").put("system","urn:govcare:renal-session").put("value",source.get("id").toString());
        }else{
            body.put("date",at).put("summary","Research continuous forecast for "+output.path("model_key").asText()+"; "+horizon+". Not a measured laboratory observation or event probability.");
            if(output.path("prediction").isNumber())extensions.addObject().put("url","urn:govcare:renal-predicted-value").putObject("valueQuantity").put("value",output.path("prediction").asDouble()).put("unit",output.path("unit").asText());
            for(var source:sources)body.withArray("supportingInfo").addObject().putObject("identifier").put("system","urn:govcare:renal-session").put("value",source.get("id").toString());
        }
        body.putArray("note").addObject().put("text","Research model - validation incomplete. Dataset permission unverified. No clinical event probability is asserted. "+output.path("explanation").path("limitations").toString());
        return body;
    }
}
