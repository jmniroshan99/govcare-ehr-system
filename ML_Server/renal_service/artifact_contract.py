"""Checks before unpickling trusted local artifacts; a digest alone is not trust."""
from importlib.metadata import version

def validate_metadata(meta, key, expected_features):
    expected_units={'hb':'g/dL','urr':'%','hyperkalemia':'probability'}
    if meta.get('model_key')!=key or meta.get('model_version')!='1.0.0':raise RuntimeError('Incompatible model identity/version')
    if meta.get('unit')!=expected_units[key]:raise RuntimeError('Incompatible output unit')
    if meta.get('feature_names')!=expected_features or meta.get('feature_order',expected_features)!=expected_features:raise RuntimeError('Incompatible feature schema/order')
    if meta.get('served_method') not in {'PERSISTENCE_BASELINE','RESEARCH_MODEL'}:raise RuntimeError('Unsupported serving method')
    # Native artifacts are not portable across arbitrary sklearn versions.
    versions=meta.get('environment',meta.get('dependency_versions',meta.get('versions',{})))
    fitted=versions.get('scikit-learn') if isinstance(versions,dict) else None
    if fitted and fitted!=version('scikit-learn'):raise RuntimeError('Incompatible estimator dependency version')
