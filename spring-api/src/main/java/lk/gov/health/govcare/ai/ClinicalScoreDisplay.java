package lk.gov.health.govcare.ai;
import java.util.Locale;
/** Formatting is not calibration. Invalid scores are unavailable, never clamped or coerced. */
final class ClinicalScoreDisplay {
 private ClinicalScoreDisplay(){}
 static String percent(Object value){if(!(value instanceof Number n))return "Unavailable";double v=n.doubleValue();return Double.isFinite(v)&&v>=0&&v<=1?String.format(Locale.ROOT,"%.2f%%",v*100):"Unavailable";}
}
