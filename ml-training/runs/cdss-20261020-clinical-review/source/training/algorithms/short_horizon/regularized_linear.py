from sklearn.linear_model import Ridge, LogisticRegression

def build(task, parameters, seed=42):
    return Ridge(**parameters) if task == 'regression' else LogisticRegression(max_iter=3000, random_state=seed, **parameters)
