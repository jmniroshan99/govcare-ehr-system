package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/** An assessment-time snapshot, never a probability inferred from a lab threshold or another disease. */
public final class DiseaseProbabilitySnapshot {
    private DiseaseProbabilitySnapshot() {}

    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Entry(String key, String label, String status, Double probability, String modelVersion,
                        String horizon, String validationStatus, String reason, String purpose) {
        public Entry {
            if (key == null || label == null || label.isBlank() || modelVersion == null || horizon == null
                    || horizon.isBlank() || validationStatus == null || reason == null || reason.isBlank()
                    || purpose == null || status == null || !KEYS.contains(key) || !STATUSES.contains(status))
                throw new IllegalArgumentException("Incomplete disease probability metadata.");
            if ("AVAILABLE".equals(status)) {
                if (probability == null || !Double.isFinite(probability) || probability < 0 || probability > 1
                        || modelVersion.isBlank() || "not-installed".equals(modelVersion)
                        || !("ckd".equals(key) ? "EXISTING_MODEL".equals(validationStatus) : "VALIDATED".equals(validationStatus)))
                    throw new IllegalArgumentException("A probability requires a model output, version and validation metadata.");
            } else if (probability != null) {
                throw new IllegalArgumentException("An unavailable output must have a null probability.");
            }
        }
    }

    public record Snapshot(int schemaVersion, String capturedAt, List<Entry> entries) {
        public Snapshot {
            entries = List.copyOf(entries);
            Set<String> seen = new HashSet<>();
            if (schemaVersion != 1 || entries.size() != KEYS.size()
                    || entries.stream().anyMatch(e -> !seen.add(e.key())) || !seen.equals(KEYS))
                throw new IllegalArgumentException("Invalid disease probability snapshot.");
            if (capturedAt != null) Instant.parse(capturedAt);
        }
    }

    private record Definition(String key, String label, String purpose) {}
    private static final List<Definition> RELATED = List.of(
            new Definition("ckd_progression", "CKD progression", "Longitudinal CKD progression risk"),
            new Definition("kfre", "Kidney failure", "Kidney failure risk with published 2 / 5 year horizons"),
            new Definition("aki", "Acute kidney injury", "Future AKI risk, separate from current laboratory safety findings"),
            new Definition("cardiovascular", "Cardiovascular disease", "Cardiovascular risk in the model's eligible population"),
            new Definition("hyperkalemia", "Hyperkalemia", "Future hyperkalemia risk"),
            new Definition("anemia", "Anemia", "Future anemia risk"));
    private static final Set<String> KEYS = Set.of("ckd", "ckd_progression", "kfre", "aki", "cardiovascular", "hyperkalemia", "anemia");
    private static final Set<String> STATUSES = Set.of("AVAILABLE", "NOT_AVAILABLE", "NOT_CAPTURED", "INSUFFICIENT_DATA", "SUPPRESSED");

    public static List<String> relatedKeys() { return RELATED.stream().map(Definition::key).toList(); }

    public static Snapshot capture(double ckdProbability, String ckdModel, Instant capturedAt, List<Map<String, Object>> registry) {
        List<Entry> entries = new ArrayList<>();
        entries.add(current(ckdProbability, ckdModel));
        for (Definition definition : RELATED) {
            Map<String, Object> model = registry.stream()
                    .filter(row -> definition.key().equals(row.get("model_key"))).findFirst().orElse(Map.of());
            // Registry validation alone cannot run a model. No related-disease runtime adapter exists yet.
            entries.add(new Entry(definition.key(), definition.label(), "NOT_AVAILABLE", null,
                    Objects.toString(model.get("version"), "not-installed"), "Not available", "NOT_INSTALLED",
                    "No reviewed runtime adapter is installed for this outcome. No probability was calculated.",
                    Objects.toString(model.get("purpose"), definition.purpose())));
        }
        return new Snapshot(1, capturedAt.toString(), entries);
    }

    /** Old assessments are not backfilled with today's registry or newly invented clinical outputs. */
    public static Snapshot legacy(double ckdProbability, String ckdModel) {
        List<Entry> entries = new ArrayList<>();
        entries.add(current(ckdProbability, ckdModel));
        for (Definition definition : RELATED) entries.add(new Entry(definition.key(), definition.label(), "NOT_CAPTURED", null,
                "not-recorded", "Not recorded", "NOT_RECORDED",
                "Related-risk model availability was not captured for this assessment. Run a new assessment to capture it.", definition.purpose()));
        return new Snapshot(1, null, entries);
    }

    private static Entry current(double probability, String model) {
        return new Entry("ckd", "Current CKD model", "AVAILABLE", probability, model, "Current assessment", "EXISTING_MODEL",
                "Output of the existing CKD classifier. This is separate from model confidence and future disease risks.",
                "Current CKD classification decision support; clinician interpretation required");
    }

    /** SqlSupport normalizes PostgreSQL jsonb into maps. Corrupt or mismatched snapshots fail closed. */
    public static Snapshot fromStored(Object stored, double ckdProbability, String ckdModel) {
        try {
            if (!(stored instanceof Map<?, ?> map) || !(map.get("schemaVersion") instanceof Number version)
                    || version.doubleValue() != 1 || !(map.get("capturedAt") instanceof String capturedAt)
                    || !(map.get("entries") instanceof List<?> rows)) return legacy(ckdProbability, ckdModel);
            List<Entry> entries = new ArrayList<>();
            for (Object row : rows) {
                if (!(row instanceof Map<?, ?> r)) return legacy(ckdProbability, ckdModel);
                Object probability = r.get("probability");
                if (probability != null && !(probability instanceof Number)) return legacy(ckdProbability, ckdModel);
                entries.add(new Entry(string(r, "key"), string(r, "label"), string(r, "status"),
                        probability == null ? null : ((Number) probability).doubleValue(), string(r, "modelVersion"),
                        string(r, "horizon"), string(r, "validationStatus"), string(r, "reason"), string(r, "purpose")));
            }
            Snapshot snapshot = new Snapshot(1, capturedAt, entries);
            Entry ckd = snapshot.entries().stream().filter(e -> "ckd".equals(e.key())).findFirst().orElseThrow();
            if (!"AVAILABLE".equals(ckd.status()) || !ckdModel.equals(ckd.modelVersion())
                    || Math.abs(ckd.probability() - ckdProbability) > 0.000001) return legacy(ckdProbability, ckdModel);
            return snapshot;
        } catch (RuntimeException invalid) {
            return legacy(ckdProbability, ckdModel);
        }
    }

    private static String string(Map<?, ?> map, String key) { return map.get(key) instanceof String s ? s : null; }
}
