import type { LearnedOutlookReadiness } from "../../../services/ckdOutlookService";

/** Uses the current server's offline audit; never invents a learned probability. */
export function LearnedModelReadiness({readiness}:{readiness?:LearnedOutlookReadiness}) {
  return <details className="co-learned-readiness" aria-label="Learned five-year research model readiness">
    <summary>Learned research-model estimate · Not available</summary>
    <p>No learned five-year estimate is installed. The current monthly dialysis dataset has no adjudicated first-kidney-failure endpoint or verified long-term follow-up.</p>
    <p><strong>Next action:</strong> collect an eligible nondialysis CKD cohort with dated first maintenance KRT, death ascertainment and verified follow-up end dates.</p>
    {readiness?.reasons.map(reason=><p key={reason}>{reason}</p>)}
    {!!readiness?.missing_fields?.length&&<p>Missing dataset fields: {readiness.missing_fields.join(", ")}.</p>}
    <p>Published KFRE remains a separate estimate for eligible patients. Short-term dialysis models predict the next observed measurement within 14–62 days.</p>
    {readiness&&<small>Readiness: {readiness.status.replaceAll("_"," ")} · Local validation: not completed</small>}
  </details>;
}
