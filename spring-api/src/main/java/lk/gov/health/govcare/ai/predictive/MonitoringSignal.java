package lk.gov.health.govcare.ai.predictive;

import java.util.List;

/** A current deterministic review signal. It is neither a probability nor a diagnosis. */
public record MonitoringSignal(
        String status,
        String category,
        String reason,
        Double currentValue,
        Double previousValue,
        String unit,
        String trendDirection,
        String freshness,
        List<String> reasoning,
        String recommendation,
        List<String> evidenceIds
) {}
