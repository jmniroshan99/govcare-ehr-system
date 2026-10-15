package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.*;
import java.time.*;
import java.util.*;

/** Normalizes saved CKD measurements, with per-feature dates and lineage. Never imputes a value or date. */
public final class ClinicalFeatureNormalizer {
    public static final String VERSION="GOVCARE-CLINICAL-FEATURES-1.0";
    private static final ObjectMapper JSON=new ObjectMapper().findAndRegisterModules().disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    public record Definition(String input,String key,String label,String unit,double minimum,double maximum,boolean strictlyPositive) {}
    public static final List<Definition> DEFINITIONS=List.of(
        new Definition("SerumCreatinine","creatinine","Serum Creatinine","mg/dL",0,50,true),
        new Definition("GFR","egfr","eGFR","mL/min/1.73m²",0,300,false),
        new Definition("ACR","acr","Urine ACR","mg/g",0,100000,false),
        new Definition("SerumElectrolytesPotassium","potassium","Serum Potassium","mmol/L",0,15,true),
        new Definition("HemoglobinLevels","hemoglobin","Hemoglobin","g/dL",0,30,true),
        new Definition("HbA1c","hba1c","HbA1c","%",0,30,true),
        new Definition("ProteinInUrine","proteinuria","Protein in urine","mg/dL",0,100000,false),
        new Definition("Age","age","Age","years",0,120,false),
        new Definition("BMI","bmi","BMI","kg/m²",0,150,true),
        new Definition("SystolicBP","systolic","Systolic Blood Pressure","mmHg",0,350,true),
        new Definition("DiastolicBP","diastolic","Diastolic Blood Pressure","mmHg",0,350,true),
        new Definition("FastingBloodSugar","glucose","Fasting Blood Sugar","mg/dL",0,2000,true),
        new Definition("BUNLevels","bun","BUN","mg/dL",0,500,false),
        new Definition("Edema","edema","Edema","boolean",0,1,false),
        new Definition("FamilyHistoryKidneyDisease","family_history","Family history of kidney disease","boolean",0,1,false),
        new Definition("PreviousAcuteKidneyInjury","previous_aki","Previous AKI","boolean",0,1,false),
        new Definition("NSAIDsUse","nsaids_use","NSAIDs use","assessment scale",0,10,false));
    public static Definition definition(String key){return DEFINITIONS.stream().filter(d->d.key().equals(key)||d.input().equals(key)).findFirst().orElse(null);}
    static JsonNode node(Object value){if(value instanceof JsonNode n)return n;try{return value instanceof String s?JSON.readTree(s):JSON.valueToTree(value);}catch(Exception e){return JSON.createObjectNode();}}
    static Instant instant(Object value){if(value instanceof Instant i)return i;if(value instanceof java.sql.Timestamp t)return t.toInstant();if(value instanceof OffsetDateTime t)return t.toInstant();try{return value==null?null:OffsetDateTime.parse(value.toString()).toInstant();}catch(Exception e){return null;}}
    static ObjectNode assessment(Map<String,Object> row,Instant now){
        ObjectNode out=JSON.createObjectNode();String id=Objects.toString(row.get("source_assessment_id"),Objects.toString(row.get("id"),""));
        out.put("id",Objects.toString(row.get("id"),id)).put("assessmentId",id).put("source","CKD_ASSESSMENT");
        putDate(out,"recordedAt",instant(row.get("recorded_at")));ObjectNode features=out.putObject("features");
        JsonNode raw=node(row.get("raw_inputs")),metadata=node(row.get("feature_metadata"));Instant latest=null;Set<Instant> dates=new HashSet<>();
        for(Definition d:DEFINITIONS){JsonNode value=raw.path(d.input()),detail=metadata.path(d.input());
            ObjectNode f=measurement(d,value,detail,out.path("recordedAt").asText(null),"CKD_ASSESSMENT",id,id,now);
            features.set(d.key(),f);Instant at=instant(f.path("observedAt").asText(null));if(at!=null&&f.path("available").asBoolean()){dates.add(at);if(latest==null||at.isAfter(latest))latest=at;}
        }
        putDate(out,"observationDate",latest);out.put("mixedObservationDates",dates.size()>1);return out;
    }
    static ObjectNode measurement(Definition d,JsonNode raw,JsonNode metadata,String recorded,String source,String sourceId,String assessmentId,Instant now){
        ObjectNode f=JSON.createObjectNode();f.put("key",d.key()).put("label",d.label()).put("unit",d.unit()).put("source",source).put("sourceId",sourceId);
        f.put("assessmentId",assessmentId);f.put("recordedAt",recorded);f.putNull("observedAt");f.putNull("value");f.put("available",false);ArrayNode flags=f.putArray("qualityFlags");
        if(raw.isMissingNode()||raw.isNull()){f.put("state","MISSING");return f;}
        String sourceUnit=metadata.path("unit").asText(d.unit());f.put("originalUnit",sourceUnit);f.set("originalValue",raw);
        Double number=raw.isNumber()?raw.asDouble():null;Double normalized=number==null?null:convert(d.key(),number,sourceUnit);
        String invalid=metadata.path("excludedReason").asText("");
        if(!invalid.isBlank()){flags.add(invalid);f.put("state","INVALID");return f;}
        if(number==null||!Double.isFinite(number)||number<0||d.strictlyPositive()&&number<=0||normalized==null||!Double.isFinite(normalized)||normalized<d.minimum()||normalized>d.maximum()||d.strictlyPositive()&&normalized<=0
                ||d.unit().equals("boolean")&&normalized!=0&&normalized!=1){flags.add("INVALID_VALUE_OR_UNIT");f.put("state","INVALID");return f;}
        JsonNode declared=metadata.path("observedAt");if(declared.isMissingNode()||declared.isNull())declared=metadata.path("clinicalDate");
        Instant at=instant(declared.asText(null));
        if(!declared.isMissingNode()&&!declared.isNull()&&!declared.asText().isBlank()&&(at==null||at.isAfter(now)||at.isBefore(Instant.parse("1900-01-01T00:00:00Z")))){
            flags.add(at!=null&&at.isAfter(now)?"FUTURE_CLINICAL_DATE":"INVALID_CLINICAL_DATE");f.put("state","INVALID");return f;
        }
        f.put("value",normalized).put("available",true).put("state",at==null?"UNDATED":"AVAILABLE");putDate(f,"observedAt",at);
        if(at==null)flags.add("MISSING_CLINICAL_DATE");else if(Duration.between(at,now).toDays()>62){flags.add("HISTORICAL_MEASUREMENT_OVER_62_DAYS");f.put("state","STALE");}
        if(metadata.path("observationId").isTextual())f.put("observationId",metadata.path("observationId").asText());
        if(metadata.path("referenceHigh").isNumber()){Double high=convert(d.key(),metadata.path("referenceHigh").asDouble(),metadata.path("referenceHighUnit").asText(sourceUnit));if(high!=null&&Double.isFinite(high)&&high>=d.minimum()&&high<=d.maximum()&&(!d.strictlyPositive()||high>0))f.put("referenceHigh",high);}
        return f;
    }
    static Double convert(String key,double value,String unit){
        String u=Objects.toString(unit,"").trim().toLowerCase(Locale.ROOT).replace("μ","u").replace("µ","u").replace("²","2").replace("^","").replace(" ","");
        Definition d=definition(key);if(d==null)return null;String canonical=d.unit().toLowerCase(Locale.ROOT).replace("²","2").replace(" ","");
        if(u.equals(canonical))return value;
        return switch(key){
            case "creatinine"->u.equals("umol/l")?value/88.4:null;
            case "acr"->u.equals("mg/mmol")?value*8.84:u.equals("ug/mg")?value:null;
            case "potassium"->u.equals("meq/l")?value:null;
            case "hemoglobin"->u.equals("g/l")?value/10:null;
            case "hba1c"->u.equals("mmol/mol")?value*.09148+2.15:null;
            case "glucose"->u.equals("mmol/l")?value*18.0182:null;
            case "egfr"->Set.of("ml/min/1.73m2","ml/min/1.73m²").contains(u)?value:null;
            case "systolic","diastolic"->u.equals("mm[hg]")?value:null;
            case "proteinuria"->u.equals("g/l")?value*100:u.equals("mg/l")?value/10:null;
            case "bun"->u.equals("mmol/l")?value*2.801:null;
            case "age","edema","family_history","previous_aki","nsaids_use"->u.isBlank()?value:null;
            default->null;
        };
    }
    static void putDate(ObjectNode out,String key,Instant date){if(date==null)out.putNull(key);else out.put(key,date.toString());}
}
