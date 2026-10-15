from pathlib import Path
import numpy as np
import pandas as pd
import shap
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

def explain_pipeline(pipeline, data, feature_names):
    transformed=pipeline[:-1].transform(data)
    model=pipeline[-1]
    if hasattr(model,'coef_'):
        # Training mean is retained in metadata; a zero standardized reference is explicit.
        explainer=shap.LinearExplainer(model,(np.zeros(transformed.shape[1]),np.eye(transformed.shape[1])))
    else:
        explainer=shap.TreeExplainer(model,feature_perturbation='tree_path_dependent',model_output='raw')
    explanation=explainer(transformed)
    if explanation.values.ndim!=2: raise ValueError('Unexpected SHAP regression output')
    return explanation,transformed

def write_global_xai(pipeline,data,feature_names,directory):
    directory=Path(directory);directory.mkdir(parents=True,exist_ok=True)
    explanation,transformed=explain_pipeline(pipeline,data,feature_names)
    ranking=pd.DataFrame({'feature':feature_names,'mean_absolute_shap':np.abs(explanation.values).mean(axis=0)})
    ranking=ranking.sort_values('mean_absolute_shap',ascending=False)
    ranking.to_csv(directory/'top_features.csv',index=False)
    shap.summary_plot(explanation.values,transformed,feature_names=feature_names,show=False,max_display=15)
    plt.title('Held-out research cohort: model associations (SHAP)')
    plt.tight_layout();plt.savefig(directory/'shap_summary.png',dpi=180,bbox_inches='tight');plt.close('all')
    # SHAP reconstruction is checked against the fitted model; no clinical/causal interpretation.
    rebuilt=np.asarray(explanation.base_values).reshape(-1)+explanation.values.sum(axis=1)
    predictions=pipeline.predict(data)
    max_error=float(np.max(np.abs(rebuilt-predictions)))
    return {'method':'SHAP','background':'Tree path dependent; Ridge standardized zero reference',
            'max_prediction_reconstruction_error':max_error,
            'top_features':ranking.head(10).to_dict(orient='records')}
