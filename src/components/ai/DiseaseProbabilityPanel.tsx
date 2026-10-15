import { useId, useState } from "react";
import { Activity, BrainCircuit, ChevronDown, CircleCheck, Clock3, Droplets, HeartPulse, Info, ShieldCheck, Waves } from "lucide-react";
import { Button } from "../ui/button";
import { diseaseAvailabilityLabel, hasProbability, probabilityText } from "../../lib/diseaseProbabilities";
import type { DiseaseProbability, DiseaseProbabilitySnapshot } from "../../types/diseaseProbability";
import "./disease-probabilities.css";

const icons = { ckd_progression: Waves, kfre: Activity, aki: Activity, cardiovascular: HeartPulse, hyperkalemia: Droplets, anemia: Droplets };

function ProbabilityCard({ entry }: { entry: DiseaseProbability }) {
  const available = hasProbability(entry);
  const Icon = icons[entry.key as keyof typeof icons] ?? BrainCircuit;
  return <article className="gov-probability-card" data-available={available}>
    <div className="gov-probability-card-top"><span className="gov-icon-tile"><Icon size={20} aria-hidden="true" /></span>
      <span className="gov-probability-status">{available ? <CircleCheck size={13} /> : <Info size={13} />}{diseaseAvailabilityLabel(entry)}</span></div>
    <h4>{entry.label}</h4>
    <p className="gov-probability-value">{available ? probabilityText(entry.probability) : "Data unavailable"}</p>
    {available ? <div className="gov-probability-meter" role="meter" aria-label={`${entry.label} model-estimated probability`}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={entry.probability! * 100} aria-valuetext={probabilityText(entry.probability)}>
      <span style={{ width: `${entry.probability! * 100}%` }} /></div>
      : <p className="gov-probability-empty">No probability calculated</p>}
    <p className="gov-probability-horizon"><Clock3 size={14} aria-hidden="true" />{available ? `Horizon: ${entry.horizon}` : "Horizon unavailable"}</p>
    <details className="gov-probability-details"><summary>Model & evidence details<ChevronDown size={15} aria-hidden="true" /></summary>
      <p>{entry.reason}</p><dl><dt>Model</dt><dd>{entry.modelVersion}</dd><dt>Validation</dt><dd>{entry.validationStatus.toLowerCase().replaceAll("_", " ")}</dd></dl>
      <p>{entry.purpose}</p></details>
  </article>;
}

/** The same assessment snapshot is rendered in both screen cards and the unfiltered print table. */
export function DiseaseProbabilityPanel({ snapshot }: { snapshot: DiseaseProbabilitySnapshot }) {
  const headingId = useId();
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const current = snapshot.entries.find(e => e.key === "ckd");
  const related = snapshot.entries.filter(e => e.key !== "ckd");
  const visible = onlyAvailable ? related.filter(hasProbability) : related;
  return <section className="gov-disease-probabilities" aria-labelledby={headingId}>
    <header className="gov-probability-header"><div><span className="gov-kicker">Assessment intelligence · related outcomes</span>
      <h3 id={headingId}><BrainCircuit size={21} aria-hidden="true" />Related disease probabilities</h3>
      <p>Each outcome uses its own model and time horizon. Confidence and abnormal laboratory values are separate from disease probabilities.</p></div>
      <span className="gov-probability-snapshot"><ShieldCheck size={15} aria-hidden="true" />{snapshot.capturedAt ? "Saved assessment snapshot" : "Earlier assessment"}</span>
    </header>
    <div className="gov-probability-screen">
      {current && <div className="gov-probability-current"><div><span>Current CKD model</span><strong>{hasProbability(current) ? probabilityText(current.probability) : "Data unavailable"}</strong></div>
        <p>{current.modelVersion} · Current assessment<br />Related-disease probabilities are not derived from this score.</p></div>}
      {snapshot.capturedAt == null && <p className="gov-probability-legacy" role="note"><Info size={16} />Related-risk availability was not captured for this assessment. Run a new assessment to capture current model availability.</p>}
      <div className="gov-probability-toolbar" role="group" aria-label="Filter related disease probabilities">
        <Button className="text-xs" variant={onlyAvailable ? "ghost" : "outline"} aria-pressed={!onlyAvailable} onClick={() => setOnlyAvailable(false)}>All outcomes</Button>
        <Button className="text-xs" variant={onlyAvailable ? "outline" : "ghost"} aria-pressed={onlyAvailable} onClick={() => setOnlyAvailable(true)}>Available probabilities</Button>
        <span>All outcomes are included when you print or export.</span>
      </div>
      {visible.length ? <div className="gov-probability-grid">{visible.map(entry => <ProbabilityCard key={entry.key} entry={entry} />)}</div>
        : <div className="gov-probability-no-results"><Info size={22} /><strong>No related-disease probability is available for this assessment.</strong><p>Choose All outcomes to review model availability and evidence requirements.</p></div>}
    </div>
    <div className="gov-probability-print"><table><caption>Assessment-time model outputs and availability</caption><thead><tr><th>Disease / outcome</th><th>Probability</th><th>Time horizon</th><th>Model & availability</th></tr></thead>
      <tbody>{snapshot.entries.map(entry => <tr key={entry.key}><th scope="row">{entry.label}</th><td>{hasProbability(entry) ? probabilityText(entry.probability) : "Data unavailable"}</td>
        <td>{entry.horizon}</td><td>{entry.modelVersion} · {diseaseAvailabilityLabel(entry)}<p>{entry.reason}</p></td></tr>)}</tbody></table></div>
    <footer className="gov-probability-footer"><ShieldCheck size={15} aria-hidden="true" /><p>{snapshot.capturedAt
      ? `Captured ${new Date(snapshot.capturedAt).toLocaleString()} · Printed reports use this saved snapshot.`
      : "Related-risk snapshot not recorded. Historical percentages have not been backfilled."}</p></footer>
  </section>;
}
