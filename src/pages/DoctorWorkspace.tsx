import { CheckCircle2, ClipboardCheck, FlaskConical, Plus, Save, Send, ShieldCheck, Stethoscope, Trash2, ScanLine } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PatientIdentityCard } from "../components/patient/PatientIdentityCard";
import { PdfActionButtons } from "../components/reports/PdfActionButtons";
import { Badge, StatusBadge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { NumericField, SearchableSelect } from "../components/forms";
import { LaboratoryTestSelector, RadiologyStudySelector } from "../components/selectors";
import { BODY_REGION_OPTIONS, MEDICINE_FREQUENCY_OPTIONS, MEDICINE_ROUTE_OPTIONS, SPECIMEN_TYPE_OPTIONS, type SelectOption } from "../data/referenceOptions";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import { getPatientRecord } from "../services/patientService";
import {
  completeConsultation,
  createLaboratoryOrders,
  createRadiologyOrders,
  createWorkflowPrescription,
  getConsultation,
  getConsultationByVisit,
  getWorkflowMedicines,
  saveConsultation,
  type ConsultationPayload,
  type ConsultationRecord,
  type MedicineOption,
  type PrescriptionLineInput,
  type PrescriptionRecord,
} from "../services/workflowService";
import { useAuthStore } from "../stores/authStore";
import { useSelectedPatientStore, type SelectedPatientContext } from "../stores/selectedPatientStore";

const fieldClass = "min-h-28 w-full rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-teal-600/20";

type ConsultationDraft = {
  chiefComplaint: string;
  symptoms: string;
  presentingHistory: string;
  pastMedicalHistory: string;
  surgicalHistory: string;
  familyHistory: string;
  socialHistory: string;
  allergyReview: string;
  currentMedications: string;
  examination: string;
  diagnosis: string;
  differentialDiagnosis: string;
  clinicalNotes: string;
  treatmentPlan: string;
  followUpInstructions: string;
  temperature: string;
  bloodPressure: string;
  pulse: string;
  oxygenSaturation: string;
};

const emptyDraft: ConsultationDraft = {
  chiefComplaint: "",
  symptoms: "",
  presentingHistory: "",
  pastMedicalHistory: "",
  surgicalHistory: "",
  familyHistory: "",
  socialHistory: "",
  allergyReview: "",
  currentMedications: "",
  examination: "",
  diagnosis: "",
  differentialDiagnosis: "",
  clinicalNotes: "",
  treatmentPlan: "",
  followUpInstructions: "",
  temperature: "",
  bloodPressure: "",
  pulse: "",
  oxygenSaturation: "",
};

const emptyMedicine: PrescriptionLineInput = {
  medicineName: "",
  strength: "",
  dosage: "",
  route: "Oral",
  frequency: "",
  duration: "",
  quantity: 1,
  instructions: "",
  substitutionAllowed: true,
};

function recordToDraft(record: ConsultationRecord): ConsultationDraft {
  const vitals = record.vital_signs ?? {};
  return {
    chiefComplaint: record.chief_complaint ?? "",
    symptoms: record.symptoms ?? "",
    presentingHistory: record.presenting_history ?? record.history ?? "",
    pastMedicalHistory: record.past_medical_history ?? "",
    surgicalHistory: record.surgical_history ?? "",
    familyHistory: record.family_history ?? "",
    socialHistory: record.social_history ?? "",
    allergyReview: record.allergy_review ?? "",
    currentMedications: record.current_medications ?? "",
    examination: record.examination ?? "",
    diagnosis: record.diagnosis ?? "",
    differentialDiagnosis: record.differential_diagnosis ?? "",
    clinicalNotes: record.clinical_notes ?? "",
    treatmentPlan: record.treatment_plan ?? "",
    followUpInstructions: record.follow_up_instructions ?? "",
    temperature: String(vitals.temperature ?? ""),
    bloodPressure: String(vitals.bloodPressure ?? ""),
    pulse: String(vitals.pulse ?? ""),
    oxygenSaturation: String(vitals.oxygenSaturation ?? ""),
  };
}

export function DoctorWorkspace() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const params = useParams<{ patientUuid: string }>();
  const [searchParams] = useSearchParams();
  const profile = useAuthStore((state) => state.profile);
  const selectedPatient = useSelectedPatientStore((state) => state.selectedPatient);
  const setSelectedPatient = useSelectedPatientStore((state) => state.setSelectedPatient);
  const [patient, setPatient] = useState<SelectedPatientContext | null>(selectedPatient);
  const [consultationUuid, setConsultationUuid] = useState(searchParams.get("consultationId") || selectedPatient?.consultationUuid || "");
  const [visitUuid, setVisitUuid] = useState(searchParams.get("visitId") || selectedPatient?.visitUuid || "");
  const [draft, setDraft] = useState<ConsultationDraft>(emptyDraft);
  const [workflowStatus, setWorkflowStatus] = useState("draft");
  const [completionOverrideReason, setCompletionOverrideReason] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [medicineOptions, setMedicineOptions] = useState<MedicineOption[]>([]);
  const [medicineDraft, setMedicineDraft] = useState<PrescriptionLineInput>(emptyMedicine);
  const [medicines, setMedicines] = useState<PrescriptionLineInput[]>([]);
  const [editingMedicine, setEditingMedicine] = useState<number | null>(null);
  const [digitalSignature, setDigitalSignature] = useState(profile?.displayName ? `Digitally signed by ${profile.displayName}` : "");
  const [prescription, setPrescription] = useState<PrescriptionRecord | null>(null);
  const [sendingPrescription, setSendingPrescription] = useState(false);
  const prescriptionDiagnosisRef = useRef<HTMLInputElement | null>(null);
  const digitalSignatureRef = useRef<HTMLInputElement | null>(null);
  const [labTest, setLabTest] = useState("Full Blood Count");
  const [selectedLabTest, setSelectedLabTest] = useState<SelectOption | null>(null);
  const [labSpecimen, setLabSpecimen] = useState("Blood");
  const [labItems, setLabItems] = useState<Array<{ testCatalogId?: string; testName: string; testCode?: string; specimen: string }>>([]);
  const [radiologyType, setRadiologyType] = useState("X-ray");
  const [selectedRadiologyStudy, setSelectedRadiologyStudy] = useState<SelectOption | null>(null);
  const [bodyArea, setBodyArea] = useState("Chest");
  const [radiologyItems, setRadiologyItems] = useState<Array<{ studyCatalogId?: string; imagingType: string; bodyArea: string }>>([]);

  useEffect(() => {
    const patientUuid = params.patientUuid || selectedPatient?.patientUuid;
    if (!patientUuid) return;

    const queueContext = selectedPatient?.patientUuid === patientUuid ? selectedPatient : null;
    if (queueContext) setPatient(queueContext);

    let cancelled = false;
    void getPatientRecord(patientUuid).then(({ patient: record }) => {
      if (cancelled) return;
      const context: SelectedPatientContext = {
        patientUuid: record.id,
        patientNo: record.patient_no,
        fullName: record.full_name,
        nic: record.nic,
        dateOfBirth: record.date_of_birth,
        age: record.age_years,
        gender: record.gender,
        bloodGroup: record.blood_group,
        phone: record.phone,
        photoUrl: record.profile_photo_url || queueContext?.photoUrl || null,
        allergies: record.allergies ?? [],
        chronicDiseases: record.chronic_diseases ?? [],
        riskFlags: record.risk_flags ?? [],
        queueUuid: searchParams.get("queueId") || queueContext?.queueUuid,
        tokenNo: queueContext?.tokenNo,
        visitUuid: searchParams.get("visitId") || queueContext?.visitUuid,
        consultationUuid: searchParams.get("consultationId") || queueContext?.consultationUuid,
        appointmentUuid: queueContext?.appointmentUuid,
        appointmentNo: queueContext?.appointmentNo,
        visitType: queueContext?.visitType,
        hospitalId: record.hospital_id,
        departmentId: queueContext?.departmentId,
        departmentName: queueContext?.departmentName,
        reason: queueContext?.reason,
        verified: true,
      };
      setPatient(context);
      setSelectedPatient(context);
      setVisitUuid(context.visitUuid ?? "");
      setConsultationUuid(context.consultationUuid ?? "");
    }).catch((error: unknown) => {
      if (!cancelled) showToast(error instanceof Error ? error.message : "Unable to load the selected patient.", "danger");
    });

    return () => {
      cancelled = true;
    };
  }, [params.patientUuid, searchParams, selectedPatient?.patientUuid, setSelectedPatient, showToast]);

  useEffect(() => {
    getWorkflowMedicines()
      .then((result) => setMedicineOptions(result.items))
      .catch((error: unknown) => showToast(error instanceof Error ? error.message : "Unable to load PostgreSQL medicines.", "danger"));
  }, [showToast]);

  useEffect(() => {
    async function loadConsultation() {
      if (!consultationUuid && !visitUuid) return;
      try {
        const result = consultationUuid ? await getConsultation(consultationUuid) : await getConsultationByVisit(visitUuid);
        setConsultationUuid(result.consultation.id);
        setDraft(recordToDraft(result.consultation));
        setWorkflowStatus(result.consultation.workflow_status);
        setDirty(false);
      } catch (error) {
        if (consultationUuid) showToast(error instanceof Error ? error.message : "Unable to load consultation.", "danger");
      }
    }
    void loadConsultation();
  }, [consultationUuid, showToast, visitUuid]);

  const consultationPayload = useCallback((): ConsultationPayload | null => {
    if (!patient?.verified || !patient.patientUuid || !visitUuid) return null;
    return {
      patientUuid: patient.patientUuid,
      visitUuid,
      queueUuid: patient.queueUuid,
      consultationUuid: consultationUuid || undefined,
      chiefComplaint: draft.chiefComplaint,
      symptoms: draft.symptoms,
      presentingHistory: draft.presentingHistory,
      pastMedicalHistory: draft.pastMedicalHistory,
      surgicalHistory: draft.surgicalHistory,
      familyHistory: draft.familyHistory,
      socialHistory: draft.socialHistory,
      allergyReview: draft.allergyReview,
      currentMedications: draft.currentMedications,
      vitalSigns: {
        temperature: draft.temperature,
        bloodPressure: draft.bloodPressure,
        pulse: draft.pulse,
        oxygenSaturation: draft.oxygenSaturation,
      },
      examination: draft.examination,
      diagnosis: draft.diagnosis,
      differentialDiagnosis: draft.differentialDiagnosis,
      clinicalNotes: draft.clinicalNotes,
      treatmentPlan: draft.treatmentPlan,
      followUpInstructions: draft.followUpInstructions,
      workflowStatus: "active",
    };
  }, [consultationUuid, draft, patient, visitUuid]);

  const saveDraft = useCallback(async (silent = false) => {
    const payload = consultationPayload();
    if (!payload) {
      if (!silent) showToast("A verified patient and visit are required before saving.", "danger");
      return null;
    }
    setSaving(true);
    try {
      const result = await saveConsultation(payload);
      setConsultationUuid(result.consultation.id);
      setWorkflowStatus(result.consultation.workflow_status);
      setDirty(false);
      if (patient) {
        const nextPatient = { ...patient, consultationUuid: result.consultation.id, visitUuid };
        setPatient(nextPatient);
        setSelectedPatient(nextPatient);
      }
      if (!silent) showToast("Consultation saved to PostgreSQL.", "success");
      return result.consultation;
    } catch (error) {
      if (!silent) showToast(error instanceof Error ? error.message : "Unable to save consultation.", "danger");
      return null;
    } finally {
      setSaving(false);
    }
  }, [consultationPayload, patient, setSelectedPatient, showToast, visitUuid]);

  useEffect(() => {
    if (!dirty) return undefined;
    const timer = window.setTimeout(() => void saveDraft(true), 15000);
    return () => window.clearTimeout(timer);
  }, [dirty, saveDraft]);

  function updateDraft(field: keyof ConsultationDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setDirty(true);
  }

  function addMedicine() {
    if (!medicineDraft.medicineName.trim() || !medicineDraft.dosage.trim() || !medicineDraft.frequency.trim() || !medicineDraft.duration.trim()) {
      showToast("Medicine name, dose, frequency, and duration are required.", "warning");
      return;
    }
    const duplicate = medicines.some((item, index) => index !== editingMedicine && item.medicineName.trim().toLowerCase() === medicineDraft.medicineName.trim().toLowerCase() && item.strength?.trim().toLowerCase() === medicineDraft.strength?.trim().toLowerCase());
    if (duplicate) {
      showToast("This medicine and strength are already in the prescription.", "warning");
      return;
    }
    const allergyTerms = patient?.allergies.map((item) => item.trim().toLowerCase()).filter(Boolean) ?? [];
    const medicineTerms = [medicineDraft.medicineName, medicineDraft.genericName ?? ""].map((item) => item.trim().toLowerCase()).filter(Boolean);
    const allergyMatch = allergyTerms.find((allergy) => medicineTerms.some((medicine) => medicine.includes(allergy) || allergy.includes(medicine)));
    if (allergyMatch) {
      showToast(`Allergy warning: ${patient?.fullName} has a recorded ${allergyMatch} allergy. Medicine was not added.`, "danger");
      return;
    }
    setMedicines((current) => editingMedicine === null ? [...current, { ...medicineDraft }] : current.map((item, index) => index === editingMedicine ? { ...medicineDraft } : item));
    setMedicineDraft(emptyMedicine);
    setEditingMedicine(null);
  }

  function editMedicine(index: number) {
    setMedicineDraft({ ...medicines[index] });
    setEditingMedicine(index);
  }

  async function sendPrescription() {
    if (!patient?.verified || !patient.patientUuid || !visitUuid) {
      showToast("A verified patient and active visit are required before prescribing.", "danger");
      return;
    }

    const diagnosis = draft.diagnosis.trim();
    if (!diagnosis) {
      showToast("Enter the prescription diagnosis or clinical indication.", "warning");
      prescriptionDiagnosisRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => prescriptionDiagnosisRef.current?.focus(), 250);
      return;
    }
    if (medicines.length === 0) {
      showToast("Add at least one medicine before sending the prescription.", "warning");
      return;
    }
    const signature = digitalSignature.trim();
    if (!signature) {
      showToast("Enter the digital signature before sending the prescription.", "warning");
      digitalSignatureRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => digitalSignatureRef.current?.focus(), 250);
      return;
    }
    if (sendingPrescription) return;

    setSendingPrescription(true);
    try {
      // Save the latest diagnosis and consultation fields first so the
      // prescription and consultation cannot become inconsistent.
      const savedConsultation = await saveDraft(true);
      if (!savedConsultation?.id) {
        showToast("The consultation could not be saved. Please try again before sending to Pharmacy.", "danger");
        return;
      }

      const result = await createWorkflowPrescription({
        patientUuid: patient.patientUuid,
        visitUuid,
        consultationUuid: savedConsultation.id,
        diagnosis,
        digitalSignature: signature,
        submitToPharmacy: true,
        lines: medicines,
      });
      setConsultationUuid(savedConsultation.id);
      setPrescription(result.prescription);
      showToast("Prescription digitally signed and sent to Pharmacy.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to send prescription.", "danger");
    } finally {
      setSendingPrescription(false);
    }
  }

  function addLaboratoryTest() {
    const testName = labTest.trim();
    const specimen = labSpecimen.trim();
    if (!testName || !specimen) return showToast("Laboratory test and specimen are required.", "warning");
    if (labItems.some((item) => item.testName.toLowerCase() === testName.toLowerCase())) return showToast("That laboratory test is already in the order.", "warning");
    setLabItems((current) => [...current, {
      testCatalogId: selectedLabTest?.value,
      testName,
      testCode: selectedLabTest?.meta?.code ? String(selectedLabTest.meta.code) : undefined,
      specimen,
    }]);
  }

  async function orderLab() {
    if (!patient?.verified || !visitUuid || !consultationUuid) return showToast("Save the consultation before ordering tests.", "danger");
    if (!labItems.length) return showToast("Add at least one laboratory test before sending.", "warning");
    try {
      await createLaboratoryOrders({ patientUuid: patient.patientUuid, visitUuid, consultationUuid, priority: "routine", clinicalIndication: draft.diagnosis || draft.chiefComplaint || "Clinical assessment", items: labItems });
      showToast(`${labItems.length} test${labItems.length === 1 ? "" : "s"} sent to Laboratory.`, "success");
      setLabItems([]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Laboratory order failed.", "danger");
    }
  }

  function addRadiologyStudy() {
    const imagingType = radiologyType.trim();
    const area = bodyArea.trim();
    if (!imagingType || !area) return showToast("Imaging type and body area are required.", "warning");
    if (radiologyItems.some((item) => item.imagingType === imagingType && item.bodyArea.toLowerCase() === area.toLowerCase())) return showToast("That imaging study is already in the order.", "warning");
    setRadiologyItems((current) => [...current, {
      studyCatalogId: selectedRadiologyStudy?.value,
      imagingType,
      bodyArea: area,
    }]);
  }

  async function orderRadiology() {
    if (!patient?.verified || !visitUuid || !consultationUuid) return showToast("Save the consultation before ordering imaging.", "danger");
    if (!radiologyItems.length) return showToast("Add at least one radiology study before sending.", "warning");
    try {
      await createRadiologyOrders({ patientUuid: patient.patientUuid, visitUuid, consultationUuid, priority: "routine", clinicalIndication: draft.diagnosis || draft.chiefComplaint || "Clinical assessment", items: radiologyItems });
      showToast(`${radiologyItems.length} imaging stud${radiologyItems.length === 1 ? "y" : "ies"} sent to Radiology.`, "success");
      setRadiologyItems([]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Radiology order failed.", "danger");
    }
  }

  async function finishConsultation() {
    if (!consultationUuid || !draft.diagnosis.trim()) {
      showToast("Save the consultation and record a diagnosis before completion.", "warning");
      return;
    }
    try {
      const input = consultationPayload();
      if (!input) throw new Error("Patient and visit context are missing.");
      const result = await completeConsultation(consultationUuid, { ...input, completionOverrideReason: completionOverrideReason.trim() || undefined });
      setWorkflowStatus(result.consultation.workflow_status);
      showToast("Consultation, visit, and queue completed.", "success");
      navigate("/doctor");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to complete consultation.", "danger");
    }
  }

  const patientWarnings = useMemo(() => [...(patient?.allergies ?? []), ...(patient?.chronicDiseases ?? [])], [patient]);

  if (!patient?.verified || !patient.patientUuid) {
    return <Card><CardHeader><CardTitle>No verified patient selected</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Return to the Doctor Command Center, call a verified PostgreSQL patient, and start the check.</p><Button onClick={() => navigate("/doctor")}>Back to doctor queue</Button></CardContent></Card>;
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="sticky top-16 z-30 space-y-3 bg-background/95 pb-2 backdrop-blur"><PatientIdentityCard patient={patient} compact /><div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3"><div className="flex flex-wrap items-center gap-2"><Badge tone="success"><ShieldCheck className="h-3.5 w-3.5" />This consultation belongs to {patient.fullName}</Badge><StatusBadge status={workflowStatus} />{dirty && <Badge tone="warning">Unsaved changes · auto-save pending</Badge>}</div><div className="flex flex-wrap items-center gap-2"><PdfActionButtons kind="consultations" recordId={consultationUuid} /><Button variant="outline" onClick={() => void saveDraft()} disabled={saving}><Save className="h-4 w-4" />{saving ? "Saving..." : "Save draft"}</Button><Button onClick={() => void finishConsultation()}><CheckCircle2 className="h-4 w-4" />Complete consultation</Button></div></div></div>

      {patientWarnings.length > 0 && <Card className="border-rose-300 bg-rose-50"><CardContent className="p-4"><strong className="text-rose-900">Clinical warnings:</strong> <span className="text-rose-800">{patientWarnings.join(", ")}</span></CardContent></Card>}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Stethoscope className="h-5 w-5 text-primary" />Structured consultation workspace</CardTitle></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          {([
            ["Chief complaint", "chiefComplaint"], ["Symptoms", "symptoms"], ["History of presenting illness", "presentingHistory"], ["Past medical history", "pastMedicalHistory"], ["Surgical history", "surgicalHistory"], ["Family history", "familyHistory"], ["Social history", "socialHistory"], ["Allergy review", "allergyReview"], ["Current medications", "currentMedications"], ["Clinical examination", "examination"], ["Diagnosis", "diagnosis"], ["Differential diagnosis", "differentialDiagnosis"], ["Clinical notes", "clinicalNotes"], ["Treatment plan", "treatmentPlan"], ["Follow-up instructions", "followUpInstructions"],
          ] as Array<[string, keyof ConsultationDraft]>).map(([label, field]) => <label key={field} className="space-y-1 text-sm font-semibold text-slate-700"><span>{label}</span><textarea className={fieldClass} value={draft[field]} onChange={(event) => updateDraft(field, event.target.value)} /></label>)}
          <div className="lg:col-span-2"><h3 className="mb-3 font-bold text-slate-900 dark:text-slate-100">Vital signs</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><label className="space-y-1 text-sm font-semibold">Temperature<NumericField min={25} max={45} step={0.1} unit="°C" value={draft.temperature} onChange={(event) => updateDraft("temperature", event.target.value)} /></label><label className="space-y-1 text-sm font-semibold">Systolic<NumericField min={40} max={300} step={1} unit="mmHg" value={draft.bloodPressure.split("/")[0] ?? ""} onChange={(event) => updateDraft("bloodPressure", `${event.target.value}/${draft.bloodPressure.split("/")[1] ?? ""}`)} /></label><label className="space-y-1 text-sm font-semibold">Diastolic<NumericField min={20} max={200} step={1} unit="mmHg" value={draft.bloodPressure.split("/")[1] ?? ""} onChange={(event) => updateDraft("bloodPressure", `${draft.bloodPressure.split("/")[0] ?? ""}/${event.target.value}`)} /></label><label className="space-y-1 text-sm font-semibold">Pulse<NumericField min={20} max={250} step={1} unit="bpm" value={draft.pulse} onChange={(event) => updateDraft("pulse", event.target.value)} /></label><label className="space-y-1 text-sm font-semibold">SpO₂<NumericField min={50} max={100} step={1} unit="%" value={draft.oxygenSaturation} onChange={(event) => updateDraft("oxygenSaturation", event.target.value)} /></label></div></div><label className="space-y-1 text-sm font-semibold text-slate-700 lg:col-span-2"><span>Completion override reason (required only when urgent laboratory or radiology orders remain unresolved)</span><Input value={completionOverrideReason} onChange={(event) => setCompletionOverrideReason(event.target.value)} placeholder="Clinical reason for completing before urgent results are resolved" /></label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Advanced e-Prescription</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <label className="block space-y-1 text-sm font-semibold text-slate-700">
            <span>Prescription diagnosis / clinical indication <span className="text-destructive">*</span></span>
            <Input
              ref={prescriptionDiagnosisRef}
              value={draft.diagnosis}
              onChange={(event) => updateDraft("diagnosis", event.target.value)}
              placeholder="Enter the confirmed or provisional diagnosis"
              aria-required="true"
            />
            <span className="block text-xs font-normal text-muted-foreground">This value is saved with both the consultation and the prescription.</span>
          </label>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><label className="space-y-1 text-sm font-semibold">Medicine<SearchableSelect value={medicineDraft.medicineId ?? ""} options={medicineOptions.map((option) => ({ value: option.id, label: option.name, description: [option.generic_name, option.strength, option.available_stock !== undefined ? `stock ${option.available_stock}` : ""].filter(Boolean).join(" · ") }))} onChange={(value) => { const option = medicineOptions.find((item) => item.id === value); setMedicineDraft((item) => ({ ...item, medicineId: option?.id ?? null, medicineName: option?.name ?? "", genericName: option?.generic_name ?? "", strength: option?.strength ?? "" })); }} placeholder="Search formulary medicine" /></label><label className="space-y-1 text-sm font-semibold text-slate-700">Strength<Input value={medicineDraft.strength ?? ""} onChange={(event) => setMedicineDraft((item) => ({ ...item, strength: event.target.value }))} placeholder="500 mg" /></label><label className="space-y-1 text-sm font-semibold text-slate-700">Dose<Input value={medicineDraft.dosage} onChange={(event) => setMedicineDraft((item) => ({ ...item, dosage: event.target.value }))} placeholder="1 tablet" /></label><label className="space-y-1 text-sm font-semibold">Route<SearchableSelect value={medicineDraft.route ?? "Oral"} options={MEDICINE_ROUTE_OPTIONS} clearable={false} onChange={(value) => setMedicineDraft((item) => ({ ...item, route: value }))} /></label><label className="space-y-1 text-sm font-semibold">Frequency<SearchableSelect value={medicineDraft.frequency} options={MEDICINE_FREQUENCY_OPTIONS} onChange={(value) => setMedicineDraft((item) => ({ ...item, frequency: value }))} placeholder="Select frequency" /></label><label className="space-y-1 text-sm font-semibold text-slate-700">Duration<Input value={medicineDraft.duration} onChange={(event) => setMedicineDraft((item) => ({ ...item, duration: event.target.value }))} placeholder="3 days" /></label><label className="space-y-1 text-sm font-semibold">Quantity<NumericField min={1} step={1} unit="units" value={medicineDraft.quantity ?? 1} onChange={(event) => setMedicineDraft((item) => ({ ...item, quantity: Number(event.target.value) || 1 }))} /></label><label className="space-y-1 text-sm font-semibold text-slate-700">Instructions<Input value={medicineDraft.instructions ?? ""} onChange={(event) => setMedicineDraft((item) => ({ ...item, instructions: event.target.value }))} placeholder="After meals" /></label></div>
          <div className="flex gap-2"><Button onClick={addMedicine}><Plus className="h-4 w-4" />{editingMedicine === null ? "Add medicine" : "Update medicine"}</Button>{editingMedicine !== null && <Button variant="outline" onClick={() => { setEditingMedicine(null); setMedicineDraft(emptyMedicine); }}>Cancel edit</Button>}</div>
          <div className="overflow-x-auto"><Table><thead><tr><Th>Medicine</Th><Th>Dose</Th><Th>Frequency</Th><Th>Duration</Th><Th>Quantity</Th><Th>Action</Th></tr></thead><tbody>{medicines.map((item, index) => <tr key={`${item.medicineName}-${index}`}><Td><strong>{item.medicineName}</strong><br /><span className="text-xs text-muted-foreground">{item.strength || "Strength not set"} · {item.route || "Route not set"}</span></Td><Td>{item.dosage}</Td><Td>{item.frequency}</Td><Td>{item.duration}</Td><Td>{item.quantity ?? 1}</Td><Td><div className="flex gap-2"><Button variant="outline" onClick={() => editMedicine(index)}>Edit</Button><Button variant="destructive" onClick={() => setMedicines((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" />Delete</Button></div></Td></tr>)}{medicines.length === 0 && <tr><Td colSpan={6} className="text-center">No medicines added.</Td></tr>}</tbody></Table></div>
          <label className="block space-y-1 text-sm font-semibold text-slate-700">Digital signature <span className="text-destructive">*</span><Input ref={digitalSignatureRef} value={digitalSignature} onChange={(event) => setDigitalSignature(event.target.value)} aria-required="true" /></label>
          <Button onClick={() => void sendPrescription()} disabled={sendingPrescription || Boolean(prescription)}><Send className="h-4 w-4" />{sendingPrescription ? "Sending to Pharmacy..." : prescription ? "Sent to Pharmacy" : "Sign and send to Pharmacy"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-primary" />Prescription Preview and Pharmacy Verification</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm"><div><strong>Patient</strong><br />{patient.fullName}</div><div><strong>Patient ID</strong><br />{patient.patientNo}</div><div><strong>Age / Gender</strong><br />{patient.age ?? "N/A"} / {patient.gender || "N/A"}</div><div><strong>Blood group</strong><br />{patient.bloodGroup || "N/A"}</div><div><strong>Doctor</strong><br />{profile?.displayName || "Current doctor"}</div><div><strong>Date</strong><br />{new Date().toLocaleString()}</div><div><strong>Consultation</strong><br />{prescription?.consultation_id || consultationUuid || "Save consultation first"}</div><div><strong>Allergies</strong><br />{patient.allergies.join(", ") || "None recorded"}</div><div className="sm:col-span-2"><strong>Diagnosis / indication</strong><br />{prescription?.diagnosis || draft.diagnosis || "Not recorded"}</div><div className="sm:col-span-2"><strong>Digital signature</strong><br />{prescription?.digital_signature || digitalSignature || "Not signed"}</div></div>
          <div className="overflow-x-auto"><Table><thead><tr><Th>Medicine</Th><Th>Dose</Th><Th>Frequency</Th><Th>Duration</Th><Th>Instructions</Th></tr></thead><tbody>{(prescription?.lines ?? medicines).map((item, index) => <tr key={`${item.medicineName}-${index}`}><Td>{item.medicineName} {item.strength}</Td><Td>{item.dosage}</Td><Td>{item.frequency}</Td><Td>{item.duration}</Td><Td>{item.instructions || "—"}</Td></tr>)}</tbody></Table></div>
          <div className="flex flex-wrap items-center gap-3"><Badge tone={prescription ? "success" : "warning"}>{prescription ? `Prescription ${prescription.prescription_no}` : "Draft preview"}</Badge><StatusBadge status={prescription?.pharmacy_status || "not sent"} /><span className="text-sm"><strong>Pharmacy verification:</strong> {prescription?.pharmacist_name || "Awaiting pharmacist"}</span><span className="text-sm"><strong>Verified:</strong> {prescription?.pharmacy_verified_at ? new Date(prescription.pharmacy_verified_at).toLocaleString() : "Pending"}</span></div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><FlaskConical className="h-5 w-5 text-primary" />Laboratory order</CardTitle></CardHeader><CardContent className="space-y-3"><label className="block space-y-1 text-sm font-semibold">Test<LaboratoryTestSelector value={selectedLabTest?.value ?? ""} selectedOption={selectedLabTest} onChange={(_, option) => { setSelectedLabTest(option ?? null); if (option) { setLabTest(option.label); const specimen = String(option.meta?.specimen_type ?? ""); if (specimen) setLabSpecimen(specimen); } }} /></label><label className="block space-y-1 text-sm font-semibold">Specimen<SearchableSelect value={labSpecimen} options={SPECIMEN_TYPE_OPTIONS} clearable={false} onChange={setLabSpecimen} /></label><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={addLaboratoryTest}><Plus className="h-4 w-4" />Add test</Button><Button onClick={() => void orderLab()} disabled={!labItems.length}><Send className="h-4 w-4" />Send {labItems.length || ""} to Laboratory</Button></div><div className="space-y-2">{labItems.map((item, index) => <div key={`${item.testName}-${index}`} className="flex items-center justify-between rounded-md border border-border p-2 text-sm"><span><strong>{item.testName}</strong> · {item.specimen}</span><Button variant="destructive" className="min-h-9 px-3 py-1" onClick={() => setLabItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button></div>)}{!labItems.length && <p className="text-sm text-muted-foreground">No tests added.</p>}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5 text-primary" />Radiology order</CardTitle></CardHeader><CardContent className="space-y-3"><label className="block space-y-1 text-sm font-semibold">Imaging study<RadiologyStudySelector value={selectedRadiologyStudy?.value ?? ""} selectedOption={selectedRadiologyStudy} onChange={(_, option) => { setSelectedRadiologyStudy(option ?? null); if (option) { setRadiologyType(option.label); const region = String(option.meta?.body_region ?? ""); if (region) setBodyArea(region); } }} /></label><label className="block space-y-1 text-sm font-semibold">Body area<SearchableSelect value={bodyArea} options={BODY_REGION_OPTIONS} onChange={setBodyArea} placeholder="Select body region" /></label><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={addRadiologyStudy}><Plus className="h-4 w-4" />Add study</Button><Button onClick={() => void orderRadiology()} disabled={!radiologyItems.length}><Send className="h-4 w-4" />Send {radiologyItems.length || ""} to Radiology</Button></div><div className="space-y-2">{radiologyItems.map((item, index) => <div key={`${item.imagingType}-${item.bodyArea}-${index}`} className="flex items-center justify-between rounded-md border border-border p-2 text-sm"><span><strong>{item.imagingType}</strong> · {item.bodyArea}</span><Button variant="destructive" className="min-h-9 px-3 py-1" onClick={() => setRadiologyItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button></div>)}{!radiologyItems.length && <p className="text-sm text-muted-foreground">No imaging studies added.</p>}</div></CardContent></Card>
      </div>
    </div>
  );
}
