from sklearn.svm import SVR, SVC

def build(task, parameters, seed=42):
    # SVC's internal row-wise Platt calibration is prohibited. The task runner
    # wraps the entire preprocessing pipeline with patient-grouped sigmoid CV.
    return SVR(**parameters) if task == 'regression' else SVC(probability=False, random_state=seed, **parameters)
