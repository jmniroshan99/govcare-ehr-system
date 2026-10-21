"""Explicit unit conversion; uncertain source units are never guessed."""
import math

CANONICAL_UNITS = {
    'hb': 'g/dL', 'albumin': 'g/L', 'calcium': 'mmol/L', 'sodium': 'mmol/L',
    'potassium_pre': 'mmol/L', 'potassium_post': 'mmol/L',
    'creatinine_pre': 'umol/L', 'creatinine_post': 'umol/L',
    'urea_pre': 'mmol/L', 'urea_post': 'mmol/L', 'dry_weight': 'kg', 'urr': '%',
}
# Wide plausibility boundaries identify data errors, not clinical decision thresholds.
RANGES = {
    'hb': (1, 25), 'albumin': (1, 100), 'calcium': (0.1, 6), 'sodium': (80, 200),
    'potassium_pre': (0.5, 15), 'potassium_post': (0.5, 15),
    'creatinine_pre': (1, 3000), 'creatinine_post': (1, 3000),
    'urea_pre': (0.001, 250), 'urea_post': (0, 250), 'dry_weight': (10, 300), 'urr': (0, 100),
}

def normalize_value(name, value, unit):
    if name not in CANONICAL_UNITS:
        raise ValueError('Unsupported measurement')
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError('A finite numeric measurement is required')
    unit = (unit or '').replace('µ', 'u').replace('μ', 'u').strip()
    canonical = CANONICAL_UNITS[name]
    factors = {(name, canonical): 1.0}
    if name == 'hb': factors[(name, 'g/L')] = 0.1
    if name == 'albumin': factors[(name, 'g/dL')] = 10.0
    if name.startswith('creatinine_'): factors[(name, 'mg/dL')] = 88.4
    if name.startswith('urea_'): factors[(name, 'mg/dL')] = 1 / 6.006
    if (name, unit) not in factors:
        raise ValueError('Unverified or unsupported unit')
    converted = float(value) * factors[(name, unit)]
    lo, hi = RANGES[name]
    if not lo <= converted <= hi:
        raise ValueError('Measurement outside the data plausibility boundary')
    return converted

def calculate_urr(pre, post):
    if pre is None or post is None:
        return None, 'MISSING_PAIRED_UREA'
    if not math.isfinite(pre) or not math.isfinite(post) or pre <= 0 or post < 0:
        return None, 'INVALID_PAIRED_UREA'
    value = (pre - post) / pre * 100.0
    if value < 0 or value > 100:
        return None, 'INVALID_URR_POST_EXCEEDS_PRE'
    return value, None
