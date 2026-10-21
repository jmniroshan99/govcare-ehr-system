package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;

/** Versioned, auditable definitions for the deterministic clinical calculations. */
public final class ClinicalRuleRegistry {
    public static final String VERSION="GOVCARE-CLINICAL-RULES-2.0";
    public static final double K_SEVERE_LOW=2.5,K_MODERATE_LOW=3.0,K_LOW=3.5,K_HIGH=5.5,K_MODERATE_HIGH=6.0,K_SEVERE_HIGH=6.5;
    public static final double HB_ADULT_MALE=13,HB_ADULT_FEMALE=12;
    public static final String KDIGO_ANEMIA="https://kdigo.org/wp-content/uploads/2026/04/KDIGO-2026-Anemia-in-CKD-Guideline.pdf";
    public static final String LOW_K="https://www.sps.nhs.uk/articles/hypokalaemia/";
    public static final String HIGH_K="https://www.ukkidney.org/sites/default/files/FINAL%20VERSION%20-%20UKKA%20CLINICAL%20PRACTICE%20GUIDELINE%20-%20MANAGEMENT%20OF%20HYPERKALAEMIA%20IN%20ADULTS%20-%20191223.pdf";
    public static final String CKD="https://kdigo.org/wp-content/uploads/2024/03/KDIGO-2024-CKD-Guideline.pdf";
    public static final String AKI="https://kdigo.org/wp-content/uploads/2016/10/KDIGO-2012-AKI-Guideline-English.pdf";
    public static final String URR="https://www.kidney.org/kidney-topics/hemodialysis";
    private static final ObjectMapper JSON=new ObjectMapper();
    private ClinicalRuleRegistry(){}
    public static ObjectNode rule(String key){
        var r=JSON.createObjectNode().put("id",key).put("version",VERSION).put("validationStatus","SOFTWARE_VERIFIED_CLINICAL_VALIDATION_INCOMPLETE")
                .put("localApproval","[Confirm with the nephrologist] local applicability and review protocol")
                .put("explanationMethod","DETERMINISTIC_RULE").put("verificationTests","ClinicalIntelligenceRulesTest; ClinicalIntelligenceConsistencyTest");
        r.putNull("horizonYears");r.putNull("artifact");r.put("missingDataPolicy","Never impute measurements, dates, sex, diabetes or clinical context. Unavailable numerical results are null.");
        switch(key){
            case "POTASSIUM_SEVERITY" -> {r.put("outcome","Recorded serum potassium abnormality").put("outputType","MEASUREMENT_SEVERITY").put("eligiblePopulation","Adult reference comparison; sample, dialysis timing and local reference limits require review");
                r.putArray("requiredInputs").add("potassium [mmol/L]");r.putArray("sources").add(LOW_K).add(HIGH_K);
                r.put("thresholdPolicy","Use unrounded values: severe low <2.5; moderate low [2.5,3.0); mild low [3.0,3.5); no adopted low/high band [3.5,5.5); mild high [5.5,6.0); moderate high [6.0,6.5); severe high >=6.5 mmol/L. No treatment order or future probability.");}
            case "ADULT_HEMOGLOBIN" -> {r.put("outcome","Recorded hemoglobin compared with the applicable adult KDIGO anemia reference").put("outputType","MEASUREMENT_SEVERITY").put("eligiblePopulation","Adults with recorded age and sex; pediatric/pregnancy pathways require specific review");
                r.putArray("requiredInputs").add("hemoglobin [g/dL]");r.putArray("sources").add(KDIGO_ANEMIA);
                r.put("thresholdPolicy","Adult male Hb <13 g/dL; adult female Hb <12 g/dL. Equality is not below threshold. Review CBC, reticulocytes, ferritin and TSAT; Hb alone does not establish iron deficiency or treatment indication.");}
            case "CREATININE_CHANGE" -> {r.put("outcome","Observed creatinine change").put("outputType","OBSERVED_TREND").put("eligiblePopulation","Same patient; comparable units/sampling context; two distinct verified collection times");
                r.putArray("requiredInputs").add("creatinine [mg/dL]").add("previous_creatinine [mg/dL]").add("current_creatinine_date").add("previous_creatinine_date");r.putArray("sources").add(CKD);
                r.put("formula","absolute = new - previous; percent = 100 * (new - previous) / previous; previous > 0").put("thresholdPolicy","No invented progression bands, forecast, AKI diagnosis or probability from a historical change.");}
            case "MEASURED_URR" -> {r.put("outcome","Measured dialysis urea reduction ratio").put("outputType","MEASURED_DIALYSIS_METRIC").put("eligiblePopulation","Verified same-patient, same-session pre/post urea samples with ordered collection times and compatible units");
                r.putArray("requiredInputs").add("urea_pre").add("urea_post").add("session_id").add("pre_collected_at").add("post_collected_at").add("compatible_units").add("verified_source");r.putArray("sources").add(URR);
                r.put("formula","100 * (pre - post) / pre; pre > 0; 0 <= post <= pre").put("thresholdPolicy","URR >=65% is a common reference for many patients receiving in-centre HD three times weekly; regimen and individual target must be verified. URR is not event risk.");}
            case "KDIGO_GA_CLASSIFICATION" -> {r.put("outcome","GFR/albuminuria prognostic category").put("outputType","PROGNOSTIC_CLASSIFICATION").put("eligiblePopulation","CKD with chronicity clinically established; otherwise provisional observed G/A category only");r.putArray("requiredInputs").add("eGFR [mL/min/1.73m2]").add("urine ACR [mg/g]");r.putArray("sources").add(CKD);r.put("thresholdPolicy","G1 >=90; G2 [60,90); G3a [45,60); G3b [30,45); G4 [15,30); G5 <15. A1 <30; A2 [30,300]; A3 >300 mg/g. Qualitative grid, never an event percentage.");}
            case "CARDIOVASCULAR_SURVEILLANCE" -> {r.put("outcome","Recorded cardiovascular factor surveillance").put("outputType","INPUT_COVERAGE").put("eligiblePopulation","Authorized CKD record; no cardiovascular event model installed");r.putArray("requiredInputs").add("blood_pressure_components").add("potassium").add("creatinine").add("age").add("diabetes_status");r.putArray("sources").add(CKD);r.put("thresholdPolicy","Five factor groups measure recorded information only. Separate BP provenance is retained; an unverified pair has no paired BP value. Unknown diabetes remains unknown.");}
            case "ACUTE_CREATININE_REVIEW" -> {r.put("outcome","Dated creatinine-based clinical review signal").put("outputType","CLINICAL_REVIEW_SIGNAL").put("eligiblePopulation","Recent comparable dated creatinine; acute threshold not applied to verified maintenance dialysis");r.putArray("requiredInputs").add("creatinine").add("previous_creatinine").add("current_creatinine_date").add("previous_creatinine_date");r.putArray("sources").add(AKI);r.put("thresholdPolicy","Clinical review signal for a rise >=0.3 mg/dL within 48 hours or >=1.5 times baseline within 7 days. Not an AKI diagnosis or stage; urine output, acute context and clinical assessment remain required.");}
            case "KIDNEY_STATUS_REVIEW" -> {r.put("outcome","Recorded renal stage and verified dialysis context").put("outputType","RECORDED_STATUS").put("eligiblePopulation","Authorized source eGFR and explicit clinical dialysis verification");r.putArray("requiredInputs").add("egfr").add("creatinine").add("proteinuria").add("acr").add("dialysis_status");r.putArray("sources").add(CKD);r.put("thresholdPolicy","eGFR <15 is a G5 measurement-category signal; G5D requires verified maintenance dialysis. An isolated result does not establish CKD chronicity or a future dialysis date.");}
            case "KFRE_2_5_YEAR" -> {r.put("outcome","Treated kidney failure at two and five years").put("outputType","EVENT_RISK_ESTIMATE").put("eligiblePopulation","Stable adult nondialysis CKD G3-G5; no prior KRT; verified dates and positive quantified urine ACR");r.putArray("requiredInputs").add("age").add("equation_sex").add("egfr").add("urine_acr");r.putArray("sources").add(CKD).add(lk.gov.health.govcare.ai.predictive.KfreFourVariableEquation.REFERENCE);r.put("artifact",lk.gov.health.govcare.ai.predictive.KfreFourVariableEquation.VERSION);r.putArray("horizonsYears").add(2).add(5);r.put("thresholdPolicy","Five-year 3%-5%: referral consideration; two-year >10%: multidisciplinary care timing; two-year >40%: KRT preparation; other clinical considerations apply. Distinct thresholds and horizons, not interchangeable risk bands.");}
            default -> {r.put("outcome","Recorded clinical monitoring").put("outputType","CLINICAL_REVIEW_SIGNAL").put("eligiblePopulation","Authorized dated clinical evidence");r.putArray("sources").add(CKD);r.putArray("requiredInputs");r.put("thresholdPolicy","See the saved method and explanation; no synthesized event probability.");}
        }
        return r;
    }
    public static ArrayNode manifest(){var a=JSON.createArrayNode();for(String key:List.of("POTASSIUM_SEVERITY","ADULT_HEMOGLOBIN","CREATININE_CHANGE","MEASURED_URR","KDIGO_GA_CLASSIFICATION","CARDIOVASCULAR_SURVEILLANCE","ACUTE_CREATININE_REVIEW","KIDNEY_STATUS_REVIEW","KFRE_2_5_YEAR"))a.add(rule(key));return a;}
}
