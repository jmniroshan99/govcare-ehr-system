package lk.gov.health.govcare.common;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Canonical Sri Lankan province and district validation shared by patient APIs. */
public final class SriLankaLocationPolicy {
    private static final Map<String, List<String>> DISTRICTS_BY_PROVINCE = createLocations();

    private SriLankaLocationPolicy() {}

    public record Location(String province, String district) {}

    public static Location resolve(String provinceValue, String districtValue) {
        String province = canonicalProvince(provinceValue);
        String district = canonicalDistrict(districtValue);

        if (district != null) {
            String owningProvince = provinceForDistrict(district);
            if (province == null) {
                province = owningProvince;
            } else if (!province.equals(owningProvince)) {
                throw ApiException.badRequest("The selected district does not belong to the selected province.");
            }
        }
        return new Location(province, district);
    }

    public static String canonicalProvince(String value) {
        String cleaned = clean(value);
        if (cleaned == null) return null;
        return DISTRICTS_BY_PROVINCE.keySet().stream()
                .filter(item -> item.equalsIgnoreCase(cleaned)
                        || item.replaceFirst("(?i)\\s+Province$", "").equalsIgnoreCase(cleaned))
                .findFirst()
                .orElseThrow(() -> ApiException.badRequest("Select a valid Sri Lankan province."));
    }

    public static String canonicalDistrict(String value) {
        String cleaned = clean(value);
        if (cleaned == null) return null;
        return DISTRICTS_BY_PROVINCE.values().stream()
                .flatMap(List::stream)
                .filter(item -> item.equalsIgnoreCase(cleaned))
                .findFirst()
                .orElseThrow(() -> ApiException.badRequest("Select a valid Sri Lankan district."));
    }

    public static List<String> provinces() {
        return List.copyOf(DISTRICTS_BY_PROVINCE.keySet());
    }

    public static List<String> districts() {
        return DISTRICTS_BY_PROVINCE.values().stream().flatMap(List::stream).toList();
    }

    public static List<String> districtsForProvince(String provinceValue) {
        String province = canonicalProvince(provinceValue);
        return province == null ? districts() : List.copyOf(DISTRICTS_BY_PROVINCE.get(province));
    }

    public static String provinceForDistrict(String district) {
        return DISTRICTS_BY_PROVINCE.entrySet().stream()
                .filter(entry -> entry.getValue().contains(district))
                .map(Map.Entry::getKey)
                .findFirst()
                .orElseThrow(() -> ApiException.badRequest("Select a valid Sri Lankan district."));
    }

    private static String clean(String value) {
        if (value == null) return null;
        String cleaned = value.trim().replaceAll("\\s+", " ");
        return cleaned.isBlank() ? null : cleaned;
    }

    private static Map<String, List<String>> createLocations() {
        Map<String, List<String>> locations = new LinkedHashMap<>();
        locations.put("Western Province", List.of("Colombo", "Gampaha", "Kalutara"));
        locations.put("Central Province", List.of("Kandy", "Matale", "Nuwara Eliya"));
        locations.put("Southern Province", List.of("Galle", "Matara", "Hambantota"));
        locations.put("Northern Province", List.of("Jaffna", "Kilinochchi", "Mannar", "Mullaitivu", "Vavuniya"));
        locations.put("Eastern Province", List.of("Ampara", "Batticaloa", "Trincomalee"));
        locations.put("North Western Province", List.of("Kurunegala", "Puttalam"));
        locations.put("North Central Province", List.of("Anuradhapura", "Polonnaruwa"));
        locations.put("Uva Province", List.of("Badulla", "Monaragala"));
        locations.put("Sabaragamuwa Province", List.of("Kegalle", "Ratnapura"));
        return Map.copyOf(locations);
    }
}
