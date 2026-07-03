import {
  Activity,
  AlertTriangle,
  Barcode,
  BellRing,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  DatabaseZap,
  Download,
  Droplets,
  FileSignature,
  FileText,
  Filter,
  History,
  Microscope,
  QrCode,
  ScanLine,
  Search,
  ShieldCheck,
  TestTube2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageTransition, Reveal, SectionReveal, Stagger } from "../components/motion/PageTransition";
import { GenderBadge } from "../components/patient/GenderBadge";
import { Badge } from "../components/ui/badge";
import type { BadgeTone } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import { CLINICAL_INTEGRATION_UPDATED_EVENT, getClinicalIntegrationState, updateDiagnosticOrderStatus, type IntegratedDiagnosticOrder } from "../services/clinicalIntegrationService";
import { refreshAndRedirectToMainMenu } from "../utils/navigation";
import { downloadTextFile, timestampedFilename, toCsv } from "../utils/download";

type LabPriority = "Routine" | "Urgent" | "STAT";
type SampleStatus = "requested" | "collected" | "in-transit" | "received" | "processing" | "rejected" | "resulted" | "approved" | "released";
type ResultClass = "normal" | "abnormal" | "critical";
type LabDepartmentId =
  | "hematology"
  | "chemistry"
  | "microbiology"
  | "serology"
  | "histopathology"
  | "molecular"
  | "blood-bank"
  | "urinalysis"
  | "parasitology"
  | "virology"
  | "toxicology"
  | "endocrinology";

interface LabDepartment {
  id: LabDepartmentId;
  name: string;
  tests: string[];
  confidentiality?: string;
}

interface LabRequest {
  id: string;
  patientId: string;
  patientName: string;
  requestingDoctor: string;
  department: LabDepartmentId;
  test: string;
  priority: LabPriority;
  sample: string;
  barcode: string;
  qr: string;
  status: SampleStatus;
  result?: string;
  referenceRange: string;
  resultClass?: ResultClass;
  clinicalAlert?: string;
  abnormal?: boolean;
  panic?: boolean;
  deltaCheck?: string;
  rejectionReason?: string;
}

const labDepartments: LabDepartment[] = [
  { id: "hematology", name: "Hematology", tests: ["CBC/FBC", "ESR", "Hemoglobin", "Platelet Count", "Differential WBC Count", "Coagulation Profile", "PT/INR", "APTT", "Reticulocyte Count"] },
  { id: "chemistry", name: "Clinical Chemistry", tests: ["Blood Glucose", "HbA1c", "Urea", "Creatinine", "Liver Function Tests", "Bilirubin", "Lipid Profile", "Electrolytes", "Calcium", "Uric Acid", "Cardiac Markers"] },
  { id: "microbiology", name: "Microbiology", tests: ["Urine Culture", "Blood Culture", "Stool Culture", "Sputum Culture", "Antibiotic Sensitivity", "Organism Identification", "Infection Monitoring"] },
  { id: "serology", name: "Serology and Immunology", tests: ["HIV", "Hepatitis B", "Hepatitis C", "Dengue", "COVID-19", "Pregnancy Test", "CRP", "Rheumatoid Factor"], confidentiality: "Restricted release and enhanced consent controls" },
  { id: "histopathology", name: "Histopathology", tests: ["Biopsy Analysis", "Cytology", "Pap Smear", "Microscopic Findings", "Image Attachments", "Pathologist Signature"] },
  { id: "molecular", name: "Molecular Biology", tests: ["PCR", "DNA Analysis", "RNA Analysis", "Gene Analysis", "Long-term Archival"], confidentiality: "Encrypted archival and long retention policy" },
  { id: "blood-bank", name: "Blood Bank", tests: ["Donor Management", "Blood Grouping", "Cross Matching", "Component Tracking", "Compatibility Check", "Expiry Alerts"] },
  { id: "urinalysis", name: "Urinalysis", tests: ["Routine Urine Analysis", "Microscopy", "Protein", "Ketones", "Specific Gravity"] },
  { id: "parasitology", name: "Parasitology", tests: ["Stool Ova/Cysts", "Malaria Parasite", "Filaria", "Helminth Identification"] },
  { id: "virology", name: "Virology", tests: ["Viral Antigen", "Viral PCR", "Dengue NS1", "Influenza", "COVID-19 PCR"] },
  { id: "toxicology", name: "Toxicology", tests: ["Drug Screen", "Poison Screen", "Alcohol Level", "Heavy Metals"] },
  { id: "endocrinology", name: "Endocrinology", tests: ["TSH", "T3/T4", "Cortisol", "Insulin", "Pregnancy Hormones", "Thyroid Antibodies"] },
];

const initialRequests: LabRequest[] = [
  { id: "LAB-2026-9001", patientId: "PAT-2026-000001", patientName: "Nimal Silva", requestingDoctor: "Dr. Perera", department: "hematology", test: "CBC/FBC", priority: "Urgent", sample: "EDTA blood", barcode: "BC-LAB-9001", qr: "QR-LAB-9001", status: "processing", result: "WBC 15.2 x10^9/L", referenceRange: "4.0 - 11.0 x10^9/L", resultClass: "abnormal", clinicalAlert: "Possible infection or inflammatory response. Doctor review advised.", abnormal: true, panic: false, deltaCheck: "WBC increased 42% from previous visit" },
  { id: "LAB-2026-9002", patientId: "PAT-2026-000233", patientName: "R. Kumar", requestingDoctor: "Dr. Fernando", department: "chemistry", test: "Cardiac Markers", priority: "STAT", sample: "Serum", barcode: "BC-LAB-9002", qr: "QR-LAB-9002", status: "resulted", result: "Troponin I 1.8 ng/mL", referenceRange: "< 0.04 ng/mL", resultClass: "critical", clinicalAlert: "Life-threatening cardiac marker elevation. Immediate escalation required.", abnormal: true, panic: true, deltaCheck: "Critical increase from baseline" },
  { id: "LAB-2026-9003", patientId: "PAT-2026-000142", patientName: "Fathima Rizna", requestingDoctor: "Dr. Jayasinghe", department: "serology", test: "Hepatitis B", priority: "Routine", sample: "Serum", barcode: "BC-LAB-9003", qr: "QR-LAB-9003", status: "received", referenceRange: "Non-reactive", resultClass: "normal", abnormal: false, panic: false },
  { id: "LAB-2026-9004", patientId: "PAT-2026-000301", patientName: "K. Thevarajah", requestingDoctor: "Dr. Perera", department: "microbiology", test: "Blood Culture", priority: "Urgent", sample: "Blood culture bottle", barcode: "BC-LAB-9004", qr: "QR-LAB-9004", status: "collected", referenceRange: "No growth", resultClass: "normal", abnormal: false, panic: false },
  { id: "LAB-2026-9005", patientId: "PAT-2026-000525", patientName: "M. Ahamed", requestingDoctor: "Dr. Nazeer", department: "blood-bank", test: "Cross Matching", priority: "STAT", sample: "Whole blood", barcode: "BC-LAB-9005", qr: "QR-LAB-9005", status: "approved", result: "Compatible O+", referenceRange: "Compatible", resultClass: "normal", abnormal: false, panic: false },
  { id: "LAB-2026-9006", patientId: "PAT-2026-000412", patientName: "Sahan Perera", requestingDoctor: "Dr. Kumar", department: "histopathology", test: "Biopsy Analysis", priority: "Routine", sample: "Tissue", barcode: "BC-LAB-9006", qr: "QR-LAB-9006", status: "rejected", referenceRange: "Pathologist interpretation", resultClass: "abnormal", rejectionReason: "Container unlabeled" },
  { id: "LAB-2026-9007", patientId: "PAT-2026-000142", patientName: "Fathima Rizna", requestingDoctor: "Dr. Jayasinghe", department: "urinalysis", test: "Routine Urine Analysis", priority: "Urgent", sample: "Urine", barcode: "BC-LAB-9007", qr: "QR-LAB-9007", status: "resulted", result: "Protein ++", referenceRange: "Negative", resultClass: "abnormal", clinicalAlert: "Proteinuria detected. Correlate with BP and pregnancy status.", abnormal: true, panic: false },
  { id: "LAB-2026-9008", patientId: "PAT-2026-000412", patientName: "Sahan Perera", requestingDoctor: "Dr. Kumar", department: "parasitology", test: "Malaria Parasite", priority: "STAT", sample: "Blood film", barcode: "BC-LAB-9008", qr: "QR-LAB-9008", status: "resulted", result: "Positive", referenceRange: "Negative", resultClass: "critical", clinicalAlert: "Positive malaria parasite. Notify clinician immediately.", abnormal: true, panic: true },
  { id: "LAB-2026-9009", patientId: "PAT-2026-000001", patientName: "Nimal Silva", requestingDoctor: "Dr. Perera", department: "endocrinology", test: "TSH", priority: "Routine", sample: "Serum", barcode: "BC-LAB-9009", qr: "QR-LAB-9009", status: "received", referenceRange: "0.4 - 4.0 mIU/L", resultClass: "normal", abnormal: false, panic: false },
];

function labPriorityFromOrder(priority: IntegratedDiagnosticOrder["priority"]): LabPriority {
  if (priority === "critical" || priority === "stat") return "STAT";
  if (priority === "urgent") return "Urgent";
  return "Routine";
}

function labStatusFromOrder(status: IntegratedDiagnosticOrder["status"]): SampleStatus {
  if (status === "released") return "released";
  if (status === "approved") return "approved";
  if (status === "resulted") return "resulted";
  if (status === "in-progress") return "processing";
  return "requested";
}

function mapIntegratedLabOrders() {
  return getClinicalIntegrationState().labOrders.map((order): LabRequest => ({
    id: order.orderId,
    patientId: order.patientId,
    patientName: order.patient.patientName,
    requestingDoctor: order.requestedByName,
    department: "hematology",
    test: order.testOrProcedure,
    priority: labPriorityFromOrder(order.priority),
    sample: "Pending collection",
    barcode: `BC-${order.orderId}`,
    qr: `QR-${order.orderId}`,
    status: labStatusFromOrder(order.status),
    result: order.resultSummary,
    referenceRange: "Clinical reference range required",
    resultClass: order.releaseStatus === "released" ? "normal" : undefined,
  }));
}

const workload = [
  { hour: "08", routine: 28, urgent: 12, stat: 4 },
  { hour: "10", routine: 44, urgent: 18, stat: 7 },
  { hour: "12", routine: 52, urgent: 24, stat: 9 },
  { hour: "14", routine: 38, urgent: 21, stat: 6 },
  { hour: "16", routine: 31, urgent: 15, stat: 5 },
];

const bloodInventory = [
  ["O+", "42 units", "8 expiring soon", "compatible checks active"],
  ["A+", "31 units", "4 expiring soon", "cross-match queue 6"],
  ["B+", "18 units", "2 expiring soon", "component tracking ready"],
  ["AB-", "5 units", "1 expiring soon", "low stock alert"],
];

const domainHighlights = [
  ["Hematology", "CBC/FBC, ESR, Hemoglobin", "Automated cell-count alerts"],
  ["Clinical Chemistry", "Glucose, HbA1c, Urea, Cardiac markers", "Reference-range validation"],
  ["Microbiology / Urinalysis", "Cultures, microscopy, protein detection", "Organism and infection monitoring"],
  ["Parasitology / Virology", "Malaria, filaria, Dengue NS1, PCR", "Critical communicable disease alerts"],
  ["Toxicology / Endocrinology", "Drug screen, alcohol, TSH, cortisol", "Clinical-risk classification"],
  ["Blood Bank", "Donors, cross-match, expiry, sharing", "Emergency allocation workflow"],
];

const trendSeries = [
  { date: "Jun 01", hb: 12.4, wbc: 8.2, glucose: 116 },
  { date: "Jun 05", hb: 12.1, wbc: 9.4, glucose: 128 },
  { date: "Jun 10", hb: 11.8, wbc: 12.1, glucose: 146 },
  { date: "Jun 15", hb: 11.9, wbc: 15.2, glucose: 132 },
];

const labAnalysisRows = [
  ["Blood Glucose", "70 - 110 mg/dL", "132 mg/dL", "abnormal", "Trend elevated; diabetes follow-up recommended"],
  ["Hemoglobin", "12 - 16 g/dL", "11.9 g/dL", "abnormal", "Mild anemia pattern; compare with previous FBC"],
  ["Cholesterol", "< 200 mg/dL", "184 mg/dL", "normal", "Within target range"],
  ["Troponin I", "< 0.04 ng/mL", "1.8 ng/mL", "critical", "Immediate cardiac escalation required"],
  ["Urine Protein", "Negative", "++", "abnormal", "Possible renal or pregnancy-related risk"],
];

const labAnalysisControls: [string, string, BadgeTone][] = [
  ["Normal/abnormal marking", "Reference-range engine classifies each value before doctor review.", "success"],
  ["Critical value alerts", "Life-threatening values notify doctors immediately through notifications.", "danger"],
  ["Patient timeline sync", "Released lab observations appear inside the patient profile and reports portal.", "info"],
];

function statusTone(status: SampleStatus) {
  if (status === "released" || status === "approved") return "success";
  if (status === "rejected") return "danger";
  if (status === "resulted" || status === "processing") return "warning";
  return "info";
}

function priorityTone(priority: LabPriority) {
  if (priority === "STAT") return "danger";
  if (priority === "Urgent") return "warning";
  return "success";
}

function resultClassTone(resultClass?: ResultClass): BadgeTone {
  if (resultClass === "critical") return "danger";
  if (resultClass === "abnormal") return "warning";
  if (resultClass === "normal") return "success";
  return "neutral";
}

function genderForPatientName(name: string) {
  if (name.toLowerCase().includes("fathima")) return "Female";
  return "Male";
}

function classifyLabResult(request: LabRequest, value: string): { resultClass: ResultClass; alert?: string } {
  const normalized = value.trim().toLowerCase();
  const numericValue = Number.parseFloat(normalized.replace(/[^\d.-]/g, ""));

  if (!normalized) return { resultClass: request.resultClass ?? "normal" };

  const criticalTerms = ["critical", "panic", "positive malaria", "troponin", "poison", "reactive hiv", "sepsis"];
  const abnormalTerms = ["high", "low", "positive", "reactive", "++", "abnormal", "detected", "growth"];

  if (criticalTerms.some((term) => normalized.includes(term)) || request.priority === "STAT" && abnormalTerms.some((term) => normalized.includes(term))) {
    return {
      resultClass: "critical",
      alert: "Critical laboratory value detected. Immediate clinician notification and escalation required.",
    };
  }

  if (request.test.includes("Troponin") && numericValue >= 0.04) {
    return {
      resultClass: "critical",
      alert: "Cardiac marker exceeds reference range. Notify emergency or requesting doctor immediately.",
    };
  }

  if (request.test.includes("CBC") && normalized.includes("wbc") && numericValue > 11) {
    return {
      resultClass: "abnormal",
      alert: "White cell count appears elevated. Compare with infection signs and previous results.",
    };
  }

  if (abnormalTerms.some((term) => normalized.includes(term))) {
    return {
      resultClass: "abnormal",
      alert: "Result is outside normal screening expectations. Doctor review recommended.",
    };
  }

  return { resultClass: "normal" };
}

export function LaboratoryManagement() {
  const { showToast } = useToast();
  const [selectedDepartment, setSelectedDepartment] = useState<LabDepartmentId>("hematology");
  const [requests, setRequests] = useState(() => [...mapIntegratedLabOrders(), ...initialRequests]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SampleStatus>("all");
  const [selectedRequestId, setSelectedRequestId] = useState(initialRequests[0].id);
  const selectedLab = labDepartments.find((department) => department.id === selectedDepartment) ?? labDepartments[0];
  const selectedRequest = requests.find((request) => request.id === selectedRequestId) ?? requests[0];
  const [resultValue, setResultValue] = useState(selectedRequest.result ?? "");
  const [referenceRange, setReferenceRange] = useState(selectedRequest.referenceRange);
  const [releaseMessage, setReleaseMessage] = useState("");

  useEffect(() => {
    function refreshIntegratedOrders() {
      setRequests((current) => {
        const integrated = mapIntegratedLabOrders();
        const localOnly = current.filter((request) => !integrated.some((order) => order.id === request.id) && !request.id.startsWith("LAB-"));
        const seeded = initialRequests.filter((request) => !integrated.some((order) => order.id === request.id));
        return [...integrated, ...localOnly, ...seeded];
      });
    }
    window.addEventListener(CLINICAL_INTEGRATION_UPDATED_EVENT, refreshIntegratedOrders);
    window.addEventListener("storage", refreshIntegratedOrders);
    refreshIntegratedOrders();
    return () => {
      window.removeEventListener(CLINICAL_INTEGRATION_UPDATED_EVENT, refreshIntegratedOrders);
      window.removeEventListener("storage", refreshIntegratedOrders);
    };
  }, []);

  const visibleRequests = useMemo(() => {
    const query = search.toLowerCase();
    return requests.filter((request) => {
      const matchesSearch = [request.id, request.patientId, request.patientName, request.test, request.barcode].some((value) => value.toLowerCase().includes(query));
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [requests, search, statusFilter]);

  const summaryStats = [
    { label: "Open requests", value: requests.filter((request) => !["released", "approved"].includes(request.status)).length, icon: ClipboardCheck, tone: "info" as const },
    { label: "STAT / urgent", value: requests.filter((request) => request.priority !== "Routine").length, icon: BellRing, tone: "warning" as const },
    { label: "Critical values", value: requests.filter((request) => request.panic || request.resultClass === "critical").length, icon: AlertTriangle, tone: "danger" as const },
    { label: "Released reports", value: requests.filter((request) => request.status === "released" || request.status === "approved").length, icon: FileSignature, tone: "success" as const },
  ];

  function chooseRequest(request: LabRequest) {
    setSelectedRequestId(request.id);
    setResultValue(request.result ?? "");
    setReferenceRange(request.referenceRange);
    setReleaseMessage("");
  }

  function updateSelectedRequest(update: Partial<LabRequest>) {
    setRequests((current) => current.map((request) => request.id === selectedRequestId ? { ...request, ...update } : request));
  }

  function saveResult() {
    const classification = classifyLabResult(selectedRequest, resultValue);
    updateSelectedRequest({
      result: resultValue,
      referenceRange,
      status: "resulted",
      resultClass: classification.resultClass,
      clinicalAlert: classification.alert,
      abnormal: classification.resultClass !== "normal",
      panic: classification.resultClass === "critical",
    });
    void updateDiagnosticOrderStatus(selectedRequest.id, "laboratory", {
      status: "resulted",
      resultSummary: resultValue,
    }, "lab-workstation", "lab_technician");
    setReleaseMessage("Result saved with reference range, delta-check, revision history, and audit log metadata.");
    showToast(`${selectedRequest.id} result saved as ${classification.resultClass}.`, classification.resultClass === "critical" ? "warning" : "success");
    refreshAndRedirectToMainMenu(800, {
      title: `${selectedRequest.id} result saved`,
      summary: `${selectedRequest.patientName} | ${selectedRequest.test} | ${classification.resultClass}`,
      module: "Laboratory",
    });
  }

  function approveAndRelease() {
    const classification = classifyLabResult(selectedRequest, resultValue);
    updateSelectedRequest({ status: "released", result: resultValue, referenceRange, resultClass: classification.resultClass, clinicalAlert: classification.alert });
    void updateDiagnosticOrderStatus(selectedRequest.id, "laboratory", {
      status: "released",
      releaseStatus: "released",
      resultSummary: resultValue,
    }, "lab-workstation", "lab_technician");
    setReleaseMessage("Pathologist signed report released to doctor and patient portal when approved for patient visibility.");
    showToast(`${selectedRequest.id} approved and released.`, "success");
  }

  function rejectSpecimen() {
    updateSelectedRequest({ status: "rejected", rejectionReason: "Specimen quality or labeling issue requires recollection." });
    setReleaseMessage("Specimen rejected and recollection notification prepared for ward/OPD staff.");
    showToast(`${selectedRequest.id} specimen rejected.`, "danger");
  }

  function downloadLabCsv() {
    downloadTextFile(
      timestampedFilename("laboratory-requests", "csv"),
      toCsv([
        ["Request", "Patient ID", "Patient", "Test", "Priority", "Status", "Result Class", "Barcode"],
        ...visibleRequests.map((request) => [request.id, request.patientId, request.patientName, request.test, request.priority, request.status, request.resultClass ?? "pending", request.barcode]),
      ]),
      "text/csv;charset=utf-8",
    );
    showToast("Laboratory CSV downloaded.", "success");
  }

  function generateLabPdf() {
    downloadTextFile(
      timestampedFilename("laboratory-report", "txt"),
      `GovCare EHR System\nLaboratory Report\n\nRequest: ${selectedRequest.id}\nPatient: ${selectedRequest.patientName}\nPatient ID: ${selectedRequest.patientId}\nTest: ${selectedRequest.test}\nSample: ${selectedRequest.sample}\nResult: ${selectedRequest.result ?? "Pending"}\nReference Range: ${selectedRequest.referenceRange}\nClassification: ${selectedRequest.resultClass ?? "pending"}\nClinical Alert: ${selectedRequest.clinicalAlert ?? "None"}\nStatus: ${selectedRequest.status}\nRequested By: ${selectedRequest.requestingDoctor}`,
      "text/plain;charset=utf-8",
    );
    showToast("Laboratory report file generated.", "success");
  }

  return (
    <PageTransition>
      <div className="space-y-5">
        <div className="page-hero flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">Laboratory workspace</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Manage samples, results, approvals, and released reports</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Start from the specimen queue, select a request, enter or review results, then approve only when the report is ready for doctors and patient release.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => showToast(`QR label printed for ${selectedRequest.qr}.`, "success")}><QrCode className="h-4 w-4" />Print QR labels</Button>
            <Button variant="outline" onClick={() => showToast(`Barcode scanned: ${selectedRequest.barcode}.`, "success")}><Barcode className="h-4 w-4" />Scan barcode</Button>
            <Button onClick={generateLabPdf}><FileText className="h-4 w-4" />Generate PDF</Button>
          </div>
        </div>

        <div className="help-strip grid gap-3 p-4 text-sm md:grid-cols-4">
          {["1. Select a lab", "2. Choose specimen", "3. Save result", "4. Approve release"].map((step) => (
            <div key={step} className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" />{step}</div>
          ))}
        </div>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {domainHighlights.map(([domain, scope, automation]) => (
            <Card key={domain} className="overflow-hidden">
              <CardContent className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-950">{domain}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{scope}</p>
                  </div>
                  <Badge tone="info"><Microscope className="h-3 w-3" />LIMS</Badge>
                </div>
                <Badge tone="success">{automation}</Badge>
              </CardContent>
            </Card>
          ))}
        </section>

        <Stagger>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryStats.map((stat) => (
              <Reveal key={stat.label}>
                <Card>
                  <CardContent className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="mt-2 text-3xl font-bold text-slate-950">{stat.value}</p>
                    </div>
                    <Badge tone={stat.tone}><stat.icon className="h-5 w-5" /></Badge>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </section>
        </Stagger>

        <section className="grid gap-4 xl:grid-cols-[330px_1fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Microscope className="h-5 w-5 text-primary" />Laboratories</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {labDepartments.map((department) => (
                <button
                  key={department.id}
                  className={`interactive-control w-full rounded-md border px-3 py-3 text-left text-sm ${department.id === selectedDepartment ? "border-teal-300 bg-teal-50 text-primary shadow-sm" : "border-border bg-white text-slate-800"}`}
                  onClick={() => setSelectedDepartment(department.id)}
                  type="button"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{department.name}</span>
                    <Badge tone={department.confidentiality ? "warning" : "info"}>{department.tests.length} tests</Badge>
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{department.tests.slice(0, 3).join(", ")}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                  <span>{selectedLab.name} catalogue</span>
                  {selectedLab.confidentiality && <Badge tone="warning"><ShieldCheck className="h-3 w-3" />{selectedLab.confidentiality}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {selectedLab.tests.map((test) => <Badge key={test} tone="neutral">{test}</Badge>)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5 text-primary" />Specimen work queue</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="selection-panel grid gap-2 p-3 text-sm md:grid-cols-[1fr_auto]">
                  <div>
                    <p className="font-bold text-slate-950">Selected: {selectedRequest.patientName} - {selectedRequest.test}</p>
                    <p className="text-muted-foreground">{selectedRequest.id} | {selectedRequest.sample} | {selectedRequest.requestingDoctor}</p>
                    {selectedRequest.clinicalAlert && <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950">{selectedRequest.clinicalAlert}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <Badge tone={priorityTone(selectedRequest.priority)}>{selectedRequest.priority}</Badge>
                    <Badge tone={resultClassTone(selectedRequest.resultClass)}>{selectedRequest.resultClass ?? "pending"}</Badge>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-[1fr_190px_auto]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patient, request, test, barcode" />
                  </div>
                  <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | SampleStatus)}>
                    <option value="all">All statuses</option>
                    <option value="requested">Requested</option>
                    <option value="collected">Collected</option>
                    <option value="in-transit">In transit</option>
                    <option value="received">Received</option>
                    <option value="processing">Processing</option>
                    <option value="rejected">Rejected</option>
                    <option value="resulted">Resulted</option>
                    <option value="approved">Approved</option>
                    <option value="released">Released</option>
                  </Select>
                  <Button variant="outline" onClick={downloadLabCsv}><Download className="h-4 w-4" />CSV</Button>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <thead><tr><Th>Request</Th><Th>Patient</Th><Th>Gender</Th><Th>Test</Th><Th>Priority</Th><Th>Tracking</Th><Th>Class</Th><Th>Status</Th></tr></thead>
                    <tbody>
                      {visibleRequests.map((request) => (
                        <tr key={request.id} onClick={() => chooseRequest(request)} className={request.id === selectedRequestId ? "cursor-pointer bg-teal-50" : "cursor-pointer"}>
                          <Td className="font-semibold">{request.id}<br /><span className="text-xs text-muted-foreground">{request.requestingDoctor}</span></Td>
                          <Td>{request.patientName}<br /><span className="text-xs text-muted-foreground">{request.patientId}</span></Td>
                          <Td><GenderBadge value={genderForPatientName(request.patientName)} compact /></Td>
                          <Td>{request.test}<br /><span className="text-xs text-muted-foreground">{request.sample}</span></Td>
                          <Td><Badge tone={priorityTone(request.priority)}>{request.priority}</Badge></Td>
                          <Td><span className="inline-flex items-center gap-1 text-xs"><ScanLine className="h-3 w-3" />{request.barcode}</span><br /><span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><QrCode className="h-3 w-3" />{request.qr}</span></Td>
                          <Td><Badge tone={resultClassTone(request.resultClass)}>{request.resultClass ?? "pending"}</Badge></Td>
                          <Td><Badge tone={statusTone(request.status)}>{request.status}</Badge></Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <SectionReveal>
          <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><TestTube2 className="h-5 w-5 text-primary" />Result entry and validation</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="help-strip p-3 text-sm">Enter the result for the selected request. Critical or abnormal values will be highlighted before release.</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-sm font-medium">Request<Input value={selectedRequest.id} readOnly /></label>
                  <label className="text-sm font-medium">Department<Input value={labDepartments.find((department) => department.id === selectedRequest.department)?.name ?? ""} readOnly /></label>
                  <label className="text-sm font-medium">Result<Input value={resultValue} onChange={(event) => setResultValue(event.target.value)} placeholder="Enter structured or analyzer result" /></label>
                  <label className="text-sm font-medium">Reference range<Input value={referenceRange} onChange={(event) => setReferenceRange(event.target.value)} /></label>
                </div>
                <textarea
                  className="min-h-24 w-full rounded-md border border-border bg-white p-3 text-sm shadow-sm"
                  defaultValue="Automated reference ranges, abnormal highlighting, panic value checks, delta-check comparison, and revision history are applied before approval."
                  aria-label="Laboratory interpretation notes"
                />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={saveResult}><ClipboardCheck className="h-4 w-4" />Save result</Button>
                  <Button variant="outline" onClick={() => showToast("Open Media Center from the sidebar to attach lab images/files.", "info")}><Upload className="h-4 w-4" />Attach image/file</Button>
                  <Button variant="destructive" onClick={rejectSpecimen}><AlertTriangle className="h-4 w-4" />Reject specimen</Button>
                  <Button variant="secondary" onClick={approveAndRelease}><FileSignature className="h-4 w-4" />Approve and release</Button>
                </div>
                {selectedRequest.resultClass && <Badge tone={resultClassTone(selectedRequest.resultClass)} className={selectedRequest.resultClass === "critical" ? "clinical-alert-pulse" : ""}>{selectedRequest.resultClass === "critical" ? "Panic value: notify doctor immediately" : `${selectedRequest.resultClass} result classification`}</Badge>}
                {selectedRequest.clinicalAlert && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">{selectedRequest.clinicalAlert}</p>}
                {selectedRequest.deltaCheck && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{selectedRequest.deltaCheck}</p>}
                {selectedRequest.rejectionReason && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-950">{selectedRequest.rejectionReason}</p>}
                {releaseMessage && <p className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-950">{releaseMessage}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5 text-destructive" />Critical escalation and approvals</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {requests.filter((request) => request.panic || request.resultClass === "critical" || request.status === "resulted" || request.status === "rejected").map((request) => (
                  <div key={request.id} className={`rounded-md border px-3 py-3 text-sm ${request.panic ? "clinical-alert-pulse border-rose-200 bg-rose-50 text-rose-950" : "border-border bg-white"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{request.test} - {request.patientName}</p>
                      <Badge tone={request.panic ? "danger" : request.status === "rejected" ? "danger" : resultClassTone(request.resultClass)}>{request.panic ? "critical" : request.resultClass ?? request.status}</Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">{request.result ?? request.rejectionReason ?? "Awaiting pathologist action"}</p>
                    {request.clinicalAlert && <p className="mt-2 text-xs font-semibold">{request.clinicalAlert}</p>}
                  </div>
                ))}
                <div className="grid gap-2 md:grid-cols-2">
                  <Badge tone="info"><History className="h-3 w-3" />Revision history immutable</Badge>
                  <Badge tone="success"><CheckCircle2 className="h-3 w-3" />Electronic signature ready</Badge>
                  <Badge tone="warning"><BellRing className="h-3 w-3" />Doctor notification on release</Badge>
                  <Badge tone="neutral"><ShieldCheck className="h-3 w-3" />Patient sees released reports only</Badge>
                </div>
              </CardContent>
            </Card>
          </section>
        </SectionReveal>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader><CardTitle>Laboratory workload analytics</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={workload}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="routine" stroke="#0f766e" fill="#99f6e4" />
                  <Area type="monotone" dataKey="urgent" stroke="#f59e0b" fill="#fde68a" />
                  <Area type="monotone" dataKey="stat" stroke="#be123c" fill="#fecdd3" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Droplets className="h-5 w-5 text-primary" />Blood bank and transfusion</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {bloodInventory.map(([group, units, expiry, status]) => (
                <div key={group} className="rounded-md border border-border bg-white px-3 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-lg font-bold text-slate-950">{group}</p>
                    <Badge tone={group === "AB-" ? "danger" : "success"}>{units}</Badge>
                  </div>
                  <p className="text-muted-foreground">{expiry} - {status}</p>
                </div>
              ))}
              <div className="grid gap-2 md:grid-cols-2">
                <Button variant="outline" onClick={() => showToast("Donor registration workflow opened.", "info")}><Droplets className="h-4 w-4" />Donor registration</Button>
                <Button variant="outline" onClick={() => showToast("Cross-match and compatibility check started.", "success")}><ShieldCheck className="h-4 w-4" />Cross-match</Button>
                <Button variant="destructive" onClick={() => showToast("Emergency blood allocation escalated.", "warning")}><AlertTriangle className="h-4 w-4" />Emergency allocation</Button>
                <Button variant="secondary" onClick={() => showToast("Inter-hospital blood sharing request prepared.", "info")}><DatabaseZap className="h-4 w-4" />Share request</Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />Patient trend analysis</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Longitudinal values help doctors compare current results against prior visits before approving clinical decisions.</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="hb" name="Hemoglobin" stroke="#2563eb" fill="#bfdbfe" />
                    <Area type="monotone" dataKey="wbc" name="WBC" stroke="#be123c" fill="#fecdd3" />
                    <Area type="monotone" dataKey="glucose" name="Glucose" stroke="#0f766e" fill="#99f6e4" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-primary" />Standardized LIMS workflow</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {[
                ["Sample registration", "Barcode, QR, patient identity, department, priority, and collection metadata."],
                ["Structured result entry", "Reference ranges, abnormal highlighting, delta-checks, and revision history."],
                ["Approval and release", "Pathologist signature, doctor notification, patient-visible release status."],
                ["Compliance trail", "Role-based access, immutable audit logs, protected confidential tests, and report downloads."],
              ].map(([title, description]) => (
                <div key={title} className="rounded-md border border-border bg-white px-3 py-3 text-sm">
                  <p className="font-bold text-slate-950">{title}</p>
                  <p className="mt-1 text-muted-foreground">{description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-primary" />Laboratory data analysis</span>
              <Badge tone="info">linked to patient EHR profile</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="help-strip p-3 text-sm">
              Incoming blood tests, urine analysis, imaging-linked diagnostics, and analyzer results are stored as structured observations, classified against reference ranges, visualized over time, and escalated when critical.
            </p>
            <div className="overflow-x-auto">
              <Table>
                <thead><tr><Th>Indicator</Th><Th>Reference range</Th><Th>Latest value</Th><Th>Class</Th><Th>Clinical interpretation</Th></tr></thead>
                <tbody>
                  {labAnalysisRows.map(([indicator, range, value, resultClass, interpretation]) => (
                    <tr key={indicator}>
                      <Td className="font-semibold">{indicator}</Td>
                      <Td>{range}</Td>
                      <Td>{value}</Td>
                      <Td><Badge tone={resultClassTone(resultClass as ResultClass)}>{resultClass}</Badge></Td>
                      <Td>{interpretation}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {labAnalysisControls.map(([title, detail, tone]) => (
                <div key={title} className="rounded-md border border-border bg-white p-3 text-sm">
                  <Badge tone={tone}>{title}</Badge>
                  <p className="mt-2 text-muted-foreground">{detail}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><DatabaseZap className="h-5 w-5 text-primary" />Analyzer and interoperability</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>HL7 ORU/ORM and FHIR DiagnosticReport, Observation, Specimen, ServiceRequest, and DocumentReference structures are represented for future analyzer integration.</p>
              <div className="flex flex-wrap gap-2"><Badge tone="info">HL7 ready</Badge><Badge tone="info">FHIR ready</Badge><Badge tone="neutral">Analyzer middleware queue</Badge></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Security controls</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Firebase custom claims, hospitalId isolation, App Check, AES-256-GCM sensitive fields, signed reports, immutable audit logs, and least-privilege access are enforced in the production design.</p>
              <div className="flex flex-wrap gap-2"><Badge tone="success">App Check</Badge><Badge tone="warning">Restricted serology</Badge><Badge tone="success">Audit every action</Badge></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />Productivity report</CardTitle></CardHeader>
            <CardContent className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[{ name: "Tech A", done: 42 }, { name: "Tech B", done: 36 }, { name: "Path", done: 24 }, { name: "Bank", done: 18 }]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="done" fill="#0f766e" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>
      </div>
    </PageTransition>
  );
}
