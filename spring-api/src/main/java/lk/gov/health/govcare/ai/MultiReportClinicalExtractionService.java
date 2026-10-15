package lk.gov.health.govcare.ai;

import org.springframework.stereotype.Service;
import java.io.IOException;
import java.util.*;

/** Coordinates independent PDF extraction and safe merge. Extraction never persists observations. */
@Service
public class MultiReportClinicalExtractionService {
    private final ClinicalPdfExtractionService extraction;
    public MultiReportClinicalExtractionService(ClinicalPdfExtractionService extraction){this.extraction=extraction;}

    public Map<String,Object> extract(List<ReportInput> inputs) throws IOException {
        List<Map<String,Object>> reports=new ArrayList<>();
        Map<String,List<Map<String,Object>>> byFeature=new LinkedHashMap<>();
        List<String> warnings=new ArrayList<>();
        for(ReportInput input:inputs){
            Map<String,Object> one=new LinkedHashMap<>(extraction.extract(input.bytes(),input.source()));
            one.put("fileName",input.fileName());
            one.put("reportId",input.reportId());
            @SuppressWarnings("unchecked") Map<String,Map<String,Object>> values=(Map<String,Map<String,Object>>)one.getOrDefault("extractedValues",Map.of());
            one.put("category",classify(values.keySet()));
            for(Map<String,Object> v:values.values()){
                Map<String,Object> copy=new LinkedHashMap<>(v);
                copy.put("sourceReport",input.fileName()); copy.put("reportId",input.reportId()); copy.put("sourceType",input.source());
                byFeature.computeIfAbsent(Objects.toString(v.get("feature")),k->new ArrayList<>()).add(copy);
            }
            reports.add(one);
        }
        Map<String,Object> merged=new LinkedHashMap<>(); List<Map<String,Object>> conflicts=new ArrayList<>();
        for(var e:byFeature.entrySet()){
            List<Map<String,Object>> candidates=e.getValue();
            if(candidates.size()==1){merged.put(e.getKey(),candidates.get(0));continue;}
            Set<String> distinct=new LinkedHashSet<>();
            for(Map<String,Object> c:candidates) distinct.add(Objects.toString(c.get("value"))+"|"+Objects.toString(c.get("unit")));
            if(distinct.size()==1) merged.put(e.getKey(),candidates.get(0));
            else conflicts.add(Map.of("feature",e.getKey(),"candidates",candidates,"message","Multiple different values were found. Clinician review is required; no value was selected automatically."));
        }
        if(!conflicts.isEmpty())warnings.add("Conflicting clinical results were detected. Resolve them before running the CKD assessment.");
        Map<String,Object> out=new LinkedHashMap<>();out.put("success",true);out.put("reports",reports);out.put("mergedClinicalData",merged);out.put("conflicts",conflicts);out.put("warnings",warnings);return out;
    }
    private String classify(Set<String> features){
        if(features.contains("ACR")||features.contains("ProteinInUrine"))return "URINE";
        if(features.contains("SerumCreatinine")||features.contains("GFR")||features.contains("BUNLevels"))return "RENAL_FUNCTION";
        if(features.contains("HbA1c")||features.contains("FastingBloodSugar"))return "DIABETES";
        if(features.contains("HemoglobinLevels"))return "CBC";
        return "OTHER";
    }
    public record ReportInput(byte[] bytes,String fileName,String source,String reportId){}
}
