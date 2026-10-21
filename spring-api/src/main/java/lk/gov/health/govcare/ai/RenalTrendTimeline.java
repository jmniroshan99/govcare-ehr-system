package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.*;
import java.time.Instant;
import java.util.*;

/** Read-only projection of measured evidence. Never calls inference or writes clinical observations. */
final class RenalTrendTimeline {
    private static final ObjectMapper JSON=new ObjectMapper();
    private RenalTrendTimeline(){}
    static List<ObjectNode> fhirMeasurements(Map<String,Object> row,Set<String> patientReferences,Instant now){
        var resource=ClinicalFeatureNormalizer.node(row.get("json_data"));
        if(!Set.of("final","amended","corrected").contains(resource.path("status").asText()))return List.of();
        List<JsonNode> quantities=new ArrayList<>();quantities.add(resource);resource.path("component").forEach(quantities::add);
        List<ObjectNode> result=new ArrayList<>();
        for(int index=0;index<quantities.size();index++){
            JsonNode item=quantities.get(index);var d=ClinicalFeatureNormalizer.definition(metric(item.path("code").path("text").asText()));
            for(var coding:item.path("code").path("coding"))if(Set.of("http://loinc.org","LOINC").contains(coding.path("system").asText())){
                var coded=ClinicalFeatureNormalizer.definition(metric(coding.path("code").asText()));if(coded!=null)d=coded;
            }
            if(d==null||!item.has("valueQuantity"))continue;
            var quantity=item.path("valueQuantity");var meta=JSON.createObjectNode().put("unit",quantity.path("unit").asText(quantity.path("code").asText("")))
                .put("sourceVerified",Boolean.TRUE.equals(row.get("source_verified")));
            if(resource.hasNonNull("effectiveDateTime"))meta.set("observedAt",resource.get("effectiveDateTime"));
            if(!patientReferences.contains(resource.path("subject").path("reference").asText()))meta.put("excludedReason","FHIR_SUBJECT_ASSOCIATION_INVALID");
            String id=Objects.toString(row.get("resource_id"))+(index==0?"":"#component-"+index);
            result.add(ClinicalFeatureNormalizer.measurement(d,quantity.path("value"),meta,Objects.toString(ClinicalFeatureNormalizer.instant(row.get("created_date")),null),"FHIR_OBSERVATION",id,null,now));
        }
        return List.copyOf(result);
    }
    static String metric(String source){
        String key=source.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]","");
        return switch(key){
            case "hb","hgb","hemoglobin","haemoglobin","7187" -> "hemoglobin";
            case "serumcreatinine","creatinine","21600" -> "creatinine";
            case "gfr","egfr","339143" -> "egfr";
            case "k","potassium","serumpotassium","serumelectrolytespotassium","28233" -> "potassium";
            case "na","sodium","serumsodium","29511" -> "sodium";
            case "ca","calcium","serumcalcium" -> "calcium";
            case "albumin","serumalbumin" -> "albumin";
            case "urea","bloodurea" -> "urea";
            case "bun","bloodureanitrogen" -> "bun";
            default -> source;
        };
    }
    static ObjectNode assemble(ObjectNode root,ClinicalPredictionFeatureService.FeatureData data,Instant now){
        var result=JSON.createObjectNode().put("version","GOVCARE-RENAL-TIMELINE-1.0").put("evaluatedAt",now.toString())
            .put("historyTruncated",data.truncated()||root.path("historyTruncated").asBoolean());
        List<ObjectNode> rows=new ArrayList<>();
        for(var snapshot:data.snapshots())for(JsonNode f:snapshot.path("features"))addFeature(rows,f);
        for(var f:data.observations())addFeature(rows,f);
        for(JsonNode observation:root.path("observations")){
            var names=observation.path("measurements").fieldNames();while(names.hasNext()){
                String key=names.next();JsonNode raw=observation.path("measurements").path(key);
                String canonical=metric(key),sourceUnit=observation.path("units").path(key).asText("");
                var r=JSON.createObjectNode().put("metric",canonical).put("source","VERIFIED_RENAL_SOURCE")
                    .put("sourceId",observation.path("id").asText()).put("sourceVerified",true)
                    .put("sampleContext",key.endsWith("_pre")?"PRE_HD":key.endsWith("_post")?"POST_HD":"SERUM")
                    .put("unit",sourceUnit).put("originalUnit",sourceUnit).put("sourceNote",observation.path("source_note").asText());
                r.set("observedAt",observation.path("observed_at"));r.set("value",raw);r.set("originalValue",raw);
                r.put("available",raw.isNumber()&&Double.isFinite(raw.asDouble())&&raw.asDouble()>=0);
                r.put("state",r.path("available").asBoolean()?"AVAILABLE":"INVALID");
                // Generic chemistry is never inferred to be a pre/post dialysis sample.
                String definitionKey=key.equals("hb")?"hemoglobin":key.startsWith("creatinine_")?"creatinine":key.startsWith("potassium_")?"potassium":key.startsWith("urea_")?"urea":key;
                if(ClinicalFeatureNormalizer.definition(definitionKey)!=null){
                    var meta=JSON.createObjectNode().put("unit",sourceUnit).put("sourceVerified",true);meta.set("observedAt",r.get("observedAt"));
                    var normalized=ClinicalFeatureNormalizer.measurement(ClinicalFeatureNormalizer.definition(definitionKey),raw,meta,null,"VERIFIED_RENAL_SOURCE",r.path("sourceId").asText(),null,now);
                    r.set("value",normalized.path("value"));r.put("unit",normalized.path("unit").asText()).put("available",normalized.path("available").asBoolean()).put("state",normalized.path("state").asText());
                    if(key.startsWith("creatinine_")&&normalized.path("value").isNumber())r.put("value",normalized.path("value").asDouble()*88.4).put("unit","umol/L");
                }
                if(key.equals("urr")&&(!sourceUnit.equals("%")||raw.asDouble()>100))r.put("available",false).put("state","INVALID");
                rows.add(r);
            }
        }
        var sources=result.putArray("sources");var series=result.putObject("series");
        Map<String,List<ObjectNode>> groups=new LinkedHashMap<>();
        for(var r:rows){
            String reason=!r.path("available").asBoolean()?"INVALID_VALUE_OR_UNIT":!r.path("sourceVerified").asBoolean()?"SOURCE_NOT_VERIFIED":
                ClinicalFeatureNormalizer.instant(r.path("observedAt").asText(null))==null?"MISSING_COLLECTION_DATE":"";
            Instant at=ClinicalFeatureNormalizer.instant(r.path("observedAt").asText(null));
            if(at!=null&&(at.isAfter(now)||at.isBefore(Instant.parse("1900-01-01T00:00:00Z"))))reason="INVALID_COLLECTION_DATE";
            r.put("included",reason.isEmpty()).put("exclusionReason",reason);
            sources.add(r);if(reason.isEmpty())groups.computeIfAbsent(r.path("metric").asText()+"|"+r.path("observedAt").asText()+"|"+r.path("sampleContext").asText("SERUM"),k->new ArrayList<>()).add(r);
        }
        for(var group:groups.values()){
            var first=group.getFirst();boolean conflict=group.stream().anyMatch(r->!r.path("unit").equals(first.path("unit"))||Math.abs(r.path("value").asDouble()-first.path("value").asDouble())>1e-6);
            for(int i=0;i<group.size();i++){
                var r=group.get(i);if(conflict||i>0)r.put("included",false).put("exclusionReason",conflict?"CONFLICTING_RESULT":"DUPLICATE_SOURCE_RESULT");
            }
            if(!conflict){String key=first.path("metric").asText();if(!series.has(key))series.putArray(key);((ArrayNode)series.get(key)).add(first.deepCopy());}
        }
        List<String> dates=new ArrayList<>();int count=0;
        var keys=series.fieldNames();while(keys.hasNext()){
            String key=keys.next();var ordered=new ArrayList<JsonNode>();series.path(key).forEach(ordered::add);ordered.sort(Comparator.comparing(n->n.path("observedAt").asText()));
            var array=series.putArray(key);for(var r:ordered){array.add(r);dates.add(r.path("observedAt").asText());count++;}
        }
        Collections.sort(dates);result.put("verifiedDatedCount",count).put("sourceCount",sources.size());
        if(dates.isEmpty())result.putNull("firstObservedAt").putNull("latestObservedAt");else result.put("firstObservedAt",dates.getFirst()).put("latestObservedAt",dates.getLast());
        result.put("status",sources.isEmpty()?"NO_SOURCE_RESULTS":count==0?"SOURCE_REVIEW_REQUIRED":"AVAILABLE");
        result.put("sourcePolicy","Verified actual collection dates only. Assessment submission, approval and upload times are never collection dates. PRE_HD, POST_HD and serum series remain separate. Duplicate source values are projected once; no clinical record is created.");
        return result;
    }
    private static void addFeature(List<ObjectNode> rows,JsonNode f){
        if(f.path("state").asText().equals("MISSING"))return;
        String key=f.path("key").asText();if(!Set.of("hemoglobin","creatinine","egfr","potassium","urea","bun","albumin","sodium","calcium","acr").contains(key))return;
        var row=f.deepCopy();if(!(row instanceof ObjectNode r))return;
        r.put("metric",key).put("sampleContext",f.path("sampleContext").asText("SERUM"));rows.add(r);
    }
}
