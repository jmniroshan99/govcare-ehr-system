package lk.gov.health.govcare.ai;

import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.documents.LocalPdfExtractionService;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Extracts CKD model features from PDF text. This service never invents missing values. */
@Service
public class ClinicalPdfExtractionService {
    private final LocalPdfExtractionService pdf;
    private static final int MAX_PDF_BYTES = 15 * 1024 * 1024;

    private record Spec(String feature, String loinc, String display, Pattern pattern, String defaultUnit) {}
    private static final List<Spec> SPECS = List.of(
        spec("SerumCreatinine", "2160-0", "Creatinine [Mass/volume] in Serum or Plasma", "(?:serum\\s+)?creatinine", "mg/dL"),
        spec("GFR", "48642-3", "Glomerular filtration rate/1.73 sq M predicted", "(?:e[- ]?gfr|estimated\\s+glomerular\\s+filtration\\s+rate)", "mL/min/1.73m2"),
        spec("HbA1c", "4548-4", "Hemoglobin A1c/Hemoglobin.total in Blood", "(?:hba1c|hb\\s*a1c|glycated\\s+hemoglobin)", "%"),
        spec("BMI", "39156-5", "Body mass index (BMI)", "(?:bmi|body\\s+mass\\s+index)", "kg/m2"),
        spec("SystolicBP", "8480-6", "Systolic blood pressure", "(?:systolic(?:\\s+blood\\s+pressure)?|sbp)", "mm[Hg]"),
        spec("DiastolicBP", "8462-4", "Diastolic blood pressure", "(?:diastolic(?:\\s+blood\\s+pressure)?|dbp)", "mm[Hg]"),
        spec("ACR", null, "Urine albumin/creatinine ratio", "(?:urine\\s+albumin(?:\\s*[/:-]\\s*creatinine)?\\s+ratio|albumin\\s*[/:-]\\s*creatinine\\s+ratio|\\bacr\\b)", "mg/g"),
        spec("BUNLevels", "3094-0", "Urea nitrogen [Mass/volume] in Serum or Plasma", "(?:blood\\s+urea\\s+nitrogen|\\bbun\\b)", "mg/dL"),
        spec("SerumElectrolytesPotassium", "2823-3", "Potassium [Moles/volume] in Serum or Plasma", "(?:serum\\s+)?potassium", "mmol/L"),
        spec("HemoglobinLevels", "718-7", "Hemoglobin [Mass/volume] in Blood", "(?:(?:hemoglobin|haemoglobin)(?!\\s*(?:a1c|a1c|total|glycated))|\\bhgb\\b)", "g/dL"),
        spec("FastingBloodSugar", "1558-6", "Fasting glucose [Mass/volume] in Serum or Plasma", "(?:fasting\\s+(?:blood\\s+)?(?:glucose|sugar)|\\bfbs\\b)", "mg/dL"),
        spec("ProteinInUrine", null, "Urine protein", "(?:urine\\s+protein|protein\\s+in\\s+urine)", "mg/dL")
    );

    public ClinicalPdfExtractionService(LocalPdfExtractionService pdf) { this.pdf = pdf; }

    private static Spec spec(String f,String l,String d,String name,String u) {
        Pattern p=Pattern.compile("(?im)^.*?"+name+"[^\\r\\n]{0,45}?([<>]?\\s*-?\\d+(?:\\.\\d+)?)\\s*([%a-zA-Zµμ/\\.0-9²^\\-]+)?[^\\r\\n]*$");
        return new Spec(f,l,d,p,u);
    }

    public Map<String,Object> extract(byte[] bytes, String source) throws IOException {
        validatePdf(bytes);
        LocalPdfExtractionService.ExtractionResult raw = pdf.extract(bytes);
        String text = raw.pages().stream().map(LocalPdfExtractionService.PageText::text).reduce("", (a,b)->a+"\n"+b);
        if (text.isBlank()) {
            return result(source, raw.method(), "OCR_REQUIRED", Map.of(), List.of(),
                    List.of("No embedded text layer was found. OCR is required for this scanned PDF; enter values manually if OCR is not configured."));
        }
        Map<String,Object> extracted = new LinkedHashMap<>();
        List<Map<String,Object>> unrecognized = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        for (Spec s : SPECS) {
            Matcher m=s.pattern().matcher(text);
            if (!m.find()) continue;
            String rawNumber=m.group(1).replaceAll("[<>\\s]","");
            try {
                BigDecimal original=new BigDecimal(rawNumber);
                String unit=normalizeUnit(m.group(2), s.defaultUnit());
                BigDecimal normalized=original;
                String normalizedUnit=unit;
                if (s.feature().equals("SerumCreatinine") && unit.toLowerCase(Locale.ROOT).matches(".*(?:µ|μ|u)mol/l.*")) {
                    normalized=original.divide(BigDecimal.valueOf(88.4), 3, RoundingMode.HALF_UP);
                    normalizedUnit="mg/dL";
                }
                Map<String,Object> v=new LinkedHashMap<>();
                v.put("feature",s.feature()); v.put("value",normalized); v.put("unit",normalizedUnit);
                v.put("loinc",s.loinc()); v.put("display",s.display()); v.put("confidence",0.95);
                v.put("source","PDF"); v.put("originalValue",original); v.put("originalUnit",unit);
                v.put("originalText",m.group(0).trim());
                if (s.loinc()==null) warnings.add(s.display()+" was extracted but no LOINC code was assigned because report semantics/specimen are not sufficiently specific.");
                extracted.put(s.feature(),v);
            } catch (NumberFormatException ignored) { unrecognized.add(Map.of("text",m.group(0).trim(),"reason","Unable to parse numeric value")); }
        }
        if (extracted.isEmpty()) warnings.add("No recognized CKD laboratory values were found in this report. You can enter the values manually below.");
        return result(source, raw.method(), "COMPLETED", extracted, unrecognized, warnings);
    }

    private Map<String,Object> result(String source,String method,String status,Map<String,Object> values,List<Map<String,Object>> unknown,List<String>warnings){
        Map<String,Object> out=new LinkedHashMap<>(); out.put("success",!"OCR_REQUIRED".equals(status)); out.put("source",source);
        out.put("extractionMethod",method); out.put("status",status); out.put("extractedValues",values);
        out.put("detectedCount",values.size()); out.put("unrecognizedResults",unknown); out.put("warnings",warnings); return out;
    }
    private void validatePdf(byte[] b){ if(b==null||b.length<5)throw ApiException.badRequest("The PDF is empty."); if(b.length>MAX_PDF_BYTES)throw ApiException.badRequest("PDF exceeds the 15 MB limit."); if(!(b[0]=='%'&&b[1]=='P'&&b[2]=='D'&&b[3]=='F'&&b[4]=='-'))throw ApiException.badRequest("The uploaded file is not a valid PDF."); }
    private String normalizeUnit(String raw,String fallback){ if(raw==null||raw.isBlank())return fallback; String u=raw.trim(); return u.replace("µ","μ").replace("mL/min/1.73m²","mL/min/1.73m2"); }
}
