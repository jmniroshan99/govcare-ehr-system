package lk.gov.health.govcare.ai;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Synthetic boundary fixtures, never hospital records or installed model outputs. */
public final class DiseaseProbabilityChecks {
    private static int checks;
    private static final String MODEL = "GOVCARE-CKD-LOGISTIC-1.0";
    private static final Instant TIME = Instant.parse("2026-10-06T12:00:00Z");

    public static void main(String[] args) { verify(); }

    static void verify() {
        checks = 0;
        var snapshot = DiseaseProbabilitySnapshot.capture(.32145, MODEL, TIME,
                List.of(Map.of("model_key", "kfre", "version", "not-installed", "purpose", "Registered kidney failure adapter")));
        check(snapshot.entries().size() == 7, "Current CKD and six related outcomes captured");
        check(snapshot.entries().getFirst().probability() == .32145, "Existing CKD output unchanged");
        check(snapshot.capturedAt().equals(TIME.toString()), "Assessment time captured");
        check(snapshot.entries().stream().skip(1).allMatch(e -> e.probability() == null && e.status().equals("NOT_AVAILABLE")), "Absent models produce nulls, never zeros");
        check(snapshot.entries().stream().filter(e -> e.key().equals("kfre")).findFirst().orElseThrow().purpose().equals("Registered kidney failure adapter"), "Registry metadata preserved");
        var registryOnly = DiseaseProbabilitySnapshot.capture(.4, MODEL, TIME,
                List.of(Map.of("model_key", "kfre", "version", "research-v1", "status", "VALIDATED")));
        check(registryOnly.entries().stream().filter(e -> e.key().equals("kfre")).findFirst().orElseThrow().probability() == null, "Registry activation alone cannot calculate risk");
        for (double probability : new double[]{0, 1}) {
            check(DiseaseProbabilitySnapshot.capture(probability, MODEL, TIME, List.of()).entries().getFirst().probability() == probability, "Real boundary outputs retained");
        }
        for (double probability : new double[]{-.1, 1.1, 50, Double.NaN, Double.POSITIVE_INFINITY}) {
            reject(() -> DiseaseProbabilitySnapshot.capture(probability, MODEL, TIME, List.of()), "Invalid or percentage-scaled output rejected");
        }
        var stored = stored(snapshot);
        check(DiseaseProbabilitySnapshot.fromStored(stored, .32145, MODEL).equals(snapshot), "Saved snapshot read without registry access");
        check(DiseaseProbabilitySnapshot.fromStored(stored, .3214504, MODEL).capturedAt() != null, "PostgreSQL six-decimal rounding tolerated");
        check(DiseaseProbabilitySnapshot.fromStored(stored, .5, MODEL).capturedAt() == null, "Mismatched current score fails closed");
        check(DiseaseProbabilitySnapshot.fromStored(stored, .32145, "different-model").capturedAt() == null, "Mismatched model fails closed");
        for (Object legacy : new Object[]{"{}", List.of(), Map.of(), Map.of("schemaVersion", 1)}) {
            check(DiseaseProbabilitySnapshot.fromStored(legacy, .32145, MODEL).entries().stream().skip(1).allMatch(e -> e.status().equals("NOT_CAPTURED") && e.probability() == null), "Legacy/malformed related outputs never backfilled");
        }
        check(DiseaseProbabilitySnapshot.fromStored(null, .32145, MODEL).capturedAt() == null, "Null historical snapshot supported");
        var malformed = new LinkedHashMap<>(stored); malformed.put("schemaVersion", 2);
        check(DiseaseProbabilitySnapshot.fromStored(malformed, .32145, MODEL).capturedAt() == null, "Unknown schema rejected");
        malformed.put("schemaVersion", 1); malformed.put("capturedAt", "not-a-time");
        check(DiseaseProbabilitySnapshot.fromStored(malformed, .32145, MODEL).capturedAt() == null, "Invalid capture date rejected");
        var rows = new ArrayList<>(snapshot.entries()); rows.set(1, rows.getFirst());
        reject(() -> new DiseaseProbabilitySnapshot.Snapshot(1, TIME.toString(), rows), "Duplicate outcome rejected");
        reject(() -> new DiseaseProbabilitySnapshot.Entry("aki", "AKI", "NOT_AVAILABLE", 0.0, "not-installed", "Unavailable", "NOT_INSTALLED", "Missing model", "Future risk"), "Unavailable cannot carry zero");
        reject(() -> new DiseaseProbabilitySnapshot.Entry("aki", "AKI", "AVAILABLE", .2, "research-v1", "3 months", "RESEARCH", "Fixture", "Future risk"), "Unvalidated related output rejected");
        reject(() -> new DiseaseProbabilitySnapshot.Entry("aki", "AKI", "AVAILABLE", .2, "not-installed", "3 months", "VALIDATED", "Fixture", "Future risk"), "Not-installed output rejected");
        var validRelated = new DiseaseProbabilitySnapshot.Entry("aki", "AKI", "AVAILABLE", .2, "fixture-validated-model", "3 months", "VALIDATED", "Synthetic test fixture", "Future risk");
        check(validRelated.probability() == .2, "Versioned validated output contract supports future adapters");
        try { snapshot.entries().clear(); throw new AssertionError("Snapshot list mutable"); }
        catch (UnsupportedOperationException expected) { checks++; }
        System.out.println("Disease probability domain checks passed: " + checks);
    }

    private static void check(boolean condition, String message) { if (!condition) throw new AssertionError(message); checks++; }
    private static void reject(Runnable operation, String message) {
        try { operation.run(); throw new AssertionError(message); }
        catch (IllegalArgumentException expected) { checks++; }
    }

    static Map<String, Object> stored(DiseaseProbabilitySnapshot.Snapshot snapshot) {
        List<Map<String, Object>> entries = snapshot.entries().stream().map(e -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("key", e.key()); row.put("label", e.label()); row.put("status", e.status());
            row.put("probability", e.probability()); row.put("modelVersion", e.modelVersion()); row.put("horizon", e.horizon());
            row.put("validationStatus", e.validationStatus()); row.put("reason", e.reason()); row.put("purpose", e.purpose());
            return row;
        }).toList();
        return Map.of("schemaVersion", 1, "capturedAt", snapshot.capturedAt(), "entries", entries);
    }
}
