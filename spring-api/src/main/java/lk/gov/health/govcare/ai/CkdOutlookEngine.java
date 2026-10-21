package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.*;
import lk.gov.health.govcare.ai.predictive.KfreFourVariableEquation;
import java.time.*;
import java.util.*;

/** Pure, reproducible long-term assessment; no inference calls, imputation or future lab curves. */
public final class CkdOutlookEngine {
    public static final String VERSION = "GOVCARE-CKD-OUTLOOK-1.1";
    private static final ObjectMapper JSON = new ObjectMapper();
    private CkdOutlookEngine() {}
    public record Confirmation(String sexForEquation, boolean confirmedChronicCkd,
        boolean noKidneyReplacementTherapy, boolean clinicallyStable, String sourceNote) {}

    /** Packaged offline audit conclusion, not a training trigger or a patient risk. */
    public static ObjectNode learnedModelReadiness() {
        try(var in=CkdOutlookEngine.class.getResourceAsStream("/cdss/current_five_year_readiness.json")) {
            if(in==null)throw new IllegalStateException("Missing readiness audit");
            JsonNode value=JSON.readTree(in);
            if(!"CDSS-SURVIVAL-1".equals(value.path("schema_version").asText())||!"INSUFFICIENT_LONG_TERM_OUTCOME_DATA".equals(value.path("status").asText()))throw new IllegalStateException("Unreviewed readiness state");
            ObjectNode out=((ObjectNode)value).deepCopy();
            out.putNull("probability").putNull("modelVersion").putNull("curve").put("method","NOT_INSTALLED").put("horizonYears",5)
                .put("endpoint","First maintenance kidney replacement therapy").put("validationStatus","NOT_COMPLETED").put("unit","probability");
            return out;
        } catch(Exception ignored) {
            var out=JSON.createObjectNode().put("status","NOT_AVAILABLE").putNull("probability").putNull("curve");
            out.putArray("reasons").add("Reviewed five-year model readiness evidence is unavailable. Continue eligible published-equation assessment.");return out;
        }
    }

    public static ObjectNode model() {
        ObjectNode m=JSON.createObjectNode().put("key","kfre_four_variable_nna").put("version",KfreFourVariableEquation.VERSION)
            .put("name","Four-variable KFRE").put("method","PUBLISHED_RISK_EQUATION")
            .put("outcome","Kidney failure requiring dialysis or transplantation within the stated horizon")
            .put("population","Adults with confirmed CKD G3–G5 who have not received kidney replacement therapy")
            .put("calibration","Published non-North American calibration (2016); not calibrated to this hospital")
            .put("externalValidation","Published multinational validation; implementation accuracy checked independently")
            .put("localValidation","NOT_COMPLETED").put("deploymentStatus","RESEARCH_PREVIEW")
            .put("riskUnit","PROBABILITY_0_1").put("reference",KfreFourVariableEquation.REFERENCE)
            .put("calculatorReference","https://kidneyfailurerisk.com/");
        m.putArray("horizonsYears").add(2).add(5);
        m.putNull("confidenceInterval");
        m.put("uncertainty","No individual prediction interval is supplied. Local calibration and competing mortality may affect interpretation; these are not survival probabilities.");
        m.put("inputPolicy","GovCare policy: age 18–120; eGFR >0 and <60; positive quantified urine ACR ≤100000 mg/g. Dated eGFR/ACR within 90 days and no more than 30 days apart. Verify CKD, equation sex variable, absence of all KRT, and stable context.");
        m.put("thresholdReference","KDIGO 2024 practice points 2.2.1–2.2.3; thresholds guide clinical review alongside other criteria.");
        return m;
    }

    /** Input is already the authorized V49 source projection; its invalid/undated states remain authoritative. */
    public static ObjectNode evidence(JsonNode modules, Map<String,Object> patient, boolean recentAdmission, Instant now) {
        ObjectNode e=JSON.createObjectNode();
        var inputs=e.putObject("inputs");
        Integer age=null;
        try {var born=LocalDate.parse(Objects.toString(patient.get("date_of_birth")));int years=Period.between(born,now.atZone(ZoneOffset.UTC).toLocalDate()).getYears();if(years>=0&&years<=120&&!born.isAfter(now.atZone(ZoneOffset.UTC).toLocalDate()))age=years;} catch(RuntimeException ignored) {}
        var a=inputs.putObject("age").put("label","Age").put("unit","years").put("source","Patient date of birth");
        if(age==null)a.putNull("value");else a.put("value",age);
        a.put("state",age==null?"MISSING":"AVAILABLE");
        String recorded=Objects.toString(patient.get("gender"),"");
        String sex=switch(recorded.toLowerCase(Locale.ROOT)){case "male","m"->"MALE";case "female","f"->"FEMALE";default->null;};
        var s=inputs.putObject("sex").put("label","Equation sex variable").put("source","Recorded demographic field; clinician confirmation required").put("recordedValue",recorded).put("state",sex==null?"MISSING":"REQUIRES_CONFIRMATION");
        if(sex==null)s.putNull("value");else s.put("value",sex);
        for(String key:List.of("egfr","acr")) {
            JsonNode f=modules.path("clinicalFeatureData").path("current").path(key);
            ObjectNode value=f.isObject()?((ObjectNode)f).deepCopy():JSON.createObjectNode().putNull("value").put("state","MISSING");
            value.put("label",key.equals("acr")?"Urine ACR":"eGFR");
            if(!value.hasNonNull("unit"))value.put("unit",key.equals("acr")?"mg/g":"mL/min/1.73m2");
            inputs.set(key,value);
        }
        e.set("history",modules.path("clinicalFeatureData").path("history").deepCopy());
        e.set("excludedData",modules.path("clinicalFeatureData").path("excludedData").deepCopy());
        String dialysis=modules.path("kidneyFailureStatus").path("dialysisStatus").asText("UNCONFIRMED");
        e.put("dialysisStatus",dialysis);
        e.set("dialysisVerifiedAt",modules.path("kidneyFailureStatus").path("lastVerifiedDate").deepCopy());
        e.put("maintenanceDialysis",dialysis.equals("VERIFIED_MAINTENANCE_HEMODIALYSIS")||dialysis.equals("MAINTENANCE_HD"));
        e.put("historyTruncated",modules.path("clinicalFeatureData").path("historyTruncated").asBoolean()||modules.path("dataQuality").path("historyTruncated").asBoolean());
        e.put("recentAdmission",recentAdmission);
        e.put("acuteReviewSignal",modules.path("akiRisk").path("acuteReviewSignal").asBoolean());
        e.put("creatinineSourceInvalid",modules.path("clinicalFeatureData").path("current").path("creatinine").path("state").asText().equals("INVALID"));
        double gfr=inputs.path("egfr").path("value").asDouble(Double.NaN);
        e.put("stage",e.path("maintenanceDialysis").asBoolean()?"G5D":Double.isFinite(gfr)&&gfr>0&&!inputs.path("egfr").path("state").asText().equals("INVALID")?gfr>=90?"G1":gfr>=60?"G2":gfr>=45?"G3a":gfr>=30?"G3b":gfr>=15?"G4":"G5":"Unknown");
        e.put("sourceSnapshotId",modules.path("snapshotId").asText());
        var identity=e.deepCopy();identity.remove(List.of("sourceSnapshotId","history","excludedData"));
        // JSONB may reorder nested properties on reload. Hash semantic evidence,
        // not serializer insertion order, so unchanged evidence stays calculable.
        e.put("fingerprint",ClinicalIntelligenceEngine.sha256(canonical(identity).toString()));
        var monitoring=e.putArray("monitoring");
        for(String key:List.of("anemia","hyperkalemia","dialysisAdequacy","renalDeterioration","cardiovascularMonitoring")) {
            JsonNode module=modules.path(key), clinical=module.has("clinicalAssessment")?module.path("clinicalAssessment"):module;
            var item=monitoring.addObject().put("key",key).put("title",clinical.path("title").asText(module.path("label").asText(key)))
                .put("status",clinical.path("riskLevel").asText("Monitoring evidence")).put("longTermStatus","NOT_INSTALLED")
                .put("horizon","Five-year prediction unavailable; current monitoring remains available.");
            item.put("supportedHorizon",Set.of("anemia","hyperkalemia","dialysisAdequacy").contains(key)?"Current monitoring; eligible HD research targets the next 14–62-day observation (+30-day display anchor).":"Current surveillance; no validated future-event model installed.");
            item.set("currentValue",clinical.path("currentValue").deepCopy());item.put("unit",clinical.path("unit").asText(""));
        }
        return e;
    }

    public static ObjectNode assess(ObjectNode evidence, Confirmation confirmation, Instant now) {
        var result=JSON.createObjectNode().put("schemaVersion",1).put("ruleVersion",VERSION).put("assessedAt",now.toString());
        result.set("model",model());result.set("evidence",evidence.deepCopy());
        result.set("learnedModel",learnedModelReadiness());
        result.putNull("twoYearRisk").putNull("fiveYearRisk").putNull("riskCategory");
        var missing=result.putArray("missingInputs");var blocks=result.putArray("reasons");
        JsonNode inputs=result.path("evidence").path("inputs");
        int present=0;
        for(String key:List.of("age","sex","egfr","acr"))if(inputs.path(key).hasNonNull("value"))present++;else missing.add(key);
        boolean confirmedSex=confirmation!=null&&Set.of("MALE","FEMALE").contains(Objects.toString(confirmation.sexForEquation(),""));
        if(confirmedSex&&!inputs.path("sex").hasNonNull("value")){present++;for(int i=missing.size()-1;i>=0;i--)if(missing.get(i).asText().equals("sex"))missing.remove(i);}
        result.putObject("completeness").put("available",present).put("required",4).put("percent",present*25).put("meaning","Presence of four equation inputs; separate from eligibility and validation");
        boolean notApplicable=evidence.path("maintenanceDialysis").asBoolean();
        if(notApplicable)blocks.add("Kidney-failure initiation risk is not applicable: maintenance hemodialysis is already verified. Continue dialysis follow-up; no long-term dialysis outcome model is installed.");
        if(inputs.path("age").hasNonNull("value")&&inputs.path("age").path("value").asInt()<18){notApplicable=true;blocks.add("The adult equation is not enabled for children.");}
        if(inputs.path("egfr").hasNonNull("value")&&inputs.path("egfr").path("value").asDouble()>=60){notApplicable=true;blocks.add("This equation is enabled for CKD G3–G5; it is not applied to G1–G2.");}
        if(missing.size()>0)blocks.add("Required equation inputs are missing. Missing information is not zero risk.");
        for(String key:List.of("egfr","acr")) {
            JsonNode v=inputs.path(key);if(!v.hasNonNull("value"))continue;
            if(!v.path("value").isNumber()||!Double.isFinite(v.path("value").asDouble())||v.path("value").asDouble()<=0)blocks.add(key.equals("acr")?"Urine ACR must be a quantified positive value; clarify a zero or censored laboratory result.":"A positive numeric eGFR is required.");
            Instant at=time(v.path("observedAt"));
            if(v.path("state").asText().equals("INVALID")||at==null||at.isAfter(now)||at.isBefore(now.minus(Duration.ofDays(90))))blocks.add(key.equals("acr")?"Urine ACR requires a valid, verified source date within 90 days.":"eGFR requires a valid, verified source date within 90 days.");
            if(key.equals("acr")&&!v.path("unit").asText().equals("mg/g"))blocks.add("The recorded urine ACR must be normalized to mg/g by the clinical source pipeline.");
            if(key.equals("egfr")&&!Set.of("mL/min/1.73m2","mL/min/1.73m²").contains(v.path("unit").asText()))blocks.add("eGFR source units require reconciliation.");
        }
        Instant g=time(inputs.path("egfr").path("observedAt")), a=time(inputs.path("acr").path("observedAt"));
        if(g!=null&&a!=null&&Duration.between(g,a).abs().compareTo(Duration.ofDays(30))>0)blocks.add("eGFR and urine ACR are more than 30 days apart; reconcile the clinical assessment period (GovCare policy).");
        if(evidence.path("historyTruncated").asBoolean())blocks.add("History retrieval is truncated; reconcile the evidence before long-term assessment.");
        if(evidence.path("acuteReviewSignal").asBoolean()||evidence.path("recentAdmission").asBoolean()||evidence.path("creatinineSourceInvalid").asBoolean())blocks.add("Acute change, recent hospital context, or unresolved creatinine evidence requires source and clinical review first.");
        result.put("canCalculateAfterConfirmation",blocks.isEmpty()||(blocks.size()==1&&missing.size()==1&&missing.get(0).asText().equals("sex")));
        if(!blocks.isEmpty()) {
            result.put("status",notApplicable?"NOT_APPLICABLE":missing.size()>0?"INSUFFICIENT_DATA":"SOURCE_REVIEW_REQUIRED");
            result.put("eligibility",notApplicable?"OUTSIDE_POPULATION":"NOT_ESTABLISHED");
        } else if(confirmation==null||!confirmedSex||!confirmation.confirmedChronicCkd()||!confirmation.noKidneyReplacementTherapy()||!confirmation.clinicallyStable()) {
            result.put("status","CLINICAL_CONTEXT_REQUIRED").put("eligibility","CLINICIAN_CONFIRMATION_REQUIRED");
            blocks.add("Confirm chronic CKD, the equation sex variable, absence of any previous/current kidney replacement therapy, and stable clinical context.");
        } else {
            try {
                var risk=KfreFourVariableEquation.calculate(inputs.path("age").path("value").asInt(),confirmation.sexForEquation(),inputs.path("egfr").path("value").asDouble(),inputs.path("acr").path("value").asDouble(),"mg/g");
                result.put("status","AVAILABLE").put("eligibility","CLINICIAN_CONFIRMED").put("twoYearRisk",risk.twoYearRisk()).put("fiveYearRisk",risk.fiveYearRisk());
                ((ObjectNode)inputs.path("sex")).put("value",confirmation.sexForEquation()).put("state","CLINICIAN_CONFIRMED").put("source","Clinician-confirmed equation variable").put("observedAt",now.toString());
                result.set("confirmation",JSON.valueToTree(confirmation));
                result.put("riskCategory",risk.twoYearRisk()>0.40?"KRT_PLANNING_REVIEW":risk.twoYearRisk()>0.10?"MULTIDISCIPLINARY_REVIEW":risk.fiveYearRisk()>=0.03?"NEPHROLOGY_REVIEW":"INDIVIDUALIZED_MONITORING");
            } catch(IllegalArgumentException error) {result.put("status","SOURCE_REVIEW_REQUIRED").put("eligibility","NOT_ESTABLISHED");blocks.add(error.getMessage());}
        }
        result.put("interpretation",result.path("status").asText().equals("AVAILABLE")?"Published equation estimate of treated kidney failure within two and five years. Clinical events, future laboratory values and survival are not determined by this estimate.":notApplicable?"Continue dialysis-specific monitoring and clinical planning. A future dialysis start is not a meaningful outcome for this context.":"A five-year probability is not available from the current eligible evidence and clinical confirmation.");
        result.putArray("limitations").add("Local clinical validation is not completed; this integration is a research preview.")
            .add("No five-year eGFR, anemia, potassium, cardiovascular, dialysis adequacy or survival model is installed.")
            .add("Two- and five-year risks are separate event estimates, not annual rates or dates of dialysis.")
            .add("Current treatment, competing mortality and population calibration require clinician interpretation.");
        result.put("resultType",result.path("status").asText().equals("AVAILABLE")?"PUBLISHED_EQUATION_ESTIMATE":"INSUFFICIENT_EVIDENCE");
        return result;
    }

    static JsonNode canonical(JsonNode value) {
        if(value.isObject()) {
            ObjectNode out=JSON.createObjectNode();var keys=new TreeSet<String>();value.fieldNames().forEachRemaining(keys::add);
            for(String key:keys)out.set(key,canonical(value.get(key)));return out;
        }
        if(value.isArray()) {var out=JSON.createArrayNode();for(JsonNode item:value)out.add(canonical(item));return out;}
        if(value.isNumber())return JSON.getNodeFactory().numberNode(value.decimalValue().stripTrailingZeros());
        return value.deepCopy();
    }
    static Instant time(JsonNode v) {try{return v.isTextual()?Instant.parse(v.asText()):null;}catch(RuntimeException ignored){return null;}}
}
