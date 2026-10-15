package lk.gov.health.govcare.ai;

import java.time.*;
import java.util.*;
import static lk.gov.health.govcare.ai.ClinicalIntelligenceEngine.*;

/** Dependency-free domain checks; also invoked by JUnit when Maven dependencies are available. */
public final class ClinicalIntelligenceChecks {
    private static final Instant NOW = Instant.parse("2026-10-05T12:00:00Z");
    private static final LocalDate DOB = LocalDate.of(1970, 1, 1);
    private static int checks;
    private ClinicalIntelligenceChecks() {}
    public static void main(String[] args) { verify(); }
    public static void verify() {
        checks=0;
        Analysis empty=run(List.of());
        eq(empty.quality().completenessPercent(),null,"Empty data has no fabricated completeness");
        eq(empty.classification().gCategory(),null,"No eGFR gives no category");
        eq(empty.safety().status(),"INSUFFICIENT_DATA","Empty data suppresses forecasting");

        Analysis converted=run(List.of(raw("c","SerumCreatinine",88.4,"umol/L",NOW.minusSeconds(3600)),
                raw("a","ACR",10,"mg/mmol",NOW.minusSeconds(3600)),raw("h","HemoglobinLevels",120,"g/L",NOW.minusSeconds(3600)),
                raw("k","SerumElectrolytesPotassium",4.5,"mmol/L",NOW.minusSeconds(3600))));
        near(trend(converted,"creatinine").latest().value(),1,"Creatinine converts µmol/L to mg/dL");
        near(trend(converted,"acr").latest().value(),88.4,"ACR converts mg/mmol to mg/g");
        near(trend(converted,"hemoglobin").latest().value(),12,"Hemoglobin g/L converts to g/dL");
        eq(trend(converted,"potassium").observations().size(),1,"Existing feature aliases normalize");
        eq(trend(converted,"creatinine").latest().originalUnit(),"umol/L","Original unit is retained");
        Analysis badRange=run(List.of(new RawObservation("range","hemoglobin",12.0,"g/dL",NOW.toString(),"TEST_FIXTURE",null,15.0,10.0,null)));
        eq(badRange.quality().includedCount(),1,"Invalid reference limits do not erase the measurement");
        eq(badRange.quality().excludedCount(),0,"Range warning is not counted as an excluded observation");
        truth(badRange.findings().stream().noneMatch(f->f.key().equals("range-hemoglobin")),"Invalid reference range cannot create an anemia review signal");

        List<RawObservation> bad=List.of(raw("date","egfr",60,"mL/min/1.73m2",null),
                raw("future","egfr",60,"mL/min/1.73m2",NOW.plusSeconds(1)),
                raw("unit","egfr",60,"mL/min",NOW),raw("value","creatinine",-1,"mg/dL",NOW),raw("nan","acr",Double.NaN,"mg/g",NOW));
        Analysis rejected=run(bad);
        eq(rejected.quality().includedCount(),0,"Undated, future, nonindexed GFR and implausible inputs excluded");
        eq(rejected.quality().excludedCount(),5,"Every exclusion has a data-quality flag");
        eq(rejected.quality().completenessPercent(),null,"Entirely unusable data has no fabricated completeness percentage");
        truth(rejected.quality().flags().stream().anyMatch(f->f.code().equals("MISSING_CLINICAL_DATE")),"No upload-time substitution");

        Analysis duplicate=run(List.of(raw("one","egfr",60,"mL/min/1.73m2",NOW),raw("two","GFR",60,"mL/min/1.73m2",NOW)));
        eq(trend(duplicate,"egfr").observations().size(),1,"Repeated imports are one measurement");
        eq(trend(duplicate,"egfr").slopePerYear(),null,"Duplicates do not create a slope");
        Analysis conflict=run(List.of(raw("one","egfr",60,"mL/min/1.73m2",NOW),raw("two","egfr",40,"mL/min/1.73m2",NOW)));
        eq(conflict.quality().excludedCount(),2,"Conflicting simultaneous results both excluded");
        eq(conflict.classification().gCategory(),null,"Conflict does not create a kidney category");

        double[] gValues={90,60,45,30,15,14.9}; String[] gCategories={"G1","G2","G3a","G3b","G4","G5"};
        for(int i=0;i<gValues.length;i++) eq(run(List.of(raw("g","GFR",gValues[i],"mL/min/1.73m²",NOW))).classification().gCategory(),gCategories[i],"G category boundary "+gValues[i]);
        double[] aValues={29.99,30,300,300.01}; String[] aCategories={"A1","A2","A2","A3"};
        for(int i=0;i<aValues.length;i++) eq(run(List.of(raw("a","ACR",aValues[i],"mg/g",NOW))).classification().aCategory(),aCategories[i],"A category boundary "+aValues[i]);
        eq(run(List.of(raw("g","egfr",40,"mL/min/1.73m2",NOW))).classification().chronicity(),"NOT_ESTABLISHED","One abnormal measurement does not establish chronicity");
        eq(run(List.of(raw("g1","egfr",40,"mL/min/1.73m2",NOW.minus(Duration.ofDays(90))),raw("g2","egfr",45,"mL/min/1.73m2",NOW))).classification().chronicity(),"PERSISTENT_ABNORMAL_MEASUREMENTS","Dated repeated abnormalities support persistence");
        eq(run(List.of(raw("g1","egfr",40,"mL/min/1.73m2",NOW.minus(Duration.ofDays(89))),raw("g2","egfr",45,"mL/min/1.73m2",NOW))).classification().chronicity(),"NOT_ESTABLISHED","89 days does not pass 90-day chronicity");
        eq(run(List.of(raw("g1","egfr",40,"mL/min/1.73m2",NOW.minus(Duration.ofDays(120))),raw("g2","egfr",95,"mL/min/1.73m2",NOW))).classification().chronicity(),"NOT_ESTABLISHED","Current normal value does not establish persistent low eGFR");

        Analysis irregular=run(List.of(raw("g1","egfr",70,"mL/min/1.73m2",NOW.minus(Duration.ofDays(180))),
                raw("g2","egfr",65,"mL/min/1.73m2",NOW.minus(Duration.ofDays(130))),raw("g3","egfr",52,"mL/min/1.73m2",NOW)));
        near(trend(irregular,"egfr").slopePerYear(),-36.53,"Regression uses actual irregular elapsed time");
        near(trend(irregular,"egfr").absoluteChange(),-13,"Latest previous absolute change");
        eq(trend(irregular,"egfr").windows().getFirst().absoluteChange(),null,"Single point in window gives no invented change");
        near(trend(irregular,"egfr").windows().getLast().absoluteChange(),-18,"Window baseline is a real observation");
        truth(irregular.findings().stream().noneMatch(f->f.key().equals("egfr-change")),"Exactly 20% change does not exceed the review threshold");
        Analysis largerChange=run(List.of(raw("g1","egfr",65,"mL/min/1.73m2",NOW.minus(Duration.ofDays(30))),raw("g2","egfr",51.9,"mL/min/1.73m2",NOW)));
        truth(largerChange.findings().stream().anyMatch(f->f.key().equals("egfr-change")),"Greater than 20% change is a review finding");
        Analysis preciseChange=run(List.of(raw("g1","egfr",65,"mL/min/1.73m2",NOW.minus(Duration.ofDays(30))),raw("g2","egfr",51.999,"mL/min/1.73m2",NOW)));
        truth(preciseChange.findings().stream().anyMatch(f->f.key().equals("egfr-change")),"Display rounding cannot hide a change above the review threshold");

        eq(creatinine(1,1.3,48).safety().status(),"POSSIBLE_AKI","48-hour absolute AKI threshold inclusive");
        truth(!creatinine(1,1.299,48).safety().status().equals("POSSIBLE_AKI"),"Subthreshold creatinine delta does not trigger AKI");
        eq(creatinine(1,1.5,168).safety().status(),"POSSIBLE_AKI","7-day relative AKI threshold inclusive");
        truth(!creatinine(2,2.3,49).safety().status().equals("POSSIBLE_AKI"),"Absolute threshold cannot use a 49-hour gap");
        truth(!creatinine(1,1.5,169).safety().status().equals("POSSIBLE_AKI"),"Relative threshold cannot use a gap beyond 7 days");
        Analysis oldAki=run(List.of(raw("c1","creatinine",1,"mg/dL",NOW.minus(Duration.ofDays(100))),raw("c2","creatinine",2,"mg/dL",NOW.minus(Duration.ofDays(99)))));
        truth(!oldAki.safety().status().equals("POSSIBLE_AKI"),"Remote acute change does not indefinitely suppress current forecasts as AKI");
        truth(creatinine(1,1.3,48).safety().forecastSuppressed(),"Possible AKI suppresses chronic forecast");
        truth(run(List.of(raw("g","egfr",60,"mL/min/1.73m2",NOW.minus(Duration.ofDays(91))))).findings().stream().anyMatch(f->f.key().equals("missing-egfr")),"Stale renal measurement creates a recency care gap");
        Analysis first=creatinine(1,1.3,48), changed=creatinine(1,1.4,48);
        truth(!first.findings().getFirst().evidenceFingerprint().equals(changed.findings().getFirst().evidenceFingerprint()),"Changed evidence invalidates prior review fingerprint");
        Analysis child=analyze(List.of(),NOW,LocalDate.of(2015,1,1));
        truth(child.safety().reasons().stream().anyMatch(s->s.contains("under 18")),"Adult-model eligibility excludes children");
        eq(ClinicalMeasurementDates.explicit("2026-09-01"),null,"Date-only metadata is not assigned a fabricated time");
        eq(ClinicalMeasurementDates.explicit("2099-01-01T00:00:00Z"),null,"Future metadata cannot become usable persisted time");
        truth(ClinicalMeasurementDates.explicit("2026-09-01T05:30:00+05:30").toInstant().equals(Instant.parse("2026-09-01T00:00:00Z")),"Explicit offsets are normalized");
        System.out.println("Clinical intelligence domain checks passed: "+checks);
    }
    private static Analysis creatinine(double before,double after,int hours) { return run(List.of(raw("prior","creatinine",before,"mg/dL",NOW.minus(Duration.ofHours(hours))),raw("latest","creatinine",after,"mg/dL",NOW))); }
    private static Analysis run(List<RawObservation> raw) { return analyze(raw,NOW,DOB); }
    private static RawObservation raw(String id,String metric,double value,String unit,Instant time) { return new RawObservation(id,metric,value,unit,time==null?null:time.toString(),"TEST_FIXTURE",id,null,null,null); }
    private static Trend trend(Analysis analysis,String key) { return analysis.trends().stream().filter(t->t.metric().equals(key)).findFirst().orElseThrow(); }
    private static void eq(Object actual,Object expected,String message) { checks++;if(!Objects.equals(actual,expected))throw new AssertionError(message+": expected "+expected+", got "+actual); }
    private static void truth(boolean condition,String message) { checks++;if(!condition)throw new AssertionError(message); }
    private static void near(double actual,double expected,String message) { checks++;if(Math.abs(actual-expected)>.011)throw new AssertionError(message+": expected "+expected+", got "+actual); }
}
