package lk.gov.health.govcare.ai;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;
import lk.gov.health.govcare.ai.predictive.ClinicalDataQualityService;
import lk.gov.health.govcare.ai.predictive.RenalSafetyGateService;

/** Deterministic, timestamp-aware review support. This class does not diagnose or predict. */
public final class ClinicalIntelligenceEngine {
    public static final String RULE_VERSION = "govcare-longitudinal-2.0.0";
    public static final String CKD_SOURCE = "KDIGO 2024 CKD guideline";
    public static final List<String> METRICS = List.of("egfr", "creatinine", "acr", "systolic", "diastolic", "hba1c",
            "glucose", "potassium", "hemoglobin", "bun", "bmi", "weight", "total_cholesterol", "hdl", "ldl", "triglycerides");
    private ClinicalIntelligenceEngine() {}

    public record RawObservation(String id, String metric, Double value, String unit, String observedAt,
                                 String source, String sourceId, Double referenceLow, Double referenceHigh, String code) {}
    public record Observation(String id, String metric, double value, String unit, Instant observedAt,
                              String source, String sourceId, Double referenceLow, Double referenceHigh, String code,
                              double originalValue, String originalUnit, String originalMetric,
                              Double originalReferenceLow, Double originalReferenceHigh) {
        public Observation(String id, String metric, double value, String unit, Instant observedAt,
                           String source, String sourceId, Double referenceLow, Double referenceHigh, String code,
                           double originalValue, String originalUnit) {
            this(id, metric, value, unit, observedAt, source, sourceId, referenceLow, referenceHigh, code,
                    originalValue, originalUnit, metric, null, null);
        }
    }
    public record QualityFlag(String code, String message, String observationId, String metric) {
        public QualityFlag(String code, String message, String observationId) { this(code, message, observationId, null); }
    }
    public record WindowChange(int days, Observation baseline, Double absoluteChange, Double percentChange, int count) {}
    public record Trend(String metric, String label, String unit, Observation latest, Observation previous,
                        Observation baseline, Double absoluteChange, Double percentChange, Double slopePerYear,
                        List<WindowChange> windows, List<Observation> observations, int observationCount,
                        Instant firstObservationDate, Instant lastObservationDate, String dataFreshness,
                        Long daysSinceLatest, String trendDirection) {
        public Trend(String metric, String label, String unit, Observation latest, Observation previous,
                     Observation baseline, Double absoluteChange, Double percentChange, Double slopePerYear,
                     List<WindowChange> windows, List<Observation> observations) {
            this(metric, label, unit, latest, previous, baseline, absoluteChange, percentChange, slopePerYear,
                    windows, observations, observations.size(), baseline == null ? null : baseline.observedAt(),
                    latest == null ? null : latest.observedAt(), "UNKNOWN", null, direction(absoluteChange));
        }
    }
    public record Classification(String gCategory, String aCategory, String chronicity, String explanation) {}
    public record Safety(String status, boolean forecastSuppressed, List<String> reasons, String source) {}
    public record Quality(int includedCount, int excludedCount, int freshMetricCount, int expectedMetricCount,
                          Integer completenessPercent, String policy, List<String> missingMetrics, List<QualityFlag> flags,
                          String qualityLevel) {
        public Quality(int includedCount, int excludedCount, int freshMetricCount, int expectedMetricCount,
                       Integer completenessPercent, String policy, List<String> missingMetrics, List<QualityFlag> flags) {
            this(includedCount, excludedCount, freshMetricCount, expectedMetricCount, completenessPercent, policy,
                    missingMetrics, flags, ClinicalDataQualityService.qualityLevel(includedCount, completenessPercent, flags));
        }
    }
    public record Finding(String key, String title, String reason, String priority, String category, String source,
                          String suggestedAction, List<String> evidenceIds, String evidenceFingerprint) {}
    public record Analysis(Instant generatedAt, String ruleVersion, List<Trend> trends, Quality quality,
                           Classification classification, Safety safety, List<Finding> findings) {}

    public static Analysis analyze(List<RawObservation> raw, Instant now, LocalDate birthDate) {
        Objects.requireNonNull(now, "Assessment time is required.");
        if (raw == null) raw = List.of();
        List<QualityFlag> flags = new ArrayList<>();
        List<Observation> candidates = new ArrayList<>();
        for (RawObservation row : raw) {
            if (row == null || metric(row.metric(), row.code()) == null) continue;
            Observation observation = normalize(row, now, flags);
            if (observation != null) candidates.add(observation);
        }
        // Repeated imports cannot create an apparent longitudinal trend. Conflicts are excluded, never averaged.
        Map<String, List<Observation>> groups = candidates.stream().collect(Collectors.groupingBy(
                o -> o.metric() + "|" + o.observedAt(), LinkedHashMap::new, Collectors.toList()));
        List<Observation> included = new ArrayList<>();
        int duplicates = 0;
        for (List<Observation> group : groups.values()) {
            if (group.stream().anyMatch(o -> Math.abs(o.value() - group.getFirst().value()) > 1e-6)) {
                for (Observation o : group) flags.add(new QualityFlag("CONFLICTING_RESULT",
                        "Conflicting " + label(o.metric()) + " results at the same measurement time require reconciliation.", o.id(), o.metric()));
            } else {
                included.add(group.getFirst());
                duplicates += group.size() - 1;
                for (int i = 1; i < group.size(); i++) flags.add(new QualityFlag("DUPLICATE_IMPORT",
                        "Repeated " + label(group.get(i).metric()) + " import does not create another longitudinal point.",
                        group.get(i).id(), group.get(i).metric()));
            }
        }
        included.sort(Comparator.comparing(Observation::observedAt).thenComparing(Observation::id));
        List<Trend> trends = new ArrayList<>();
        for (String key : METRICS) {
            List<Observation> points = included.stream().filter(o -> key.equals(o.metric())).toList();
            Observation latest = last(points), previous = points.size() < 2 ? null : points.get(points.size() - 2);
            List<WindowChange> windows = new ArrayList<>();
            for (int days : List.of(30, 90, 180, 365)) {
                List<Observation> within = points.stream().filter(o -> !o.observedAt().isBefore(now.minus(Duration.ofDays(days)))).toList();
                Observation base = within.size() < 2 ? null : within.getFirst();
                windows.add(new WindowChange(days, base, difference(latest, base), percentage(latest, base), within.size()));
            }
            trends.add(new Trend(key, label(key), unit(key), latest, previous, points.isEmpty() ? null : points.getFirst(),
                    difference(latest, previous), percentage(latest, previous), slope(points), List.copyOf(windows), points,
                    points.size(), points.isEmpty() ? null : points.getFirst().observedAt(), latest == null ? null : latest.observedAt(),
                    ClinicalDataQualityService.freshness(latest, now, 90, ClinicalDataQualityService.hasUnresolved(flags, key)),
                    latest == null ? null : Duration.between(latest.observedAt(), now).toDays(), direction(difference(latest, previous))));
        }
        Map<String, Trend> byMetric = trends.stream().collect(Collectors.toMap(Trend::metric, t -> t));
        Quality quality = new ClinicalDataQualityService().summarize(included, trends, flags, now);
        Trend renal = byMetric.get("egfr"), acr = byMetric.get("acr");
        Observation g = ClinicalDataQualityService.hasUnresolved(flags, "egfr") ? null : renal.latest();
        Observation a = ClinicalDataQualityService.hasUnresolved(flags, "acr") ? null : acr.latest();
        boolean sustainedG = sustained(renal.observations(), 60, false), sustainedA = sustained(acr.observations(), 30, true);
        Classification classification = new Classification(g == null ? null : gCategory(g.value()), a == null ? null : aCategory(a.value()),
                sustainedG || sustainedA ? "PERSISTENT_ABNORMAL_MEASUREMENTS" : "NOT_ESTABLISHED",
                "Categories describe recorded measurements. CKD diagnosis requires clinician confirmation, chronicity and clinical context; G1/G2 alone do not establish CKD.");
        Safety safety = new RenalSafetyGateService().evaluate(byMetric, now, birthDate, quality.flags());
        List<Finding> findings = new ArrayList<>();
        if (Set.of("POSSIBLE_AKI", "RAPID_RENAL_CHANGE").contains(safety.status())) {
            findings.add(finding("renal-safety", "Review recent acute renal-function change", String.join(" ", safety.reasons()), "URGENT", "REVIEW",
                    "KDIGO 2012 AKI guideline, 2.1.1", "Review current renal function, acute illness and volume status before interpreting CKD trajectories.",
                    byMetric.get("creatinine").observations().stream().filter(o -> fresh(o, now, 7)).toList(), "aki"));
        }
        for (String k : List.of("egfr", "acr")) {
            Observation o = byMetric.get(k).latest();
            if (!fresh(o, now, 90)) findings.add(finding("missing-" + k, o == null ? "No dated " + label(k) + " available" : label(k) + " needs a recency review",
                    o == null ? "No usable, dated result is available for longitudinal review." : "The most recent recorded result is older than the workspace's 90-day freshness policy.",
                    "ROUTINE", "CARE_GAP", "GovCare review policy v2; frequency must be individualized", "Confirm whether a newer result exists and whether repeat measurement is clinically appropriate.",
                    o == null ? List.of() : List.of(o), "fresh=" + fresh(o, now, 90)));
        }
        if (renal.latest() != null && renal.previous() != null && renal.previous().value() > 0
                && Math.abs(100 * (renal.latest().value() - renal.previous().value()) / renal.previous().value()) > 20) {
            findings.add(finding("egfr-change", "Review change in kidney function", "eGFR change exceeds the 20% review threshold between the two latest usable measurements (approximately " + round(renal.percentChange()) + "%). Measurement variability and clinical context require review.",
                    "PRIORITY", "REVIEW", CKD_SOURCE + ", practice point 2.1.3", "Evaluate the change with the patient's clinical context; do not infer a future probability from this trend.",
                    List.of(renal.previous(), renal.latest()), "change"));
        }
        for (String k : List.of("potassium", "hemoglobin")) {
            Observation o = byMetric.get(k).latest();
            if (fresh(o, now, 90) && ((o.referenceHigh() != null && o.value() > o.referenceHigh()) || (o.referenceLow() != null && o.value() < o.referenceLow()))) {
                findings.add(finding("range-" + k, "Review " + label(k) + " outside the recorded reference range",
                        "The latest value is outside the source laboratory's recorded reference range. This is a review signal, not a diagnosis or validated future risk score.",
                        "PRIORITY", "REVIEW", "Source laboratory reference range", "Confirm the result, urgency and patient context with the treating clinician.", List.of(o), "range"));
            }
        }
        if ((g != null && g.value() < 60 || a != null && a.value() >= 30) && !sustainedG && !sustainedA) {
            List<Observation> evidence = new ArrayList<>(); if (g != null) evidence.add(g); if (a != null) evidence.add(a);
            findings.add(finding("chronicity", "Confirm chronicity before CKD labeling", "Available dated measurements do not establish persistence over at least 90 days.",
                    "ROUTINE", "CARE_GAP", CKD_SOURCE + ", practice points 1.1.3.1–1.1.3.2", "Review prior results and other evidence of chronicity with the clinician.", evidence, "not-established"));
        }
        findings.sort(Comparator.comparingInt(f -> switch (f.priority()) { case "URGENT" -> 0; case "PRIORITY" -> 1; default -> 2; }));
        return new Analysis(now, RULE_VERSION, List.copyOf(trends), quality, classification, safety, List.copyOf(findings));
    }

    private static Observation normalize(RawObservation r, Instant now, List<QualityFlag> flags) {
        String key = metric(r.metric(), r.code());
        String namedMetric = metric(r.metric(), null), codedMetric = metric(null, r.code());
        if (namedMetric != null && codedMetric != null && !namedMetric.equals(codedMetric)) {
            flags.add(new QualityFlag("METRIC_CODE_CONFLICT", "The recorded analyte and LOINC code disagree; reconcile the source.", r.id(), key));
            return null;
        }
        Instant time;
        try { time = Instant.parse(r.observedAt()); }
        catch (Exception ex) { flags.add(new QualityFlag("MISSING_CLINICAL_DATE", "A usable measurement date is required; upload time is never substituted.", r.id(), key)); return null; }
        if (time.isAfter(now)) { flags.add(new QualityFlag("FUTURE_CLINICAL_DATE", "Measurement date is in the future.", r.id(), key)); return null; }
        if (r.id() == null || r.id().isBlank() || r.source() == null || r.source().isBlank()) {
            flags.add(new QualityFlag("MISSING_PROVENANCE", "A traceable source type and observation identifier are required.", r.id(), key)); return null;
        }
        if (r.value() == null || !Double.isFinite(r.value())) { flags.add(new QualityFlag("NON_NUMERIC_VALUE", "A finite numeric result is required.", r.id(), key)); return null; }
        Double multiplier = factor(key, r.unit(), r);
        if (multiplier == null) { flags.add(new QualityFlag("UNSUPPORTED_UNIT", "The recorded unit cannot be safely normalized for " + label(key) + ".", r.id(), key)); return null; }
        // IFCC mmol/mol HbA1c is an affine conversion, not a multiplicative glucose conversion.
        double offset = "hba1c".equals(key) && "mmol/mol".equals(normalizeUnit(r.unit())) ? 2.15 : 0;
        double value = r.value() * multiplier + offset;
        double max = switch (key) {
            case "egfr" -> 300; case "creatinine" -> 50; case "acr" -> 100000;
            case "systolic", "diastolic" -> 350; case "hba1c", "hemoglobin" -> 30;
            case "potassium" -> 15; case "glucose" -> 2000; case "bun" -> 500; case "bmi" -> 150;
            case "weight" -> 600; case "total_cholesterol", "ldl" -> 2000; case "hdl" -> 300;
            case "triglycerides" -> 10000; default -> 0;
        };
        if (!Double.isFinite(value) || value < 0 || value > max || (!key.equals("acr") && value == 0)) {
            flags.add(new QualityFlag("IMPLAUSIBLE_VALUE", "Result is outside the workspace's broad data-quality guardrails; verify the source.", r.id(), key)); return null;
        }
        Double low = r.referenceLow() == null ? null : r.referenceLow() * multiplier + offset;
        Double high = r.referenceHigh() == null ? null : r.referenceHigh() * multiplier + offset;
        if (low != null && (!Double.isFinite(low) || low < 0 || low > max)
                || high != null && (!Double.isFinite(high) || high < 0 || high > max)
                || low != null && high != null && low > high) {
            flags.add(new QualityFlag("INVALID_REFERENCE_RANGE", "Source reference limits are invalid and are not used for review rules.", r.id(), key)); low = null; high = null;
        }
        return new Observation(r.id(), key, value, unit(key), time, r.source(), r.sourceId(), low, high,
                r.code(), r.value(), r.unit(), r.metric(), r.referenceLow(), r.referenceHigh());
    }

    public static String metric(String raw, String code) {
        if (code != null) switch (code) {
            case "2160-0" -> { return "creatinine"; }
            case "48642-3", "33914-3", "62238-1" -> { return "egfr"; }
            case "9318-7", "14959-1" -> { return "acr"; }
            case "8480-6" -> { return "systolic"; } case "8462-4" -> { return "diastolic"; }
            case "4548-4", "59261-8" -> { return "hba1c"; } case "2823-3" -> { return "potassium"; }
            case "718-7" -> { return "hemoglobin"; } case "2345-7", "14749-6" -> { return "glucose"; }
            case "3094-0", "3091-6", "22664-7" -> { return "bun"; }
            case "39156-5" -> { return "bmi"; } case "29463-7" -> { return "weight"; }
            case "2093-3", "14647-2" -> { return "total_cholesterol"; }
            case "2085-9", "14646-4" -> { return "hdl"; }
            case "2089-1", "13457-7", "22748-8" -> { return "ldl"; }
            case "2571-8", "14927-8" -> { return "triglycerides"; } default -> {}
        }
        if (raw == null) return null;
        return switch (raw.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "")) {
            case "gfr", "egfr", "estimatedgfr" -> "egfr";
            case "serumcreatinine", "creatinine" -> "creatinine";
            case "acr", "uacr", "urineacr", "albumincreatinineratio", "urinealbumincreatinineratio" -> "acr";
            case "systolicbp", "systolic", "systolicbloodpressure" -> "systolic";
            case "diastolicbp", "diastolic", "diastolicbloodpressure" -> "diastolic";
            case "hba1c", "glycatedhemoglobin" -> "hba1c";
            case "potassium", "serumelectrolytespotassium" -> "potassium";
            case "hemoglobin", "haemoglobin", "hemoglobinlevels" -> "hemoglobin";
            case "glucose", "bloodglucose", "fastingglucose", "randomglucose", "fastingbloodglucose", "randombloodglucose", "fbs", "rbs" -> "glucose";
            case "bun", "bloodureanitrogen", "ureanitrogen", "urea", "bloodurea", "serumurea" -> "bun";
            case "bmi", "bodymassindex" -> "bmi"; case "weight", "bodyweight" -> "weight";
            case "totalcholesterol", "cholesterol" -> "total_cholesterol";
            case "hdl", "hdlcholesterol" -> "hdl"; case "ldl", "ldlcholesterol" -> "ldl";
            case "triglycerides", "triglyceride", "tg" -> "triglycerides";
            default -> null;
        };
    }
    private static String normalizeUnit(String raw) {
        return raw == null ? "" : raw.toLowerCase(Locale.ROOT).replace("μ", "u").replace("µ", "u")
                .replace("²", "2").replace(" ", "").replace("^", "");
    }
    private static Double factor(String key, String raw, RawObservation observation) {
        String u = normalizeUnit(raw);
        return switch (key) {
            case "egfr" -> Set.of("ml/min/1.73m2", "ml/min/{1.73_m2}", "ml/min/1.73m(2)").contains(u) ? 1.0 : null;
            case "creatinine" -> u.equals("mg/dl") ? 1.0 : u.equals("umol/l") ? 1 / 88.4 : null;
            case "acr" -> u.equals("mg/g") ? 1.0 : u.equals("mg/mmol") ? 8.84 : null;
            case "systolic", "diastolic" -> Set.of("mmhg", "mm[hg]").contains(u) ? 1.0 : null;
            case "hba1c" -> u.equals("%") ? 1.0 : u.equals("mmol/mol") ? 0.09148 : null;
            case "potassium" -> Set.of("mmol/l", "meq/l").contains(u) ? 1.0 : null;
            case "hemoglobin" -> u.equals("g/dl") ? 1.0 : u.equals("g/l") ? 0.1 : null;
            case "glucose" -> u.equals("mg/dl") ? 1.0 : u.equals("mmol/l") ? 18.0182 : null;
            case "bun" -> ureaToBunFactor(observation, u);
            case "bmi" -> Set.of("kg/m2", "kg/m(2)").contains(u) ? 1.0 : null;
            case "weight" -> u.equals("kg") ? 1.0 : u.equals("g") ? 0.001 : Set.of("lb", "lbs", "[lb_av]").contains(u) ? 0.45359237 : null;
            case "total_cholesterol", "hdl", "ldl" -> u.equals("mg/dl") ? 1.0 : u.equals("mmol/l") ? 38.67 : null;
            case "triglycerides" -> u.equals("mg/dl") ? 1.0 : u.equals("mmol/l") ? 88.57 : null;
            default -> null;
        };
    }
    private static Double ureaToBunFactor(RawObservation r, String unit) {
        String name = Objects.toString(r.metric(), "").toLowerCase(Locale.ROOT).replaceAll("[^a-z]", "");
        boolean urea = Set.of("3091-6", "22664-7").contains(Objects.toString(r.code(), ""))
                || (r.code() == null && Set.of("urea", "bloodurea", "serumurea").contains(name));
        // Urea and urea nitrogen are distinct mass concentrations (LOINC 3091-6 versus 3094-0).
        // A molar 'BUN' value is not accepted without a reviewed explicit urea-analyte mapping.
        if (unit.equals("mg/dl")) return urea ? 28.014 / 60.056 : 1.0;
        if (urea && unit.equals("mmol/l")) return 2.8014;
        return null;
    }
    public static String label(String key) { return switch (key) {
        case "egfr" -> "eGFR"; case "creatinine" -> "Creatinine"; case "acr" -> "Urine ACR";
        case "systolic" -> "Systolic blood pressure"; case "diastolic" -> "Diastolic blood pressure";
        case "hba1c" -> "HbA1c"; case "potassium" -> "Potassium"; case "hemoglobin" -> "Hemoglobin";
        case "glucose" -> "Blood glucose"; case "bun" -> "Blood urea nitrogen"; case "bmi" -> "Body mass index";
        case "weight" -> "Weight"; case "total_cholesterol" -> "Total cholesterol"; case "hdl" -> "HDL cholesterol";
        case "ldl" -> "LDL cholesterol"; case "triglycerides" -> "Triglycerides"; default -> key;
    }; }
    public static String unit(String key) { return switch (key) {
        case "egfr" -> "mL/min/1.73m2"; case "creatinine", "glucose", "bun", "total_cholesterol", "hdl", "ldl", "triglycerides" -> "mg/dL";
        case "acr" -> "mg/g"; case "systolic", "diastolic" -> "mm[Hg]"; case "hba1c" -> "%";
        case "potassium" -> "mmol/L"; case "hemoglobin" -> "g/dL"; case "bmi" -> "kg/m2"; case "weight" -> "kg"; default -> "";
    }; }
    private static String direction(Double change) { return change == null ? "UNKNOWN" : change > 0 ? "RISING" : change < 0 ? "FALLING" : "STABLE"; }
    private static String gCategory(double v) { return v >= 90 ? "G1" : v >= 60 ? "G2" : v >= 45 ? "G3a" : v >= 30 ? "G3b" : v >= 15 ? "G4" : "G5"; }
    private static String aCategory(double v) { return v < 30 ? "A1" : v <= 300 ? "A2" : "A3"; }
    private static boolean sustained(List<Observation> points, double threshold, boolean above) { Observation latest = last(points); if (latest == null || !(above ? latest.value() >= threshold : latest.value() < threshold)) return false; return points.stream().anyMatch(o -> Duration.between(o.observedAt(), latest.observedAt()).toDays() >= 90 && (above ? o.value() >= threshold : o.value() < threshold)); }
    private static boolean fresh(Observation o, Instant now, int days) { return o != null && !o.observedAt().isBefore(now.minus(Duration.ofDays(days))); }
    private static Observation last(List<Observation> p) { return p.isEmpty() ? null : p.getLast(); }
    private static Double difference(Observation a, Observation b) { return a == null || b == null ? null : round(a.value() - b.value()); }
    private static Double percentage(Observation a, Observation b) { return a == null || b == null || b.value() == 0 ? null : round(100 * (a.value() - b.value()) / b.value()); }
    private static Double slope(List<Observation> p) {
        if (p.size() < 2) return null;
        double meanX = 0, meanY = 0;
        for (Observation o : p) { meanX += Duration.between(p.getFirst().observedAt(), o.observedAt()).toSeconds() / 31557600.0; meanY += o.value(); }
        meanX /= p.size(); meanY /= p.size(); double numerator = 0, denominator = 0;
        for (Observation o : p) { double x = Duration.between(p.getFirst().observedAt(), o.observedAt()).toSeconds() / 31557600.0 - meanX; numerator += x * (o.value() - meanY); denominator += x * x; }
        return denominator == 0 ? null : round(numerator / denominator);
    }
    private static double round(double v) { return Math.round(v * 100.0) / 100.0; }
    private static Finding finding(String key, String title, String reason, String priority, String category, String source, String action, List<Observation> evidence, String context) {
        String canonical = RULE_VERSION + "|" + key + "|" + context + "|" + evidence.stream().map(o -> o.id() + ":" + o.value() + ":" + o.observedAt() + ":" + o.referenceLow() + ":" + o.referenceHigh()).sorted().collect(Collectors.joining("|"));
        return new Finding(key, title, reason, priority, category, source, action, evidence.stream().map(Observation::id).toList(), sha256(canonical));
    }
    public static String sha256(String text) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8))); } catch (java.security.NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); } }
}
