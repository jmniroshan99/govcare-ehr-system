package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lk.gov.health.govcare.common.SqlSupport;
import lk.gov.health.govcare.security.*;
import org.springframework.stereotype.Service;
import java.time.*;
import java.util.*;
import static lk.gov.health.govcare.ai.ClinicalIntelligenceEngine.*;

/** Canonical, authorized EHR retrieval; excludes invalid provenance instead of inventing dates. */
@Service
public class LongitudinalClinicalFeatureService {
    private static final int MAX_OBSERVATIONS=5000;
    private final SqlSupport sql;
    private final ObjectMapper mapper;
    private final ClinicalPatientAccess access;
    public LongitudinalClinicalFeatureService(SqlSupport sql,ObjectMapper mapper,ClinicalPatientAccess access) {
        this.sql=sql;this.mapper=mapper;this.access=access;
    }
    public record Medication(String id,String name,String recordedAt,List<String> classes) {}
    public record MedicationContext(List<String> classes,List<Medication> prescriptions,boolean recorded,boolean reconciled,String limitation) {}
    public record LoadedClinicalData(GovCarePrincipal scoped,Map<String,Object> patient,Analysis analysis,boolean truncated,MedicationContext medications,LocalDate birthDate) {}
    public LoadedClinicalData load(GovCarePrincipal actor, UUID patient, boolean write) {
        GovCarePrincipal scoped = access.clinicalScope(actor, patient, write);
        Map<String,Object> params = Map.of("h", scoped.hospitalId(), "p", patient);
        Map<String,Object> identity = sql.required("""
                select p.id,p.patient_no,p.full_name,p.date_of_birth,p.gender,p.hospital_id,h.name as hospital_name,h.code as hospital_code
                from patients p join hospitals h on h.id=p.hospital_id where p.id=:p and p.hospital_id=:h and p.status<>'deleted'
                """, params, "Patient not found.");
        List<RawObservation> observations = new ArrayList<>();
        List<QualityFlag> retrievalFlags = new ArrayList<>();
        List<Map<String,Object>> rows = sql.list("""
                select o.id::text as id,o.feature_key as metric,o.value_numeric as value,o.unit,
                  coalesce(o.effective_at,r.specimen_collected_at,r.resulted_at,r.report_date) as observed_at,
                  o.source_type as source,coalesce(o.report_id::text,e.source_note,o.id::text) as source_id,o.reference_range_low as ref_low,o.reference_range_high as ref_high,
                  case when o.coding_system in ('http://loinc.org','LOINC') then o.code else null end as code
                from clinical_observations o left join clinical_reports r on r.id=o.report_id and r.hospital_id=:h and r.patient_id=:p and r.report_status='ACTIVE'
                left join predictive_observation_entries e on e.observation_id=o.id and e.hospital_id=:h and e.patient_id=:p
                where o.hospital_id=:h and o.patient_id=:p and o.status='FINAL' and (o.report_id is null or r.id is not null)
                union all
                select 'lab-'||l.id::text,q.test_type,l.numeric_result,l.unit,
                  coalesce(q.sample_collected_at,q.result_entered_at,l.verified_at,l.approved_at),
                  'VERIFIED_LAB',l.id::text,null::numeric,null::numeric,null::text
                from lab_results l join lab_requests q on q.id=l.lab_request_id and q.hospital_id=:h and q.patient_id=:p
                where l.hospital_id=:h and l.patient_id=:p and l.numeric_result is not null and l.status<>'deleted' and q.status<>'deleted'
                  and (l.verified_at is not null or l.approved_at is not null)
                order by observed_at desc nulls last limit 5001
                """, params);
        boolean truncated = rows.size() > MAX_OBSERVATIONS;
        for (Map<String,Object> row : rows.stream().limit(MAX_OBSERVATIONS).toList()) observations.add(new RawObservation(text(row.get("id")),text(row.get("metric")),number(row.get("value")),text(row.get("unit")), iso(row.get("observed_at")),
                text(row.get("source")),text(row.get("source_id")),number(row.get("ref_low")),number(row.get("ref_high")),text(row.get("code"))));
        List<Map<String,Object>> resources = sql.list("select resource_id,json_data from fhir_resource where hospital_id=:h and patient_id=:p and resource_type='Observation' order by updated_date desc limit 5001", params);
        truncated |= resources.size() > MAX_OBSERVATIONS;
        Set<String> patientReferences=new HashSet<>(Set.of("Patient/"+patient,"Patient/patient-"+patient));
        for (Map<String,Object> linked : sql.list("select resource_id from fhir_resource where hospital_id=:h and patient_id=:p and resource_type='Patient'",params)) patientReferences.add("Patient/"+linked.get("resource_id"));
        for (Map<String,Object> row : resources.stream().limit(MAX_OBSERVATIONS).toList()) readFhir(row, patientReferences, observations, retrievalFlags);
        LocalDate birth = null;
        if (identity.get("date_of_birth") != null) { try { birth = LocalDate.parse(String.valueOf(identity.get("date_of_birth"))); } catch (RuntimeException ignored) { /* Unknown date never becomes an inferred age. */ } }
        Analysis analysis = analyze(observations, Instant.now(), birth);
        if (truncated) {
            List<String> reasons=new ArrayList<>(analysis.safety().reasons());reasons.add("History exceeds the bounded retrieval limit; this partial series cannot support forecasting.");
            Safety safety=new Safety(analysis.safety().status().equals("POSSIBLE_AKI")?"POSSIBLE_AKI":"INSUFFICIENT_DATA",true,List.copyOf(reasons),analysis.safety().source());
            analysis=new Analysis(analysis.generatedAt(),analysis.ruleVersion(),analysis.trends(),analysis.quality(),analysis.classification(),safety,analysis.findings());
        }
        MedicationContext medications = medications(params);
        List<QualityFlag> flags = new ArrayList<>(analysis.quality().flags());
        flags.addAll(retrievalFlags);
        flags.add(new QualityFlag("MEDICATION_RECONCILIATION_REQUIRED",medications.limitation(),null));
        List<String> reasons = new ArrayList<>(analysis.safety().reasons());
        if (!retrievalFlags.isEmpty()) reasons.add("Unresolved FHIR patient/provenance data requires reconciliation before forecasting.");
        boolean recentAdmission = !sql.list("select id from admissions where hospital_id=:h and patient_id=:p and status<>'deleted' and (admitted_at>=now()-interval '14 days' or (status='active' and discharged_at is null)) limit 1",params).isEmpty();
        if (recentAdmission) {
            reasons.add("An active or recent admission requires acute illness and fluid-status review before long-term forecasting (GovCare 14-day context policy).");
            flags.add(new QualityFlag("RECENT_HOSPITAL_CONTEXT","Recent hospitalization recorded; acute illness, volume status and current medications need clinician review.",null));
        }
        Quality q=analysis.quality();
        Quality quality=new Quality(q.includedCount(),q.excludedCount()+retrievalFlags.size(),q.freshMetricCount(),q.expectedMetricCount(),q.completenessPercent(),q.policy(),q.missingMetrics(),List.copyOf(flags));
        Safety safety=new Safety(analysis.safety().status().equals("POSSIBLE_AKI")?"POSSIBLE_AKI":reasons.isEmpty()?analysis.safety().status():"INSUFFICIENT_DATA",
                analysis.safety().forecastSuppressed()||!retrievalFlags.isEmpty()||recentAdmission,List.copyOf(reasons),analysis.safety().source());
        analysis=new Analysis(analysis.generatedAt(),analysis.ruleVersion(),analysis.trends(),quality,analysis.classification(),safety,analysis.findings());
        return new LoadedClinicalData(scoped, identity, analysis, truncated, medications, birth);

    }

    private void readFhir(Map<String,Object> row, Set<String> patientReferences, List<RawObservation> destination, List<QualityFlag> flags) {
        JsonNode resource;
        try { Object data = row.get("json_data"); resource = data instanceof String text ? mapper.readTree(text) : mapper.valueToTree(data); }
        catch (Exception ignored) { flags.add(new QualityFlag("INVALID_FHIR_RESOURCE","An unreadable stored FHIR observation was excluded.",text(row.get("resource_id")))); return; }
        if (!Set.of("final","amended","corrected").contains(resource.path("status").asText())) return;
        String reference = resource.path("subject").path("reference").asText();
        // The stored patient association is authoritative; reject contradictory explicit local references.
        if (patientReferences.contains(reference)) {
            String time = resource.path("effectiveDateTime").asText(null);
            if (time == null) time = resource.path("effectivePeriod").path("end").asText(null);
            readFhirQuantity(row, resource, resource, time, destination, "");
            int index=0; for (JsonNode component : resource.path("component")) readFhirQuantity(row, resource, component, time, destination, "-"+index++);
        } else {
            flags.add(new QualityFlag("WRONG_PATIENT_OR_MISSING_SUBJECT", "A FHIR result has a contradictory or missing patient reference and was excluded.", text(row.get("resource_id"))));
        }
    }

    private void readFhirQuantity(Map<String,Object> row, JsonNode resource, JsonNode element, String time, List<RawObservation> destination, String suffix) {
        String code=null;
        for (JsonNode coding : element.path("code").path("coding")) if ("http://loinc.org".equals(coding.path("system").asText())) { code=coding.path("code").asText(); if (metric(null, code)!=null) break; }
        JsonNode quantity = element.path("valueQuantity"); if (!quantity.path("value").isNumber() || quantity.has("comparator")) return;
        String unit = quantity.path("code").asText(quantity.path("unit").asText(null));
        if (quantity.has("system") && !"http://unitsofmeasure.org".equals(quantity.path("system").asText())) unit=null;
        JsonNode range = element.path("referenceRange").path(0);
        // Keep limits only when their units agree with the measurement; never compare unlike quantities.
        Double low = referenceLimit(range.path("low"),unit), high = referenceLimit(range.path("high"),unit);
        destination.add(new RawObservation("fhir-"+row.get("resource_id")+suffix,element.path("code").path("text").asText(null),quantity.path("value").doubleValue(),unit,time,
                "FHIR_OBSERVATION",text(row.get("resource_id")),low,high,code));
    }


    private MedicationContext medications(Map<String,Object> params) {
        List<Map<String,Object>> rows=sql.list("""
            select i.id::text,coalesce(nullif(i.generic_name,''),i.medicine_name) as name,p.created_at
            from prescriptions p join prescription_items i on i.prescription_id=p.id
            where p.hospital_id=:h and p.patient_id=:p and p.status='active' and i.status='active'
              and p.created_at>=now()-interval '90 days'
            order by p.created_at desc,i.id limit 201
            """,params);
        List<Medication> records=new ArrayList<>(); Set<String> classes=new LinkedHashSet<>();
        for (Map<String,Object> row:rows.stream().limit(200).toList()) {
            String name=text(row.get("name")); String lower=Objects.toString(name,"").toLowerCase(Locale.ROOT);
            Set<String> matched=new LinkedHashSet<>();
            if (matches(lower,"enalapril|lisinopril|ramipril|captopril|perindopril|benazepril|fosinopril|quinapril|trandolapril")) matched.add("ACEi");
            if (matches(lower,"losartan|valsartan|candesartan|irbesartan|telmisartan|olmesartan|azilsartan|eprosartan")) matched.add("ARB");
            if (matches(lower,"spironolactone|eplerenone|finerenone")) matched.add("MRA");
            if (matches(lower,"ibuprofen|diclofenac|naproxen|indomethacin|celecoxib|etoricoxib|meloxicam|piroxicam")) matched.add("NSAID");
            if (matches(lower,"amiloride|triamterene|trimethoprim|cotrimoxazole|tacrolimus|ciclosporin|cyclosporine|potassium chloride|potassium citrate")) matched.add("OTHER_POTASSIUM_AFFECTING");
            classes.addAll(matched); records.add(new Medication(text(row.get("id")),name,iso(row.get("created_at")),List.copyOf(matched)));
        }
        String limitation=rows.isEmpty()?"No recent active prescription record was found. Medication use and nephrotoxic exposure are unknown; reconcile with the patient."
                :"Recent active prescription records provide context only. Actual use, adherence, stop dates, non-prescription drugs and acute illness/fluid status are not confirmed. Reconcile with the patient.";
        if(rows.size()>200) limitation+=" Medication retrieval is truncated at 200 entries.";
        return new MedicationContext(List.copyOf(classes),List.copyOf(records),!rows.isEmpty(),false,limitation);
    }
    private static boolean matches(String value,String terms) {return java.util.regex.Pattern.compile("(?<![a-z])(?:"+terms+")(?![a-z])").matcher(value).find();}
    private static String text(Object o) { return o==null?null:String.valueOf(o); }
    private static Double number(Object o) { return o instanceof Number n?n.doubleValue():null; }
    private static Instant instant(Object o) { if(o==null)return null; if(o instanceof java.sql.Timestamp t)return t.toInstant(); if(o instanceof OffsetDateTime t)return t.toInstant(); if(o instanceof Instant t)return t; try{return Instant.parse(String.valueOf(o));}catch(RuntimeException e){return null;} }
    private static String iso(Object o) { Instant t=instant(o);return t==null?null:t.toString(); }
    private static Double referenceLimit(JsonNode q,String unit) { return !q.has("comparator") && q.path("value").isNumber() && Objects.equals(unit,q.path("code").asText(q.path("unit").asText(null)))?q.path("value").doubleValue():null; }
}
