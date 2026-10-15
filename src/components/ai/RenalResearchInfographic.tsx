import { useId, useState } from "react";
import { Download, ExternalLink, FileText, Info } from "lucide-react";
import "./renal-research-infographic.css";

const assets = {
  png: `${import.meta.env.BASE_URL}research/ckd-risk-predictive-intelligence-v45.png`,
  pdf: `${import.meta.env.BASE_URL}research/ckd-risk-predictive-intelligence-v45.pdf`,
};

const modules = [
  {
    title: "Anemia / Hb Deterioration",
    description: ["Monitors declining Hemoglobin", "Predicts next-period Hb risk"],
    indicators: ["Hb", "Albumin", "Urea", "Creatinine", "Calcium", "Potassium"],
    method: "Hb is served as a persistence baseline, carrying forward the last verified observation.",
  },
  {
    title: "Hyperkalemia Monitoring",
    description: ["Detects rising Potassium patterns", "Supports early clinical review"],
    indicators: ["Pre-HD K+", "Post-HD K+", "K+ Difference", "Creatinine", "Longitudinal K+ Trend"],
    method: "The next-period research risk model is not clinically calibrated.",
  },
  {
    title: "Dialysis Adequacy / URR",
    description: ["Measures effectiveness of urea removal", "Forecasts next-period inadequate dialysis risk"],
    indicators: ["Pre-HD Urea", "Post-HD Urea", "Current URR", "Previous URR", "URR Trend"],
    method: "URR forecasts are research estimates requiring clinician review.",
    formula: "URR = ((Pre-HD Urea − Post-HD Urea) / Pre-HD Urea) × 100",
  },
  {
    title: "Renal Clinical Deterioration",
    description: ["Combines multiple renal trends", "Stable • Improving • Declining"],
    indicators: ["Creatinine ↑", "Urea ↑", "Potassium ↑", "Hemoglobin ↓", "Albumin ↓", "URR ↓"],
    method: "The directional trend composite is a clinical review signal, not a disease probability.",
  },
];

const workflow = [
  "Sri Lankan Longitudinal Patient Data",
  "Clinical Data Validation",
  "Predictive Intelligence",
  "Explainable AI",
  "Clinician Review",
];

/** Static research explanation. Never consumes patient data or invokes inference. */
export function RenalResearchInfographic() {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  return <section className="renal-research" aria-labelledby={`${id}-title`}>
    <header className="renal-research-header">
      <div>
        <span className="renal-research-kicker">Research overview · Illustrative trends</span>
        <h3 id={`${id}-title`}>CKD-Related Clinical Risks &amp; Predictive Intelligence</h3>
        <p>Sri Lankan Longitudinal Renal &amp; Hemodialysis Data</p>
      </div>
      <nav className="renal-research-actions" aria-label="Research infographic exports">
        <a href={assets.png} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} aria-hidden="true" /> Open full size</a>
        <a href={assets.png} download="GovCare_CKD_Research_Infographic.png"><Download size={15} aria-hidden="true" /> Download PNG</a>
        <a href={assets.pdf} download="GovCare_CKD_Research_Infographic.pdf"><FileText size={15} aria-hidden="true" /> Presentation PDF</a>
      </nav>
    </header>

    <details className="renal-research-figure" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
      <summary>{expanded ? "Collapse research infographic" : "Show research infographic"}</summary>
      <figure>
        {imageFailed ? <p className="renal-research-fallback" role="status">The infographic image could not be loaded. The complete module descriptions remain available below.</p> :
          <a className="renal-research-image-link" href={assets.png} target="_blank" rel="noopener noreferrer" aria-label="Open the research infographic at full resolution in a new tab">
            <img src={assets.png} width={1672} height={941} loading="lazy" decoding="async"
              alt="Research concept: a realistic kidney pair connects anemia and hemoglobin deterioration, hyperkalemia monitoring, dialysis adequacy and URR, and renal clinical deterioration. Illustrative trends lead through data validation, predictive intelligence, explainable AI and clinician review."
              onError={() => setImageFailed(true)} />
          </a>}
        <figcaption><Info size={16} aria-hidden="true" /><span>Conceptual research graphic only. Its charts are illustrative clinical review signals, not patient-specific results or confirmed diagnoses. G5D requires verified maintenance dialysis. Recorded patient measurements and stored research outputs appear in the clinical cards below.</span></figcaption>
      </figure>
    </details>

    <details className="renal-research-transcript">
      <summary>Readable module descriptions and clinical context</summary>
      <p className="renal-research-center-text">Chronic Kidney Disease / Kidney Failure (G5D) · Longitudinal Clinical Monitoring</p>
      <div className="renal-research-modules">{modules.map(module => <article key={module.title}>
        <h4>{module.title}</h4>
        {module.description.map(line => <p key={line}>{line}</p>)}
        {module.formula && <p className="renal-research-formula">{module.formula}</p>}
        <ul className="renal-research-indicators">{module.indicators.map(indicator => <li key={indicator}>{indicator}</li>)}</ul>
        <p className="renal-research-method">{module.method}</p>
      </article>)}</div>
      <ol className="renal-research-workflow" aria-label="Research intelligence workflow">{workflow.map(step => <li key={step}>{step}</li>)}</ol>
      <ul className="renal-research-badges" aria-label="Research design capabilities">{["Longitudinal Data", "Explainable AI", "Clinician-in-the-Loop", "FHIR R4 Compatible"].map(badge => <li key={badge}>{badge}</li>)}</ul>
    </details>
  </section>;
}
