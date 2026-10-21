package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.*;
import java.util.*;

/** Authoritative measurement rules and the shared saved-result contract consumed by UI/PDF/FHIR. */
public final class ClinicalIntelligenceRules {
    private static final ObjectMapper JSON=new ObjectMapper();
    private ClinicalIntelligenceRules(){}
    static ObjectNode potassium(ObjectNode features){
        var r=ClinicalFeatureMappingEngine.result("Potassium assessment","Recorded low/high potassium severity");
        ClinicalFeatureMappingEngine.check(r,features,"potassium",true);
        var f=features.path("current").path("potassium");Double value=value(f);
        r.set("rule",ClinicalRuleRegistry.rule("POTASSIUM_SEVERITY"));
        if(value!=null){
            String code,label,severity,priority;
            if(value<ClinicalRuleRegistry.K_SEVERE_LOW){code="SEVERE_HYPOKALEMIA";label="Severe low potassium";severity="Severe";priority="PROMPT_VERIFICATION_AND_REVIEW";}
            else if(value<ClinicalRuleRegistry.K_MODERATE_LOW){code="MODERATE_HYPOKALEMIA";label="Moderate low potassium";severity="Moderate";priority="CLINICAL_REVIEW";}
            else if(value<ClinicalRuleRegistry.K_LOW){code="MILD_HYPOKALEMIA";label="Mild low potassium";severity="Mild";priority="CLINICAL_REVIEW";}
            else if(value>=ClinicalRuleRegistry.K_SEVERE_HIGH){code="SEVERE_HYPERKALEMIA";label="Severe high potassium";severity="Severe";priority="PROMPT_VERIFICATION_AND_REVIEW";}
            else if(value>=ClinicalRuleRegistry.K_MODERATE_HIGH){code="MODERATE_HYPERKALEMIA";label="Moderate high potassium";severity="Moderate";priority="CLINICAL_REVIEW";}
            else if(value>=ClinicalRuleRegistry.K_HIGH){code="MILD_HYPERKALEMIA";label="Mild high potassium";severity="Mild";priority="CLINICAL_REVIEW";}
            else {code="NO_ADOPTED_POTASSIUM_BAND";label="Not within adopted low/high potassium bands";severity="Not classified as low/high";priority="ROUTINE_EVIDENCE_REVIEW";}
            recorded(r,f,value,"mmol/L");r.put("riskLevel",severity).put("resultTitle",label);
            var signal=signal(r,code,label,severity,priority,!code.equals("NO_ADOPTED_POTASSIUM_BAND"));
            signal.put("currentRelevance",relevance(f));
            String temporal=f.path("observedAt").isTextual()?f.path("state").asText().equals("STALE")?"Historical value; current relevance is not established.":"Interpret the recorded collection time and sample context.":"Measurement date unverified; current relevance is not established.";
            String explanation=label+": recorded potassium "+value+" mmol/L. "+temporal;
            if(severity.equals("Severe"))explanation+=" Promptly verify the source/date and arrange clinical review under the institution's protocol; prediction unavailability does not remove this finding.";
            r.put("message",explanation);r.withArray("explanations").add(explanation).add(r.path("rule").path("thresholdPolicy").asText());
        }else {r.put("resultTitle",f.path("state").asText().equals("INVALID")?"Potassium source requires reconciliation":"Recorded potassium not assessed").put("message","A valid potassium value and unit are required. Conflicting or unreliable samples do not support a reassuring interpretation.");signal(r,"NOT_ASSESSED",r.path("resultTitle").asText(),"Not assessed","SOURCE_VERIFICATION",false);}
        r.set("trend",ClinicalFeatureMappingEngine.trend(features,"potassium"));
        r.withArray("recommendations").add("Review source sample quality, actual collection time, dialysis timing and documented medicines. No automatic medication order is generated.");
        ClinicalFeatureMappingEngine.next(r,"ADD_CLINICAL_HISTORY",value!=null&&(value<2.5||value>=6.5)?"Promptly verify potassium and review patient":"Verify potassium evidence","potassium");return r;
    }
    static ObjectNode hemoglobin(ObjectNode features){
        var r=ClinicalFeatureMappingEngine.result("Hemoglobin assessment","KDIGO 2026 adult hemoglobin reference comparison");
        ClinicalFeatureMappingEngine.check(r,features,"hemoglobin",true);var f=features.path("current").path("hemoglobin");Double h=value(f);
        var context=features.path("clinicalContext").path("demographics");String sex=context.path("sex").asText("").toUpperCase(Locale.ROOT);
        Double age=value(features.path("current").path("age"));if(context.path("ageYears").isNumber())age=context.path("ageYears").asDouble();
        r.set("rule",ClinicalRuleRegistry.rule("ADULT_HEMOGLOBIN"));
        if(h!=null){
            recorded(r,f,h,"g/dL");boolean adult=age!=null&&age>=18,knownSex=Set.of("MALE","FEMALE").contains(sex);
            if(adult&&knownSex){
                double threshold=sex.equals("MALE")?ClinicalRuleRegistry.HB_ADULT_MALE:ClinicalRuleRegistry.HB_ADULT_FEMALE;
                boolean below=h<threshold;String title=below?"Below adult hemoglobin reference threshold":"Not below adult hemoglobin reference threshold";
                r.put("resultTitle",title).put("riskLevel",below?"Clinical review":"Reference comparison only");
                signal(r,below?"BELOW_ADULT_HB_REFERENCE":"NOT_BELOW_ADULT_HB_REFERENCE",title,below?"Below threshold":"Not below threshold",below?"CLINICAL_REVIEW":"ROUTINE_EVIDENCE_REVIEW",below).put("threshold",threshold).put("referenceSex",sex).put("currentRelevance",relevance(f));
                r.withArray("explanations").add("Recorded Hb "+h+" g/dL compared with the KDIGO adult "+sex.toLowerCase(Locale.ROOT)+" threshold <"+threshold+" g/dL. This reference comparison does not establish iron deficiency or a treatment indication.");
            }else {r.put("resultTitle","Recorded hemoglobin; population context required").putNull("riskLevel");signal(r,"POPULATION_CONTEXT_REQUIRED",r.path("resultTitle").asText(),"Not assessed","SOURCE_VERIFICATION",false);r.withArray("explanations").add("Verify adult age and the sex-specific pathway before applying the adult thresholds. Pediatric or pregnancy-specific applicability is not assumed.");}
        }else {r.put("resultTitle","Hemoglobin result required");signal(r,"NOT_ASSESSED","Hemoglobin result required","Not assessed","SOURCE_VERIFICATION",false);}
        var workup=r.putArray("supportingInvestigations");
        for(String key:List.of("ferritin","tsat","reticulocytes","pcv","rbc")){
            JsonNode item=features.path("current").path(key);var entry=workup.addObject().put("key",key).put("available",item.path("available").asBoolean());
            entry.set("measurement",item.isMissingNode()?JSON.nullNode():item.deepCopy());if(item.path("available").asBoolean())r.withArray("featuresUsed").add(item.deepCopy());
        }
        var hbTrend=ClinicalFeatureMappingEngine.trend(features,"hemoglobin"); if(hbTrend.path("ready").asBoolean())hbTrend.put("declineRatePerDay",-hbTrend.path("absoluteChange").asDouble()/hbTrend.path("intervalDays").asDouble());r.set("trend",hbTrend);
        r.put("message","Recorded Hb, observed change, a future Hb forecast and a future anemia-event probability are different outputs. No anemia-event model is installed.");
        r.withArray("explanations").add("Ferritin and TSAT support iron evaluation; hemoglobin alone does not identify iron deficiency. Missing supporting investigations are not counted as recorded Hb inputs.");
        r.withArray("recommendations").add("[Confirm with the nephrologist] population pathway, dialysis/pregnancy context, CBC, reticulocytes, ferritin, TSAT and documented treatment context. No automatic treatment order.");
        ClinicalFeatureMappingEngine.next(r,"ADD_CLINICAL_HISTORY","Review hemoglobin context and source investigations","hemoglobin");return r;
    }
    static ObjectNode progression(ObjectNode features){
        var r=ClinicalFeatureMappingEngine.result("Renal function and observed progression","Comparable dated creatinine change");
        ClinicalFeatureMappingEngine.check(r,features,"creatinine",true);var trend=ClinicalFeatureMappingEngine.trend(features,"creatinine");boolean ready=trend.path("ready").asBoolean();
        ClinicalFeatureMappingEngine.addRequirement(r,"previous_creatinine","creatinine","Previous comparable creatinine",true,ready,ready?"AVAILABLE":"MISSING_HISTORY","ADD_CLINICAL_HISTORY","creatinine","A comparable previous creatinine is required",trend.path("previousAt"));
        JsonNode date=ready?trend.path("currentAt"):features.path("current").path("creatinine").path("observedAt");
        ClinicalFeatureMappingEngine.addRequirement(r,"current_creatinine_date","history","Creatinine collection time",true,date.isTextual(),date.isTextual()?"AVAILABLE":"UNVERIFIED","ADD_CLINICAL_HISTORY","creatinine","Actual current collection time",date);
        ClinicalFeatureMappingEngine.addRequirement(r,"previous_creatinine_date","history","Previous collection time",true,ready,ready?"AVAILABLE":"MISSING_HISTORY","ADD_CLINICAL_HISTORY","creatinine","A different actual previous collection time is required",trend.path("previousAt"));
        r.set("trend",trend);r.set("rule",ClinicalRuleRegistry.rule("CREATININE_CHANGE"));r.put("formula",r.path("rule").path("formula").asText());
        r.put("status",ready?"CALCULATED":value(features.path("current").path("creatinine"))!=null?"PARTIALLY_CALCULATED":"INSUFFICIENT_DATA");
        r.put("resultTitle",ready?(trend.path("snapshotUndated").asBoolean()?"Historical creatinine change calculated":"Observed creatinine change calculated"):"Trend not established");
        if(ready){double change=trend.path("absoluteChange").asDouble();r.put("riskLevel",change>0?"Observed increase":change<0?"Observed decrease":"Observed unchanged");r.withArray("explanations").add("Creatinine "+trend.path("previousValue").asDouble()+" to "+trend.path("currentValue").asDouble()+" "+trend.path("unit").asText()+" between "+trend.path("previousAt").asText()+" and "+trend.path("currentAt").asText()+"; elapsed "+trend.path("intervalDays").asDouble()+" days; absolute change "+change+"; percentage change "+trend.path("percentChange").asDouble()+"%. This is not a probability or forecast.");}
        else r.putNull("riskLevel");
        r.put("message",ready?"An observed dated change is available. No validated five-year laboratory forecast, AKI diagnosis or dialysis start date is inferred.":"Trend not established: at least two comparable measurements with distinct verified collection times are required.");
        r.put("longitudinalMessage",trend.path("message").asText());r.set("prognosticClassification",prognosis(features));
        r.withArray("recommendations").add("Review the dated source pair, comparability, chronicity, eGFR and urine ACR; a historical slope is not a validated future prediction.");
        ClinicalFeatureMappingEngine.next(r,"ADD_CLINICAL_HISTORY","Review dated renal timeline","creatinine");return r;
    }
    static ObjectNode urr(ObjectNode output){
        var r=ClinicalFeatureMappingEngine.result("Dialysis adequacy / measured URR","Verified same-session urea reduction ratio");JsonNode selected=null;
        for(JsonNode row:output.path("observations"))if(row.path("measurements").has("urea_pre")||row.path("measurements").has("urea_post"))if(selected==null||row.path("observed_at").asText().compareTo(selected.path("observed_at").asText())>0)selected=row;
        if(selected==null)selected=JSON.createObjectNode();
        var result=UreaReductionRatio.evaluate(output.path("patientId").asText(),selected);r.set("rule",result.path("rule"));r.set("requirements",result.path("requirements"));r.set("calculation",result);
        r.put("formula",result.path("rule").path("formula").asText());boolean ready=result.path("value").isNumber();
        r.put("status",ready?"CALCULATED":"INSUFFICIENT_DATA").put("resultTitle",ready?"Measured URR available":"URR not calculated");
        r.put("message",ready?"Measured same-session dialysis metric; this percentage is not a kidney-failure or dialysis-failure probability.":"Missing or invalid same-session evidence; review the named requirements. No unrelated urea/BUN value is substituted.");
        if(ready){r.set("currentValue",result.path("value"));r.put("unit","%");r.set("currentAt",result.path("postCollectedAt"));r.withArray("explanations").add("URR = 100 * ("+result.path("preValue").asDouble()+" - "+result.path("postValue").asDouble()+") / "+result.path("preValue").asDouble()+" = "+result.path("value").asDouble()+"%; same session "+result.path("sessionId").asText()+". "+result.path("targetNote").asText());
            for(String key:List.of("urea_pre","urea_post"))r.withArray("featuresUsed").addObject().put("key",key).put("label",key.equals("urea_pre")?"Pre-dialysis urea":"Post-dialysis urea").put("value",result.path(key.equals("urea_pre")?"preValue":"postValue").asDouble()).put("unit","mmol/L").put("sourceId",selected.path("id").asText()).put("source","VERIFIED_HD_SESSION").put("observedAt",result.path(key.equals("urea_pre")?"preCollectedAt":"postCollectedAt").asText()).put("available",true).put("state","AVAILABLE");}
        else for(JsonNode reason:result.path("reasons"))r.withArray("explanations").add(reason);
        r.withArray("recommendations").add("Verify the patient's session, pre/post collection times, units and dialysis prescription; do not infer adequacy target applicability from URR alone.");
        ClinicalFeatureMappingEngine.next(r,"ADD_LAB_RESULT",ready?"Review dialysis-session source":"Complete same-session dialysis evidence","urea_pre");return r;
    }
    private static ObjectNode prognosis(ObjectNode features){
        var p=JSON.createObjectNode().put("outputType","PROGNOSTIC_CLASSIFICATION");p.set("rule",ClinicalRuleRegistry.rule("KDIGO_GA_CLASSIFICATION"));p.putNull("eventProbability");
        Double g=value(features.path("current").path("egfr")),a=value(features.path("current").path("acr"));
        if(g==null||a==null){p.put("status","MISSING_REQUIRED_INFORMATION").putNull("category");return p;}
        String gc=g>=90?"G1":g>=60?"G2":g>=45?"G3a":g>=30?"G3b":g>=15?"G4":"G5",ac=a<30?"A1":a<=300?"A2":"A3";
        String category=switch(gc){case "G1","G2"->ac.equals("A1")?"Low":ac.equals("A2")?"Moderately increased":"High";case "G3a"->ac.equals("A1")?"Moderately increased":ac.equals("A2")?"High":"Very high";case "G3b"->ac.equals("A1")?"High":"Very high";default->"Very high";};
        p.put("status","PROVISIONAL_RECORDED_GA_CATEGORY").put("gCategory",gc).put("aCategory",ac).put("category",category).put("limitation","Observed G/A classification only. Confirm source dates and established CKD chronicity; isolated G1-G2/A1 does not establish CKD. No event percentage.");return p;
    }
    static void publish(ObjectNode output){
        output.put("schemaVersion",4).put("clinicalRulesVersion",ClinicalRuleRegistry.VERSION).put("ruleVersion",ClinicalRuleRegistry.VERSION);output.set("calculationRegistry",ClinicalRuleRegistry.manifest());
        if(output.path("deteriorationComposite") instanceof ObjectNode composite)composite.putNull("scorePercent");
        var priorities=output.putArray("patientReviewSummary");
        for(String key:List.of("anemia","hyperkalemia","dialysisAdequacy","renalTrajectory","renalDeterioration","kidneyFailureStatus","cardiovascularMonitoring")){
            var module=(ObjectNode)output.path(key);var c=(ObjectNode)(key.equals("cardiovascularMonitoring")?module:module.path("clinicalAssessment"));
            if(!c.has("rule"))c.set("rule",ClinicalRuleRegistry.rule(key.equals("cardiovascularMonitoring")?"CARDIOVASCULAR_SURVEILLANCE":key.equals("renalDeterioration")?"ACUTE_CREATININE_REVIEW":"KIDNEY_STATUS_REVIEW"));
            var coverage=c.putObject("coverage").put("outputType","INPUT_COVERAGE");var required=coverage.putArray("requiredInputs");int recorded=0;
            for(JsonNode requirement:c.path("requirements"))if(requirement.path("required").asBoolean(true)){
                boolean has=requirement.path("recorded").asBoolean(requirement.path("satisfied").asBoolean());
                JsonNode original=output.path("clinicalFeatureData").path("current").path(requirement.path("key").asText());
                if(original.hasNonNull("originalValue")||original.hasNonNull("value"))has=true;
                var item=requirement.deepCopy();((ObjectNode)item).put("recorded",has);required.add(item);if(has)recorded++;
            }
            coverage.put("recordedCount",recorded).put("requiredCount",required.size()).put("percent",required.isEmpty()?0:Math.round(recorded*100.0/required.size())).put("label",recorded+" of "+required.size()+" listed inputs recorded").put("meaning","Recorded-input coverage only; not evidence quality, model readiness or event risk.");
            var quality=c.putObject("evidenceQuality");var warnings=quality.putArray("warnings");var evidence=quality.putArray("evidence");
            for(JsonNode requirement:required)if(requirement.path("recorded").asBoolean()&&!requirement.path("satisfied").asBoolean())warnings.add(requirement.path("label").asText()+": "+requirement.path("detail").asText());
            for(JsonNode f:c.path("featuresUsed")){evidence.add(f.deepCopy());if(!f.path("key").asText().equals("age")&&!f.path("observedAt").isTextual())warnings.add(f.path("label").asText()+": measurement date unverified");if(f.path("state").asText().equals("STALE"))warnings.add(f.path("label").asText()+": historical measurement; current relevance unverified");for(JsonNode flag:f.path("qualityFlags"))if(!flag.asText().equals("MISSING_CLINICAL_DATE"))warnings.add(flag.asText());}
            for(JsonNode excluded:output.path("clinicalFeatureData").path("excludedData"))for(JsonNode requirement:required)if(requirement.path("key").equals(excluded.path("key")))warnings.add(excluded.path("label").asText()+": excluded conflicting/invalid source; reconcile original evidence");
            if(c.has("bloodPressurePair")&&!c.path("bloodPressurePair").path("verified").asBoolean())warnings.add("Blood pressure components are not a verified paired reading; separate provenance retained");
            for(JsonNode f:c.path("trend").path("points"))if(f.path("observedAt").equals(c.path("trend").path("currentAt"))||f.path("observedAt").equals(c.path("trend").path("previousAt")))evidence.add(f.deepCopy());
            quality.put("status",warnings.isEmpty()?evidence.isEmpty()?"NOT_ASSESSED":"DATES_UNITS_SOURCES_RECORDED":"SOURCE_REVIEW_REQUIRED");
            if(!c.has("clinicalSignal"))signal(c,c.path("status").asText(),c.path("resultTitle").asText(),c.path("riskLevel").asText("Not assessed"),c.path("acuteReviewSignal").asBoolean()?"CLINICAL_REVIEW":"EVIDENCE_REVIEW",c.path("acuteReviewSignal").asBoolean());
            ((ObjectNode)c.path("clinicalSignal")).put("outputType",c.path("rule").path("outputType").asText());
            if(!c.has("trend"))c.putObject("trend").put("ready",false).put("message","No comparable dated trend is established for this output").putNull("currentValue").putNull("previousValue").putNull("percentChange");
            if(key.equals("dialysisAdequacy")&&!c.path("currentValue").isNumber()){module.put("canRun",false).putNull("forecast").putNull("researchRiskScore");}
            var prediction=c.putObject("prediction").put("outputType","UNAVAILABLE");prediction.putNull("value").putNull("eventProbability").putNull("researchScore");
            JsonNode research=module.path("researchReadiness");String model=module.path("modelKey").asText("");
            prediction.put("status",model.isBlank()?"MODEL_UNAVAILABLE":research.path("ready").asBoolean()?"RESEARCH_MODEL_VALIDATION_INCOMPLETE":"MISSING_REQUIRED_INFORMATION").put("ready",!model.isBlank()&&module.path("canRun").asBoolean()).put("clinicalValidation","NOT_COMPLETED");
            prediction.put("reason",model.isBlank()?key.equals("cardiovascularMonitoring")?"Cardiovascular event risk not estimated—risk-factor review available.":"No appropriate event prediction model is installed for this output.":research.path("message").asText("Research model eligibility is not established."));
            prediction.put("outcome",model.equals("hb")?"Next-observed hemoglobin":model.equals("urr")?"Next-observed URR":model.equals("hyperkalemia")?"Next-observed pre-dialysis potassium >=5.5 mmol/L":"No supported event model");prediction.put("horizon",model.isBlank()?"Not applicable":"Immediate next observation within 14–62 days; +30 days is a display anchor");
            if(module.path("forecast").isNumber()){prediction.set("value",module.path("forecast"));prediction.put("outputType","PREDICTED_VALUE");}
            if(module.path("researchRiskScore").isNumber()){prediction.set("researchScore",module.path("researchRiskScore"));prediction.put("outputType","RESEARCH_MODEL_SCORE");}
            prediction.set("model",module.path("researchModel").deepCopy());prediction.put("unit",prediction.path("outputType").asText().equals("RESEARCH_MODEL_SCORE")?"1":c.path("unit").asText(""));
            String method=module.path("researchModel").path("method").asText();prediction.put("explanationMethod",method.contains("BASELINE")?"BASELINE":"MODEL_ATTRIBUTION_WHEN_AVAILABLE");prediction.put("baselineExplanation",method.contains("BASELINE")?"Persistence baseline repeats the latest eligible recorded measurement. It is not an anemia-event probability.":"");
            JsonNode saved=null;String latest="";
            for(JsonNode candidate:output.path("predictions"))if(candidate.path("model_key").asText().equals(model)&&candidate.path("created_at").asText().compareTo(latest)>=0){latest=candidate.path("created_at").asText();saved=candidate.path("outputs");}
            if(saved!=null){
                prediction.set("attribution",saved.path("explanation").deepCopy());prediction.set("dataQuality",saved.path("data_quality").deepCopy());prediction.set("uncertainty",saved.path("interval").deepCopy());prediction.set("artifactRevision",saved.path("artifact_revision").deepCopy());prediction.set("trainingRunId",saved.path("training_run_id").deepCopy());prediction.put("evaluatedAt",latest);
                prediction.put("explanationMethod",saved.path("explanation").path("method").asText(prediction.path("explanationMethod").asText()));
                if(saved.path("method").asText().equals("PERSISTENCE_BASELINE"))prediction.put("baselineExplanation","Persistence baseline repeats the latest eligible recorded measurement. It is not an anemia-event probability.");
            }
            if(key.equals("dialysisAdequacy")&&!c.path("currentValue").isNumber())prediction.put("ready",false).put("status","MISSING_REQUIRED_INFORMATION").put("reason","Verified same-session urea collection timing, source, patient and units are required before a URR forecast can run.");
            if(module.path("researchStatus").asText().equals("ERROR")||saved!=null&&saved.path("status").asText().equals("ERROR"))prediction.put("status","ERROR").put("reason","Inference service failed or is unavailable; existing recorded measurements and clinical findings remain visible.");
            if(module.path("researchStatus").asText().equals("NOT_INSTALLED"))prediction.put("status","MODEL_UNAVAILABLE").put("reason","The selected research model is not installed; no fallback probability or category is generated.");
            if(!model.isBlank()&&output.path("kidneyFailureStatus").path("dialysisStatus").asText().equals("NOT_ON_MAINTENANCE_HD"))prediction.put("status","OUTSIDE_ELIGIBLE_POPULATION").put("ready",false).put("reason","The maintenance-hemodialysis research model does not apply to verified nondialysis context.");
            var explanation=c.putObject("explanation").put("method",c.path("method").asText()).put("ruleId",c.path("rule").path("id").asText()).put("version",ClinicalRuleRegistry.VERSION);explanation.set("statements",c.path("explanations").deepCopy());explanation.set("evidence",evidence.deepCopy());explanation.set("limitations",warnings.deepCopy());explanation.set("patientContext",output.path("clinicalFeatureData").path("clinicalContext").deepCopy());
            c.putObject("review").put("status","AWAITING_REVIEW").put("priority",c.path("clinicalSignal").path("reviewPriority").asText()).put("note","");
            for(String field:List.of("coverage","evidenceQuality","clinicalSignal","trend","prediction","explanation","review"))if(c.has(field))module.set(field,c.get(field).deepCopy());
            if(c.path("clinicalSignal").path("abnormal").asBoolean()||!warnings.isEmpty())priorities.addObject().put("module",key).put("finding",c.path("clinicalSignal").path("label").asText()).put("priority",c.path("clinicalSignal").path("reviewPriority").asText()).put("evidenceQuality",quality.path("status").asText()).put("sourceSnapshot",output.path("snapshotId").asText());
        }
        var ordered=new ArrayList<JsonNode>();priorities.forEach(ordered::add);ordered.sort(Comparator.comparingInt(n->switch(n.path("priority").asText()){case "PROMPT_VERIFICATION_AND_REVIEW"->0;case "CLINICAL_REVIEW"->1;case "SOURCE_VERIFICATION"->2;default->3;}));priorities.removeAll();ordered.forEach(priorities::add);
    }
    private static Double value(JsonNode f){return f.path("available").asBoolean()&&f.path("value").isNumber()?f.path("value").asDouble():null;}
    static void bindSnapshot(ObjectNode output,String id){
        for(String key:List.of("anemia","hyperkalemia","dialysisAdequacy","renalTrajectory","renalDeterioration","kidneyFailureStatus","cardiovascularMonitoring")){
            var module=(ObjectNode)output.path(key);var c=(ObjectNode)(key.equals("cardiovascularMonitoring")?module:module.path("clinicalAssessment"));
            if(c.path("explanation") instanceof ObjectNode explanation)explanation.put("snapshotId",id);
            if(!key.equals("cardiovascularMonitoring"))module.set("explanation",c.path("explanation").deepCopy());
        }
        for(JsonNode finding:output.path("patientReviewSummary"))if(finding instanceof ObjectNode item)item.put("sourceSnapshot",id);
    }
    static ObjectNode fhirContract(ObjectNode output){
        var contract=JSON.createObjectNode().put("schemaVersion",output.path("schemaVersion").asInt()).put("snapshotId",output.path("snapshotId").asText()).put("rulesVersion",output.path("clinicalRulesVersion").asText());
        var results=contract.putObject("results");
        for(String key:List.of("anemia","hyperkalemia","dialysisAdequacy","renalTrajectory","renalDeterioration","kidneyFailureStatus","cardiovascularMonitoring")){
            JsonNode c=key.equals("cardiovascularMonitoring")?output.path(key):output.path(key).path("clinicalAssessment");var result=results.putObject(key);
            for(String field:List.of("coverage","evidenceQuality","clinicalSignal","trend","prediction","explanation","review","rule"))result.set(field,c.path(field).deepCopy());
        }
        return contract;
    }
    private static String relevance(JsonNode f){return !f.path("observedAt").isTextual()?"MEASUREMENT_DATE_UNVERIFIED":f.path("state").asText().equals("STALE")?"HISTORICAL_CURRENT_RELEVANCE_UNVERIFIED":"RECORDED_COLLECTION_TIME";}
    private static void recorded(ObjectNode r,JsonNode f,double value,String unit){r.put("status","CALCULATED").put("currentValue",value).put("unit",unit);r.set("currentAt",f.path("observedAt"));}
    private static ObjectNode signal(ObjectNode r,String code,String label,String severity,String priority,boolean abnormal){return r.putObject("clinicalSignal").put("outputType","MEASUREMENT_SEVERITY_OR_REVIEW_SIGNAL").put("code",code).put("label",label).put("severity",severity).put("reviewPriority",priority).put("abnormal",abnormal).putNull("eventProbability");}
}
