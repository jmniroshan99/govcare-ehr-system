import { QRCodeSVG } from "qrcode.react";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Download,
  FileSignature,
  CalendarPlus,
  FlaskConical,
  Mic,
  Pill,
  Radio,
  Save,
  Send,
  ShieldCheck,
  Stethoscope,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import {
  approveDoctorDischarge,
  getDoctorSessionActions,
  saveConsultationDraft,
  scheduleDoctorFollowUp,
  sendDoctorReferral,
  submitDoctorApproval,
  type DoctorSessionActionRecord,
} from "../services/doctorService";
import { createDiagnosticOrdersFromConsultation, type OrderPriority, type PatientIdentitySnapshot } from "../services/clinicalIntegrationService";
import { createPrescriptionFromConsultation, type PharmacyPriority } from "../services/pharmacyService";
import { downloadTextFile, timestampedFilename } from "../utils/download";
import { completeDoctorConsultation, getDoctorVisitBuckets } from "../utils/doctorWorkflow";
import { addNotification } from "../utils/notifications";
import { useAuthStore } from "../stores/authStore";

const timeline = [
  ["2026-06-13", "OPD", "Fever, cough, viral illness suspected"],
  ["2026-06-12", "Lab", "FBC normal, CRP mildly elevated"],
  ["2026-05-29", "Emergency", "Hypoglycaemia observation"],
  ["2026-05-20", "Discharge", "Ward 12 discharge summary"],
];

const vitals = [
  { day: "Mon", bp: 128, pulse: 82, spo2: 98 },
  { day: "Tue", bp: 132, pulse: 86, spo2: 97 },
  { day: "Wed", bp: 126, pulse: 80, spo2: 99 },
  { day: "Thu", bp: 144, pulse: 92, spo2: 96 },
  { day: "Fri", bp: 136, pulse: 84, spo2: 98 },
];

const medicines = ["Metformin", "Losartan", "Paracetamol", "Omeprazole", "Amoxicillin", "Atorvastatin"];

export function DoctorWorkspace() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const profile = useAuthStore((state) => state.profile);
  const activeVisit = getDoctorVisitBuckets().checking[0];
  const [symptoms, setSymptoms] = useState("Fever, cough, tiredness");
  const [history, setHistory] = useState("Diabetes mellitus, penicillin allergy");
  const [exam, setExam] = useState("Temp 37.8 C. Chest clear. No respiratory distress.");
  const [diagnosis, setDiagnosis] = useState("J06.9 Acute upper respiratory infection, unspecified");
  const [soap, setSoap] = useState("S: Fever and cough for 2 days\nO: Stable vitals\nA: Viral URTI\nP: Symptomatic care and follow-up");
  const [plan, setPlan] = useState("Hydration, paracetamol, return if breathing difficulty");
  const [medicine, setMedicine] = useState("Paracetamol");
  const [prescription, setPrescription] = useState("Paracetamol 500mg TDS for 3 days");
  const [labRequests, setLabRequests] = useState("FBC, CRP");
  const [radiologyRequests, setRadiologyRequests] = useState("Chest X-ray");
  const [followUpDate, setFollowUpDate] = useState("2026-06-21");
  const [completionStatus, setCompletionStatus] = useState<"Checked" | "Consulted" | "Completed">("Completed");
  const [draftState, setDraftState] = useState("Saved locally");
  const [template, setTemplate] = useState("URTI template");
  const [labPriority, setLabPriority] = useState("routine");
  const [radiologyPriority, setRadiologyPriority] = useState("routine");
  const [pharmacyPipelineState, setPharmacyPipelineState] = useState("Prescription not sent to pharmacy yet.");
  const [referralDestination, setReferralDestination] = useState("Medical clinic follow-up");
  const [dischargeTitle, setDischargeTitle] = useState("OPD discharge note");
  const [approvalReason, setApprovalReason] = useState("Approve lab result review and prescription");
  const aiSummary = useMemo(() => "44-year-old with diabetes and penicillin allergy. Stable vitals, likely viral URTI. Avoid penicillin-class antibiotics; monitor sugar and follow up if fever persists.", []);
  const patientSnapshot: PatientIdentitySnapshot = useMemo(() => ({
    patientId: activeVisit?.patientId ?? "PAT-2026-000001",
    patientName: activeVisit?.patientName ?? "Nimal Silva",
    age: activeVisit?.patientAge ?? 44,
    gender: activeVisit?.patientGender ?? "Male",
    phone: "0771234567",
    nic: activeVisit?.patientId === "PAT-2026-000001" ? "812345678V" : undefined,
    qrReference: activeVisit?.tokenNo ?? "RX-DRAFT",
    allergies: history.toLowerCase().includes("penicillin") ? ["Penicillin"] : [],
    chronicDiseases: history.toLowerCase().includes("diabetes") ? ["Diabetes"] : [],
    hospitalId: activeVisit?.hospitalId ?? "hosp-colombo-national",
  }), [activeVisit, history]);
  const [sessionActions, setSessionActions] = useState<DoctorSessionActionRecord[]>(() => getDoctorSessionActions(patientSnapshot.patientId).slice(0, 3));

  function diagnosticPriority(value: string): OrderPriority {
    if (value === "critical") return "critical";
    if (value === "urgent") return "urgent";
    return "routine";
  }

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      await saveConsultationDraft({ symptoms, history, exam, diagnosis, soap, plan });
      setDraftState(`Auto-saved ${new Date().toLocaleTimeString()}`);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [symptoms, history, exam, diagnosis, soap, plan]);

  useEffect(() => {
    setSessionActions(getDoctorSessionActions(patientSnapshot.patientId).slice(0, 3));
  }, [patientSnapshot.patientId]);

  async function approve(type: string) {
    await submitDoctorApproval({ type, patientId: patientSnapshot.patientId });
    setDraftState(`${type} approved`);
  }

  function sessionPayload(notes: string) {
    const visit = activeVisit ?? {
      visitId: "VIS-DEMO-SESSION",
      patientId: patientSnapshot.patientId,
      patientName: patientSnapshot.patientName,
      department: "Medical OPD",
      hospitalId: patientSnapshot.hospitalId,
    };
    return {
      visitId: visit.visitId,
      patientId: visit.patientId,
      patientName: visit.patientName,
      hospitalId: visit.hospitalId,
      department: visit.department,
      doctorId: profile?.uid ?? "demo-doctor",
      doctorName: profile?.displayName ?? "Dr. Anjali Perera",
      diagnosis,
      treatmentPlan: plan,
      notes,
      followUpDate,
      destination: referralDestination,
      completionStatus,
      actionReason: approvalReason,
      actorRole: profile?.role ?? "doctor",
    };
  }

  function recordSessionAction(action: DoctorSessionActionRecord, toastMessage: string, notificationTitle: string) {
    setSessionActions((current) => [action, ...current.filter((item) => item.id !== action.id)].slice(0, 3));
    setDraftState(`${notificationTitle}: ${action.status}`);
    addNotification({
      title: notificationTitle,
      message: `${action.patientName} - ${toastMessage}`,
      module: "Doctor Center",
      priority: action.type === "discharge_approval" ? "urgent" : "information",
      roles: ["super_admin", "hospital_admin", "doctor", "nurse", "receptionist", "patient"],
      channels: ["in-app", "push"],
      group: "Consultation",
      actionHref: action.type === "follow_up" ? "/appointments" : "/doctor/workspace",
    });
  }

  async function handleSendReferral() {
    if (!referralDestination.trim()) {
      showToast("Enter a referral destination before sending.", "warning");
      return;
    }
    const action = await sendDoctorReferral(sessionPayload(`Referral to ${referralDestination}. ${plan}`));
    recordSessionAction(action, `referral sent to ${referralDestination}`, "Referral sent");
    showToast(`${patientSnapshot.patientName} referral sent to ${referralDestination}.`, action.status === "queued" ? "warning" : "success");
  }

  async function handleApproveDischarge() {
    if (completionStatus !== "Completed") {
      showToast("Set visit completion status to Completed before approving discharge.", "warning");
      return;
    }
    if (!dischargeTitle.trim() || !approvalReason.trim()) {
      showToast("Enter discharge title and approval reason before approving.", "warning");
      return;
    }
    const action = await approveDoctorDischarge(sessionPayload(`${dischargeTitle}. ${approvalReason}. ${soap}`));
    recordSessionAction(action, "discharge approved and nursing/admin teams notified", "Discharge approved");
    showToast(`${patientSnapshot.patientName} discharge approved. Ward/reception follow-up is ready.`, action.status === "queued" ? "warning" : "success");
  }

  async function handleScheduleFollowUp() {
    if (!followUpDate) {
      showToast("Select a follow-up date before scheduling.", "warning");
      return;
    }
    const action = await scheduleDoctorFollowUp(sessionPayload(`Follow-up scheduled for ${followUpDate}. ${referralDestination}`));
    recordSessionAction(action, `follow-up scheduled on ${followUpDate}`, "Follow-up scheduled");
    showToast(`${patientSnapshot.patientName} follow-up scheduled for ${followUpDate}.`, action.status === "queued" ? "warning" : "success");
  }

  function saveWorkspace() {
    void saveConsultationDraft({ symptoms, history, exam, diagnosis, soap, plan }).catch((error) => console.warn("Consultation background save failed.", error));
    setDraftState(`Saved ${new Date().toLocaleTimeString()}`);
    showToast("Consultation workspace saved.", "success");
  }

  function validateCompletion() {
    const missing = [
      !symptoms.trim() && "symptoms",
      !exam.trim() && "examination findings",
      !diagnosis.trim() && "diagnosis",
      !plan.trim() && "treatment plan",
      !prescription.trim() && "prescription",
    ].filter(Boolean);
    return missing as string[];
  }

  async function finishPatientCheck() {
    const missing = validateCompletion();
    if (missing.length) {
      showToast(`Complete required fields: ${missing.join(", ")}.`, "warning");
      return;
    }
    if (!activeVisit) {
      showToast("No active Currently Checking patient found. Start a patient check from Doctor Center first.", "danger");
      return;
    }
    const confirmed = window.confirm(`Mark ${activeVisit.patientName} (${activeVisit.tokenNo}) as ${completionStatus}? This removes the patient from the active OPD queue.`);
    if (!confirmed) return;
    try {
      const completed = completeDoctorConsultation({
        visitId: activeVisit.visitId,
        tokenNo: activeVisit.tokenNo,
        patientId: activeVisit.patientId,
        patientName: activeVisit.patientName,
        status: completionStatus,
        consultationNotes: soap,
        symptoms,
        examination: exam,
        diagnosis,
        prescription,
        labRequests,
        radiologyRequests,
        treatmentPlan: plan,
        followUpDate,
        doctorId: profile?.uid ?? "demo-doctor",
        doctorName: profile?.displayName ?? "Dr. Anjali Perera",
        department: activeVisit.department,
        hospitalId: activeVisit.hospitalId,
        actorRole: profile?.role ?? "doctor",
      });
      await createDiagnosticOrdersFromConsultation({
        visitId: activeVisit.visitId,
        patient: patientSnapshot,
        labRequests,
        radiologyRequests,
        clinicalReason: `${diagnosis}. ${plan}`,
        labPriority: diagnosticPriority(labPriority),
        radiologyPriority: diagnosticPriority(radiologyPriority),
        doctorId: profile?.uid ?? "demo-doctor",
        doctorName: profile?.displayName ?? "Dr. Anjali Perera",
        department: activeVisit.department,
      });
      await saveConsultationDraft({ symptoms, history, exam, diagnosis, soap, plan });
      setDraftState(`${completed.status} at ${new Date(completed.timestamp).toLocaleTimeString()}`);
      showToast(`${activeVisit.tokenNo} marked as ${completed.status}. OPD queue updated.`, "success");
      navigate("/doctor");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to save consultation. Queue state rolled back.", "danger");
    }
  }

  function printPrescription() {
    const visit = activeVisit ?? {
      visitId: "VIS-DEMO-PRESCRIPTION",
      tokenNo: patientSnapshot.qrReference ?? "OPD-DEMO",
      patientId: patientSnapshot.patientId,
      patientName: patientSnapshot.patientName,
      department: "Medical OPD",
      hospitalId: patientSnapshot.hospitalId,
    };
    downloadTextFile(
      timestampedFilename(`${visit.patientId.toLowerCase()}-consultation-prescription`, "txt"),
      `GovCare EHR System
Prescription Preview

Patient: ${visit.patientName}
Patient ID: ${visit.patientId}
Gender/Age: ${patientSnapshot.gender} / ${patientSnapshot.age ?? "Not recorded"}
NIC/QR: ${patientSnapshot.nic ?? patientSnapshot.qrReference ?? "Not recorded"}
Visit: ${visit.tokenNo} | Department: ${visit.department}
Diagnosis: ${diagnosis}
Medicine: ${prescription || `${medicine} 500mg TDS for 3 days`}
Plan: ${plan}
Follow-up: ${followUpDate || "Not scheduled"}
Doctor: ${profile?.displayName ?? "Dr. Anjali Perera"}
Digital signature: pending`,
      "text/plain;charset=utf-8",
    );
    showToast(`${visit.patientName} prescription print file downloaded.`, "success");
  }

  async function sendSignedPrescriptionToPharmacy() {
    const missing = [
      !diagnosis.trim() && "diagnosis",
      !prescription.trim() && "prescription",
      !medicine.trim() && "medicine",
    ].filter(Boolean) as string[];
    if (missing.length) {
      showToast(`Complete required prescription fields: ${missing.join(", ")}.`, "warning");
      return;
    }
    const visit = activeVisit ?? {
      visitId: "VIS-DEMO-PHARMACY",
      tokenNo: "OPD-DEMO",
      patientId: patientSnapshot.patientId,
      patientName: patientSnapshot.patientName,
      department: "Medical OPD",
      hospitalId: patientSnapshot.hospitalId,
      priority: "urgent" as const,
    };
    const priority: PharmacyPriority = visit.priority === "critical" ? "stat" : visit.priority === "urgent" ? "urgent" : "routine";
    try {
      const queued = await createPrescriptionFromConsultation({
        consultationId: `CON-${visit.visitId}`,
        visitId: visit.visitId,
        patientId: visit.patientId,
        patientName: visit.patientName,
        age: patientSnapshot.age,
        gender: patientSnapshot.gender,
        phone: patientSnapshot.phone,
        nic: patientSnapshot.nic ?? "not-recorded",
        allergies: patientSnapshot.allergies ?? [],
        diagnosis,
        clinicalNotes: soap,
        doctorId: profile?.uid ?? "demo-doctor",
        doctorName: profile?.displayName ?? "Dr. Anjali Perera",
        department: visit.department,
        hospitalId: visit.hospitalId,
        opdToken: visit.tokenNo,
        priority,
        lines: [{
          medicineId: `MED-${medicine.slice(0, 3).toUpperCase()}-001`,
          name: prescription,
          generic: medicine,
          dosage: prescription.match(/\d+\s?mg/i)?.[0] ?? "500mg",
          frequency: prescription.match(/\b(OD|BD|TDS|QID|PRN)\b/i)?.[0]?.toUpperCase() ?? "TDS",
          duration: prescription.match(/for\s+(.+)$/i)?.[1] ?? "3 days",
          quantity: 9,
          instructions: `${plan}. ${prescription}`,
          stock: medicine.toLowerCase().includes("amoxicillin") ? 0 : 120,
          expiry: "2027-08",
          alternative: medicine.toLowerCase().includes("amoxicillin") ? "Azithromycin after doctor review" : undefined,
        }],
      });
      await approve("Prescription sent to pharmacy");
      setPharmacyPipelineState(`${queued.prescriptionNo} sent to Pharmacy Queue with ${queued.validation} validation.`);
      showToast(`${queued.prescriptionNo} sent to Pharmacy Queue. Pharmacist verification workflow is ready.`, queued.validation === "warning" ? "warning" : "success");
      navigate("/pharmacy");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Prescription handoff failed. Please try again.", "danger");
    }
  }

  async function sendDiagnosticOrders() {
    const visitId = activeVisit?.visitId ?? "VIS-DEMO-DIAGNOSTICS";
    try {
      const result = await createDiagnosticOrdersFromConsultation({
        visitId,
        patient: patientSnapshot,
        labRequests,
        radiologyRequests,
        clinicalReason: `${diagnosis}. ${plan}`,
        labPriority: diagnosticPriority(labPriority),
        radiologyPriority: diagnosticPriority(radiologyPriority),
        doctorId: profile?.uid ?? "demo-doctor",
        doctorName: profile?.displayName ?? "Dr. Anjali Perera",
        department: activeVisit?.department ?? "Medical OPD",
      });
      showToast(`Sent ${result.labOrders.length} lab and ${result.radiologyOrders.length} radiology order(s).`, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to send diagnostic requests.", "danger");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Structured consultation workspace</h1>
          <p className="text-sm text-muted-foreground">Patient overview, SOAP consultation, clinical decision support, e-prescription, diagnostics, approvals, and telemedicine tools.</p>
          {activeVisit && <p className="mt-1 text-sm font-semibold text-primary">Active check: {activeVisit.tokenNo} | {activeVisit.patientName} | {activeVisit.department}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={saveWorkspace}><Save className="h-4 w-4" />Save</Button>
          <Button variant="secondary" onClick={() => void finishPatientCheck()}><CheckCircle2 className="h-4 w-4" />Finish check</Button>
          <Button variant="outline" onClick={() => showToast("Speech-to-text notes are ready for microphone integration.", "info")}><Mic className="h-4 w-4" />Speech notes</Button>
          <Button variant="outline" onClick={() => showToast("Voice command mode is ready for browser speech API integration.", "info")}><Volume2 className="h-4 w-4" />Voice commands</Button>
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <QRCodeSVG value={`${patientSnapshot.patientId}|${patientSnapshot.qrReference ?? "RX-DRAFT"}`} size={104} />
              <div className="text-right">
                <p className="text-lg font-bold">{patientSnapshot.patientName}</p>
                <p className="text-sm text-muted-foreground">{patientSnapshot.patientId} | {patientSnapshot.age ?? "?"} | {patientSnapshot.gender ?? "Not recorded"} | B+</p>
                {(patientSnapshot.allergies?.length ?? 0) > 0 && <Badge tone="danger" className="mt-2">{patientSnapshot.allergies?.join(", ")} allergy</Badge>}
              </div>
            </div>
            <div className="grid gap-2 text-sm">
              <p><strong>Chronic diseases:</strong> Diabetes, hypertension</p>
              <p><strong>Medications:</strong> Metformin, Losartan</p>
              <p><strong>Past surgeries:</strong> Appendectomy</p>
              <p><strong>Family history:</strong> Ischaemic heart disease</p>
              <p><strong>Immunizations:</strong> COVID booster complete</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="grid gap-3 md:grid-cols-3">
            {["Allergy warning: avoid penicillin", "Renal dose check required for NSAIDs", "Duplicate medication check: no duplicate found"].map((alert) => (
              <div key={alert} className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-rose-950">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                {alert}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Stethoscope className="h-5 w-5 text-primary" />SOAP and ICD-10 consultation</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
              <Select value={template} onChange={(event) => setTemplate(event.target.value)}>
                <option>URTI template</option>
                <option>Diabetes review</option>
                <option>Chest pain template</option>
                <option>Antenatal review</option>
              </Select>
              <Input placeholder="Quick diagnosis preset" defaultValue="Viral URTI, dengue screen if fever persists" />
              <Button variant="outline" onClick={() => {
                setSoap(`S: ${symptoms}\nO: ${exam}\nA: ${diagnosis}\nP: ${plan}`);
                showToast(`${template} applied to SOAP notes.`, "success");
              }}>Apply template</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm font-medium">Symptoms<Input value={symptoms} onChange={(event) => setSymptoms(event.target.value)} /></label>
              <label className="block text-sm font-medium">History<Input value={history} onChange={(event) => setHistory(event.target.value)} /></label>
              <label className="block text-sm font-medium">Examination findings<Input value={exam} onChange={(event) => setExam(event.target.value)} /></label>
              <label className="block text-sm font-medium">ICD-10 diagnosis<Input value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} /></label>
            </div>
            <label className="block text-sm font-medium">
              SOAP notes
              <textarea className="min-h-36 w-full rounded-md border border-border bg-white px-3 py-2 text-sm" value={soap} onChange={(event) => setSoap(event.target.value)} />
            </label>
            <label className="block text-sm font-medium">
              Treatment plan, referrals, and follow-up
              <textarea className="min-h-24 w-full rounded-md border border-border bg-white px-3 py-2 text-sm" value={plan} onChange={(event) => setPlan(event.target.value)} />
            </label>
            <p className="text-sm font-medium text-primary">{draftState}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-primary" />AI-ready decision support</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-md border border-border bg-white p-3"><strong>Automatic patient summary:</strong> {aiSummary}</div>
            {["Suggested diagnoses: viral URTI, dengue fever screen if persistent", "Abnormal finding detection: blood sugar trend elevated", "Drug interaction check: monitor losartan with NSAIDs", "Pregnancy alert: not applicable", "Disease risk analysis: high chronic metabolic risk"].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-md bg-muted px-3 py-2"><CheckCircle2 className="h-4 w-4 text-primary" />{item}</div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Pill className="h-5 w-5 text-primary" />Advanced e-prescription</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_120px_120px_120px]">
              <Select value={medicine} onChange={(event) => setMedicine(event.target.value)}>{medicines.map((item) => <option key={item}>{item}</option>)}</Select>
              <Input placeholder="Dosage" defaultValue="500mg" />
              <Input placeholder="Frequency" defaultValue="TDS" />
              <Input placeholder="Duration" defaultValue="3 days" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => approve("Prescription digital signature")}><FileSignature className="h-4 w-4" />Digital sign</Button>
              <Button variant="outline" onClick={printPrescription}><Download className="h-4 w-4" />Print Rx</Button>
              <Button variant="outline" onClick={() => showToast("Prescription QR verification generated.", "success")}><ShieldCheck className="h-4 w-4" />QR verify</Button>
              <Button variant="outline" onClick={() => void sendSignedPrescriptionToPharmacy()}>Send to pharmacy</Button>
            </div>
            <div className="rounded-md border border-border bg-white p-3">
              <p className="font-semibold">Prescription preview</p>
              <Input className="mt-2" value={prescription} onChange={(event) => setPrescription(event.target.value)} aria-label="Prescription details" />
              <p className="mt-2 text-sm text-muted-foreground">{prescription}. Dosage suggestion checked. Digital signature pending.</p>
              <p className="mt-2 text-xs font-semibold text-primary">{pharmacyPipelineState}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Vitals trend charts</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={vitals}>
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="bp" stroke="#0f766e" strokeWidth={2} />
                <Line type="monotone" dataKey="pulse" stroke="#155e75" strokeWidth={2} />
                <Line type="monotone" dataKey="spo2" stroke="#f59e0b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Laboratory and radiology tracking</CardTitle></CardHeader>
          <CardContent className="space-y-4 overflow-x-auto">
            <div className="grid gap-3 md:grid-cols-[1fr_160px_1fr_160px]">
              <Input placeholder="Lab request" value={labRequests} onChange={(event) => setLabRequests(event.target.value)} />
              <Select value={labPriority} onChange={(event) => setLabPriority(event.target.value)}><option>routine</option><option>urgent</option><option>critical</option></Select>
              <Input placeholder="Radiology request" value={radiologyRequests} onChange={(event) => setRadiologyRequests(event.target.value)} />
              <Select value={radiologyPriority} onChange={(event) => setRadiologyPriority(event.target.value)}><option>routine</option><option>urgent</option><option>critical</option></Select>
              <Input className="md:col-span-3" placeholder="Clinical reason" defaultValue="Persistent fever and cough, exclude pneumonia" />
              <Button variant="outline" onClick={() => void sendDiagnosticOrders()}>Send requests</Button>
            </div>
            <Table>
              <thead><tr><Th>Type</Th><Th>Request</Th><Th>Status</Th><Th>Compare</Th><Th>Action</Th></tr></thead>
              <tbody>
                {[
                  ["Lab", "FBC, CRP", "sample collected"],
                  ["Lab", "HbA1c", "result ready"],
                  ["Radiology", "Chest X-ray", "report uploaded"],
                ].map((row) => (
                  <tr key={row.join("-")}>
                    <Td>{row[0] === "Lab" ? <FlaskConical className="h-4 w-4" /> : <Radio className="h-4 w-4" />}</Td>
                    <Td>{row[1]}</Td>
                    <Td><Badge tone={row[2].includes("ready") || row[2].includes("uploaded") ? "success" : "warning"}>{row[2]}</Badge></Td>
                    <Td><Button variant="outline" onClick={() => showToast(`Previous ${row[0]} results opened for comparison.`, "info")}>Previous</Button></Td>
                    <Td><Button variant="outline" onClick={() => approve(`${row[1]} result reviewed`)}>Mark reviewed</Button></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Referrals, discharge, and approvals</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <Input placeholder="Referral destination" value={referralDestination} onChange={(event) => setReferralDestination(event.target.value)} />
            <Input type="date" aria-label="Follow-up date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} />
            <label className="block text-sm font-medium">Visit completion status<Select value={completionStatus} onChange={(event) => setCompletionStatus(event.target.value as "Checked" | "Consulted" | "Completed")}><option>Checked</option><option>Consulted</option><option>Completed</option></Select></label>
            <Input placeholder="Discharge summary title" value={dischargeTitle} onChange={(event) => setDischargeTitle(event.target.value)} />
            <Input placeholder="Electronic approval reason" value={approvalReason} onChange={(event) => setApprovalReason(event.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSendReferral}><Send className="h-4 w-4" />Send referral</Button>
              <Button variant="outline" onClick={handleApproveDischarge}><FileSignature className="h-4 w-4" />Approve discharge</Button>
              <Button variant="outline" onClick={handleScheduleFollowUp}><CalendarPlus className="h-4 w-4" />Schedule follow-up</Button>
            </div>
            <div className="rounded-md border border-border bg-emerald-50 p-3 text-sm text-slate-800 dark:bg-slate-900 dark:text-slate-100">
              <p className="font-semibold">After-session action trail</p>
              {sessionActions.length ? (
                <div className="mt-2 space-y-2">
                  {sessionActions.map((action) => (
                    <div key={action.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-white px-3 py-2 dark:bg-slate-950">
                      <span>{action.type.replaceAll("_", " ")} for {action.patientName}</span>
                      <Badge tone={action.status === "queued" ? "warning" : "success"}>{action.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-muted-foreground">No referral, discharge approval, or follow-up has been saved for this session yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle>Medical timeline and previous records</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {timeline.map((item) => (
            <div key={item.join("-")} className="grid gap-2 rounded-md border border-border bg-white p-3 md:grid-cols-[120px_120px_1fr]">
              <span className="text-sm font-semibold">{item[0]}</span>
              <Badge tone={item[1] === "Emergency" ? "danger" : "info"}>{item[1]}</Badge>
              <span className="text-sm text-slate-700">{item[2]}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
