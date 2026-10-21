def assert_patient_split(frame, split):
    groups=[set(frame.iloc[indices].patient_id) for indices in split.values()]
    if any(groups[i]&groups[j] for i in range(len(groups)) for j in range(i+1,len(groups))):
        raise AssertionError('Patient leakage between partitions')
    return True

def assert_feature_contract(names):
    if any(n in ('patient_id','source_row','observed_at') or 'next' in n.lower() or 'target' in n.lower() for n in names):
        raise AssertionError('Identifier, date or target was included as a model feature')
    return True
