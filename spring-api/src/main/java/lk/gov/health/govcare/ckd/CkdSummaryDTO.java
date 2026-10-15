package lk.gov.health.govcare.ckd;

import java.time.LocalDate;

public record CkdSummaryDTO(
 String patientId, String ckdStage, String icd10,
 Double egfr, Double serumCreatinine, String risk,
 Boolean diabetes, Boolean hypertension, LocalDate lastTestDate
) {}
