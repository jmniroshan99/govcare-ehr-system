import {
  AlertTriangle,
  CalendarDays,
  Camera,
  CheckCircle2,
  Contrast,
  Download,
  Eye,
  FileSignature,
  FileText,
  Image,
  Maximize,
  MonitorDot,
  QrCode,
  Radio,
  RotateCw,
  ScanLine,
  Send,
  ShieldCheck,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageTransition, Reveal, SectionReveal, Stagger } from "../components/motion/PageTransition";
import { GenderBadge } from "../components/patient/GenderBadge";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { SmartSearch } from "../components/search/SmartSearch";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import { CLINICAL_INTEGRATION_UPDATED_EVENT, getClinicalIntegrationState, updateDiagnosticOrderStatus, type IntegratedDiagnosticOrder } from "../services/clinicalIntegrationService";
import { downloadTextFile, timestampedFilename, toCsv } from "../utils/download";

type ImagingType = "X-ray" | "CT" | "MRI" | "Ultrasound" | "ECG" | "Echo" | "Portable X-ray";
type ImagingPriority = "Routine" | "Urgent" | "STAT";
type ImagingStatus = "requested" | "scheduled" | "arrived" | "scanning" | "images uploaded" | "reported" | "approved" | "released";
type ResultFlag = "normal" | "abnormal" | "critical";

interface RadiologyRequest {
  id: string;
  patientId: string;
  patientName: string;
  source: "OPD" | "Inpatient" | "Emergency";
  doctor: string;
  type: ImagingType;
  priority: ImagingPriority;
  status: ImagingStatus;
  room: string;
  appointment: string;
  finding: string;
  flag: ResultFlag;
  exposure: string;
  technicianNote: string;
}

const initialRequests: RadiologyRequest[] = [
  { id: "RAD-2026-3001", patientId: "PAT-2026-000233", patientName: "R. Kumar", source: "Emergency", doctor: "Dr. Fernando", type: "CT", priority: "STAT", status: "reported", room: "CT Room 01", appointment: "Now", finding: "Acute intracranial bleed suspected. Urgent neurosurgical review advised.", flag: "critical", exposure: "CTDIvol 48 mGy", technicianNote: "Patient monitored with oxygen support." },
  { id: "RAD-2026-3002", patientId: "PAT-2026-000001", patientName: "Nimal Silva", source: "OPD", doctor: "Dr. Perera", type: "X-ray", priority: "Routine", status: "scheduled", room: "X-ray Room 02", appointment: "10:30", finding: "No focal lung lesion. Awaiting radiologist signature.", flag: "normal", exposure: "0.08 mSv", technicianNote: "PA chest planned." },
  { id: "RAD-2026-3003", patientId: "PAT-2026-000142", patientName: "Fathima Rizna", source: "Inpatient", doctor: "Dr. Jayasinghe", type: "Ultrasound", priority: "Urgent", status: "images uploaded", room: "US Room 01", appointment: "11:00", finding: "Single live intrauterine pregnancy. Placental review required.", flag: "abnormal", exposure: "No ionizing radiation", technicianNote: "Obstetric protocol used." },
  { id: "RAD-2026-3004", patientId: "PAT-2026-000525", patientName: "M. Ahamed", source: "Inpatient", doctor: "Dr. Nazeer", type: "Portable X-ray", priority: "Urgent", status: "scanning", room: "Ward portable", appointment: "11:20", finding: "Portable chest requested for fluid overload.", flag: "abnormal", exposure: "0.1 mSv planned", technicianNote: "Portable unit assigned to Ward 08." },
  { id: "RAD-2026-3005", patientId: "PAT-2026-000301", patientName: "K. Thevarajah", source: "OPD", doctor: "Dr. Silva", type: "MRI", priority: "Routine", status: "requested", room: "MRI Room 01", appointment: "14:00", finding: "Lumbar spine MRI requested for radiculopathy.", flag: "normal", exposure: "No ionizing radiation", technicianNote: "Safety checklist pending." },
];

function radiologyPriorityFromOrder(priority: IntegratedDiagnosticOrder["priority"]): ImagingPriority {
  if (priority === "critical" || priority === "stat") return "STAT";
  if (priority === "urgent") return "Urgent";
  return "Routine";
}

function radiologyStatusFromOrder(status: IntegratedDiagnosticOrder["status"]): ImagingStatus {
  if (status === "released") return "released";
  if (status === "approved") return "approved";
  if (status === "resulted") return "reported";
  if (status === "in-progress") return "scanning";
  return "requested";
}

function imagingTypeFromText(value: string): ImagingType {
  const text = value.toLowerCase();
  if (text.includes("ct")) return "CT";
  if (text.includes("mri")) return "MRI";
  if (text.includes("ultrasound") || text.includes("uss")) return "Ultrasound";
  if (text.includes("echo")) return "Echo";
  if (text.includes("ecg")) return "ECG";
  if (text.includes("portable")) return "Portable X-ray";
  return "X-ray";
}

function mapIntegratedRadiologyOrders() {
  return getClinicalIntegrationState().radiologyOrders.map((order): RadiologyRequest => ({
    id: order.orderId,
    patientId: order.patientId,
    patientName: order.patient.patientName,
    source: "OPD",
    doctor: order.requestedByName,
    type: imagingTypeFromText(order.testOrProcedure),
    priority: radiologyPriorityFromOrder(order.priority),
    status: radiologyStatusFromOrder(order.status),
    room: "Scheduling pending",
    appointment: "Pending",
    finding: order.resultSummary ?? order.clinicalReason,
    flag: order.priority === "critical" || order.priority === "stat" ? "critical" : "normal",
    exposure: "Pending protocol",
    technicianNote: "Doctor Center request received through integrated order workflow.",
  }));
}

const rooms = [
  ["X-ray Room 01", "available", "Digital radiography online"],
  ["X-ray Room 02", "busy", "Chest queue active"],
  ["CT Room 01", "emergency", "STAT case in progress"],
  ["MRI Room 01", "available", "Safety screening ready"],
  ["US Room 01", "busy", "Antenatal list"],
  ["Echo/ECG Bay", "available", "Cardiology slot open"],
  ["Portable Unit", "busy", "Ward 08 request"],
];

const timeline = [
  ["2026-06-10", "Chest X-ray", "Normal", "Released"],
  ["2026-05-22", "Ultrasound abdomen", "Fatty liver changes", "Released"],
  ["2026-04-03", "ECG", "Sinus rhythm", "Released"],
];

const workload = [
  { room: "X-ray", scans: 42 },
  { room: "CT", scans: 18 },
  { room: "MRI", scans: 9 },
  { room: "US", scans: 27 },
  { room: "ECG", scans: 34 },
  { room: "Echo", scans: 12 },
];

function priorityTone(priority: ImagingPriority) {
  if (priority === "STAT") return "danger";
  if (priority === "Urgent") return "warning";
  return "success";
}

function statusTone(status: ImagingStatus) {
  if (status === "approved" || status === "released") return "success";
  if (status === "reported" || status === "images uploaded") return "warning";
  return "info";
}

function flagTone(flag: ResultFlag) {
  if (flag === "critical") return "danger";
  if (flag === "abnormal") return "warning";
  return "success";
}

function genderForPatientName(name: string) {
  if (name.toLowerCase().includes("fathima")) return "Female";
  return "Male";
}

export function RadiologyManagement() {
  const { showToast } = useToast();
  const [requests, setRequests] = useState(() => [...mapIntegratedRadiologyOrders(), ...initialRequests]);
  const [selectedId, setSelectedId] = useState(initialRequests[0].id);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ImagingStatus>("all");
  const selected = requests.find((request) => request.id === selectedId) ?? requests[0];
  const [findings, setFindings] = useState(selected.finding);
  const [flag, setFlag] = useState<ResultFlag>(selected.flag);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);

  useEffect(() => {
    function refreshIntegratedOrders() {
      setRequests((current) => {
        const integrated = mapIntegratedRadiologyOrders();
        const localOnly = current.filter((request) => !integrated.some((order) => order.id === request.id) && !request.id.startsWith("RAD-"));
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
      const matchesSearch = [request.id, request.patientId, request.patientName, request.type, request.doctor].some((value) => value.toLowerCase().includes(query));
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [requests, search, statusFilter]);

  const summaryStats = [
    { label: "Open imaging requests", value: requests.filter((request) => !["approved", "released"].includes(request.status)).length, icon: Radio, tone: "info" as const },
    { label: "Urgent / STAT", value: requests.filter((request) => request.priority !== "Routine").length, icon: AlertTriangle, tone: "warning" as const },
    { label: "Critical reports", value: requests.filter((request) => request.flag === "critical").length, icon: MonitorDot, tone: "danger" as const },
    { label: "Released reports", value: requests.filter((request) => request.status === "released" || request.status === "approved").length, icon: FileSignature, tone: "success" as const },
  ];

  function chooseRequest(request: RadiologyRequest) {
    setSelectedId(request.id);
    setFindings(request.finding);
    setFlag(request.flag);
  }

  function updateSelected(update: Partial<RadiologyRequest>) {
    setRequests((current) => current.map((request) => request.id === selectedId ? { ...request, ...update } : request));
  }

  function scheduleScan() {
    updateSelected({ status: "scheduled" });
    showToast(`${selected.id} scheduled in ${selected.room}.`, "success");
  }

  function uploadImages() {
    updateSelected({ status: "images uploaded" });
    void updateDiagnosticOrderStatus(selected.id, "radiology", { status: "in-progress" }, "radiology-workstation", "radiology_technician");
    showToast("DICOM images and PDF report uploaded to secure Spring Boot file storage.", "success");
  }

  function approveReport() {
    updateSelected({ status: "released", finding: findings, flag });
    void updateDiagnosticOrderStatus(selected.id, "radiology", {
      status: "released",
      releaseStatus: "released",
      resultSummary: findings,
    }, "radiology-workstation", "radiologist");
    showToast(`${selected.id} signed, released, and shared with doctor/patient profile.`, flag === "critical" ? "warning" : "success");
  }

  function markScanning() {
    updateSelected({ status: "scanning" });
    void updateDiagnosticOrderStatus(selected.id, "radiology", { status: "in-progress" }, "radiology-workstation", "radiology_technician");
    showToast(`${selected.patientName} scan status updated to scanning.`, "info");
  }

  function downloadRadiologyCsv() {
    downloadTextFile(
      timestampedFilename("radiology-requests", "csv"),
      toCsv([
        ["Request", "Patient ID", "Patient", "Scan", "Priority", "Status", "Flag", "Room"],
        ...visibleRequests.map((request) => [request.id, request.patientId, request.patientName, request.type, request.priority, request.status, request.flag, request.room]),
      ]),
      "text/csv;charset=utf-8",
    );
    showToast("Radiology CSV downloaded.", "success");
  }

  function downloadSelectedRadiologyReport() {
    downloadTextFile(timestampedFilename(selected.id.toLowerCase(), "txt"), `GovCare EHR System\nRadiology report\n\nRequest: ${selected.id}\nPatient: ${selected.patientName} (${selected.patientId})\nScan: ${selected.type}\nRoom: ${selected.room}\nPriority: ${selected.priority}\nStatus: ${selected.status}\nFlag: ${flag}\nExposure: ${selected.exposure}\n\nFindings:\n${findings}\n\nTechnician note:\n${selected.technicianNote}`, "text/plain;charset=utf-8");
    showToast(`${selected.id} report downloaded.`, "success");
  }

  return (
    <PageTransition>
      <div className="space-y-5">
        <div className="page-hero flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">Radiology workspace</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Manage imaging requests, scan workflow, reports, and releases</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Doctors request imaging from consultation. Radiology teams schedule, scan, upload images, report findings, sign, and release approved results to the EHR.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => showToast(`${selected.id} QR verification opened.`, "success")}><QrCode className="h-4 w-4" />Verify QR</Button>
            <Button variant="outline" onClick={uploadImages}><Upload className="h-4 w-4" />Upload images</Button>
            <Button onClick={approveReport}><FileSignature className="h-4 w-4" />Approve report</Button>
          </div>
        </div>

        <div className="help-strip grid gap-3 p-4 text-sm md:grid-cols-4">
          {["1. Receive request", "2. Schedule scan", "3. Upload DICOM/report", "4. Sign and release"].map((step) => (
            <div key={step} className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" />{step}</div>
          ))}
        </div>

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

        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5 text-primary" />Radiology queue</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="selection-panel grid gap-2 p-3 text-sm md:grid-cols-[1fr_auto_auto]">
                <div>
                  <p className="font-bold text-slate-950">Selected: {selected.patientName} - {selected.type}</p>
                  <p className="text-muted-foreground">{selected.id} | {selected.source} | {selected.room} | {selected.appointment}</p>
                </div>
                <Badge tone={priorityTone(selected.priority)}>{selected.priority}</Badge>
                <Badge tone={flagTone(selected.flag)}>{selected.flag}</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_190px_auto]">
                <SmartSearch value={search} onChange={setSearch} placeholder="Search patient, request, scan, doctor" scope="radiology" />
                <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | ImagingStatus)}>
                  <option value="all">All statuses</option>
                  <option value="requested">Requested</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="arrived">Arrived</option>
                  <option value="scanning">Scanning</option>
                  <option value="images uploaded">Images uploaded</option>
                  <option value="reported">Reported</option>
                  <option value="approved">Approved</option>
                  <option value="released">Released</option>
                </Select>
                <Button variant="outline" onClick={downloadRadiologyCsv}><Download className="h-4 w-4" />CSV</Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <thead><tr><Th>Request</Th><Th>Patient</Th><Th>Gender</Th><Th>Scan</Th><Th>Priority</Th><Th>Status</Th><Th>Flag</Th></tr></thead>
                  <tbody>
                    {visibleRequests.map((request) => (
                      <tr key={request.id} onClick={() => chooseRequest(request)} className={request.id === selectedId ? "cursor-pointer bg-teal-50" : "cursor-pointer"}>
                        <Td className="font-semibold">{request.id}<br /><span className="text-xs text-muted-foreground">{request.doctor}</span></Td>
                        <Td>{request.patientName}<br /><span className="text-xs text-muted-foreground">{request.patientId} | {request.source}</span></Td>
                        <Td><GenderBadge value={genderForPatientName(request.patientName)} compact /></Td>
                        <Td>{request.type}<br /><span className="text-xs text-muted-foreground">{request.room} | {request.appointment}</span></Td>
                        <Td><Badge tone={priorityTone(request.priority)}>{request.priority}</Badge></Td>
                        <Td><Badge tone={statusTone(request.status)}>{request.status}</Badge></Td>
                        <Td><Badge tone={flagTone(request.flag)}>{request.flag}</Badge></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" />Scan calendar and rooms</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Button onClick={scheduleScan}><CalendarDays className="h-4 w-4" />Schedule selected</Button>
                <Button variant="outline" onClick={markScanning}><Camera className="h-4 w-4" />Start scan</Button>
              </div>
              {rooms.map(([room, status, note]) => (
                <div key={room} className="rounded-md border border-border bg-white px-3 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-slate-950">{room}</p>
                    <Badge tone={status === "emergency" ? "danger" : status === "busy" ? "warning" : "success"}>{status}</Badge>
                  </div>
                  <p className="text-muted-foreground">{note}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <SectionReveal>
          <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Image className="h-5 w-5 text-primary" />DICOM image viewer</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid min-h-80 place-items-center overflow-hidden rounded-md border border-border bg-slate-950 text-white">
                  <div
                    className="grid h-56 w-72 place-items-center rounded-full border border-cyan-300/70 bg-[radial-gradient(circle,rgba(125,211,252,0.35),rgba(15,23,42,0.18)_46%,rgba(15,23,42,0.85)_72%)] text-center text-sm shadow-2xl"
                    style={{ transform: `scale(${zoom / 100}) rotate(${rotation}deg)`, filter: `brightness(${brightness}%) contrast(${contrast}%)` }}
                  >
                    <div>
                      <Eye className="mx-auto mb-2 h-9 w-9 text-cyan-200" />
                      <p className="font-bold">{selected.type} Preview</p>
                      <p className="text-xs text-cyan-100">DICOM viewport mock</p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <Button variant="outline" onClick={() => setZoom((value) => Math.max(50, value - 10))}><ZoomOut className="h-4 w-4" />Zoom</Button>
                  <Button variant="outline" onClick={() => setZoom((value) => Math.min(180, value + 10))}><ZoomIn className="h-4 w-4" />Zoom</Button>
                  <Button variant="outline" onClick={() => setRotation((value) => value + 90)}><RotateCw className="h-4 w-4" />Rotate</Button>
                  <Button variant="outline" onClick={() => setBrightness((value) => value === 100 ? 125 : 100)}><Maximize className="h-4 w-4" />Brightness</Button>
                  <Button variant="outline" onClick={() => setContrast((value) => value === 100 ? 130 : 100)}><Contrast className="h-4 w-4" />Contrast</Button>
                  <Button variant="outline" onClick={() => showToast("Previous imaging timeline opened for comparison.", "info")}><FileText className="h-4 w-4" />Compare previous</Button>
                  <Button variant="outline" onClick={uploadImages}><Upload className="h-4 w-4" />Upload DICOM</Button>
                  <Button variant="outline" onClick={downloadSelectedRadiologyReport}><Download className="h-4 w-4" />Download</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><FileSignature className="h-5 w-5 text-primary" />Report editor and approval</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-sm font-medium">Result flag
                    <Select value={flag} onChange={(event) => setFlag(event.target.value as ResultFlag)}>
                      <option value="normal">Normal</option>
                      <option value="abnormal">Abnormal</option>
                      <option value="critical">Critical</option>
                    </Select>
                  </label>
                  <label className="text-sm font-medium">Radiation exposure<Input value={selected.exposure} readOnly /></label>
                </div>
                <textarea className="min-h-40 w-full rounded-md border border-border bg-white p-3 text-sm shadow-sm" value={findings} onChange={(event) => setFindings(event.target.value)} aria-label="Radiology findings" />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={uploadImages}><Upload className="h-4 w-4" />Attach PDF/images</Button>
                  <Button variant="outline" onClick={() => showToast("Radiology report QR verification generated.", "success")}><QrCode className="h-4 w-4" />QR verification</Button>
                  <Button onClick={approveReport}><Send className="h-4 w-4" />Sign and notify doctor</Button>
                </div>
                <p className="help-strip p-3 text-sm">Approval should run through a Spring Boot service that signs the report, writes audit logs, shares approved reports to patient profile, and sends FCM notifications.</p>
              </CardContent>
            </Card>
          </section>
        </SectionReveal>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Emergency alerts</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {requests.filter((request) => request.flag === "critical" || request.priority === "STAT").map((request) => (
                <div key={request.id} className="clinical-alert-pulse rounded-md border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-950">
                  <p className="font-bold">{request.type} - {request.patientName}</p>
                  <p>{request.finding}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Patient imaging timeline</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {timeline.map(([date, scan, result, status]) => (
                <div key={`${date}-${scan}`} className="rounded-md border border-border bg-white px-3 py-3 text-sm">
                  <p className="font-bold text-slate-950">{scan}</p>
                  <p className="text-muted-foreground">{date} | {result} | {status}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Security and audit</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>JWT role claims and PostgreSQL permissions restrict radiologist and technician workflows. Spring Boot API authorization enforce hospitalId isolation. Storage uploads should use encrypted paths, API request validation, signed report approval, and audit logs for every view, upload, edit, print, and download.</p>
              <div className="flex flex-wrap gap-2"><Badge tone="success">API request validation</Badge><Badge tone="info">DICOM ready</Badge><Badge tone="warning">Audit every access</Badge></div>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader><CardTitle>Imaging workload</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workload}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="room" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="scans" fill="#0f766e" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}

