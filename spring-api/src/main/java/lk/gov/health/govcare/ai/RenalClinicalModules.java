package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** Deterministic projection of verified observations and stored model outputs. Never invokes ML. */
public final class RenalClinicalModules {
    public static final String VERSION = "LK-RENAL-MODULES-1.2";
    public static final List<String> ORDER = List.of("renalTrajectory", "kidneyFailureStatus", "hyperkalemia", "anemia", "dialysisAdequacy", "renalDeterioration");
    private static final ObjectMapper MAPPER = new ObjectMapper().findAndRegisterModules()
            .disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    private static final List<String> METRICS = List.of("creatinine_pre", "urea_pre", "potassium_pre", "hb", "albumin", "urr");
    private static final List<String> LABELS = List.of("Creatinine", "Urea", "Potassium", "Hemoglobin", "Albumin", "URR");
    private static final Map<String,String> UNITS = Map.ofEntries(Map.entry("hb","g/dL"), Map.entry("albumin","g/L"),
            Map.entry("urea_pre","mmol/L"), Map.entry("urea_post","mmol/L"), Map.entry("creatinine_pre","umol/L"),
            Map.entry("creatinine_post","umol/L"), Map.entry("potassium_pre","mmol/L"), Map.entry("potassium_post","mmol/L"),
            Map.entry("calcium","mmol/L"), Map.entry("sodium","mmol/L"), Map.entry("dry_weight","kg"), Map.entry("urr","%"));
    private RenalClinicalModules() {}
    private record Point(UUID id, Instant at, double value, String source) {}

    public static ObjectNode assemble(SriLankanRenalIntelligenceService.Overview data, List<Map<String,Object>> registry, Instant now) {
        ObjectNode result = MAPPER.createObjectNode();
        result.put("schemaVersion", 2); result.put("ruleVersion", VERSION);
        result.put("patientId", data.patientId().toString()); result.put("hospitalId", data.hospitalId().toString());
        result.put("generatedAt", now.toString()); result.put("canReview", data.canReview());
        result.set("moduleOrder", MAPPER.valueToTree(ORDER));
        List<String> flags = new ArrayList<>();
        List<SriLankanRenalIntelligenceService.ObservationView> rows = canonical(data.observations(), now, flags);
        ArrayNode excluded=result.putArray("excludedObservations");Set<UUID> retained=new HashSet<>();rows.forEach(row->retained.add(row.id()));
        for(var source:data.observations())if(!retained.contains(source.id()))excluded.addObject().put("sourceId",source.id().toString()).put("observedAt",source.observedAt().toString()).put("reason","INVALID_OR_DUPLICATE_OBSERVATION_DATE");
        if (data.historyTruncated()) flags.add("HISTORY_TRUNCATED");
        result.set("observations", MAPPER.valueToTree(rows)); result.set("predictions", MAPPER.valueToTree(data.predictions()));
        result.set("currentRenalStatus", MAPPER.valueToTree(data.currentRenalStatus())); result.put("historyTruncated", data.historyTruncated());
        List<ObjectNode> domains = new ArrayList<>(); int evaluated=0, adverse=0, improving=0;
        for (int i=0;i<METRICS.size();i++) {
            String key=METRICS.get(i); ObjectNode t = trend(rows, key, LABELS.get(i));
            boolean canEvaluate=t.path("usablePoints").asInt()>=2;
            String direction=t.path("trendDirection").asText();
            String worsening=i<3?"RISING":"FALLING";
            boolean worse=canEvaluate && worsening.equals(direction);
            t.put("metric",key); t.put("adverseDirection",worsening); t.put("evaluable",canEvaluate); t.put("worsening",worse);
            if(canEvaluate) { evaluated++; if(worse)adverse++; else if(!"STABLE".equals(direction))improving++; }
            domains.add(t);
        }
        String trajectory=evaluated==0?"INSUFFICIENT_DATA":evaluated<3?"PARTIAL_TRAJECTORY":adverse>0&&improving>0?"MIXED":adverse>0?"DECLINING":improving>0?"IMPROVING":"STABLE";
        ObjectNode renal=base("renalTrajectory","Renal Clinical Trajectory","Longitudinal Trend");
        renal.put("status",evaluated==0?"INSUFFICIENT_DATA":"AVAILABLE"); renal.put("signal",trajectory); renal.set("domains",MAPPER.valueToTree(domains));
        renal.put("usablePoints",rows.size()); renal.put("evaluableDomains",evaluated); renal.put("dataReliability",reliability(rows.size(),flags));
        renal.set("limitations",MAPPER.valueToTree(List.of("Directions compare the two latest valid values per domain using a 1% neutral band; this is not a prognosis or a G1-to-G5 forecast.","Dialysis timing, clinical context and measurement uncertainty require clinician interpretation.")));
        result.set("renalTrajectory",renal);
        ObjectNode kidney=base("kidneyFailureStatus","Kidney Failure / G5D","Clinical Rule");
        var last=rows.isEmpty()?null:rows.get(rows.size()-1);
        var statusContext=data.currentRenalStatus();
        boolean recordedContext=statusContext.dialysisStatus()!=null;
        boolean dialysis=recordedContext?"MAINTENANCE_HD".equals(statusContext.dialysisStatus()):last!=null && last.maintenanceHemodialysisVerified();
        boolean g5="G5".equals(data.currentRenalStatus().stage()) && data.currentRenalStatus().basis()!=null
                && data.currentRenalStatus().basis().contains("PERSISTENT_ABNORMAL_MEASUREMENTS");
        // G5D always requires a current explicit verified maintenance-HD source. A creatinine result cannot set this state.
        kidney.put("status",dialysis||g5?"AVAILABLE":"INSUFFICIENT_DATA");
        kidney.put("signal",dialysis?"CKD G5D – Kidney Failure on Dialysis":g5?"G5 eGFR evidence – clinician confirmation required":"Insufficient clinical evidence");
        kidney.put("renalStatus",dialysis?"G5D":g5?"G5":"UNCONFIRMED"); kidney.put("dialysisStatus",dialysis?"VERIFIED_MAINTENANCE_HEMODIALYSIS":recordedContext?statusContext.dialysisStatus():"NOT_VERIFIED");
        kidney.put("evidenceSource",recordedContext?statusContext.dialysisEvidence():dialysis?last.sourceNote():data.currentRenalStatus().basis());
        if(recordedContext)kidney.put("lastVerifiedDate",statusContext.dialysisVerifiedAt().toString());else if(dialysis)kidney.put("lastVerifiedDate",last.observedAt().toString());else kidney.putNull("lastVerifiedDate");
        kidney.put("ruleStatus",dialysis?"EXPLICIT_CLINICIAN_VERIFIED_HD":g5?"PERSISTENT_EGFR_EVIDENCE":"REQUIRES_CLINICAL_EVIDENCE");
        kidney.set("limitations",MAPPER.valueToTree(List.of("High creatinine alone does not establish G5D. This card reports recorded clinical evidence, not a diagnosis generated by AI.","No 2-year or 5-year kidney-failure probability is calculated.")));
        if(last!=null){kidney.put("usablePoints",1);kidney.put("dataReliability","VERIFIED_CLINICAL_SOURCE");kidney.withArray("sources").addObject().put("id",last.id().toString()).put("observedAt",last.observedAt().toString()).put("sourceNote",last.sourceNote());}
        if(recordedContext){kidney.put("usablePoints",1);kidney.withArray("sources").addObject().put("id",statusContext.dialysisEvidenceId().toString()).put("observedAt",statusContext.dialysisVerifiedAt().toString()).put("sourceNote",statusContext.dialysisEvidence());}
        result.set("kidneyFailureStatus",kidney);
        result.set("hyperkalemia",modelModule(data,registry,rows,"hyperkalemia","Hyperkalemia Monitoring","hyperkalemia","potassium_pre",dialysis,now));
        result.set("anemia",modelModule(data,registry,rows,"anemia","Anemia / Hb Deterioration","hb","hb",dialysis,now));
        ObjectNode urr=modelModule(data,registry,rows,"dialysisAdequacy","Dialysis Adequacy / URR","urr","urr",dialysis,now);
        urr.put("formula","URR = ((Pre-HD Urea − Post-HD Urea) / Pre-HD Urea) × 100");
        urr.set("preHdUrea",trend(rows,"urea_pre","Pre-HD Urea").get("currentValue")); urr.set("postHdUrea",trend(rows,"urea_post","Post-HD Urea").get("currentValue"));
        result.set("dialysisAdequacy",urr);
        ObjectNode composite=base("renalDeterioration","Renal Clinical Deterioration","Transparent Composite");
        String compositeStatus=evaluated<3?"INSUFFICIENT_DATA":adverse==0?"NO_ADVERSE_DIRECTION_DETECTED":adverse*2>=evaluated?"MULTIDOMAIN_WORSENING_SIGNAL":"MIXED_TRAJECTORY";
        composite.put("status",evaluated<3?"INSUFFICIENT_DATA":"AVAILABLE"); composite.put("signal",compositeStatus);
        composite.put("evaluatedComponents",evaluated);composite.put("worseningComponents",adverse);
        if(evaluated>=3)composite.put("directionalPercent",Math.round(100.0*adverse/evaluated));else composite.putNull("directionalPercent");
        composite.set("domains",MAPPER.valueToTree(domains)); composite.put("scoreKind","DIRECTIONAL_COMPONENT_PERCENTAGE");
        composite.set("limitations",MAPPER.valueToTree(List.of("Directional composite – not a validated prognosis score.","Equal weights; two latest valid observations per domain; 1% neutral stability band. Missing domains are excluded, never scored as zero.","A directional percentage is not a disease probability.")));
        result.set("renalDeterioration",composite);
        result.set("deteriorationComposite",MAPPER.valueToTree(data.deteriorationComposite()));
        ObjectNode quality=result.putObject("dataQuality");quality.put("usableObservations",rows.size());quality.put("evaluableDomains",evaluated);
        quality.put("historyTruncated",data.historyTruncated());quality.set("flags",MAPPER.valueToTree(flags.stream().distinct().sorted().toList()));
        quality.put("reliability",reliability(rows.size(),flags));
        for(String key:ORDER) {
            ObjectNode module=(ObjectNode)result.get(key); if(last==null)module.putNull("lastUpdated");else module.put("lastUpdated",last.observedAt().toString());
            module.set("dataQualityFlags",quality.get("flags"));
            if(data.historyTruncated() && !key.equals("kidneyFailureStatus")) { module.put("status","BLOCKED_BY_SAFETY_GATE");module.put("canRun",false);module.putNull("forecast");module.putNull("researchRiskScore");module.putNull("directionalPercent"); }
        }
        if(result.path("hyperkalemia").path("currentValue").isNumber() && result.path("hyperkalemia").path("currentValue").asDouble()>=8) {
            ObjectNode hyper=(ObjectNode)result.get("hyperkalemia");hyper.put("status","BLOCKED_BY_SAFETY_GATE");hyper.put("canRun",false);hyper.putNull("researchRiskScore");
            hyper.withArray("limitations").add("Extreme current potassium requires source reconciliation and prompt clinical review; research inference is blocked.");
        }
        for(String key:List.of("renalTrajectory","renalDeterioration")) {
            ArrayNode sources=((ObjectNode)result.get(key)).putArray("sources");
            for(var row:rows)sources.addObject().put("id",row.id().toString()).put("observedAt",row.observedAt().toString()).put("sourceNote",row.sourceNote());
        }
        RenalDataReadiness.attach(result,rows,registry,now);
        return result;
    }

    private static ObjectNode base(String key,String label,String method) {
        ObjectNode b=MAPPER.createObjectNode();b.put("key",key);b.put("label",label);b.put("method",method);b.put("status","INSUFFICIENT_DATA");
        for(String n:List.of("currentValue","previousValue","forecast","researchRiskScore","horizon","currentAt","previousAt","lastUpdated"))b.putNull(n);
        b.put("validationStatus","NOT_CLINICALLY_VALIDATED");b.put("requiresClinicianReview",true);b.put("reviewState","AWAITING_REVIEW");b.put("reviewVersion",0);
        b.put("signal","INSUFFICIENT_DATA");b.put("usablePoints",0);b.put("dataReliability","INSUFFICIENT");b.putArray("sources");b.putArray("topFactors");b.putArray("limitations");
        return b;
    }
    private static ObjectNode modelModule(SriLankanRenalIntelligenceService.Overview data,List<Map<String,Object>> registry,
            List<SriLankanRenalIntelligenceService.ObservationView> rows,String key,String label,String modelKey,String metric,boolean dialysis,Instant now) {
        ObjectNode b=base(key,label,modelKey.equals("hb")?"Persistence Baseline":"Longitudinal Research Model");
        ObjectNode t=trend(rows,metric,label);t.properties().forEach(e->b.set(e.getKey(),e.getValue()));
        b.put("modelKey",modelKey);
        if(!rows.isEmpty()) {
            var inputs=rows.get(rows.size()-1);b.set("inputMeasurements",MAPPER.valueToTree(inputs.measurements()));b.set("inputUnits",MAPPER.valueToTree(inputs.units()));
            if(modelKey.equals("hyperkalemia")) {
                Double pre=inputs.measurements().get("potassium_pre"),post=inputs.measurements().get("potassium_post");
                if(post!=null)b.put("postHdPotassium",post);else b.putNull("postHdPotassium");
                if(pre!=null&&post!=null)b.put("potassiumDifference",pre-post);else b.putNull("potassiumDifference");
            }
        }

        Map<String,Object> meta=registry.stream().filter(r->modelKey.equals(r.get("model_key"))).findFirst().orElse(Map.of());
        b.put("modelStatus",RenalDataReadiness.installed(meta)?"RESEARCH_MODEL":"NOT_INSTALLED");
        b.put("model",Objects.toString(meta.get("display_name"),"Reviewed artifact not installed"));b.put("modelVersion",Objects.toString(meta.get("version"),"Unavailable"));
        b.put("validationStatus","INTERNALLY_VALIDATED");b.put("clinicalValidationStatus","NOT_CLINICALLY_VALIDATED");
        b.put("population","Sri Lankan maintenance-hemodialysis longitudinal research cohort");
        b.put("disclaimer",modelKey.equals("hyperkalemia")?"Research model – not clinically validated":modelKey.equals("urr")?"Research model – clinician review required":"Persistence baseline – not a validated anemia prognosis");
        List<String> limitations=new ArrayList<>(); limitations.add("Research outputs require clinician interpretation; internal evaluation is not independent clinical validation.");
        limitations.add("Dataset permission status remains UNVERIFIED.");
        if(modelKey.equals("hb"))limitations.add("Learned candidates failed the gate against persistence. Carries forward the last measured Hb; no anemia-classifier probability is installed.");
        b.put("signal",t.path("usablePoints").asInt()<2?"INSUFFICIENT_DATA":modelKey.equals("hb")?t.path("trendDirection").asText().equals("FALLING")?"DECLINING_HB_SIGNAL":t.path("trendDirection").asText().equals("RISING")?"IMPROVING_HB_TREND":"STABLE_HB":t.path("trendDirection").asText());
        if(modelKey.equals("hyperkalemia") && t.path("currentValue").isNumber() && t.path("currentValue").asDouble()>=5.5)b.put("signal","CURRENT_POTASSIUM_REVIEW_SIGNAL");
        boolean ready=RenalDataReadiness.forecastReady(rows,meta,metric,now);b.put("canRun",dialysis&&ready&&"RESEARCH_MODEL".equals(b.path("modelStatus").asText()));
        b.put("status",!dialysis?"NOT_APPLICABLE":"NOT_INSTALLED".equals(b.path("modelStatus").asText())?"NOT_INSTALLED":!ready?"INSUFFICIENT_DATA":"RESEARCH_MODEL");
        if(!dialysis)limitations.add("This installed model is scoped to verified maintenance hemodialysis. No applicable dialysis context is recorded.");
        if(!ready)limitations.add("Requires two fresh verified HD observations 14–62 days apart, a current target result and five supported predictor values.");
        var p=data.predictions().stream().filter(x->modelKey.equals(x.modelKey())).max(Comparator.comparing(SriLankanRenalIntelligenceService.PredictionView::createdAt)).orElse(null);
        if(p!=null) {
            b.put("predictionId",p.id().toString());b.put("predictionStatus",p.status());b.put("reviewState",p.reviewState());b.put("reviewVersion",p.reviewVersion());
            JsonNode out=p.outputs();b.put("model",out.path("model").asText(b.path("model").asText()));b.put("modelVersion",out.path("model_version").asText());
            b.put("method",out.path("method").asText().equals("PERSISTENCE_BASELINE")?"Persistence Baseline":"Longitudinal Research Model");
            b.put("algorithm",out.path("algorithm").asText()); b.set("explanation",out.path("explanation"));b.set("topFactors",out.path("explanation").path("top_factors"));
            out.path("explanation").path("limitations").forEach(x->limitations.add(x.asText()));
            boolean current=false;
            try {current=!rows.isEmpty()&&Instant.parse(out.path("forecast_origin_date").asText()).equals(rows.get(rows.size()-1).observedAt());}catch(Exception ignored){}
            if(!current)limitations.add("Stored prediction input is superseded by newer observations or its source date cannot be verified. Run again before interpreting it as current.");
            if(dialysis&&ready&&current&&"AVAILABLE".equals(p.status())) {
                b.put("status","AVAILABLE"); b.set("horizon",out.path("horizon_definition"));b.set("forecastDate",out.path("forecast_date"));
                if(modelKey.equals("hyperkalemia")&&out.path("probability").isNumber()) {b.set("researchRiskScore",out.get("probability"));b.put("scoreKind","RESEARCH_RISK_SCORE");}
                if(!modelKey.equals("hyperkalemia")&&out.path("prediction").isNumber())b.set("forecast",out.get("prediction"));
                b.set("interval",out.path("interval"));
            } else if(dialysis&&ready&&current&&!"AVAILABLE".equals(p.status())) b.put("status",p.status().equals("NOT_AVAILABLE")?"ERROR":"INSUFFICIENT_DATA");
            b.put("lastRun",p.createdAt().toString());
        }else {b.putNull("predictionId");b.put("predictionStatus","NOT_RUN");b.putNull("lastRun");}
        b.set("limitations",MAPPER.valueToTree(limitations.stream().distinct().toList()));
        return b;
    }
    private static ObjectNode trend(List<SriLankanRenalIntelligenceService.ObservationView> rows,String key,String label) {
        List<Point> points=rows.stream().filter(r->r.measurements().containsKey(key)).map(r->new Point(r.id(),r.observedAt(),r.measurements().get(key),r.sourceNote())).toList();
        ObjectNode t=MAPPER.createObjectNode();t.put("label",label);t.put("unit",UNITS.getOrDefault(key,""));t.put("usablePoints",points.size());
        t.putNull("currentValue");t.putNull("previousValue");t.putNull("currentAt");t.putNull("previousAt");t.putNull("absoluteChange");
        t.put("trendDirection","INSUFFICIENT_DATA");t.put("dataReliability",points.size()<2?"INSUFFICIENT":points.size()<3?"LIMITED":"SUPPORTED");
        ArrayNode history=t.putArray("trendPoints"),sources=t.putArray("sources");
        for(Point p:points){history.addObject().put("observedAt",p.at().toString()).put("value",p.value());sources.addObject().put("id",p.id().toString()).put("observedAt",p.at().toString()).put("sourceNote",p.source());}
        if(!points.isEmpty()){Point c=points.get(points.size()-1);t.put("currentValue",c.value());t.put("currentAt",c.at().toString());}
        if(points.size()>=2){Point c=points.get(points.size()-1),p=points.get(points.size()-2);double delta=c.value()-p.value();t.put("previousValue",p.value());t.put("previousAt",p.at().toString());t.put("absoluteChange",delta);t.put("trendDirection",Math.abs(delta)/Math.max(Math.abs(p.value()),1e-9)<=.01?"STABLE":delta>0?"RISING":"FALLING");}
        return t;
    }
    private static String reliability(int n,List<String> flags){return n<2?"INSUFFICIENT":flags.isEmpty()&&n>=3?"SUPPORTED":"LIMITED";}
    static List<SriLankanRenalIntelligenceService.ObservationView> canonical(List<SriLankanRenalIntelligenceService.ObservationView> source,Instant now,List<String> flags) {
        List<SriLankanRenalIntelligenceService.ObservationView> result=new ArrayList<>();Set<Instant> seen=new HashSet<>();
        for(var o:source.stream().sorted(Comparator.comparing(SriLankanRenalIntelligenceService.ObservationView::observedAt)).toList()) {
            if(o.observedAt().isAfter(now)||!seen.add(o.observedAt())) {flags.add("INVALID_OR_DUPLICATE_OBSERVATION_DATE");continue;}
            Map<String,Double> values=new LinkedHashMap<>();Map<String,String> units=new LinkedHashMap<>();List<String> issues=new ArrayList<>(o.dataQualityFlags());
            for(var entry:o.measurements().entrySet()) {
                if(entry.getKey().equals("urr"))continue; // Always recalculate from a paired same-session urea source.
                try {SriLankanRenalIntelligenceService.validateMeasurements(Collections.singletonMap(entry.getKey(),entry.getValue()),Collections.singletonMap(entry.getKey(),o.units().get(entry.getKey())));
                    values.put(entry.getKey(),SriLankanRenalIntelligenceService.convert(entry.getKey(),entry.getValue(),o.units().get(entry.getKey())));units.put(entry.getKey(),UNITS.get(entry.getKey()));
                }catch(Exception invalid){issues.add("INVALID_VALUE_OR_UNIT_"+entry.getKey().toUpperCase());}
            }
            if(values.containsKey("urea_pre")&&values.containsKey("urea_post")) {
                double pre=values.get("urea_pre"),post=values.get("urea_post");
                if(o.maintenanceHemodialysisVerified()&&Objects.equals(o.units().get("urea_pre"),o.units().get("urea_post"))&&pre>0&&post>=0&&post<=pre) {values.put("urr",100*(pre-post)/pre);units.put("urr","%");}
                else issues.add("PAIRED_UREA_INVALID_FOR_URR");
            }
            flags.addAll(issues);result.add(new SriLankanRenalIntelligenceService.ObservationView(o.id(),o.observedAt(),o.maintenanceHemodialysisVerified(),values,units,o.sourceNote(),issues));
        }
        if(!result.isEmpty()&&ChronoUnit.DAYS.between(result.get(result.size()-1).observedAt(),now)>62)flags.add("STALE_LATEST_OBSERVATION_OVER_62_DAYS");
        return result;
    }
}
