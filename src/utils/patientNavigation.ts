export const patientUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function clinicalAssessmentHref(pathname: string) {
  const patientId = pathname.match(/^\/patients\/([^/]+)(?:\/|$)/)?.[1];
  return patientId && patientUuidPattern.test(patientId)
    ? `/ai-cdss/ckd?patientId=${encodeURIComponent(patientId)}`
    : "/ai-cdss/ckd";
}
