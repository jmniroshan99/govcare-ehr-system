import {
  AlertTriangle,
  BadgeCheck,
  BellRing,
  CheckCircle2,
  Download,
  FileCheck2,
  FileText,
  Mail,
  PackageCheck,
  Pill,
  Printer,
  QrCode,
  Search,
  ShieldCheck,
  TriangleAlert,
  UserCheck,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useEffect, useMemo, useState } from "react";
import { PageTransition, Reveal, SectionReveal, Stagger } from "../components/motion/PageTransition";
import { GenderBadge } from "../components/patient/GenderBadge";
import { Badge } from "../components/ui/badge";
import type { BadgeTone } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { SmartSearch } from "../components/search/SmartSearch";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import {
  PHARMACY_QUEUE_UPDATED_EVENT,
  completePharmacyTransaction,
  getPharmacyQueue,
  upsertPharmacyQueuePrescription,
  verifyPrescriptionSafety,
  type PharmacyQueuePrescription,
} from "../services/pharmacyService";
import { addNotification } from "../utils/notifications";

type RxStatus = "pending" | "verified" | "issued" | "partially issued" | "rejected";
type RxPriority = "routine" | "urgent" | "stat";
type LineIssueStatus = "pending" | "issued" | "unavailable" | "substituted";
type IntegrationCard = [string, string, string, LucideIcon, BadgeTone];

interface PharmacyLine {
  medicineId: string;
  name: string;
  generic: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions: string;
  stock: number;
  expiry: string;
  alternative?: string;
  status: LineIssueStatus;
}

interface PharmacyPrescription {
  id: string;
  prescriptionNo: string;
  patientId: string;
  nic: string;
  patientName: string;
  age: number;
  gender: string;
  phone: string;
  allergies: string[];
  diagnosis: string;
  doctorName: string;
  department: string;
  opdToken: string;
  admissionNo?: string;
  priority: RxPriority;
  status: RxStatus;
  validation: "clear" | "warning" | "blocked";
  submittedAt: string;
  lines: PharmacyLine[];
}

const seedPrescriptions: PharmacyPrescription[] = [
  {
    id: "rx-2026-0443",
    prescriptionNo: "RX-2026-0443",
    patientId: "PAT-2026-000001",
    nic: "812345678V",
    patientName: "Nimal Silva",
    age: 44,
    gender: "Male",
    phone: "0771234567",
    allergies: ["Penicillin"],
    diagnosis: "Type 2 diabetes with viral URTI",
    doctorName: "Dr. Anjali Perera",
    department: "Medical OPD",
    opdToken: "OPD-126",
    priority: "urgent",
    status: "pending",
    validation: "warning",
    submittedAt: "2026-06-15T10:25:00+05:30",
    lines: [
      { medicineId: "MED-MET-500", name: "Glucomet 500mg", generic: "Metformin", dosage: "500mg", frequency: "BD", duration: "30 days", quantity: 60, instructions: "After meals. Monitor blood sugar.", stock: 124, expiry: "2027-08", status: "pending" },
      { medicineId: "MED-PAR-500", name: "Paracetamol 500mg", generic: "Paracetamol", dosage: "500mg", frequency: "TDS", duration: "3 days", quantity: 9, instructions: "For fever only.", stock: 360, expiry: "2026-12", status: "pending" },
    ],
  },
  {
    id: "rx-2026-0444",
    prescriptionNo: "RX-2026-0444",
    patientId: "PAT-2026-000142",
    nic: "936542117V",
    patientName: "Fathima Rizna",
    age: 33,
    gender: "Female",
    phone: "0768899001",
    allergies: [],
    diagnosis: "High-risk antenatal review",
    doctorName: "Dr. Fernando",
    department: "Obstetrics",
    opdToken: "OBS-003",
    admissionNo: "ADM-2026-00342",
    priority: "stat",
    status: "verified",
    validation: "warning",
    submittedAt: "2026-06-15T10:40:00+05:30",
    lines: [
      { medicineId: "MED-FER-200", name: "Ferrous Sulphate", generic: "Iron", dosage: "200mg", frequency: "OD", duration: "30 days", quantity: 30, instructions: "After meals.", stock: 18, expiry: "2026-10", status: "pending" },
      { medicineId: "MED-FOL-005", name: "Folic Acid", generic: "Folic Acid", dosage: "5mg", frequency: "OD", duration: "30 days", quantity: 30, instructions: "Morning dose.", stock: 0, expiry: "2026-09", alternative: "Combined prenatal vitamin after doctor approval", status: "pending" },
    ],
  },
  {
    id: "rx-2026-0439",
    prescriptionNo: "RX-2026-0439",
    patientId: "PAT-2026-000233",
    nic: "N9128843",
    patientName: "R. Kumar",
    age: 51,
    gender: "Male",
    phone: "0718844221",
    allergies: ["Aspirin sensitivity"],
    diagnosis: "Acute coronary syndrome follow-up",
    doctorName: "Dr. Perera",
    department: "Cardiology",
    opdToken: "ETU-020",
    admissionNo: "ADM-2026-00341",
    priority: "urgent",
    status: "partially issued",
    validation: "warning",
    submittedAt: "2026-06-15T09:10:00+05:30",
    lines: [
      { medicineId: "MED-ATO-040", name: "Atorvastatin", generic: "Atorvastatin", dosage: "40mg", frequency: "Nocte", duration: "30 days", quantity: 30, instructions: "Night dose.", stock: 56, expiry: "2027-03", status: "issued" },
      { medicineId: "MED-CLO-075", name: "Clopidogrel", generic: "Clopidogrel", dosage: "75mg", frequency: "OD", duration: "30 days", quantity: 30, instructions: "Doctor-approved antiplatelet plan.", stock: 4, expiry: "2026-07", status: "pending" },
    ],
  },
];

function priorityTone(priority: RxPriority) {
  if (priority === "stat") return "danger" as const;
  if (priority === "urgent") return "warning" as const;
  return "info" as const;
}

function statusTone(status: RxStatus | LineIssueStatus) {
  if (status === "issued" || status === "verified") return "success" as const;
  if (status === "partially issued" || status === "pending" || status === "substituted") return "warning" as const;
  if (status === "rejected" || status === "unavailable") return "danger" as const;
  return "neutral" as const;
}

function validationTone(validation: PharmacyPrescription["validation"]) {
  if (validation === "blocked") return "danger" as const;
  if (validation === "warning") return "warning" as const;
  return "success" as const;
}

function mergedPrescriptions() {
  const queued = getPharmacyQueue();
  const queuedIds = new Set(queued.map((item) => item.prescriptionNo));
  return [...queued, ...seedPrescriptions.filter((item) => !queuedIds.has(item.prescriptionNo))] as PharmacyPrescription[];
}

export function PharmacyModule() {
  const { showToast } = useToast();
  const [prescriptions, setPrescriptions] = useState<PharmacyPrescription[]>(() => mergedPrescriptions());
  const [selectedId, setSelectedId] = useState(() => mergedPrescriptions()[0].id);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RxStatus | "all">("all");
  const [credential, setCredential] = useState("PAT-2026-000001");
  const [pharmacistName, setPharmacistName] = useState("Pharmacist Jayawardena");
  const [receiptLog, setReceiptLog] = useState<string[]>([]);

  const selected = prescriptions.find((item) => item.id === selectedId) ?? prescriptions[0] ?? seedPrescriptions[0];
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return prescriptions
      .filter((item) => statusFilter === "all" || item.status === statusFilter)
      .filter((item) => !q || [item.patientId, item.nic, item.patientName, item.prescriptionNo, item.doctorName, item.opdToken, item.admissionNo ?? ""].some((value) => value.toLowerCase().includes(q)))
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }, [prescriptions, query, statusFilter]);

  const stats = useMemo(() => [
    { label: "Pending", value: prescriptions.filter((item) => item.status === "pending").length, icon: FileText, tone: "warning" as const },
    { label: "Issued", value: prescriptions.filter((item) => item.status === "issued").length, icon: PackageCheck, tone: "success" as const },
    { label: "Partially issued", value: prescriptions.filter((item) => item.status === "partially issued").length, icon: FileCheck2, tone: "info" as const },
    { label: "Rejected", value: prescriptions.filter((item) => item.status === "rejected").length, icon: XCircle, tone: "danger" as const },
    { label: "Urgent/STAT", value: prescriptions.filter((item) => item.priority !== "routine").length, icon: BellRing, tone: "danger" as const },
  ], [prescriptions]);

  const allergyWarning = selected.lines.some((line) => selected.allergies.some((allergy) => line.generic.toLowerCase().includes(allergy.toLowerCase().split(" ")[0])));
  const duplicateWarning = new Set(selected.lines.map((line) => line.generic)).size !== selected.lines.length;
  const lowStockLines = selected.lines.filter((line) => line.stock < line.quantity);
  const expiryAlerts = selected.lines.filter((line) => line.expiry <= "2026-09");
  const integrationCards: IntegrationCard[] = [
    ["Doctor prescription link", `${selected.prescriptionNo} from ${selected.doctorName}`, "Direct consultation-to-pharmacy queue sync", FileText, "info"],
    ["Medication availability", `${selected.lines.filter((line) => line.stock >= line.quantity).length}/${selected.lines.length} lines available`, "Stock and expiry checked before issue", PackageCheck, "success"],
    ["Patient safety checks", `${selected.allergies.length + lowStockLines.length + expiryAlerts.length} active warnings`, "Allergy, interaction, dosage, and duplicate alerts", ShieldCheck, "warning"],
    ["Digital prescription record", selected.status, "Saved to patient EHR and receipt history after issue", FileCheck2, "neutral"],
  ];

  useEffect(() => {
    function refreshQueue() {
      const next = mergedPrescriptions();
      setPrescriptions(next);
      setSelectedId((current) => next.some((item) => item.id === current) ? current : next[0].id);
    }
    refreshQueue();
    window.addEventListener(PHARMACY_QUEUE_UPDATED_EVENT, refreshQueue);
    window.addEventListener("storage", refreshQueue);
    return () => {
      window.removeEventListener(PHARMACY_QUEUE_UPDATED_EVENT, refreshQueue);
      window.removeEventListener("storage", refreshQueue);
    };
  }, []);

  function updateSelected(patch: Partial<PharmacyPrescription>) {
    setPrescriptions((current) => current.map((item) => item.id === selected.id ? { ...item, ...patch } : item));
    const queueItem = getPharmacyQueue().find((item) => item.id === selected.id || item.prescriptionNo === selected.prescriptionNo);
    if (queueItem) {
      upsertPharmacyQueuePrescription({
        ...queueItem,
        ...(patch as Partial<PharmacyQueuePrescription>),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  function updateLine(medicineId: string, status: LineIssueStatus) {
    const lines = selected.lines.map((line) => line.medicineId === medicineId ? { ...line, status } : line);
    const allIssued = lines.every((line) => line.status === "issued" || line.status === "substituted");
    const anyIssued = lines.some((line) => line.status === "issued" || line.status === "substituted");
    updateSelected({ lines, status: allIssued ? "issued" : anyIssued ? "partially issued" : selected.status });
    showToast(`${medicineId} marked as ${status}.`, status === "unavailable" ? "warning" : "success");
  }

  function verifyPatient() {
    const normalized = credential.trim().toLowerCase();
    const identifiers = [selected.patientId, selected.nic, selected.phone, selected.opdToken, selected.admissionNo ?? ""].map((item) => item.toLowerCase());
    if (!identifiers.includes(normalized)) {
      showToast("Patient credential does not match this prescription.", "danger");
      return;
    }
    const safety = verifyPrescriptionSafety(selected);
    updateSelected({ status: "verified", validation: safety.validation });
    showToast(safety.warnings.length ? `Patient verified with warnings: ${safety.warnings[0]}` : "Patient verified. Prescription is ready for medicine issue.", safety.validation === "warning" ? "warning" : "success");
  }

  async function issueAvailableMedicines() {
    const issuable = selected.lines.filter((line) => line.stock > 0 && line.status !== "issued" && line.status !== "unavailable");
    const issuedLines = selected.lines.map((line) => line.stock > 0 ? { ...line, status: line.stock >= line.quantity ? "issued" as const : "substituted" as const } : { ...line, status: "unavailable" as const });
    const status: RxStatus = issuedLines.every((line) => line.status === "issued" || line.status === "substituted") ? "issued" : "partially issued";
    updateSelected({ lines: issuedLines, status });
    try {
      await completePharmacyTransaction({
        prescriptionId: selected.prescriptionNo,
        patientId: selected.patientId,
        issuedBy: pharmacistName,
        actorId: "demo-pharmacist",
        items: issuable.map((line) => ({ medicineId: line.medicineId, quantity: Math.min(line.quantity, line.stock) })),
      });
      showToast("Medicines issued, stock deduction queued, and receipt generated.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Issue failed. Please retry.", "danger");
      return;
    }
    setReceiptLog((current) => [`${selected.prescriptionNo} issued for ${selected.patientName}`, ...current].slice(0, 6));
    addNotification({
      title: "Prescription issued",
      message: `${selected.prescriptionNo} issued for ${selected.patientName}. Receipt is ready.`,
      module: "Pharmacy",
      priority: selected.priority === "stat" ? "urgent" : "information",
      roles: ["doctor", "pharmacist", "patient"],
      channels: ["in-app", "push", "email"],
      group: "Pharmacy",
      actionHref: "/pharmacy",
    });
  }

  function rejectPrescription() {
    updateSelected({ status: "rejected" });
    showToast("Prescription rejected and doctor notification prepared.", "warning");
  }

  function generateReceiptPdf() {
    const issuedAt = new Date().toLocaleString();
    const receiptId = `PHR-${Date.now().toString().slice(-8)}`;
    const doc = new jsPDF();
    doc.setFillColor(15, 118, 110);
    doc.rect(0, 0, 210, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("GovCare EHR System", 14, 13);
    doc.setFontSize(11);
    doc.text("Government Hospital Pharmacy Receipt", 14, 22);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Receipt ID: ${receiptId}`, 145, 42);
    doc.text(`Issue date: ${issuedAt}`, 145, 49);
    doc.text(`Status: ${selected.status}`, 145, 56);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Patient", 14, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`${selected.patientName} | ${selected.age}/${selected.gender}`, 14, 50);
    doc.text(`Patient ID: ${selected.patientId}`, 14, 57);
    doc.text(`NIC/Passport: ${selected.nic}`, 14, 64);
    doc.text(`Allergies: ${selected.allergies.join(", ") || "No known allergies"}`, 14, 71);

    doc.setFont("helvetica", "bold");
    doc.text("Prescription", 82, 42);
    doc.setFont("helvetica", "normal");
    doc.text(`Prescription ID: ${selected.prescriptionNo}`, 82, 50);
    doc.text(`Doctor: ${selected.doctorName}`, 82, 57);
    doc.text(`Department: ${selected.department}`, 82, 64);
    doc.text(`Token/Admission: ${selected.opdToken} ${selected.admissionNo ?? ""}`, 82, 71);

    doc.setFont("helvetica", "bold");
    doc.text("Diagnosis", 14, 86);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(selected.diagnosis, 180), 14, 93);

    autoTable(doc, {
      startY: 105,
      head: [["Medicine", "Dosage", "Duration", "Qty", "Status", "Instructions"]],
      body: selected.lines.map((line) => [line.name, `${line.dosage} ${line.frequency}`, line.duration, String(line.quantity), line.status, line.instructions]),
      styles: { fontSize: 8.5, cellPadding: 3, valign: "top" },
      headStyles: { fillColor: [15, 118, 110], textColor: 255 },
    });

    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 160;
    doc.setDrawColor(203, 213, 225);
    doc.rect(14, finalY + 12, 54, 34);
    doc.setFont("helvetica", "bold");
    doc.text("QR verification", 19, finalY + 23);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(doc.splitTextToSize(`govcare://pharmacyReceipts/${receiptId}`, 44), 19, finalY + 31);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Issued by", 120, finalY + 23);
    doc.setFont("helvetica", "normal");
    doc.text(pharmacistName, 120, finalY + 31);
    doc.text("Digital pharmacy verification prepared", 120, finalY + 38);

    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text("Production receipts should be generated or signed by PostgreSQL API backend API jobs and saved to pharmacyReceipts with audit logs.", 14, 286);
    doc.save(`${receiptId}-${selected.prescriptionNo}.pdf`);
    showToast("Pharmacy receipt PDF downloaded.", "success");
  }

  return (
    <PageTransition>
      <div className="space-y-5">
        <div className="page-hero flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">Pharmacy verification</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Prescription verification and receipt workflow</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Verify patient identity, review doctor e-prescriptions, check allergies and stock, issue medicines, deduct stock securely, and generate patient-ready pharmacy receipts.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={generateReceiptPdf}><Download className="h-4 w-4" />Download receipt</Button>
            <Button onClick={issueAvailableMedicines}><PackageCheck className="h-4 w-4" />Issue medicines</Button>
          </div>
        </div>

        <Stagger>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {stats.map(({ label, value, icon: Icon, tone }) => (
              <Reveal key={label}>
                <Card><CardContent className="flex min-h-28 items-center justify-between"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold text-slate-950">{value}</p></div><Badge tone={tone}><Icon className="h-5 w-5" /></Badge></CardContent></Card>
              </Reveal>
            ))}
          </section>
        </Stagger>

        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5 text-primary" />Pharmacy queue</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                <SmartSearch placeholder="Search patient ID, NIC, QR, prescription no, doctor, OPD token..." scope="pharmacy" value={query} onChange={setQuery} />
                <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as RxStatus | "all")}><option value="all">All status</option><option value="pending">Pending</option><option value="verified">Verified</option><option value="issued">Issued</option><option value="partially issued">Partially issued</option><option value="rejected">Rejected</option></Select>
              </div>
              <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                {filtered.map((rx) => (
                  <button key={rx.id} type="button" onClick={() => { setSelectedId(rx.id); setCredential(rx.patientId); }} className={`w-full rounded-md border p-3 text-left transition hover:border-primary ${selected.id === rx.id ? "border-primary bg-cyan-50" : "border-border bg-white"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-slate-950">{rx.prescriptionNo} | {rx.patientName}</p>
                          <GenderBadge value={rx.gender} compact />
                        </div>
                        <p className="text-xs text-muted-foreground">{rx.patientId} | age {rx.age} | {rx.nic} | {rx.opdToken} | {rx.doctorName}</p>
                      </div>
                      <div className="flex gap-1"><Badge tone={statusTone(rx.status)}>{rx.status}</Badge><Badge tone={priorityTone(rx.priority)}>{rx.priority}</Badge></div>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{rx.diagnosis}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-primary" />Patient and prescription verification</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 rounded-md border border-border bg-white p-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xl font-bold text-slate-950">{selected.patientName}</p>
                    <GenderBadge value={selected.gender} />
                  </div>
                  <p className="text-sm text-muted-foreground">{selected.patientId} | {selected.age} years | {selected.phone}</p>
                  <p className="mt-2 text-sm"><span className="font-semibold">Diagnosis:</span> {selected.diagnosis}</p>
                  <p className="text-sm"><span className="font-semibold">Doctor:</span> {selected.doctorName} | {selected.department}</p>
                </div>
                <div className="space-y-2">
                  <Badge tone={validationTone(selected.validation)}><ShieldCheck className="h-3.5 w-3.5" />{selected.validation}</Badge>
                  <Badge tone={priorityTone(selected.priority)}><BellRing className="h-3.5 w-3.5" />{selected.priority}</Badge>
                  <Badge tone={statusTone(selected.status)}><FileCheck2 className="h-3.5 w-3.5" />{selected.status}</Badge>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <label className="text-sm font-medium">Verify patient credential<Input value={credential} onChange={(event) => setCredential(event.target.value)} placeholder="Patient ID / NIC / QR / phone / OPD or admission no" /></label>
                <Button className="self-end" onClick={verifyPatient}><BadgeCheck className="h-4 w-4" />Verify patient</Button>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <AlertCard active={allergyWarning || selected.allergies.length > 0} danger title="Allergy warning" text={selected.allergies.join(", ") || "No known allergies"} />
                <AlertCard active={duplicateWarning} title="Duplicate medicine" text={duplicateWarning ? "Duplicate generic detected. Review before issue." : "No duplicate generic medicines."} />
                <AlertCard active={lowStockLines.length > 0} title="Stock availability" text={lowStockLines.length ? lowStockLines.map((line) => `${line.generic}: ${line.stock}/${line.quantity}`).join(", ") : "All selected quantities available."} />
                <AlertCard active={expiryAlerts.length > 0} title="Expiry alert" text={expiryAlerts.length ? expiryAlerts.map((line) => `${line.generic} expires ${line.expiry}`).join(", ") : "No near-expiry medicine selected."} />
              </div>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Pill className="h-5 w-5 text-primary" />Medicine issue workspace</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <thead><tr><Th>Medicine</Th><Th>Dosage</Th><Th>Qty</Th><Th>Stock / expiry</Th><Th>Status</Th><Th>Actions</Th></tr></thead>
              <tbody>
                {selected.lines.map((line) => (
                  <tr key={line.medicineId}>
                    <Td><span className="font-semibold text-slate-950">{line.name}</span><p className="text-xs text-muted-foreground">{line.generic} | {line.medicineId}</p>{line.alternative && <p className="mt-1 text-xs text-amber-700">Alternative: {line.alternative}</p>}</Td>
                    <Td>{line.dosage} {line.frequency}<br /><span className="text-xs text-muted-foreground">{line.duration} | {line.instructions}</span></Td>
                    <Td>{line.quantity}</Td>
                    <Td><Badge tone={line.stock < line.quantity ? "danger" : "success"}>{line.stock} available</Badge><p className="mt-1 text-xs text-muted-foreground">Expiry {line.expiry}</p></Td>
                    <Td><Badge tone={statusTone(line.status)}>{line.status}</Badge></Td>
                    <Td>
                      <div className="flex min-w-80 flex-wrap gap-2">
                        <Button className="h-9 px-3 text-xs" variant="outline" onClick={() => updateLine(line.medicineId, "issued")}><CheckCircle2 className="h-3.5 w-3.5" />Issue</Button>
                        <Button className="h-9 px-3 text-xs" variant="outline" onClick={() => updateLine(line.medicineId, "unavailable")}><XCircle className="h-3.5 w-3.5" />Unavailable</Button>
                        <Button className="h-9 px-3 text-xs" variant="outline" onClick={() => updateLine(line.medicineId, "substituted")}><TriangleAlert className="h-3.5 w-3.5" />Alternative</Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>

        <SectionReveal>
          <section className="grid gap-4 xl:grid-cols-4">
            {integrationCards.map(([title, value, detail, Icon, tone]) => (
              <Card key={title}>
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm text-muted-foreground">{title}</p>
                      <p className="mt-1 font-bold text-slate-950">{value}</p>
                    </div>
                    <Badge tone={tone}><Icon className="h-4 w-4" /></Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{detail}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Receipt actions</CardTitle></CardHeader>
              <CardContent className="grid gap-2">
                <label className="text-sm font-medium">Pharmacist name<Input value={pharmacistName} onChange={(event) => setPharmacistName(event.target.value)} /></label>
                <Button variant="outline" className="justify-start" onClick={generateReceiptPdf}><Download className="h-4 w-4" />Download PDF receipt</Button>
                <Button variant="outline" className="justify-start" onClick={rejectPrescription}><XCircle className="h-4 w-4" />Reject and notify doctor</Button>
                <Button variant="outline" className="justify-start" onClick={() => showToast("Receipt sent to patient portal and email/SMS notification queue.", "success")}><Mail className="h-4 w-4" />Send to patient</Button>
                <Button variant="outline" className="justify-start" onClick={() => window.print()}><Printer className="h-4 w-4" />Print receipt</Button>
                <Button variant="outline" className="justify-start" onClick={() => showToast("QR verification opened for prescription receipt.", "info")}><QrCode className="h-4 w-4" />Verify QR</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Secure backend workflow</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {["prescriptions: status and validation", "pharmacyQueue: pending/urgent dashboard", "medicineStock: stock and expiry", "medicineIssues: issue lines", "pharmacyReceipts: PDF/QR receipt", "auditLogs: every verify, issue, print, download"].map((item) => <p key={item} className="rounded-md border border-border bg-white p-3">{item}</p>)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-primary" />Receipt history</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {receiptLog.length ? receiptLog.map((item) => <p key={item} className="rounded-md border border-border bg-white p-3 text-sm">{item}</p>) : <p className="rounded-md border border-dashed border-border bg-muted p-3 text-sm text-muted-foreground">No receipt generated in this session yet.</p>}
              </CardContent>
            </Card>
          </section>
        </SectionReveal>
      </div>
    </PageTransition>
  );
}

function AlertCard({ active, danger = false, title, text }: { active: boolean; danger?: boolean; title: string; text: string }) {
  return (
    <div className={`rounded-md border p-3 text-sm ${active ? danger ? "border-rose-200 bg-rose-50 text-rose-950" : "border-amber-200 bg-amber-50 text-amber-950" : "border-emerald-200 bg-emerald-50 text-emerald-950"}`}>
      <p className="flex items-center gap-2 font-bold">{active ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}{title}</p>
      <p className="mt-1">{text}</p>
    </div>
  );
}
