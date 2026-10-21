package lk.gov.health.govcare.ai.predictive;

/**
 * Published four-variable KFRE, non-North American calibration (2016).
 * Coefficients and S0 checked against the original-model Table 3 in
 * Bravo-Zuniga et al. (doi:10.1186/s12882-025-04357-z); its recalibrated models are not used.
 * Original implementation reference: Major et al. 2019 S1 Text
 * (doi:10.1371/journal.pmed.1002955.s008). Direct calculator-JS retrieval was unavailable.
 * Mathematical implementation is not local clinical validation or deployment approval.
 * Clinical eligibility/provenance is enforced by the dedicated outlook workflow.
 */
public final class KfreFourVariableEquation {
    public static final String VERSION = "KFRE4-NNA-2016-GOVCARE-1.0";
    public static final double TWO_YEAR_BASELINE = 0.9832;
    public static final double FIVE_YEAR_BASELINE = 0.9365;
    public static final String REFERENCE = "https://doi.org/10.1371/journal.pmed.1002955.s008";
    private KfreFourVariableEquation() {}
    public record Risk(double twoYearRisk, double fiveYearRisk) {}

    public static double acrMgG(double value, String unit) {
        double canonical = switch (unit == null ? "" : unit) {
            case "mg/g" -> value;
            case "mg/mmol" -> value * 8.84;
            default -> throw new IllegalArgumentException("Urine ACR requires explicit mg/g or mg/mmol units.");
        };
        if (!Double.isFinite(canonical) || canonical <= 0 || canonical > 100000)
            throw new IllegalArgumentException("A quantified positive urine ACR within the supported entry range is required; clarify zero or censored laboratory results.");
        return canonical;
    }

    public static Risk calculate(int age, String sex, double egfr, double acr, String unit) {
        if (age < 18 || age > 120) throw new IllegalArgumentException("Adult age 18–120 is required by the GovCare entry policy.");
        if (!"MALE".equals(sex) && !"FEMALE".equals(sex))
            throw new IllegalArgumentException("The equation's sex variable must be explicitly verified.");
        if (!Double.isFinite(egfr) || egfr <= 0 || egfr >= 60)
            throw new IllegalArgumentException("This equation is enabled for CKD G3–G5 with eGFR greater than zero and below 60.");
        double a = acrMgG(acr, unit);
        double male = "MALE".equals(sex) ? 1 : 0;
        double linear = -0.2201 * (age / 10.0 - 7.036) + 0.2467 * (male - 0.5642)
                - 0.5567 * (egfr / 5.0 - 7.222) + 0.4510 * (Math.log(a) - 5.137);
        // expm1 avoids cancellation for small risks. Each horizon has its own S0.
        return new Risk(-Math.expm1(Math.log(TWO_YEAR_BASELINE) * Math.exp(linear)),
                -Math.expm1(Math.log(FIVE_YEAR_BASELINE) * Math.exp(linear)));
    }
}
