import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity, BrainCircuit, CalendarClock, ChevronDown, ClipboardCheck, ShieldCheck, Stethoscope } from "lucide-react";
import { AuthorizedPatientSelect } from "../forms/AuthorizedPatientSelect";
import { PatientPhoto } from "../patient/PatientPhoto";
import { PageTransition } from "../motion/PageTransition";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { PageHeader } from "../ui/page-header";
import { WorkspaceTabs, type WorkspaceTab } from "../ui/workspace-tabs";
import { useAuthStore } from "../../stores/authStore";
import { canUsePredictiveWorkspace, resolveCkdWorkspaceView, type CkdWorkspaceView } from "../../lib/ckdWorkspace";
import { patientUuidPattern } from "../../utils/patientNavigation";
import { calculateAgeYears } from "../../utils/age";
import type { AuthorizedPatient } from "../../services/patientService";
import type { ReactNode } from "react";
import { CkdResearchDemoTools } from "./CkdEvidenceSetup";
import { isSyntheticCkdPatient } from "../../services/ckdClinicalEvidenceService";

const Intelligence = lazy(async () => ({ default: (await import("../../pages/PredictiveClinicalIntelligence")).PredictiveIntelligencePanel }));
const Outlook = lazy(async () => ({ default: (await import("./CkdFiveYearOutlook")).CkdFiveYearOutlook }));

export function CkdClinicalWorkspace({ assessment }: { assessment: (patient: AuthorizedPatient) => ReactNode }) {
  const profile = useAuthStore(state => state.profile);
  const [params, setParams] = useSearchParams();
  const [patient, setPatient] = useState<AuthorizedPatient | null>(null);
  const [chooserOpen, setChooserOpen] = useState(true);
  const [requestedView, setRequestedView] = useState<string | null>(params.get("view"));
  useEffect(()=>setRequestedView(params.get("view")),[params]);
  const view = resolveCkdWorkspaceView(requestedView, profile);
  const canUseIntelligence = canUsePredictiveWorkspace(profile);
  const selectPatient = useCallback((next: AuthorizedPatient | null) => {
    setPatient(current => current?.id === next?.id ? current : next);
    setChooserOpen(!next);
  }, []);
  const initialIdentifier = params.get("patientId") ?? "";
  const tabs: WorkspaceTab<CkdWorkspaceView>[] = [
    { value: "assessment", label: "CKD risk assessment", description: "Review inputs and current model result", icon: <ClipboardCheck size={19} />, panelId: "ckd-assessment-panel" },
    ...(canUseIntelligence ? [{ value: "intelligence" as const, label: "Predictive clinical intelligence", description: "Dated trends, evidence and clinical reviews", icon: <Activity size={19} />, panelId: "ckd-intelligence-panel" }] : []),
    ...(canUseIntelligence ? [{ value: "outlook" as const, label: "5-year outlook", description: "Future risk, evidence and clinical planning", icon: <CalendarClock size={19} />, panelId: "ckd-outlook-panel" }] : []),
  ];
  const age = calculateAgeYears(patient?.date_of_birth);
  return <PageTransition><div className="space-y-5">
    <PageHeader eyebrow="GovCare · Clinical Intelligence" icon={<BrainCircuit size={17} />} title="CKD care workspace"
      description="Assess current kidney risk and review the patient's recorded history in one place."
      actions={<Badge><ShieldCheck size={14} /> Clinician controlled</Badge>} />
    <section className="gov-patient-context" aria-label="Shared patient context">
      <div className="gov-patient-toolbar">
        <div className="gov-patient-identity">
          {patient ? <PatientPhoto src={patient.profile_photo_url} name={patient.full_name ?? "Patient"} className="h-12 w-12 shrink-0 rounded-2xl border border-accent-border" />
            : <span className="gov-icon-tile h-12 w-12"><Stethoscope size={23} /></span>}
          <div><span className="gov-kicker">{patient ? "Selected patient · connected clinical views" : "Start with an authorized patient"}</span>
            <h2>{patient?.full_name ?? "Who are you reviewing today?"}</h2>
            <p>{patient ? [patient.patient_no, age == null ? null : `Age ${age}`, patient.hospital_name].filter(Boolean).join(" · ") : "Find a patient by number, name or identification. Access follows your hospital and clinical assignments."}</p>
          </div>
        </div>
        {patient && <Button variant="outline" aria-expanded={chooserOpen} aria-controls="ckd-shared-patient-picker" onClick={() => setChooserOpen(open => !open)}>
          {chooserOpen ? "Close selector" : "Change patient"}<ChevronDown size={16} /></Button>}
      </div>
      <div id="ckd-shared-patient-picker" className="gov-patient-picker" hidden={!chooserOpen}>
        {initialIdentifier && !patientUuidPattern.test(initialIdentifier) && <p role="alert" className="mb-3 text-sm text-danger">The patient link is invalid. Select an authorized patient from the list.</p>}
        <AuthorizedPatientSelect value={patient?.id ?? ""} initialIdentifier={initialIdentifier} onChange={selectPatient}
          assessmentLabel="CKD assessment and clinical intelligence" showSelectedSummary={false} />
      </div>
      {patient && <div className="gov-patient-footer"><ShieldCheck size={14} />{profile?.role === "super_admin" ? "Authorized hospital-network access" : "Authorized patient access"} · Changing the patient clears the clinical workspace.</div>}
      {profile?.role==="super_admin"&&<CkdResearchDemoTools onSelect={p=>{selectPatient(p);setRequestedView("intelligence");setParams(current=>{const next=new URLSearchParams(current);next.set("patientId",p.id);next.set("view","intelligence");return next;},{replace:true});}}/>}
    </section>
    {patient&&isSyntheticCkdPatient(patient)&&<div className="ckd-synthetic-banner" role="status"><strong>SYNTHETIC RESEARCH DEMONSTRATION — NOT A REAL PATIENT.</strong> Generated software fixtures; clinical validation and model eligibility requirements remain unchanged.</div>}
    <WorkspaceTabs label="CKD care views" tabs={tabs} value={view} onValueChange={setRequestedView} />
    <div id="ckd-assessment-panel" role="tabpanel" aria-labelledby="ckd-assessment-panel-tab" tabIndex={0} hidden={view !== "assessment"} className="gov-clinical-panel">
      {patient ? assessment(patient) : <div className="gov-empty-state"><BrainCircuit size={34} /><h2 className="text-lg font-semibold">Start an assessment</h2><p>Select an authorized patient above. Upload source reports or enter verified clinical values, then review the CKD model result.</p></div>}
    </div>
    {canUseIntelligence && <div id="ckd-intelligence-panel" role="tabpanel" aria-labelledby="ckd-intelligence-panel-tab" tabIndex={0} hidden={view !== "intelligence"} className="gov-clinical-panel">
      {view === "intelligence" && (patient ? <Suspense fallback={<div className="gov-empty-state" role="status">Loading clinical intelligence…</div>}>
        <Intelligence key={patient.id} patient={patient} /></Suspense> : <div className="gov-empty-state"><Activity size={34} /><h2 className="text-lg font-semibold">A connected clinical picture</h2><p>Select a patient above to review real dated measurements, kidney categories, evidence quality and the clinical review queue.</p></div>)}
    </div>}
    {canUseIntelligence && <div id="ckd-outlook-panel" role="tabpanel" aria-labelledby="ckd-outlook-panel-tab" tabIndex={0} hidden={view !== "outlook"} className="gov-clinical-panel">
      {view === "outlook" && (patient ? <Suspense fallback={<div className="gov-empty-state" role="status">Loading five-year outlook…</div>}>
        <Outlook key={patient.id} patient={patient} onNavigate={setRequestedView}/></Suspense> : <div className="gov-empty-state"><CalendarClock size={34}/><h2 className="text-lg font-semibold">Plan the next five years</h2><p>Select an authorized patient to review long-term risk eligibility, recorded evidence and a clinician-defined care plan.</p></div>)}
    </div>}
  </div></PageTransition>;
}
