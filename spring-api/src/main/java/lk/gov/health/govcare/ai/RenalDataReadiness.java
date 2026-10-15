package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.*;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** Patient-data readiness is calculated once by Spring and consumed by the UI and stored-snapshot PDF. */
public final class RenalDataReadiness {
    private static final ObjectMapper JSON=new ObjectMapper();
    private static final Map<String,String> LABELS=Map.ofEntries(Map.entry("hb","Hemoglobin"),Map.entry("urr","Measured URR"),
            Map.entry("albumin","Albumin"),Map.entry("calcium","Calcium"),Map.entry("sodium","Sodium"),
            Map.entry("potassium_pre","Pre-HD Potassium"),Map.entry("potassium_post","Post-HD Potassium"),
            Map.entry("creatinine_pre","Pre-HD Creatinine"),Map.entry("creatinine_post","Post-HD Creatinine"),
            Map.entry("urea_pre","Pre-HD Urea"),Map.entry("urea_post","Post-HD Urea"));
    private RenalDataReadiness() {}
    static JsonNode node(Object value){return value instanceof JsonNode n?n:JSON.valueToTree(value);}
    static Map<String,Object> meta(List<Map<String,Object>> registry,String key){return registry.stream().filter(r->key.equals(r.get("model_key"))).findFirst().orElse(Map.of());}
    static boolean installed(Map<String,Object> meta){return "ACTIVE".equals(meta.get("runtime_status"))&&"INSTALLED".equals(meta.get("artifact_status"));}
    static boolean forecastReady(List<SriLankanRenalIntelligenceService.ObservationView> rows,Map<String,Object> metadata,String target,Instant now) {
        if(rows.isEmpty()||!installed(metadata)||!rows.getLast().maintenanceHemodialysisVerified())return false;
        JsonNode contract=node(metadata.get("serving_contract"));
        var hd=rows.stream().filter(SriLankanRenalIntelligenceService.ObservationView::maintenanceHemodialysisVerified).toList();
        if(hd.size()<contract.path("minimumObservations").asInt(Integer.MAX_VALUE))return false;
        var last=hd.getLast();double gap=Duration.between(hd.get(hd.size()-2).observedAt(),last.observedAt()).toSeconds()/86400.0;
        int supported=0;for(JsonNode p:contract.path("predictors"))if(last.measurements().containsKey(p.asText()))supported++;
        return gap>=contract.path("minimumIntervalDays").asDouble()&&gap<=contract.path("maximumIntervalDays").asDouble()
                &&ChronoUnit.DAYS.between(last.observedAt(),now)<=contract.path("maximumLatestAgeDays").asInt()
                &&last.measurements().containsKey(target)&&supported>=contract.path("minimumCurrentPredictors").asInt();
    }
    static void attach(ObjectNode output,List<SriLankanRenalIntelligenceService.ObservationView> rows,
            List<Map<String,Object>> registry,Instant now) {
        for(String key:RenalClinicalModules.ORDER) {
            ObjectNode m=(ObjectNode)output.get(key),r=m.putObject("readiness");
            r.put("status",m.path("status").asText());r.put("method",m.path("method").asText());r.put("ready",false);
            r.set("lastUpdated",m.path("lastUpdated"));r.put("lastEvaluated",output.path("generatedAt").asText());
            r.put("dataPointsUsed",m.path("usablePoints").asInt());r.putNull("technicalReference");
            ArrayNode requirements=r.putArray("requirements");
            if(key.equals("renalTrajectory")||key.equals("renalDeterioration")) {
                int count=output.path("dataQuality").path("evaluableDomains").asInt();boolean composite=key.equals("renalDeterioration");
                int minimum=composite?3:1;r.put("minimumDomains",minimum);r.put("evaluableDomains",count);r.put("partial",count>0&&count<6);
                for(JsonNode d:m.path("domains")) {
                    String metric=d.path("metric").asText();int n=d.path("usablePoints").asInt();
                    ObjectNode check=requirement(requirements,metric+"_history",metric,d.path("label").asText(),true,2,n,n>=2?"AVAILABLE":n==1?"MISSING_HISTORY":"MISSING","ADD_LAB_RESULT",metric);
                    check.put("detail",n>=2?n+" valid dated results":n==1?"1/2 dated results available":"No recorded result; need 2 valid dated results");
                    check.set("latestAt",d.path("currentAt"));check.set("previousAt",d.path("previousAt"));
                    warning(check,d.path("currentAt"),now);
                    if(n<2&&hasInvalid(output,metric)){check.put("state","INVALID");check.put("detail","Excluded invalid value or unit; "+n+"/2 valid dated results remain");}
                }
                boolean ready=count>=minimum&&!output.path("historyTruncated").asBoolean();r.put("ready",ready);
                r.put("resultTitle",count==0?composite?"Not enough longitudinal data":"Result not ready yet":count<minimum?"More longitudinal data required":count<6?"Result partially available":composite?signal(m.path("signal").asText()):signal(m.path("signal").asText())+(!composite&&count==6?" trajectory":""));
                r.put("message",count+" of 6 domains currently evaluable. "+(ready?"Missing domains are excluded; available trends remain visible.":"Each domain needs 2 valid dated results; "+minimum+" evaluable domain"+(minimum==1?"":"s")+" required for this result."));
                r.put("requirementPolicy","At least "+minimum+" of 6 independently evaluable domains; all six are not mandatory.");
                r.put("missingCount",Math.max(0,minimum-count));
                next(r,count==6?"VIEW_HISTORY":"ADD_LAB_RESULT",count==6?"Open renal history":composite?"Complete renal trend data":"Add missing renal labs",null);
            } else if(key.equals("kidneyFailureStatus")) {
                boolean hd="VERIFIED_MAINTENANCE_HEMODIALYSIS".equals(m.path("dialysisStatus").asText());
                boolean notHd="NOT_ON_MAINTENANCE_HD".equals(m.path("dialysisStatus").asText()),dated=m.path("lastVerifiedDate").isTextual();
                boolean evidence=hd||"G5".equals(m.path("renalStatus").asText());
                requirement(requirements,"maintenance_hemodialysis","dialysis","Chronic dialysis status",true,1,hd||notHd?1:0,hd||notHd?"AVAILABLE":"UNVERIFIED","VERIFY_DIALYSIS_STATUS","dialysis").put("detail",hd?"Verified chronic maintenance hemodialysis":notHd?"Clinician verified not on chronic maintenance hemodialysis":"Chronic dialysis context is not established");
                requirement(requirements,"dialysis_verification_date","dialysis","Dialysis verification date",true,1,dated?1:0,dated?"AVAILABLE":"MISSING","VERIFY_DIALYSIS_STATUS","dialysis").set("latestAt",m.path("lastVerifiedDate"));
                JsonNode context=output.path("currentRenalStatus");boolean chronic="PERSISTENT_ABNORMAL_MEASUREMENTS".equals(context.path("chronicity").asText());
                requirement(requirements,"renal_context","diagnosis","CKD / chronicity context",!hd,1,chronic?1:0,chronic?"AVAILABLE":hd?"NOT_REQUIRED":"UNVERIFIED","OPEN_CLINICAL_RECORD",null)
                        .put("detail",hd?"Verified chronic maintenance dialysis is the recorded clinical source":chronic?"Persistent abnormal measurements recorded":"Chronicity / diagnosis requires clinician confirmation");
                boolean egfr=context.path("latestEgfr").isNumber();
                requirement(requirements,"latest_egfr","egfr","Latest valid eGFR",false,1,egfr?1:0,egfr?"AVAILABLE":"NOT_REQUIRED","OPEN_CLINICAL_RECORD",null).set("latestAt",context.path("egfrAt"));
                if(egfr){m.set("latestEgfr",context.get("latestEgfr"));m.set("egfrAt",context.get("egfrAt"));}
                r.put("ready",evidence);r.put("resultTitle",evidence?m.path("signal").asText():"Status not established");
                r.put("message",hd?"G5D reflects explicitly verified chronic maintenance hemodialysis; no probability is calculated.":
                        "Current eGFR alone does not establish chronic kidney failure. Verify chronic dialysis and clinical context; high creatinine cannot establish G5D.");
                next(r,hd?"VIEW_HISTORY":notHd?"OPEN_CLINICAL_RECORD":evidence?"REVIEW_MODULE":"VERIFY_DIALYSIS_STATUS",hd?"Open renal history":notHd?"Open renal clinical record":evidence?"Review renal status evidence":"Verify dialysis status","dialysis");
            } else model(output,m,r,requirements,rows,meta(registry,m.path("modelKey").asText()),now);

            if("BLOCKED_BY_SAFETY_GATE".equals(m.path("status").asText())) {
                m.put("canRun",false);if(r.path("forecast") instanceof ObjectNode forecast)forecast.put("ready",false);
                r.put("ready",false);r.put("resultTitle","Clinical source review required");r.put("message",output.path("historyTruncated").asBoolean()?"History exceeds the supported retrieval limit; prediction is suppressed until the source history is reconciled.":"Research prediction is intentionally suppressed by the current-potassium source safety gate. Reconcile the measured result with a clinician.");
                next(r,"VIEW_HISTORY","Review clinical source data",null);
            }
            r.put("status",m.path("status").asText());
            r.put("method",m.path("method").asText());
            if(!r.has("missingCount"))r.put("missingCount",countMissing(requirements));
            r.put("readyCount",countReady(requirements));r.put("requirementCount",requirements.size());
            int required=0,requiredReady=0;for(JsonNode check:requirements)if(check.path("required").asBoolean()){required++;if(check.path("satisfied").asBoolean())requiredReady++;}
            r.put("requiredCount",required);r.put("requiredReadyCount",requiredReady);
            ArrayNode excluded=r.putArray("excludedData");output.path("excludedObservations").forEach(x->excluded.add(x.deepCopy()));for(JsonNode row:output.path("observations"))for(JsonNode flag:row.path("data_quality_flags"))
                excluded.addObject().put("sourceId",row.path("id").asText()).put("observedAt",row.path("observed_at").asText()).put("reason",flag.asText());
            r.set("dataUsed",m.path("sources"));
        }
        summary(output);
    }
    private static void model(ObjectNode output,ObjectNode m,ObjectNode r,ArrayNode checks,
            List<SriLankanRenalIntelligenceService.ObservationView> rows,Map<String,Object> metadata,Instant now) {
        String key=m.path("modelKey").asText(),target=key.equals("hyperkalemia")?"potassium_pre":key;
        JsonNode contract=node(metadata.get("serving_contract")),artifact=node(metadata.get("artifact_metadata"));
        boolean installed=installed(metadata),hd=output.path("kidneyFailureStatus").path("dialysisStatus").asText().equals("VERIFIED_MAINTENANCE_HEMODIALYSIS");
        boolean ineligible=output.path("kidneyFailureStatus").path("dialysisStatus").asText().equals("NOT_ON_MAINTENANCE_HD");
        var verified=rows.stream().filter(SriLankanRenalIntelligenceService.ObservationView::maintenanceHemodialysisVerified).toList();
        var latest=rows.isEmpty()?null:rows.getLast();Map<String,Double> values=latest==null?Map.of():latest.measurements();
        boolean ready=hd&&forecastReady(rows,metadata,target,now);
        requirement(checks,"model_"+key,"model","Reviewed model and metadata",true,1,installed?1:0,installed?"AVAILABLE":"MISSING","VIEW_MODEL_STATUS",null)
                .put("detail",installed?"Reviewed artifact and serving input contract verified":Objects.toString(metadata.get("artifact_reason"),"Reviewed model is not installed. Adding patient data cannot install a model."));
        if(!installed){
            m.put("status","NOT_INSTALLED").put("canRun",false);m.putNull("forecast").putNull("researchRiskScore");
            r.put("ready",false).put("resultTitle","Reviewed model not installed").put("message","Adding patient measurements cannot install the model. Ask an administrator to restore its reviewed metadata and artifact.");
            r.putObject("forecast").put("ready",false).put("message","Serving model unavailable");
            int n=m.path("usablePoints").asInt();r.putObject("trend").put("ready",n>=2).put("minimumCount",2).put("availableCount",n).put("message","Measured trend is independent of model installation");
            if(key.equals("urr"))r.putObject("measured").put("ready",m.path("currentValue").isNumber()).set("value",m.path("currentValue"));
            next(r,"VIEW_MODEL_STATUS","View model status",null);return;
        }
        requirement(checks,"maintenance_hemodialysis","dialysis","Verified maintenance hemodialysis",true,1,hd?1:0,hd?"AVAILABLE":"UNVERIFIED","VERIFY_DIALYSIS_STATUS","dialysis");
        if(!hd){
            m.put("status","NOT_APPLICABLE").put("canRun",false);m.putNull("forecast").putNull("researchRiskScore");
            r.put("ready",false).put("resultTitle",ineligible?"Not applicable to this patient":"Eligible dialysis context not verified")
                .put("message",ineligible?"The latest clinician-verified record confirms that this patient is not on chronic maintenance hemodialysis. This research model applies to the supported maintenance-HD cohort.":"This research model applies to the supported maintenance-hemodialysis cohort. The clinical record does not verify eligible chronic dialysis; eligibility is not established.");
            int n=m.path("usablePoints").asInt();r.putObject("trend").put("ready",n>=2).put("minimumCount",2).put("availableCount",n).put("message","Available measured trends remain visible; eligibility governs forecasting");
            r.putObject("forecast").put("ready",false).put("message","Verify applicable clinical dialysis context before assessing forecast requirements");
            if(key.equals("urr"))r.putObject("measured").put("ready",m.path("currentValue").isNumber()).set("value",m.path("currentValue"));
            r.set("modelFeatureContract",artifact.path("feature_names"));r.set("requiredMeasurements",artifact.path("required_measurements"));r.set("servingContract",contract);
            r.put("requirementPolicy","Verified applicable chronic maintenance dialysis is required. Patient eligibility does not retroactively verify laboratory sampling context.");
            next(r,ineligible?"VIEW_HISTORY":"VERIFY_DIALYSIS_STATUS",ineligible?"Open renal history":"Verify dialysis status","dialysis");return;
        }
        requirement(checks,"latest_verified_hd_source","history","Latest laboratory HD source context",true,1,latest!=null&&latest.maintenanceHemodialysisVerified()?1:0,latest!=null&&latest.maintenanceHemodialysisVerified()?"AVAILABLE":"UNVERIFIED","ADD_LAB_RESULT","observedAt")
                .put("detail","Current patient eligibility does not retroactively verify sampling context for previous laboratory results.");
        int minimum=contract.path("minimumObservations").asInt(2);
        requirement(checks,"verified_hd_history","history","Dated verified HD observations",true,minimum,verified.size(),verified.size()>=minimum?"AVAILABLE":"MISSING_HISTORY","ADD_LAB_RESULT","observedAt")
                .put("detail",verified.size()+"/"+minimum+" dated observations; Hb trend and forecast history are checked independently");
        double gap=verified.size()<2?Double.NaN:Duration.between(verified.get(verified.size()-2).observedAt(),verified.getLast().observedAt()).toSeconds()/86400.0;
        boolean interval=Double.isFinite(gap)&&gap>=contract.path("minimumIntervalDays").asDouble(14)&&gap<=contract.path("maximumIntervalDays").asDouble(62);
        requirement(checks,"monthly_interval","history","Supported observation interval",true,1,interval?1:0,interval?"AVAILABLE":Double.isFinite(gap)?"INVALID":"MISSING_HISTORY","VIEW_HISTORY",null)
                .put("detail",(Double.isFinite(gap)?String.format(Locale.ROOT,"Latest interval %.1f days. ",gap):"")+"Supported source dates are 14–62 days apart. Record actual dates; do not alter dates to fit a model.");
        long age=latest==null?-1:ChronoUnit.DAYS.between(latest.observedAt(),now);boolean fresh=age>=0&&age<=contract.path("maximumLatestAgeDays").asInt(62);
        requirement(checks,"latest_hd_freshness","history","Latest HD observation freshness",true,1,fresh?1:0,fresh?"AVAILABLE":age<0?"MISSING":"STALE","ADD_LAB_RESULT","observedAt")
                .put("detail",age<0?"No verified dated result":age+" days since latest measurement; supported age is at most 62 days");
        ObjectNode targetCheck=requirement(checks,target+"_current",target,"Current "+LABELS.getOrDefault(target,target),true,1,values.containsKey(target)?1:0,values.containsKey(target)?"AVAILABLE":hasInvalid(output,target)?"INVALID":"MISSING","ADD_LAB_RESULT",target.equals("urr")?"urea_pre":target);
        if(latest!=null&&values.containsKey(target))targetCheck.put("latestAt",latest.observedAt().toString());
        if(m.path("currentAt").isTextual()){
            long measuredAge=ChronoUnit.DAYS.between(Instant.parse(m.path("currentAt").asText()),now);
            if(measuredAge>62)r.put("measurementNote","Last measured "+measuredAge+" days ago — historical result only.");
            else if(latest!=null&&!m.path("currentAt").asText().equals(latest.observedAt().toString()))r.put("measurementNote","The latest recorded session lacks a valid value for this measure. The displayed value is the last valid dated result.");
        }
        int supported=0;for(JsonNode p:contract.path("predictors"))if(values.containsKey(p.asText()))supported++;
        int minimumPredictors=contract.path("minimumCurrentPredictors").asInt(5);
        requirement(checks,"current_predictor_coverage","modelInputs","Current supported predictors",true,minimumPredictors,supported,supported>=minimumPredictors?"AVAILABLE":"MISSING","ADD_LAB_RESULT",null)
                .put("detail",supported+"/"+contract.path("predictors").size()+" current predictors; minimum "+minimumPredictors+". Missing optional inputs may use training-only medians.");
        // Raw feature requirements come from the reviewed artifact, not a React or Java feature guess.
        for(JsonNode feature:artifact.path("required_measurements")) {
            String metric=feature.asText();if(metric.equals(target))continue;boolean present=values.containsKey(metric);
            requirement(checks,metric+"_current",metric,LABELS.getOrDefault(metric,metric),key.equals("urr")&&metric.startsWith("urea_"),1,present?1:0,
                    present?"AVAILABLE":hasInvalid(output,metric)?"INVALID":key.equals("urr")&&metric.startsWith("urea_")?"MISSING":"NOT_REQUIRED","ADD_LAB_RESULT",metric)
                    .put("detail",present?"Recorded source value":key.equals("urr")&&metric.startsWith("urea_")?"Required paired same-session urea for measured URR":"Optional predictor at the serving gate; training-only imputation may apply");
        }
        if(key.equals("urr")) {
            boolean pair=values.containsKey("urr");requirement(checks,"paired_urea_session","urea","Valid paired urea / session",true,1,pair?1:0,pair?"AVAILABLE":hasInvalid(output,"urea")?"INVALID":"MISSING","ADD_LAB_RESULT","urea_pre")
                    .put("detail","Same verified session and explicit matching source units; pre-HD urea > 0; 0 ≤ post-HD urea ≤ pre-HD urea.");
            r.putObject("measured").put("ready",m.path("currentValue").isNumber()).set("value",m.path("currentValue"));
        }
        int targetHistory=(int)rows.stream().filter(row->row.measurements().containsKey(target)).count();
        requirement(checks,target+"_history",target,LABELS.get(target)+" trend history",false,2,targetHistory,targetHistory>=2?"AVAILABLE":"MISSING_HISTORY","ADD_LAB_RESULT",target.equals("urr")?"urea_pre":target)
                .put("detail",targetHistory>=2?"Trend ready; two valid dated results available":targetHistory==1?"Add one more dated result for a trend; this is separate from the forecast gate":"Two dated results required for a trend");
        r.putObject("trend").put("ready",targetHistory>=2).put("minimumCount",2).put("availableCount",targetHistory)
                .put("message",targetHistory>=2?"Trend ready":targetHistory==1?"Add one more dated "+LABELS.get(target)+" result to calculate a trend":"No recorded "+LABELS.get(target)+" trend; 2 dated results required");
        r.putObject("forecast").put("ready",ready).put("minimumObservations",minimum).put("availableObservations",verified.size())
                .put("message",ready?"Serving gate ready; run to obtain a stored forecast":"The monthly-cohort forecast gate requires eligible history, current target and supported predictor coverage");
        r.put("ready",ready);r.set("modelFeatureContract",artifact.path("feature_names"));r.set("requiredMeasurements",artifact.path("required_measurements"));
        r.set("servingContract",contract);r.put("requirementPolicy",key.equals("hb")?contract.path("persistencePolicy").asText():"Current target, eligible dated HD history and at least "+minimumPredictors+" supported current predictors.");
        m.put("canRun",ready);if(!artifact.isMissingNode()&&!artifact.isNull()){
            m.put("method",artifact.path("served_method").asText().equals("PERSISTENCE_BASELINE")?"Persistence Baseline":"Longitudinal Research Model");
            m.put("model",artifact.path("model").asText());m.put("modelVersion",artifact.path("model_version").asText());
            m.put("algorithm",artifact.path("served_method").asText().equals("PERSISTENCE_BASELINE")?"LAST_OBSERVATION_CARRIED_FORWARD":artifact.path("algorithm").asText());
        }
        String status=m.path("status").asText();
        if(!installed){m.put("status","NOT_INSTALLED");r.put("resultTitle","Reviewed model not installed");r.put("message","Adding patient measurements cannot install the model. Ask an administrator to restore its reviewed metadata and artifact.");next(r,"VIEW_MODEL_STATUS","View model status",null);}
        else if(!hd){m.put("status","NOT_APPLICABLE");r.put("resultTitle",ineligible?"Not applicable to this patient":"Eligible dialysis context not verified");r.put("message",ineligible?"The latest clinician-verified clinical record states that this patient is not on chronic maintenance hemodialysis. The installed model applies to the supported maintenance-HD cohort.":"This research model applies to the supported maintenance-hemodialysis cohort. The latest clinical source does not verify eligible chronic dialysis; eligibility is not established.");next(r,ineligible?"VIEW_HISTORY":"VERIFY_DIALYSIS_STATUS",ineligible?"Open renal history":"Verify dialysis status","dialysis");}
        else if(status.equals("ERROR")){r.put("resultTitle","Prediction service temporarily unavailable");r.put("message","A technical service failure prevented the result. This is different from missing patient data.");r.set("technicalReference",m.path("predictionId"));next(r,"RETRY_MODEL","Retry prediction",null);}
        else {
            boolean measured=m.path("currentValue").isNumber();r.put("resultTitle",m.path("forecast").isNumber()?"Research forecast available":m.path("researchRiskScore").isNumber()?"Research risk score available":key.equals("urr")&&measured?"Current measured URR available":ready?"Ready for research prediction":key.equals("hb")&&measured?"Latest Hb available; forecast not ready":"Result not ready yet");
            r.put("message",ready?"Required serving conditions are met. Trend readiness is separate; no output is invented before a model run.":missingMessage(checks));
            JsonNode first=null;for(JsonNode check:checks)if(check.path("required").asBoolean()&&!check.path("satisfied").asBoolean()){first=check;break;}
            String type=ready?"RUN_MODEL":first==null?"ADD_LAB_RESULT":first.path("action").asText();
            next(r,type,ready?"Run research prediction":type.equals("VIEW_HISTORY")?"Open renal history":type.equals("VERIFY_DIALYSIS_STATUS")?"Verify dialysis status":key.equals("urr")?"Add dialysis-session labs":targetHistory==1&&key.equals("hb")?"Add another dated Hb result":"Add missing clinical data",first==null?target:first.path("focusKey").asText(null));
        }
        if(!ready)m.put("canRun",false);
    }
    private static String missingMessage(ArrayNode checks){List<String> missing=new ArrayList<>();for(JsonNode c:checks)if(c.path("required").asBoolean()&&!c.path("satisfied").asBoolean())missing.add(c.path("label").asText());return missing.isEmpty()?"Required clinical evidence needs review":"Missing "+missing.size()+" required condition"+(missing.size()==1?"":"s")+": "+String.join(", ",missing)+". Exact counts and dates are listed below.";}
    private static ObjectNode requirement(ArrayNode list,String key,String group,String label,boolean required,int minimum,int count,String state,String action,String focus) {
        ObjectNode r=list.addObject();r.put("key",key).put("groupKey",group).put("label",label).put("required",required).put("minimumCount",minimum).put("availableCount",count).put("state",state).put("action",action);
        r.put("satisfied",count>=minimum||"NOT_REQUIRED".equals(state));r.put("additionalCount",Math.max(0,minimum-count));r.putNull("latestAt");r.putNull("previousAt");r.put("detail",count+"/"+minimum+" available");if(focus==null)r.putNull("focusKey");else r.put("focusKey",focus);return r;
    }
    private static void warning(ObjectNode check,JsonNode at,Instant now){try{long days=ChronoUnit.DAYS.between(Instant.parse(at.asText()),now);if(days>62){check.put("state","STALE");check.put("detail",check.path("detail").asText()+"; last measured "+days+" days ago — historical trend only");}}catch(Exception ignored){}}
    private static boolean hasInvalid(JsonNode output,String metric){for(JsonNode f:output.path("dataQuality").path("flags"))if(f.asText().contains("INVALID")&&(f.asText().toLowerCase(Locale.ROOT).contains(metric)||metric.equals("urr")&&f.asText().contains("UREA")))return true;return false;}
    private static int countMissing(ArrayNode a){int n=0;for(JsonNode r:a)if(r.path("required").asBoolean()&&!r.path("satisfied").asBoolean())n++;return n;}
    private static int countReady(ArrayNode a){int n=0;for(JsonNode r:a)if(r.path("satisfied").asBoolean())n++;return n;}
    private static void next(ObjectNode r,String type,String label,String focus){ObjectNode n=r.putObject("nextAction");n.put("type",type).put("label",label);if(focus==null)n.putNull("focusKey");else n.put("focusKey",focus);}
    private static String signal(String value){return switch(value){case "STABLE","NO_ADVERSE_DIRECTION_DETECTED"->"Stable";case "IMPROVING"->"Improving";case "DECLINING"->"Declining";case "MULTIDOMAIN_WORSENING_SIGNAL"->"Multidomain deterioration signal";default->"Mixed trajectory";};}
    private static void summary(ObjectNode output) {
        ObjectNode s=output.putObject("readinessSummary");int ready=0;ArrayNode modules=s.putArray("modules");Map<String,ObjectNode> grouped=new LinkedHashMap<>();
        for(String key:RenalClinicalModules.ORDER){JsonNode m=output.path(key),r=m.path("readiness");boolean moduleReady=r.path("ready").asBoolean()&&!m.path("status").asText().equals("ERROR");if(moduleReady)ready++;
            modules.addObject().put("key",key).put("label",m.path("label").asText()).put("ready",moduleReady).put("status",m.path("status").asText()).put("message",moduleReady?r.path("resultTitle").asText():r.path("message").asText());
            for(JsonNode c:r.path("requirements"))if(!c.path("satisfied").asBoolean()||c.path("state").asText().equals("STALE")) {
                if(m.path("status").asText().equals("NOT_INSTALLED")&&!c.path("groupKey").asText().equals("model"))continue;
                if(m.path("status").asText().equals("NOT_APPLICABLE")&&output.path("kidneyFailureStatus").path("dialysisStatus").asText().equals("NOT_ON_MAINTENANCE_HD"))continue;
                String group=c.path("groupKey").asText();ObjectNode g=grouped.computeIfAbsent(group,k->{ObjectNode v=JSON.createObjectNode();v.put("groupKey",k);v.put("label",k.equals("dialysis")?"Dialysis verification":k.equals("history")?"Dated renal history":k.equals("model")?"Model availability":LABELS.getOrDefault(k,c.path("label").asText()));v.putArray("requirements");return v;});
                boolean duplicate=false;for(JsonNode existing:g.path("requirements"))if(existing.path("key").equals(c.path("key")))duplicate=true;
                if(!duplicate){ObjectNode item=c.deepCopy();item.put("moduleKey",key);g.withArray("requirements").add(item);}
            }
        }
        s.put("readyModules",ready).put("totalModules",6);ArrayNode missing=s.putArray("missingDataGroups");grouped.values().forEach(missing::add);
    }
}
