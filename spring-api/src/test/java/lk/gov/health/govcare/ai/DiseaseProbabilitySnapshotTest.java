package lk.gov.health.govcare.ai;

import org.junit.jupiter.api.Test;

class DiseaseProbabilitySnapshotTest {
    @Test void modelOutputsAndHistoricalSnapshotsFailClosed() { DiseaseProbabilityChecks.verify(); }
}
