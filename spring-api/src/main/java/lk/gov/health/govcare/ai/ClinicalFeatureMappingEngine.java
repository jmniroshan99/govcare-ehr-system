package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.*;
import java.time.*;
import java.util.*;

/** Explainable clinical measurement rules. These outputs are neither learned forecasts nor diagnoses. */
public final class ClinicalFeatureMappingEngine {
    public static final String VERSION="GOVCARE-CKD-FEATURE-MAPPING-2.0";
    private static final ObjectMapper JSON=new ObjectMapper();
    private ClinicalFeatureMappingEngine(){}
    public static ObjectNode apply(ObjectNode output,ClinicalPredictionFeatureService.FeatureData data,Instant now){
        if(!data.patientId().toString().equals(output.path("patientId").asText())||!data.hospitalId().toString().equals(output.path("hospitalId").asText()))throw new IllegalArgumentException("Clinical feature scope disagrees with the renal snapshot.");
        for(var source:data.snapshots())if(source.hasNonNull("patientId")&&!source.path("patientId").asText().equals(data.patientId().toString())||source.hasNonNull("hospitalId")&&!source.path("hospitalId").asText().equals(data.hospitalId().toString()))throw new IllegalArgumentException("Foreign clinical evidence scope");
        for(var source:data.observations())if(source.hasNonNull("patientId")&&!source.path("patientId").asText().equals(data.patientId().toString())||source.hasNonNull("hospitalId")&&!source.path("hospitalId").asText().equals(data.hospitalId().toString()))throw new IllegalArgumentException("Foreign observation scope");
        ObjectNode featureData=collect(output,data,now);output.set("clinicalFeatureData",featureData);output.put("schemaVersion",3);
        ObjectNode progression=progression(featureData),kidney=kidney(output,featureData),potassium=potassium(featureData),hb=hemoglobin(featureData),urr=urr(output),aki=aki(featureData,data.truncated(),now);
        if(output.path("kidneyFailureStatus").path("dialysisStatus").asText().equals("VERIFIED_MAINTENANCE_HEMODIALYSIS")&&aki.path("status").asText().equals("CALCULATED")){
            aki.put("acuteReviewSignal",false).put("riskLevel","Trend only").put("resultTitle","Creatinine change on verified dialysis").put("message","Creatinine change is available. Maintenance dialysis and sampling timing require clinician interpretation; the AKI threshold is not applied to this chronic dialysis context.");
        }
        output.set("akiRisk",aki);
        attach(output,"renalTrajectory",progression,now);attach(output,"kidneyFailureStatus",kidney,now);attach(output,"hyperkalemia",potassium,now);
        attach(output,"anemia",hb,now);attach(output,"dialysisAdequacy",urr,now);attach(output,"renalDeterioration",aki,now);
        ((ObjectNode)output.get("renalTrajectory")).put("label","CKD Progression / Renal Trajectory");
        ((ObjectNode)output.get("renalDeterioration")).put("label","AKI / Renal Clinical Deterioration");
        output.set("cardiovascularMonitoring",cardiovascular(featureData));
        summary(output);ClinicalIntelligenceRules.publish(output);
        output.set("renalTimeline",RenalTrendTimeline.assemble(output,data,now));return output;
    }
    static List<String> forecastSafety(ClinicalPredictionFeatureService.FeatureData data,List<SriLankanRenalIntelligenceService.ObservationView> observations,Instant now){
        var root=JSON.createObjectNode().put("patientId",data.patientId().toString()).put("hospitalId",data.hospitalId().toString());var rows=root.putArray("observations");
        for(var row:observations){var item=rows.addObject().put("id",row.id().toString()).put("observed_at",row.observedAt().toString());item.set("measurements",JSON.valueToTree(row.measurements()));item.set("units",JSON.valueToTree(row.units()));}
        var features=collect(root,data,now);List<String> reasons=new ArrayList<>();if(data.truncated())reasons.add("Clinical feature history is truncated; reconcile the source series before forecasting.");
        var k=features.path("current").path("potassium");if(k.path("available").asBoolean()&&(k.path("value").asDouble()<ClinicalRuleRegistry.K_SEVERE_LOW||k.path("value").asDouble()>=ClinicalRuleRegistry.K_SEVERE_HIGH))reasons.add("Extreme current potassium from the unified clinical features requires source reconciliation and prompt clinician review; research inference is blocked.");
        if(k.path("state").asText().equals("INVALID"))reasons.add("The current potassium source is invalid or conflicting; reconcile it before research forecasting.");return List.copyOf(reasons);
    }
    private static ObjectNode collect(ObjectNode output,ClinicalPredictionFeatureService.FeatureData data,Instant now){
        ObjectNode result=JSON.createObjectNode().put("normalizationVersion",ClinicalFeatureNormalizer.VERSION).put("mappingVersion",VERSION);
        result.put("assessmentCount",data.snapshots().size()).put("historyTruncated",data.truncated());
        result.set("clinicalContext",data.clinicalContext()==null?JSON.createObjectNode():data.clinicalContext().deepCopy());
        var snapshots=data.snapshots().stream().sorted(Comparator.comparing((ObjectNode n)->time(n,"recordedAt")).reversed().thenComparing(n->n.path("assessmentId").asText())).toList();
        if(snapshots.isEmpty())result.putNull("latestAssessmentId");else result.set("latestAssessmentId",snapshots.getFirst().get("assessmentId"));
        ArrayNode sources=result.putArray("assessmentSources");snapshots.forEach(s->{var source=s.deepCopy();source.remove("features");sources.add(source);});
        Map<String,List<ObjectNode>> candidates=new LinkedHashMap<>();
        for(var snapshot:snapshots)for(var d:ClinicalFeatureNormalizer.DEFINITIONS){
            JsonNode saved=snapshot.path("features").path(d.key());
            ObjectNode feature=saved instanceof ObjectNode object?object.deepCopy():JSON.createObjectNode().put("key",d.key()).put("label",d.label()).put("unit",d.unit()).put("state","MISSING").put("available",false);
            candidates.computeIfAbsent(d.key(),k->new ArrayList<>()).add(feature);
        }
        for(var value:data.observations())candidates.computeIfAbsent(value.path("key").asText(),k->new ArrayList<>()).add(value.deepCopy());
        // A real pre-HD potassium may support current monitoring, but a generic CKD potassium is never relabeled pre/post-HD.
        for(JsonNode row:output.path("observations"))for(String key:List.of("hemoglobin","potassium")){
            String metric=key.equals("hemoglobin")?"hb":"potassium_pre";if(!row.path("measurements").path(metric).isNumber())continue;
            var metadata=JSON.createObjectNode().put("unit",row.path("units").path(metric).asText()).put("observedAt",row.path("observed_at").asText());
            var f=ClinicalFeatureNormalizer.measurement(ClinicalFeatureNormalizer.definition(key),row.path("measurements").path(metric),metadata,row.path("observed_at").asText(),"VERIFIED_RENAL_SOURCE",row.path("id").asText(),null,now);
            if(key.equals("potassium"))f.put("sampleContext","PRE_HD");candidates.computeIfAbsent(key,k->new ArrayList<>()).add(f);
        }
        ObjectNode current=result.putObject("current"),history=result.putObject("history");ArrayNode excluded=result.putArray("excludedData");
        for(var d:ClinicalFeatureNormalizer.DEFINITIONS){
            var values=candidates.getOrDefault(d.key(),List.of());Map<String,List<ObjectNode>> byTime=new TreeMap<>(Comparator.comparing((String at)->Instant.parse(at)));
            for(var f:values)if(f.path("available").asBoolean()&&f.path("observedAt").isTextual())byTime.computeIfAbsent(f.path("observedAt").asText(),k->new ArrayList<>()).add(f);
            Set<String> conflicts=new HashSet<>();ArrayNode points=history.putArray(d.key());
            for(var group:byTime.entrySet()){
                double first=group.getValue().getFirst().path("value").asDouble();boolean conflict=group.getValue().stream().anyMatch(f->Math.abs(f.path("value").asDouble()-first)>1e-6);
                if(conflict){conflicts.add(group.getKey());for(var f:group.getValue()){f.put("available",false).put("state","INVALID").putNull("value");f.withArray("qualityFlags").add("CONFLICTING_RESULT");excluded.add(f.deepCopy());}}
                else points.add(group.getValue().getFirst().deepCopy());
            }
            List<ObjectNode> present=values.stream().filter(f->!f.path("state").asText().equals("MISSING")).toList();ObjectNode chosen=null;
            // An undated latest assessment is explicit snapshot evidence, with no claimed chronology.
            for(var f:present)if(!f.path("observedAt").isTextual()&&(chosen==null||time(f,"recordedAt").isAfter(time(chosen,"recordedAt"))))chosen=f;
            ObjectNode dated=present.stream().filter(f->f.path("observedAt").isTextual()).max(Comparator.comparing(f->time(f,"observedAt"))).orElse(null);
            if(chosen==null||dated!=null&&!time(dated,"observedAt").isBefore(time(chosen,"recordedAt")))chosen=dated;
            if(chosen==null)chosen=JSON.createObjectNode().put("key",d.key()).put("label",d.label()).put("unit",d.unit()).put("available",false).put("state","MISSING");
            current.set(d.key(),chosen.deepCopy());
            for(var f:values)if(f.path("state").asText().equals("INVALID")&&!conflicts.contains(f.path("observedAt").asText()))excluded.add(f.deepCopy());
        }
        result.put("sourcePolicy","Actual CKD assessment values and dated clinical observations. Missing values and dates are never imputed. Readiness describes data completeness, not disease probability.");
        return result;
    }
    static ObjectNode result(String title,String method){
        ObjectNode r=JSON.createObjectNode().put("title",title).put("method",method).put("ruleVersion",VERSION).put("status","INSUFFICIENT_DATA");
        r.putNull("riskLevel").putNull("currentValue").putNull("unit").putNull("currentAt");r.putArray("explanations");r.putArray("recommendations");r.putArray("featuresUsed");r.putArray("requirements");return r;
    }
    /** Factor surveillance only. No cardiovascular classifier or probability is installed. */
    private static ObjectNode cardiovascular(ObjectNode features){
        ObjectNode r=result("CKD Cardiovascular Monitoring","Recorded cardiovascular factor surveillance");
        Double systolic=value(features,"systolic"),diastolic=value(features,"diastolic");
        JsonNode sbp=features.path("current").path("systolic"),dbp=features.path("current").path("diastolic");
        boolean bp=systolic!=null&&diastolic!=null;
        boolean sameTime=bp&&sbp.path("observedAt").isTextual()&&sbp.path("observedAt").equals(dbp.path("observedAt"));
        String bpDetail=bp?"Systolic "+format(systolic)+" / diastolic "+format(diastolic)+" mmHg; "+(sameTime?"same recorded measurement time":"separate or unverified dates; not a paired BP reading"):"Systolic and diastolic source measurements required";
        addRequirement(r,"blood_pressure","blood_pressure","Blood pressure",true,bp,bp?"AVAILABLE":"MISSING","ADD_CLINICAL_HISTORY",systolic==null?"systolic":"diastolic",bpDetail,sbp.path("observedAt"));
        if(systolic!=null)r.withArray("featuresUsed").add(sbp.deepCopy());
        if(diastolic!=null)r.withArray("featuresUsed").add(dbp.deepCopy());
        for(String key:List.of("potassium","creatinine","age"))check(r,features,key,true);
        // Glycemic biomarkers cannot stand in for a confirmed diabetes diagnosis.
        JsonNode diabetes=features.path("clinicalContext").path("diabetes");boolean confirmed=Set.of("CONFIRMED_DIABETES","NO_KNOWN_DIABETES").contains(diabetes.path("status").asText());
        addRequirement(r,"diabetes_status","diabetes_status","Clinical diabetes status",true,confirmed,confirmed?"AVAILABLE":"UNVERIFIED","OPEN_CLINICAL_RECORD","diabetes_status",confirmed?(diabetes.path("status").asText().equals("CONFIRMED_DIABETES")?"Diabetes documented in the verified record":"No known diabetes in the reviewed record")+"; "+diabetes.path("sourceNote").asText():"Confirm clinical diabetes context; HbA1c / glucose alone do not establish a diagnosis.",diabetes.path("verifiedAt"));r.set("diabetesContext",diabetes.deepCopy());
        int available=0;for(JsonNode item:r.path("requirements"))if(item.path("satisfied").asBoolean())available++;
        r.put("status",available==0?"INSUFFICIENT_DATA":"PARTIALLY_CALCULATED").put("resultTitle","Cardiovascular surveillance recommended").put("riskLevel","Not estimated");
        r.put("message","Cardiovascular event risk not estimated; risk-factor review available.");
        r.put("modelAvailable",false);
        var pair=r.putObject("bloodPressurePair").put("verified",sameTime&&(!sbp.path("sourceId").asText().isBlank()&&sbp.path("sourceId").equals(dbp.path("sourceId"))||sbp.hasNonNull("pairId")&&sbp.path("pairId").equals(dbp.path("pairId")))&&(!sbp.hasNonNull("encounterId")&&!dbp.hasNonNull("encounterId")||sbp.hasNonNull("encounterId")&&sbp.path("encounterId").equals(dbp.path("encounterId"))));
        pair.set("systolic",sbp.deepCopy());pair.set("diastolic",dbp.deepCopy());if(pair.path("verified").asBoolean())pair.put("value",systolic+"/"+diastolic+" mmHg");else pair.putNull("value");pair.put("reason",pair.path("verified").asBoolean()?"Shared source/pair and verified collection time":"Separate provenance or unverified collection times; not a paired BP reading");
        r.putObject("dataReadiness").put("availableCount",available).put("requiredCount",5).put("missingCount",5-available).put("percent",Math.round(available*100.0/5)).put("policy","Completeness of five displayed surveillance factor groups; not model readiness or cardiovascular risk probability.");
        r.withArray("explanations").add("The dashboard presents actual blood pressure, potassium, creatinine and age when available, with their source dates.");
        r.withArray("explanations").add("Missing diabetes status remains unknown. A low recorded potassium or creatinine does not establish low cardiovascular risk.");
        r.withArray("recommendations").add("Review cardiovascular history, confirmed diabetes status, blood pressure and other relevant factors in the patient record; use an externally validated CKD-appropriate tool when estimating cardiovascular event risk.");
        next(r,"OPEN_CLINICAL_RECORD","Review cardiovascular factors","diabetes_status");return r;
    }
    private static ObjectNode progression(ObjectNode features){return ClinicalIntelligenceRules.progression(features);}
    private static ObjectNode kidney(ObjectNode output,ObjectNode features){
        ObjectNode r=result("Kidney Failure Risk Indicator","Clinical evidence / monitoring rule");for(String key:List.of("egfr","creatinine","proteinuria","acr"))check(r,features,key,true);
        String dialysis=output.path("kidneyFailureStatus").path("dialysisStatus").asText();boolean hd=dialysis.equals("VERIFIED_MAINTENANCE_HEMODIALYSIS"),verified=hd||dialysis.equals("NOT_ON_MAINTENANCE_HD");Double g=value(features,"egfr");
        addRequirement(r,"dialysis_status","dialysis","Verified dialysis status",true,verified,verified?"AVAILABLE":"UNVERIFIED","VERIFY_DIALYSIS_STATUS","dialysis",verified?"Clinician-verified dialysis context":"Dialysis verification required",output.path("kidneyFailureStatus").path("lastVerifiedDate"));
        boolean high=hd||g!=null&&g<15;r.put("status",g!=null||hd?"CALCULATED":r.path("featuresUsed").size()>0?"PARTIALLY_CALCULATED":"INSUFFICIENT_DATA");
        if(high)r.put("riskLevel","High");else if(g!=null)r.put("riskLevel","Below high-signal threshold");
        r.put("resultTitle",high?"High kidney failure monitoring signal":g!=null?"Kidney failure risk indicator calculated":"Renal clinical evidence required");
        r.put("message",high?"Kidney failure risk indicator; clinical review required. This does not confirm a diagnosis or establish G5D.":"High monitoring signal requires eGFR <15 or verified chronic dialysis; creatinine alone cannot establish G5D.");
        r.put("dialysisMessage",hd?"Chronic maintenance hemodialysis verified":verified?"Clinician verified not on chronic maintenance hemodialysis":"Dialysis verification required");
        if(g!=null)r.withArray("explanations").add("eGFR "+format(g)+" mL/min/1.73 m²"+(g<15?" is below the 15 monitoring threshold.":" does not meet the <15 high-signal threshold."));
        if(hd)r.withArray("explanations").add("Explicit clinician verification of chronic maintenance hemodialysis is recorded.");
        r.withArray("recommendations").add("Review renal function and chronicity; verify dialysis status before G5D labeling or maintenance-HD model use.");
        next(r,verified?"VIEW_HISTORY":"VERIFY_DIALYSIS_STATUS",verified?"Review renal clinical evidence":"Verify dialysis status",verified?null:"dialysis");return r;
    }
    private static ObjectNode potassium(ObjectNode features){return ClinicalIntelligenceRules.potassium(features);}
    private static ObjectNode hemoglobin(ObjectNode features){return ClinicalIntelligenceRules.hemoglobin(features);}
    private static ObjectNode urr(ObjectNode output){return ClinicalIntelligenceRules.urr(output);}
    private static ObjectNode aki(ObjectNode features,boolean truncated,Instant now){
        ObjectNode r=result("AKI Risk / Creatinine Trend","Dated creatinine change / acute review rule");check(r,features,"creatinine",true);ObjectNode t=trend(features,"creatinine");
        boolean pair=t.path("ready").asBoolean()&&!truncated;
        addRequirement(r,"previous_creatinine","creatinine","Previous creatinine",true,pair,pair?"AVAILABLE":"MISSING_HISTORY","ADD_CLINICAL_HISTORY","creatinine","Baseline creatinine required for AKI trend calculation",t.path("previousAt"));
        JsonNode currentDate=pair?t.path("currentAt"):features.path("current").path("creatinine").path("observedAt");
        boolean dated=currentDate.isTextual();
        addRequirement(r,"current_creatinine_date","history","Current creatinine measurement date",true,dated,dated?"AVAILABLE":"MISSING","ADD_CLINICAL_HISTORY","creatinine","Current and previous results need distinct actual dates",currentDate);
        addRequirement(r,"previous_creatinine_date","history","Previous creatinine measurement date",true,pair,pair?"AVAILABLE":"MISSING_HISTORY","ADD_CLINICAL_HISTORY","creatinine","A recorded baseline date is required",t.path("previousAt"));
        r.put("formula","Creatinine change (%) = ((Current Creatinine − Previous Creatinine) / Previous Creatinine) × 100");
        if(pair){
            r.put("status","CALCULATED").set("trend",t);r.set("creatinineChangePercent",t.path("percentChange"));boolean acute=false;
            Instant current=ClinicalFeatureNormalizer.instant(t.path("currentAt").asText());double currentValue=t.path("currentValue").asDouble();
            for(JsonNode prior:features.path("history").path("creatinine")){
                Instant at=ClinicalFeatureNormalizer.instant(prior.path("observedAt").asText());double hours=Duration.between(at,current).toNanos()/3_600_000_000_000.0;
                if(hours>0&&(hours<=48&&currentValue-prior.path("value").asDouble()>=.3-1e-9||hours<=168&&currentValue/prior.path("value").asDouble()>=1.5-1e-9))acute=true;
            }
            boolean historical=t.path("snapshotUndated").asBoolean()||Duration.between(current,now).toDays()>7;r.put("acuteReviewSignal",acute&&!historical);
            r.put("riskLevel",acute&&!historical?"Clinical Review Signal":"Trend only");
            r.put("resultTitle",acute&&!historical?"Creatinine-based AKI clinical review signal":historical?"Historical creatinine change calculated":"Creatinine change calculated");
            r.put("message",acute&&!historical?"A dated creatinine change meets an acute review threshold; this is not a confirmed AKI diagnosis.":"Creatinine change is a measured trend. It does not establish AKI; timing, urine output and clinical context require review.");
            r.withArray("explanations").add("Creatinine "+format(t.path("previousValue").asDouble())+" → "+format(currentValue)+" mg/dL over "+format(t.path("intervalDays").asDouble())+" days; "+format(t.path("percentChange").asDouble())+"% change (not probability).");
        }else{r.put("status",value(features,"creatinine")!=null?"PARTIALLY_CALCULATED":"INSUFFICIENT_DATA");r.put("resultTitle","AKI trend not calculated").put("message",truncated?"History retrieval is truncated; reconcile the clinical series before AKI trend interpretation.":"Baseline creatinine required for AKI trend calculation");r.putNull("creatinineChangePercent");r.put("acuteReviewSignal",false);r.set("trend",t);}
        r.put("thresholdPolicy","Creatinine-based clinical review only: rise ≥0.3 mg/dL within 48 h or ≥1.5 times a dated baseline within 7 days. No AKI staging, urine-output assessment or diagnosis is generated.");
        r.withArray("recommendations").add("Obtain previous creatinine with its actual measurement date; clinician review of timing, acute illness, medications and urine output is required.");
        next(r,"ADD_CLINICAL_HISTORY","Add baseline creatinine history","creatinine");return r;
    }
    static ObjectNode trend(ObjectNode features,String key){
        JsonNode current=features.path("current").path(key);ArrayNode points=(ArrayNode)features.path("history").path(key);ObjectNode t=JSON.createObjectNode().put("ready",false).put("availableCount",points.size()).put("minimumCount",2);
        t.put("message",points.size()==0?"No dated history available":points.size()==1?"One dated result; previous dated observation required":"Dated history available; current snapshot date must be verified");
        for(String field:List.of("currentValue","previousValue","currentAt","previousAt","absoluteChange","percentChange","intervalDays"))t.putNull(field);
        t.set("points",points.deepCopy());if(!current.path("available").asBoolean())return t;
        if(!current.path("observedAt").isTextual()){if(points.size()<2)return t;current=points.get(points.size()-1);t.put("snapshotUndated",true);}
        JsonNode previous=null;var comparable=JSON.createArrayNode(); for(JsonNode p:points)if(p.path("unit").asText().equals(current.path("unit").asText())&&p.path("sampleContext").asText("").equals(current.path("sampleContext").asText(""))){comparable.add(p.deepCopy());if(time(p,"observedAt").isBefore(time(current,"observedAt")))previous=p;}
        t.set("points",comparable);t.put("availableCount",comparable.size());
        if(previous==null||previous.path("value").asDouble()<=0)return t;
        double days=Duration.between(Instant.parse(previous.path("observedAt").asText()),Instant.parse(current.path("observedAt").asText())).toNanos()/86_400_000_000_000.0;if(days<=0)return t;
        double delta=current.path("value").asDouble()-previous.path("value").asDouble();
        t.put("ready",true).put("message",t.path("snapshotUndated").asBoolean()?"Dated history compared; undated assessment excluded":"Dated trend calculated").put("currentValue",current.path("value").asDouble()).put("previousValue",previous.path("value").asDouble()).put("absoluteChange",delta).put("percentChange",delta/previous.path("value").asDouble()*100).put("intervalDays",days).put("unit",current.path("unit").asText());
        t.set("currentAt",current.get("observedAt"));t.set("previousAt",previous.get("observedAt"));return t;
    }
    static void check(ObjectNode r,ObjectNode features,String key,boolean required){
        var f=features.path("current").path(key);boolean available=f.path("available").asBoolean();var d=ClinicalFeatureNormalizer.definition(key);
        String state=f.path("state").asText("MISSING");String detail=available?format(f.path("value").asDouble())+" "+f.path("unit").asText()+(state.equals("STALE")?"; historical measurement only":f.path("observedAt").isTextual()?"; source date recorded":"; undated snapshot only"):state.equals("INVALID")?"Excluded invalid or conflicting source; review the original result":"No recorded value";
        addRequirement(r,key,key,d.label(),required,available,state.equals("UNDATED")?"AVAILABLE":state,"ADD_CLINICAL_HISTORY",key,detail,f.path("observedAt"));
        if(available)r.withArray("featuresUsed").add(f.deepCopy());
    }
    static void addRequirement(ObjectNode r,String key,String group,String label,boolean required,boolean satisfied,String state,String action,String focus,String detail,JsonNode date){
        ObjectNode c=r.withArray("requirements").addObject().put("key",key).put("groupKey",group).put("label",label).put("required",required).put("minimumCount",1).put("availableCount",satisfied?1:0).put("state",state).put("satisfied",satisfied).put("additionalCount",satisfied?0:1).put("action",action).put("focusKey",focus).put("detail",detail);
        c.set("latestAt",date.isMissingNode()?JSON.nullNode():date);c.putNull("previousAt");
    }
    private static Double value(ObjectNode f,String key){JsonNode v=f.path("current").path(key);return v.path("available").asBoolean()&&v.path("value").isNumber()?v.path("value").asDouble():null;}
    static void next(ObjectNode r,String type,String label,String focus){var n=r.putObject("nextAction").put("type",type).put("label",label);if(focus==null)n.putNull("focusKey");else n.put("focusKey",focus);}
    private static String format(double v){return String.format(Locale.ROOT,"%.2f",v);}
    private static Instant time(JsonNode node,String field){var at=ClinicalFeatureNormalizer.instant(node.path(field).asText(null));return at==null?Instant.MIN:at;}
    private static void attach(ObjectNode output,String key,ObjectNode clinical,Instant now){
        ObjectNode m=(ObjectNode)output.get(key),old=m.path(m.has("researchReadiness")?"researchReadiness":"readiness").deepCopy();if(!m.has("researchStatus"))m.set("researchStatus",m.path("status"));m.set("researchReadiness",old);m.set("clinicalAssessment",clinical);
        if(!m.has("researchModel")){var research=m.putObject("researchModel");for(String field:List.of("method","model","modelVersion","algorithm","population","validationStatus","clinicalValidationStatus"))research.set(field,m.path(field));}
        m.put("method",clinical.path("method").asText()).put("model","GovCare clinical measurement rules").put("modelVersion",VERSION).put("algorithm","DETERMINISTIC_RULE").put("validationStatus","NOT_CLINICALLY_VALIDATED").put("population","Saved CKD assessment and authorized renal clinical sources");
        ObjectNode r=old.deepCopy();boolean calculated=clinical.path("status").asText().equals("CALCULATED"),partial=clinical.path("status").asText().equals("PARTIALLY_CALCULATED");
        m.put("status",calculated?"AVAILABLE":partial?"PARTIALLY_CALCULATED":"INSUFFICIENT_DATA");r.put("status",m.path("status").asText()).put("ready",calculated).put("method",clinical.path("method").asText()).put("resultTitle",clinical.path("resultTitle").asText()).put("message",clinical.path("message").asText());
        r.set("requirements",clinical.path("requirements"));r.set("nextAction",clinical.path("nextAction"));r.set("dataUsed",clinical.path("featuresUsed"));r.put("lastEvaluated",now.toString());
        var exclusions=r.putArray("excludedData");for(JsonNode excluded:output.path("clinicalFeatureData").path("excludedData")){var entry=exclusions.addObject().put("sourceId",excluded.path("sourceId").asText()).put("metric",excluded.path("key").asText());entry.set("observedAt",excluded.path("observedAt"));var reasons=new ArrayList<String>();excluded.path("qualityFlags").forEach(reason->reasons.add(reason.asText()));entry.put("reason",String.join(", ",reasons));}
        for(JsonNode excluded:old.path("excludedData"))exclusions.add(excluded.deepCopy());
        int total=0,available=0;for(JsonNode c:clinical.path("requirements"))if(c.path("required").asBoolean(true)){total++;if(c.path("satisfied").asBoolean())available++;}
        Set<String> sourceIds=new HashSet<>();for(JsonNode f:clinical.path("featuresUsed"))if(f.path("sourceId").isTextual())sourceIds.add(f.path("sourceId").asText());
        r.put("readyCount",available).put("requiredReadyCount",available).put("requiredCount",total).put("requirementCount",total).put("missingCount",total-available).put("dataPointsUsed",sourceIds.size());
        boolean historical=false,undated=false;for(JsonNode f:clinical.path("featuresUsed")){historical|=f.path("state").asText().equals("STALE");undated|=!f.path("key").asText().equals("age")&&!f.path("observedAt").isTextual();}
        if(historical)r.put("measurementNote","One or more measurements are historical (over 62 days old). This snapshot monitoring result does not describe verified current clinical status.");
        else if(undated)r.put("measurementNote","One or more clinical values have no verified measurement date. Undated values support snapshot monitoring only; separately dated values remain eligible for their own trends.");
        else r.remove("measurementNote");
        ObjectNode readiness=clinical.putObject("dataReadiness").put("availableCount",available).put("requiredCount",total).put("missingCount",total-available).put("percent",total==0?0:Math.round(available*100.0/total));
        readiness.put("policy","Completeness of the listed clinical monitoring parameters. This is not forecast eligibility, diagnostic certainty or disease probability.");r.set("clinicalDataReadiness",readiness);r.put("requirementPolicy",readiness.path("policy").asText());
        if(clinical.has("trend"))r.set("trend",clinical.get("trend"));m.set("readiness",r);
        var potassium=output.path("clinicalFeatureData").path("current").path("potassium");String safetyReason=null;
        if(output.path("clinicalFeatureData").path("historyTruncated").asBoolean())safetyReason="Clinical feature history is truncated; reconcile the source series before forecasting.";
        if(potassium.path("available").asBoolean()&&(potassium.path("value").asDouble()<ClinicalRuleRegistry.K_SEVERE_LOW||potassium.path("value").asDouble()>=ClinicalRuleRegistry.K_SEVERE_HIGH))safetyReason="Extreme measured potassium requires source reconciliation and prompt clinician review; research inference is blocked.";
        if(potassium.path("state").asText().equals("INVALID"))safetyReason="The current potassium source is invalid or conflicting; reconcile it before research forecasting.";
        if(safetyReason!=null&&m.has("modelKey")){
            m.put("canRun",false).put("researchStatus","BLOCKED_BY_SAFETY_GATE").putNull("forecast").putNull("researchRiskScore");if(r.path("forecast") instanceof ObjectNode f)f.put("ready",false);
            var research=(ObjectNode)m.get("researchReadiness");research.put("ready",false).put("resultTitle","Clinical source review required").put("message",safetyReason);research.putObject("nextAction").put("type","VIEW_HISTORY").put("label","Review clinical source data").putNull("focusKey");
        }
    }
    private static void summary(ObjectNode output){
        ObjectNode summary=output.putObject("readinessSummary");ArrayNode modules=summary.putArray("modules");Map<String,ObjectNode> groups=new LinkedHashMap<>();int ready=0;
        for(String key:RenalClinicalModules.ORDER){JsonNode m=output.path(key),r=m.path("readiness");if(r.path("ready").asBoolean())ready++;
            modules.addObject().put("key",key).put("label",m.path("label").asText()).put("ready",r.path("ready").asBoolean()).put("status",m.path("status").asText()).put("message",r.path("resultTitle").asText());
            for(JsonNode c:r.path("requirements"))if(!c.path("satisfied").asBoolean()||c.path("state").asText().equals("STALE")){
                String group=c.path("groupKey").asText();ObjectNode g=groups.computeIfAbsent(group,k->{var v=JSON.createObjectNode().put("groupKey",k).put("label",k.equals("dialysis")?"Dialysis verification":k.equals("history")?"Actual dated history":ClinicalFeatureNormalizer.definition(k)==null?c.path("label").asText():ClinicalFeatureNormalizer.definition(k).label());v.putArray("requirements");return v;});
                boolean exists=false;for(JsonNode prior:g.path("requirements"))if(prior.path("key").equals(c.path("key")))exists=true;
                if(!exists){ObjectNode copy=c.deepCopy();copy.put("moduleKey",key);g.withArray("requirements").add(copy);}
            }
        }
        summary.put("readyModules",ready).put("totalModules",6).put("policy","Clinical monitoring results available; maintenance-HD model readiness is separate.");var missing=summary.putArray("missingDataGroups");groups.values().forEach(missing::add);
    }
}
