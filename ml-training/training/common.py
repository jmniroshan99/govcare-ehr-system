"""Offline IO helpers. Importing this module performs no fitting or filesystem writes."""
import hashlib
import importlib.metadata
import json
import platform
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SEED = 42
LIMITATIONS = [
    'Previously examined patient test cohort reused; not a new independent test set.',
    'Original precleaning measurements unavailable; upstream interpolation leakage cannot be excluded.',
    'Dataset secondary-use permission UNVERIFIED; clinical validation NOT_COMPLETED.',
    'Small single-source maintenance-hemodialysis cohort; no general-population CKD inference.',
]

def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def write_json(path, value):
    def clean(x):
        if isinstance(x, dict): return {str(k): clean(v) for k,v in x.items()}
        if isinstance(x, (list, tuple, np.ndarray)): return [clean(v) for v in x]
        if isinstance(x, (float, np.floating)) and not np.isfinite(x): return None
        if isinstance(x, np.generic): return x.item()
        return x
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(clean(value), indent=2, allow_nan=False, default=str)+'\n', encoding='utf-8')

def environment():
    result = {'python': platform.python_version(), 'platform': platform.platform()}
    for name in ['numpy','pandas','scikit-learn','xgboost','scipy','joblib','Django','scikit-survival','lifelines']:
        try: result[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError: result[name] = 'NOT_INSTALLED'
    return result
