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
    private final ClinicalPdfOcrService ocr;
    private static final int MAX_PDF_BYTES = 15 * 1024 * 1024;

    private record Spec(String feature, String loinc, String display, Pattern pattern, String defaultUnit) {}
    private static final List<Spec> SPECS = List.of(
        spec("SerumCreatinine", "2160-0", "Creatinine [Mass/volume] in Serum or Plasma", "(?:serum\\s+creatinine|creatinine(?:\\s*,?\\s*serum)?|scr)", "mg/dL"),
        spec("GFR", "48642-3", "Glomerular filtration rate/1.73 sq M predicted", "(?:e[- ]?gfr|estimated\\s+gfr|estimated\\s+glomerular\\s+filtration\\s+rate)", "mL/min/1.73m2"),
        spec("HbA1c", "4548-4", "Hemoglobin A1c/Hemoglobin.total in Blood", "(?:hba1c|hb\\s*a1c|glycated\\s+h(?:ae|e)moglobin)", "%"),
        spec("BMI", "39156-5", "Body mass index (BMI)", "(?:bmi|body\\s+mass\\s+index)", "kg/m2"),
        spec("SystolicBP", "8480-6", "Systolic blood pressure", "(?:systolic(?:\\s+(?:blood\\s+pressure|bp))?|sbp)", "mm[Hg]"),
        spec("DiastolicBP", "8462-4", "Diastolic blood pressure", "(?:diastolic(?:\\s+(?:blood\\s+pressure|bp))?|dbp)", "mm[Hg]"),
        spec("ACR", null, "Urine albumin/creatinine ratio", "(?:(?:urine\\s+)?albumin\\s*(?:[/:-]|to|\\s)\\s*creatinine\\s+ratio|urine\\s+acr|uacr|acr)", "mg/g"),
        spec("BUNLevels", "3094-0", "Urea nitrogen [Mass/volume] in Serum or Plasma", "(?:blood\\s+urea\\s+nitrogen|\\bbun\\b)", "mg/dL"),
        spec("SerumElectrolytesPotassium", "2823-3", "Potassium [Moles/volume] in Serum or Plasma", "(?:(?:serum\\s+)?potassium|k\\+)", "mmol/L"),
        spec("HemoglobinLevels", "718-7", "Hemoglobin [Mass/volume] in Blood", "(?:(?:hemoglobin|haemoglobin)(?!\\s*(?:a1c|a1c|total|glycated))|\\bhgb\\b|\\bhb\\b(?!\\s*a1c))", "g/dL"),
        spec("FastingBloodSugar", "1558-6", "Fasting glucose [Mass/volume] in Serum or Plasma", "(?:fasting\\s+(?:blood\\s+)?(?:glucose|sugar)|\\bfbs\\b)", "mg/dL"),
        spec("ProteinInUrine", null, "Urine protein", "(?:urine\\s+protein|protein\\s+in\\s+urine)", "mg/dL"),
        spec("PCV",null,"Packed cell volume","(?:packed\\s+cell\\s+volume|pcv|h(?:ae|e)matocrit|hct)","%"),
        spec("RBC",null,"Red blood cell count","(?:rbc(?:\\s+count)?|red\\s+blood\\s+cell(?:\\s+count)?)","10^12/L"),
        spec("WBC",null,"White blood cell count","(?:wbc(?:\\s+count)?|white\\s+blood\\s+cell(?:\\s+count)?|total\\s+leukocyte\\s+count)","10^9/L"),
        spec("PlateletCount",null,"Platelet count","(?:platelet(?:s|\\s+count)?|plt)","10^9/L"),
        spec("BloodUrea",null,"Blood urea","(?:blood\\s+urea|serum\\s+urea|urea)","mmol/L"),
        spec("SerumSodium",null,"Serum sodium","(?:(?:serum\\s+)?sodium|na\\+)","mmol/L"),
        spec("SerumCalcium",null,"Serum calcium","(?:(?:serum\\s+)?calcium)","mmol/L"),
        spec("SerumAlbumin",null,"Serum albumin","(?:serum\\s+albumin|albumin(?:\\s*,\\s*serum)?)","g/L"),
        spec("BloodGlucose",null,"Blood glucose; fasting status not assumed","(?:(?:random\\s+)?(?:blood\\s+)?glucose)","mg/dL"),
        spec("PreHDUrea",null,"Pre-dialysis urea","(?:(?:pre[- ]?(?:hd|dialysis)\\s+urea)|urea\\s+pre[- ]?(?:hd|dialysis))","mmol/L"),
        spec("PostHDUrea",null,"Post-dialysis urea","(?:(?:post[- ]?(?:hd|dialysis)\\s+urea)|urea\\s+post[- ]?(?:hd|dialysis))","mmol/L")
    );

    public ClinicalPdfExtractionService(LocalPdfExtractionService pdf) { this(pdf,ClinicalPdfOcrService.disabled()); }
    @org.springframework.beans.factory.annotation.Autowired
    public ClinicalPdfExtractionService(LocalPdfExtractionService pdf,ClinicalPdfOcrService ocr) { this.pdf = pdf;this.ocr=ocr; }

    private static Spec spec(String f,String l,String d,String name,String u) {
        Pattern p=Pattern.compile("(?im)^[ \\t]*(?:(?:historical|previous|prior)[ \\t]+)?"+name+"(?=[ \\t:(=|]|$)[ \\t]*(?:\\([^\\r\\n)]{0,40}\\))?[ \\t]*[:=|]?[ \\t]*([<>≤≥]=?[ \\t]*-?\\d+(?:\\.\\d+)?|-?\\d+(?:\\.\\d+)?)[ \\t]*([%a-zA-Zµμ/\\.0-9²³⁹¹×^\\[\\]\\-]+(?:[ \\t]+m[²2])?)?[^\\r\\n]*$");
        return new Spec(f,l,d,p,u);
    }

    public Map<String,Object> extract(byte[] bytes, String source) throws IOException {
        validatePdf(bytes);
        LocalPdfExtractionService.ExtractionResult raw = pdf.extract(bytes);
        var stages=new ArrayList<Map<String,Object>>();stage(stages,"PDF_VALIDATION","SUCCESS","PDF signature and size checked.");
        var lines=new ArrayList<ClinicalPdfOcrService.Line>();
        for(var page:raw.pages())for(String line:page.text().lines().toList())lines.add(new ClinicalPdfOcrService.Line(line,page.page(),null));
        String method=raw.method();var ocrWarnings=new ArrayList<String>();String ocrStatus="SKIPPED";
        boolean scanned=raw.pages().stream().anyMatch(page->page.text().isBlank());
        stage(stages,"TEXT_EXTRACTION",scanned?"REVIEW_REQUIRED":"SUCCESS",scanned?"Some pages have no embedded text.":"Selectable text extracted locally.");
        if(scanned){var recognized=ocr.extract(bytes);ocrStatus=recognized.status();ocrWarnings.add(recognized.message());
            if(ocrStatus.equals("COMPLETED")){method="LOCAL_TEXT_AND_OCR";var blankPages=new HashSet<Integer>();for(var page:raw.pages())if(page.text().isBlank())blankPages.add(page.page());lines.addAll(recognized.lines().stream().filter(line->blankPages.contains(line.page())).toList());}
        }
        stage(stages,"OCR",scanned?"REVIEW_REQUIRED":"SKIPPED",scanned?String.join(" ",ocrWarnings):"Embedded text is available.");
        String text=String.join("\n",lines.stream().map(ClinicalPdfOcrService.Line::text).toList());
        if (text.isBlank()) {
            for(String pending:List.of("IDENTIFIERS_AND_DATES","MEASUREMENT_RECOGNITION","NORMALIZATION_AND_VALIDATION","CONFLICT_REVIEW"))stage(stages,pending,"SKIPPED","No readable text is available; OCR or manual review is required.");
            stage(stages,"CLINICIAN_REVIEW","REVIEW_REQUIRED","Review the scan and supply measured values manually until OCR is available.");
            var out=result(source,method,"OCR_REQUIRED",Map.of(),List.of(),ocrWarnings);out.put("processingStages",stages);out.put("ocrStatus",ocrStatus);return out;
        }
        Map<String,Object> extracted = new LinkedHashMap<>();
        var candidates=new LinkedHashMap<String,List<Map<String,Object>>>();var conflicts=new ArrayList<Map<String,Object>>();
        List<Map<String,Object>> unrecognized = new ArrayList<>();
        List<String> warnings = new ArrayList<>(ocrWarnings);
        for (Spec s : SPECS) {
            Matcher m=s.pattern().matcher(text);
            while(m.find()){
            if(s.feature().equals("HemoglobinLevels")&&m.group(0).toLowerCase(Locale.ROOT).matches(".*(?:hba1c|hb\\s*a1c|glycated).*"))continue;
            if(historicalAt(text,m.start(),m.group(0))){unrecognized.add(Map.of("text",m.group(0).trim(),"reason","Historical measurement retained for review; not assigned as a current input"));continue;}
            if(Pattern.compile("\\b\\d{4}-\\d{2}-\\d{2}\\b").matcher(m.group(0)).find()){unrecognized.add(Map.of("text",m.group(0).trim(),"reason","Per-result date requires manual reconciliation; no current measurement time was assumed"));continue;}
            var line=lines.stream().filter(item->item.text().trim().equals(m.group(0).trim())).min(Comparator.comparingDouble(item->item.confidence()==null?1:item.confidence())).orElse(null);
            if(line!=null&&line.confidence()!=null&&line.confidence()<.70){unrecognized.add(Map.of("text",m.group(0).trim(),"reason","Low-confidence OCR result; check the scan and enter the measured value manually"));continue;}
            String rawNumber=m.group(1).replaceAll("[<>\\s]","");
            try {
                BigDecimal original=new BigDecimal(rawNumber);
                String printedUnit=Objects.toString(m.group(2),"").trim();String unit=normalizeUnit(printedUnit, "");
                BigDecimal normalized=original;
                String normalizedUnit=unit;
                var definition=ClinicalFeatureNormalizer.definition(s.feature());
                Double converted=definition==null?null:ClinicalFeatureNormalizer.convert(definition.key(),original.doubleValue(),unit);
                if(converted==null||!Double.isFinite(converted)||converted<definition.minimum()||converted>definition.maximum()||definition.strictlyPositive()&&converted<=0||text.substring(m.start(),m.end(1)).matches("(?s).*[<>\u2264\u2265].*")){
                    unrecognized.add(Map.of("text",m.group(0).trim(),"reason","Unsupported unit, qualified result or invalid numeric value; manual review required"));continue;
                }
                normalized=BigDecimal.valueOf(converted).setScale(3,RoundingMode.HALF_UP).stripTrailingZeros();normalizedUnit=definition.unit();
                Map<String,Object> v=new LinkedHashMap<>();
                v.put("feature",s.feature()); v.put("value",normalized); v.put("unit",normalizedUnit);
                v.put("loinc",s.loinc()); v.put("display",s.display()); v.put("confidence",line==null||line.confidence()==null?.95:line.confidence());
                v.put("confidenceBasis",line==null||line.confidence()==null?"TEXT_MAPPING_HEURISTIC_NOT_CLINICAL_VERIFICATION":"MINIMUM_TESSERACT_WORD_CONFIDENCE");
                if(line!=null)v.put("sourcePage",line.page());v.put("sourceVerified",false);v.put("requiresReview",true);v.put("conversionMethod",conversionMethod(definition.key(),unit,normalizedUnit));
                v.put("source","PDF"); v.put("originalValue",original); v.put("originalUnit",printedUnit);
                v.put("originalText",m.group(0).trim());
                if (s.loinc()==null) warnings.add(s.display()+" was extracted but no LOINC code was assigned because report semantics/specimen are not sufficiently specific.");
                var group=candidates.computeIfAbsent(s.feature(),key->new ArrayList<>());
                if(group.stream().noneMatch(item->item.get("value").equals(v.get("value"))&&item.get("unit").equals(v.get("unit"))))group.add(v);
            } catch (NumberFormatException ignored) { unrecognized.add(Map.of("text",m.group(0).trim(),"reason","Unable to parse numeric value")); }
            }
        }
        candidates.forEach((key,group)->{if(group.size()==1)extracted.put(key,group.getFirst());else conflicts.add(Map.of("feature",key,"candidates",group,"message","Choose between competing measurements in this report."));});
        if (candidates.isEmpty()) warnings.add("No recognized CKD laboratory values were found in this report. You can enter the values manually below.");
        for(String line:text.lines().map(String::trim).toList()){
            boolean mapped=candidates.values().stream().flatMap(List::stream).anyMatch(value->line.equals(value.get("originalText")));
            boolean retained=unrecognized.stream().anyMatch(value->line.equals(value.get("text")));
            if(!mapped&&!retained&&(line.matches("(?i).*\\b(?:CRP|ALT|Platelet(?: Count)?|C[- ]reactive protein|alanine aminotransferase|serum albumin|blood urea(?! nitrogen)|urine creatinine)\\b.*")||line.matches("(?i)^[\\p{L}][\\p{L} ()./+:-]{1,65}\\s+[-<>]?\\d+(?:\\.\\d+)?\\s+(?:%|(?:[munpµμ]?(?:g|mol|iu|u|eq)|cells|10\\^[0-9]+)/(?:[dmunp]?l|[munp]?g|[munp]?mol)|mmhg|kg/m[²2])(?:\\s|$).*")))unrecognized.add(Map.of("text",line,"reason","No mapping to the configured CKD model input contract"));
        }
        var out=result(source,method,candidates.isEmpty()?"NO_SUPPORTED_MEASUREMENTS":unrecognized.isEmpty()&&conflicts.isEmpty()&&!scanned?"COMPLETED":"PARTIAL",extracted,unrecognized,warnings);
        out.put("measurementCandidates",candidates);out.put("conflicts",conflicts);out.put("detectedCount",candidates.values().stream().mapToInt(List::size).sum());
        stage(stages,"MEASUREMENT_RECOGNITION",candidates.isEmpty()?"REVIEW_REQUIRED":"SUCCESS",candidates.size()+" supported measurement types recognized.");
        stage(stages,"NORMALIZATION_AND_VALIDATION",unrecognized.isEmpty()?"SUCCESS":"REVIEW_REQUIRED",unrecognized.size()+" results retained for manual review.");
        stage(stages,"CONFLICT_REVIEW",conflicts.isEmpty()?"SUCCESS":"REVIEW_REQUIRED",conflicts.size()+" measurement types have competing results.");
        stage(stages,"CLINICIAN_REVIEW","REVIEW_REQUIRED","Review and approve values before applying them. No observations were saved.");out.put("processingStages",stages);
        var identity=new LinkedHashMap<String,Object>();
        boolean identityConflict=false;
        for(String[] item:List.of(new String[]{"patientNumber","(?:patient\\s*(?:id|number|no\\.?|identifier))"},new String[]{"nic","(?:NIC|national\\s*(?:identity|id)(?:\\s*number)?)"},new String[]{"patientName","patient(?:\\s*name)?"})){
            var matcher=Pattern.compile("(?im)^\\s*"+item[1]+"\\s*[:=]\\s*([^\\r\\n]+)$").matcher(text);var found=new LinkedHashSet<String>();
            while(matcher.find()){String value=matcher.group(1).trim();if(!identity.containsKey(item[0]))identity.put(item[0],value);found.add(value.replaceAll("[^\\p{L}\\p{N}]","").toUpperCase(Locale.ROOT));}if(found.size()>1)identityConflict=true;
        }
        out.put("identityConflict",identityConflict);
        out.put("patientIdentity",identity);
        stage(stages,"IDENTIFIERS_AND_DATES",identity.isEmpty()?"REVIEW_REQUIRED":"SUCCESS",identity.isEmpty()?"No printed identity; confirm the selected patient.":"Printed identity retained for comparison.");
        var dates=new LinkedHashMap<String,Object>();
        var collection=Pattern.compile("(?im)^\\s*(?:collection(?:\\s*(?:date|time))?|specimen\\s*collected|sample\\s*collected)\\s*[:=]\\s*(\\d{4}-\\d{2}-\\d{2}T[^\\s]+)").matcher(text);
        var collectionTimes=new LinkedHashSet<String>();while(collection.find())if(ClinicalFeatureNormalizer.instant(collection.group(1))!=null)collectionTimes.add(collection.group(1));
        if(collectionTimes.size()==1){String at=collectionTimes.iterator().next();dates.put("specimenCollectionTime",at);for(var group:candidates.values())for(var value:group)value.put("clinicalDate",at);}
        else if(collectionTimes.size()>1)warnings.add("Multiple collection times require per-result review. No shared measurement date was assumed.");
        var reportDate=Pattern.compile("(?im)^\\s*report\\s*date\\s*[:=]\\s*(\\d{4}-\\d{2}-\\d{2}|\\d{2}/\\d{2}/\\d{4})\\b").matcher(text);
        if(reportDate.find())try{String printed=reportDate.group(1);var date=java.time.LocalDate.parse(printed,printed.contains("/")?java.time.format.DateTimeFormatter.ofPattern("dd/MM/uuuu").withResolverStyle(java.time.format.ResolverStyle.STRICT):java.time.format.DateTimeFormatter.ISO_LOCAL_DATE);dates.put("reportDate",date.toString());}catch(java.time.DateTimeException invalid){warnings.add("The printed report date requires manual review.");}
        out.put("reportDates",dates);return out;
    }

    private Map<String,Object> result(String source,String method,String status,Map<String,Object> values,List<Map<String,Object>> unknown,List<String>warnings){
        Map<String,Object> out=new LinkedHashMap<>(); out.put("success",!"OCR_REQUIRED".equals(status)); out.put("source",source);
        out.put("extractionMethod",method); out.put("status",status); out.put("extractedValues",values);
        out.put("detectedCount",values.size()); out.put("unrecognizedResults",unknown); out.put("warnings",warnings); return out;
    }
    private void validatePdf(byte[] b) throws IOException{ if(b==null||b.length<5)throw ApiException.badRequest("The PDF is empty."); if(b.length>MAX_PDF_BYTES)throw ApiException.badRequest("PDF exceeds the 15 MB limit."); if(!(b[0]=='%'&&b[1]=='P'&&b[2]=='D'&&b[3]=='F'&&b[4]=='-'))throw ApiException.badRequest("The uploaded file is not a valid PDF."); lk.gov.health.govcare.documents.ClinicalPdfFileValidation.validate(b); }
    private String normalizeUnit(String raw,String fallback){ if(raw==null||raw.isBlank())return fallback; String u=raw.trim(); return u.replace("µ","μ").replace("mL/min/1.73m²","mL/min/1.73m2"); }
    private static void stage(List<Map<String,Object>> stages,String name,String status,String message){stages.add(Map.of("stage",name,"status",status,"message",message));}
    private static boolean historicalAt(String text,int position,String line){
        if(line.stripLeading().matches("(?i)^(?:historical|previous|prior)\\b.*"))return true;
        boolean historical=false;for(String previous:text.substring(0,position).lines().toList()){
            if(previous.trim().matches("(?i)^(?:historical|previous|prior)\\s+(?:results|measurements|laboratory.*)\\s*:?.*$"))historical=true;
            if(previous.trim().matches("(?i)^(?:current|new|recent)\\s+(?:results|measurements|laboratory.*)\\s*:?.*$"))historical=false;
        }return historical;
    }
    static String conversionMethod(String key,String unit,String target){
        String u=unit.toLowerCase(Locale.ROOT).replace("µ","u").replace("μ","u").replace(" ","");
        if(key.equals("creatinine")&&u.equals("umol/l"))return "DIVIDE_BY_88.4";
        if(key.equals("hemoglobin")&&u.equals("g/l"))return "DIVIDE_BY_10";
        if(key.equals("acr")&&u.equals("mg/mmol"))return "MULTIPLY_BY_8.84";
        if(key.equals("hba1c")&&u.equals("mmol/mol"))return "MULTIPLY_BY_0.09148_ADD_2.15";
        if(key.equals("glucose")&&u.equals("mmol/l"))return "MULTIPLY_BY_18.0182";
        if(key.equals("bun")&&u.equals("mmol/l"))return "MULTIPLY_BY_2.801_NITROGEN_ONLY";
        if(key.equals("proteinuria")&&u.equals("g/l"))return "MULTIPLY_BY_100";
        if(key.equals("proteinuria")&&u.equals("mg/l"))return "DIVIDE_BY_10";
        if(Set.of("urea","urea_pre","urea_post").contains(key)&&u.equals("mg/dl"))return "DIVIDE_BY_6.006_UREA_ONLY";
        if(key.equals("albumin")&&u.equals("g/dl"))return "MULTIPLY_BY_10";
        if(key.equals("pcv")&&u.equals("l/l"))return "MULTIPLY_BY_100";
        if(key.equals("calcium")&&u.equals("mg/dl"))return "MULTIPLY_BY_0.2495";
        if(key.equals("blood_glucose")&&u.equals("mmol/l"))return "MULTIPLY_BY_18.0182";
        if(Set.of("wbc","platelets").contains(key)&&Set.of("/ul","cells/ul").contains(u))return "DIVIDE_BY_1000";
        return "IDENTITY_OR_EQUIVALENT_UNIT: "+unit+" -> "+target;
    }
}
