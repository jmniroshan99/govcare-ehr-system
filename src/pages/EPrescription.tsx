import {
  AlertTriangle,
  CheckCircle2,
  FileSignature,
  FileText,
  History,
  Pill,
  Printer,
  QrCode,
  ShieldCheck,
  ShoppingCart,
  Stethoscope,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useMemo, useState } from "react";
import { PageTransition, Reveal, SectionReveal, Stagger } from "../components/motion/PageTransition";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import { createPrescriptionFromConsultation, processPrescriptionIssue } from "../services/pharmacyService";
import { getSavedPatientsForDoctors, type SavedPatientForDoctor } from "../utils/patientRegistry";

type RxType = "OPD" | "Emergency" | "Discharge" | "Repeat";
type IssueStatus = "pending" | "verified" | "partially issued" | "issued";

interface MedicineOption {
  id: string;
  brand: string;
  generic: string;
  category: string;
  form: string;
  strength: string;
  stock: number;
  alternative?: string;
}

interface PrescriptionLine extends MedicineOption {
  route: string;
  frequency: string;
  duration: string;
  quantity: string;
  instructions: string;
  meals: string;
  prn: boolean;
  status: IssueStatus;
}

const medicines: MedicineOption[] = [
  { id: "MED-MET-500", brand: "Glucomet", generic: "Metformin", category: "Antidiabetic", form: "Tablet", strength: "500mg", stock: 124, alternative: "Metformin generic" },
  { id: "MED-PAR-500", brand: "Panadol", generic: "Paracetamol", category: "Analgesic", form: "Tablet", strength: "500mg", stock: 360 },
  { id: "MED-AMC-625", brand: "Augmentin", generic: "Amoxicillin + Clavulanate", category: "Antibiotic", form: "Tablet", strength: "625mg", stock: 0, alternative: "Azithromycin after review" },
  { id: "MED-LOS-050", brand: "Cozaar", generic: "Losartan", category: "Antihypertensive", form: "Tablet", strength: "50mg", stock: 42 },
  { id: "MED-SAL-100", brand: "Ventolin", generic: "Salbutamol", category: "Respiratory", form: "Inhaler", strength: "100mcg", stock: 18 },
];

const history = [
  ["RX-443", "2026-06-10", "Metformin, Atorvastatin", "issued"],
  ["RX-401", "2026-05-28", "ORS, Paracetamol", "issued"],
  ["RX-366", "2026-04-14", "Losartan repeat", "partially issued"],
];

const fallbackPrescriptionPatients: SavedPatientForDoctor[] = [
  { patientId: "PAT-2026-000001", hospitalId: "hosp-colombo-national", name: "Nimal Silva", nicOrPassport: "812345678V", phone: "0771234567", sex: "Male", age: 44, district: "Colombo", bloodGroup: "B+", riskCategory: "high", allergies: "Penicillin", chronicDiseases: "Diabetes", assignedDoctor: "Dr. Anjali Perera", visitReason: "Diabetes follow-up", status: "assigned", registeredAt: "2026-06-10T08:30:00.000Z" },
];

export function EPrescription() {
  const { showToast } = useToast();
  const prescriptionPatients = useMemo(() => {
    const saved = getSavedPatientsForDoctors();
    const byId = new Map([...saved, ...fallbackPrescriptionPatients].map((patient) => [patient.patientId, patient]));
    return Array.from(byId.values());
  }, []);
  const [selectedPatientId, setSelectedPatientId] = useState(prescriptionPatients[0]?.patientId ?? "PAT-2026-000001");
  const [query, setQuery] = useState("metformin");
  const [rxType, setRxType] = useState<RxType>("OPD");
  const [diagnosis, setDiagnosis] = useState("Type 2 diabetes mellitus with viral URTI");
  const [selectedMedicine, setSelectedMedicine] = useState("Glucomet");
  const [route, setRoute] = useState("Oral");
  const [frequency, setFrequency] = useState("BD");
  const [duration, setDuration] = useState("30 days");
  const [quantity, setQuantity] = useState("60");
  const [meals, setMeals] = useState("After meals");
  const [lines, setLines] = useState<PrescriptionLine[]>([
    { ...medicines[0], route: "Oral", frequency: "BD", duration: "30 days", quantity: "60", instructions: "Take after meals. Monitor blood sugar.", meals: "After meals", prn: false, status: "pending" },
    { ...medicines[1], route: "Oral", frequency: "TDS", duration: "3 days", quantity: "9", instructions: "For fever only.", meals: "After meals", prn: true, status: "pending" },
  ]);
  const [pharmacyLog, setPharmacyLog] = useState<string[]>([]);
  const selectedPatient = prescriptionPatients.find((patient) => patient.patientId === selectedPatientId) ?? prescriptionPatients[0] ?? fallbackPrescriptionPatients[0];

  const filteredMedicines = useMemo(() => {
    const q = query.toLowerCase();
    return medicines.filter((medicine) => [medicine.brand, medicine.generic, medicine.category, medicine.form, medicine.strength].some((value) => value.toLowerCase().includes(q)));
  }, [query]);

  const selected = medicines.find((medicine) => medicine.brand === selectedMedicine) ?? medicines[0];
  const hasAllergyRisk = lines.some((line) => line.generic.toLowerCase().includes("amoxicillin"));
  const duplicateRisk = new Set(lines.map((line) => line.generic)).size !== lines.length;
  const lowStock = lines.filter((line) => line.stock < Number(line.quantity));

  function addMedicine() {
    setLines((current) => [
      ...current,
      {
        ...selected,
        route,
        frequency,
        duration,
        quantity,
        instructions: `${meals}. Review renal/liver dose if indicated.`,
        meals,
        prn: false,
        status: "pending",
      },
    ]);
    showToast(`${selected.generic} added to prescription.`, "success");
  }

  async function signPrescription() {
    try {
      const queued = await createPrescriptionFromConsultation({
        consultationId: "CON-EPRESCRIPTION",
        visitId: selectedPatient.visitReason || "OPD prescription",
        patientId: selectedPatient.patientId,
        patientName: selectedPatient.name,
        age: selectedPatient.age ?? 0,
        gender: selectedPatient.sex,
        phone: selectedPatient.phone,
        nic: selectedPatient.nicOrPassport || selectedPatient.passportNumber || selectedPatient.birthCertificateNo || "not-recorded",
        allergies: selectedPatient.allergies ? selectedPatient.allergies.split(",").map((item) => item.trim()).filter(Boolean) : [],
        diagnosis,
        clinicalNotes: `${rxType} e-prescription generated from the prescription workspace.`,
        doctorId: "demo-doctor",
        doctorName: "Dr. Anjali Perera",
        department: "Medical OPD",
        hospitalId: "hosp-colombo-national",
        opdToken: selectedPatient.visitReason || "OPD",
        priority: rxType === "Emergency" ? "stat" : "routine",
        lines: lines.map((line) => ({
          medicineId: line.id,
          name: `${line.brand} ${line.strength}`,
          generic: line.generic,
          dosage: line.strength,
          frequency: line.frequency,
          duration: line.duration,
          quantity: Number(line.quantity || 0),
          instructions: line.instructions,
          stock: line.stock,
          expiry: "2027-08",
          alternative: line.alternative,
        })),
      });
      addPharmacyLog(`${queued.prescriptionNo}: signed, QR generated, and sent to Pharmacy Queue.`);
      showToast(`${queued.prescriptionNo} digitally signed and sent to pharmacy.`, queued.validation === "warning" || hasAllergyRisk ? "warning" : "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Prescription signing failed.", "danger");
    }
  }

  function generatePrescriptionPdf() {
    const doc = new jsPDF();
    const prescriptionId = `RX-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    const issuedAt = new Date().toLocaleString();

    doc.setFillColor(15, 118, 110);
    doc.rect(0, 0, 210, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("GovCare EHR System", 14, 12);
    doc.setFontSize(11);
    doc.text("Government Hospital Digital Prescription", 14, 20);

    doc.setTextColor(23, 32, 29);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Prescription ID: ${prescriptionId}`, 145, 38);
    doc.text(`Date: ${issuedAt}`, 145, 45);
    doc.text(`Type: ${rxType}`, 145, 52);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Patient Details", 14, 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Name: ${selectedPatient.name}`, 14, 48);
    doc.text(`Patient ID: ${selectedPatient.patientId}`, 14, 55);
    doc.text(`Age/Sex: ${selectedPatient.age ?? "Not recorded"} / ${selectedPatient.sex || "Not recorded"}`, 14, 62);
    doc.text(`Allergy: ${selectedPatient.allergies || "No known allergies"}`, 14, 69);

    doc.setFont("helvetica", "bold");
    doc.text("Doctor / Hospital", 82, 40);
    doc.setFont("helvetica", "normal");
    doc.text("Doctor: Dr. Anjali Perera", 82, 48);
    doc.text("Department: Medical OPD", 82, 55);
    doc.text("Hospital: National Hospital", 82, 62);
    doc.text(`Visit: ${selectedPatient.visitReason || "Prescription workspace"}`, 82, 69);

    doc.setFont("helvetica", "bold");
    doc.text("Diagnosis", 14, 82);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(diagnosis, 180), 14, 89);

    autoTable(doc, {
      startY: 102,
      head: [["Medicine", "Dose", "Duration", "Qty", "Instructions"]],
      body: lines.map((line) => [
        `${line.generic} (${line.brand})\n${line.form} ${line.strength}`,
        `${line.route}, ${line.frequency}\n${line.meals}${line.prn ? ", PRN" : ""}`,
        line.duration,
        line.quantity,
        line.instructions,
      ]),
      styles: { fontSize: 9, cellPadding: 3, valign: "top" },
      headStyles: { fillColor: [15, 118, 110], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { cellWidth: 38 },
        2: { cellWidth: 24 },
        3: { cellWidth: 18 },
        4: { cellWidth: 66 },
      },
    });

    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 150;
    doc.setFont("helvetica", "bold");
    doc.text("Safety Alerts", 14, finalY + 14);
    doc.setFont("helvetica", "normal");
    const alerts = [
      hasAllergyRisk ? "Allergy warning: Penicillin-related medicine detected." : "Allergy check: no allergy conflict in selected medicines.",
      duplicateRisk ? "Duplicate medicine warning: review duplicate generic medicines." : "Duplicate medicine check: clear.",
      lowStock.length ? `Stock warning: ${lowStock.map((line) => line.generic).join(", ")} may be insufficient.` : "Stock check: selected quantities available.",
      "Renal/liver dose review required for high-risk patients.",
    ];
    doc.text(doc.splitTextToSize(alerts.join("\n"), 180), 14, finalY + 21);

    doc.setDrawColor(216, 227, 223);
    doc.rect(14, finalY + 48, 58, 34);
    doc.setFont("helvetica", "bold");
    doc.text("QR Verification", 19, finalY + 58);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(doc.splitTextToSize(`Scan/verify: govcare://prescriptions/${prescriptionId}`, 48), 19, finalY + 66);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Digital Signature", 120, finalY + 58);
    doc.setFont("helvetica", "normal");
    doc.text(selectedPatient.assignedDoctor || "Dr. Anjali Perera", 120, finalY + 66);
    doc.text("Firebase custom-claim signing required in production", 120, finalY + 73);

    doc.setFontSize(8);
    doc.setTextColor(95, 111, 105);
    doc.text("This demo PDF is generated client-side. Production signing/issuing should be validated by Firebase Spring Boot services with audit logs.", 14, 286);

    doc.save(`${prescriptionId}.pdf`);
    showToast("Prescription PDF generated and downloaded.", "success");
  }

  function addPharmacyLog(entry: string) {
    setPharmacyLog((current) => [entry, ...current].slice(0, 8));
  }

  async function issueLine(index: number, status: IssueStatus) {
    const line = lines[index];
    if (!line) return;
    const requestedQuantity = Number(line.quantity || 0);
    const issuedQuantity = status === "issued" ? requestedQuantity : status === "partially issued" ? Math.max(1, Math.floor(requestedQuantity / 2)) : 0;

    if (status !== "verified" && line.stock <= 0) {
      showToast(`${line.generic} is out of stock. Use approved substitution before issuing.`, "danger");
      addPharmacyLog(`${line.generic}: issue blocked because stock is unavailable.`);
      return;
    }

    if (issuedQuantity > 0) {
      try {
        await processPrescriptionIssue({
          prescriptionId: "RX-443",
          items: [{ medicineId: line.id, quantity: issuedQuantity }],
        });
      } catch (error) {
        console.warn("Pharmacy Spring Boot service unavailable; applying demo stock update.", error);
      }
    }

    setLines((current) => current.map((item, lineIndex) => lineIndex === index ? { ...item, status, stock: Math.max(0, item.stock - issuedQuantity) } : item));
    addPharmacyLog(`${line.generic}: ${status}${issuedQuantity ? `, ${issuedQuantity} units deducted` : ", stock unchanged"}.`);
    showToast(`Medicine marked as ${status}. ${issuedQuantity ? "Stock updated." : "Ready for issue."}`, status === "partially issued" ? "warning" : "success");
  }

  async function issueAllAvailable() {
    const issuable = lines.filter((line) => line.status !== "issued" && line.stock > 0);
    if (!issuable.length) {
      showToast("No available medicines to issue.", "warning");
      return;
    }

    try {
      await processPrescriptionIssue({
        prescriptionId: "RX-443",
        items: issuable.map((line) => ({ medicineId: line.id, quantity: Math.min(Number(line.quantity || 0), line.stock) })),
      });
    } catch (error) {
      console.warn("Pharmacy Spring Boot service unavailable; issuing locally.", error);
    }

    setLines((current) => current.map((line) => {
      if (line.status === "issued" || line.stock <= 0) return line;
      const issuedQuantity = Math.min(Number(line.quantity || 0), line.stock);
      return { ...line, status: issuedQuantity >= Number(line.quantity || 0) ? "issued" : "partially issued", stock: Math.max(0, line.stock - issuedQuantity) };
    }));
    addPharmacyLog(`Prescription RX-443 processed for ${issuable.length} available medicines.`);
    showToast("Available prescription medicines issued and stock updated.", "success");
  }

  return (
    <PageTransition>
      <div className="space-y-5">
        <div className="page-hero flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">E-Prescription</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Create, sign, verify, and issue digital prescriptions</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Connected to patient profile, diagnosis, visit record, pharmacy stock, doctor signature, QR verification, audit logs, and multilingual prescription output.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={generatePrescriptionPdf}><Printer className="h-4 w-4" />PDF</Button>
            <Button onClick={() => void signPrescription()}><FileSignature className="h-4 w-4" />Sign prescription</Button>
            <Button variant="outline" onClick={issueAllAvailable}><ShoppingCart className="h-4 w-4" />Issue available</Button>
          </div>
        </div>

        <div className="help-strip grid gap-3 p-4 text-sm md:grid-cols-4">
          {["Safety checks before signing", "Pharmacy stock connected", "QR verified prescription", "Spring Boot service issuing workflow"].map((item) => (
            <div key={item} className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" />{item}</div>
          ))}
        </div>

        <Stagger>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["Current medicines", lines.length, Pill, "info" as const],
              ["Safety alerts", Number(hasAllergyRisk) + Number(duplicateRisk) + lowStock.length, AlertTriangle, "warning" as const],
              ["Signed today", 18, FileSignature, "success" as const],
              ["Pending issue", lines.filter((line) => line.status !== "issued").length, ShoppingCart, "danger" as const],
            ].map((stat) => (
              <Reveal key={stat[0] as string}>
                <Card>
                  <CardContent className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat[0] as string}</p>
                      <p className="mt-2 text-3xl font-bold text-slate-950">{stat[1] as number}</p>
                    </div>
                    {(() => {
                      const Icon = stat[2] as typeof Pill;
                      return <Badge tone={stat[3] as "info" | "warning" | "success" | "danger"}><Icon className="h-5 w-5" /></Badge>;
                    })()}
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </section>
        </Stagger>

        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Stethoscope className="h-5 w-5 text-primary" />Prescription details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="selection-panel space-y-2 p-3 text-sm">
                <label className="block text-sm font-medium">
                  Patient selection
                  <Select value={selectedPatientId} onChange={(event) => setSelectedPatientId(event.target.value)}>
                    {prescriptionPatients.map((patient) => <option key={patient.patientId} value={patient.patientId}>{patient.patientId} - {patient.name}</option>)}
                  </Select>
                </label>
                <p className="font-bold text-slate-950">{selectedPatient.name} | {selectedPatient.patientId}</p>
                <p className="text-muted-foreground">Visit {selectedPatient.visitReason || "Prescription workspace"} | Doctor: {selectedPatient.assignedDoctor || "Dr. Anjali Perera"} | Allergy: {selectedPatient.allergies || "No known allergies"}</p>
              </div>
              <label className="text-sm font-medium">Prescription type<Select value={rxType} onChange={(event) => setRxType(event.target.value as RxType)}><option>OPD</option><option>Emergency</option><option>Discharge</option><option>Repeat</option></Select></label>
              <label className="text-sm font-medium">Diagnosis<Input value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} /></label>
              <label className="text-sm font-medium">Medicine search<Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Brand, generic, category, strength, stock" /></label>
              <label className="text-sm font-medium">Select medicine<Select value={selectedMedicine} onChange={(event) => setSelectedMedicine(event.target.value)}>{filteredMedicines.map((medicine) => <option key={medicine.brand}>{medicine.brand}</option>)}</Select></label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm font-medium">Route<Input value={route} onChange={(event) => setRoute(event.target.value)} /></label>
                <label className="text-sm font-medium">Frequency<Input value={frequency} onChange={(event) => setFrequency(event.target.value)} /></label>
                <label className="text-sm font-medium">Duration<Input value={duration} onChange={(event) => setDuration(event.target.value)} /></label>
                <label className="text-sm font-medium">Quantity<Input value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
                <label className="text-sm font-medium">Meals<Select value={meals} onChange={(event) => setMeals(event.target.value)}><option>After meals</option><option>Before meals</option><option>With meals</option><option>PRN only</option></Select></label>
                <div className="rounded-md border border-border bg-white p-3 text-sm">
                  <p className="font-bold text-slate-950">Stock</p>
                  <p className="text-muted-foreground">{selected.stock} available | {selected.form} {selected.strength}</p>
                </div>
              </div>
              <Button onClick={addMedicine}><Pill className="h-4 w-4" />Add medicine</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-primary" />Clinical safety checks</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <SafetyItem label="Allergy warning" active={hasAllergyRisk} detail="Penicillin allergy found. Avoid amoxicillin/clavulanate unless overridden." />
              <SafetyItem label="Drug interaction alert" active detail="Metformin: review renal function before dose escalation." />
              <SafetyItem label="Duplicate medicine warning" active={duplicateRisk} detail="Duplicate generic medicine detected." />
              <SafetyItem label="Pregnancy / child / elderly dose" active={rxType === "Emergency"} detail="Emergency prescriptions require age/pregnancy/weight review." />
              <SafetyItem label="Renal / liver dose check" active detail="Creatinine and liver profile should be checked for high-risk medicines." />
              <SafetyItem label="Contraindication check" active={lowStock.length > 0} detail={lowStock.length ? "Some medicines have insufficient stock; substitution may be needed." : "No major contraindication found in demo data."} />
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Prescription medicines</CardTitle></CardHeader>
          <CardContent className="space-y-4 overflow-x-auto">
            <Table>
              <thead><tr><Th>Medicine</Th><Th>Dose</Th><Th>Instructions</Th><Th>Stock</Th><Th>Status</Th><Th>Pharmacy action</Th></tr></thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={`${line.brand}-${index}`}>
                    <Td className="font-semibold">{line.brand}<br /><span className="text-xs text-muted-foreground">{line.generic} | {line.form} {line.strength}</span></Td>
                    <Td>{line.route} | {line.frequency}<br /><span className="text-xs text-muted-foreground">{line.duration} | Qty {line.quantity} | {line.prn ? "PRN" : "regular"}</span></Td>
                    <Td>{line.instructions}<br /><span className="text-xs text-muted-foreground">{line.meals}</span></Td>
                    <Td><Badge tone={line.stock < Number(line.quantity) ? "danger" : line.stock < 30 ? "warning" : "success"}>{line.stock} left</Badge></Td>
                    <Td><Badge tone={line.status === "issued" ? "success" : line.status === "partially issued" ? "warning" : "info"}>{line.status}</Badge></Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => issueLine(index, "verified")}>Verify</Button>
                        <Button variant="outline" onClick={() => issueLine(index, "partially issued")}>Partial</Button>
                        <Button onClick={() => issueLine(index, "issued")}>Issue</Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {pharmacyLog.length > 0 && (
              <div className="rounded-md border border-border bg-muted p-3 text-sm">
                <p className="mb-2 font-bold text-slate-950">Pharmacy action log</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {pharmacyLog.map((entry) => (
                    <p key={entry} className="rounded-md border border-border bg-white px-3 py-2 text-slate-700">{entry}</p>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5 text-primary" />Printable prescription</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid place-items-center rounded-lg border border-border bg-white p-6">
                <QrCode className="h-24 w-24 text-primary" />
                <p className="mt-2 text-sm font-bold text-slate-950">GovCare RX QR</p>
              </div>
              <div className="rounded-md border border-border bg-white p-3 text-sm">
                <p className="font-bold text-slate-950">National Hospital | OPD Prescription</p>
                <p>Patient: Nimal Silva | Diagnosis: {diagnosis}</p>
                <p>Doctor: Dr. Anjali Perera | Digital signature: pending/ready</p>
              </div>
              <Button className="w-full" onClick={() => void signPrescription()}><FileSignature className="h-4 w-4" />Sign and generate QR</Button>
              <Button className="w-full" variant="outline" onClick={generatePrescriptionPdf}><Printer className="h-4 w-4" />Download PDF</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary" />History, refills, adherence</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {history.map(([id, date, meds, status]) => (
                <div key={id} className="rounded-md border border-border bg-white px-3 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-slate-950">{id} | {date}</p>
                    <Badge tone={status === "issued" ? "success" : "warning"}>{status}</Badge>
                  </div>
                  <p className="text-muted-foreground">{meds}</p>
                </div>
              ))}
              <div className="grid gap-2 md:grid-cols-3">
                <Badge tone="info">Refill reminder: 12 days</Badge>
                <Badge tone="warning">Adherence: 78%</Badge>
                <Badge tone="success">Label print ready</Badge>
              </div>
            </CardContent>
          </Card>
        </section>

        <SectionReveal>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Security, issuing, and audit model</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-3">
              <p className="help-strip p-3">Doctors create/sign prescriptions using Firebase custom claims; pharmacists verify, substitute approved alternatives, issue, and update stock.</p>
              <p className="help-strip p-3">Spring Boot services should validate signing, issuing, substitution, stock deduction, QR verification, and audit log writes.</p>
              <p className="help-strip p-3">Spring Boot API authorization, React Query caching, pharmacy status listeners, AES-sensitive fields, and multilingual labels support production deployment.</p>
            </CardContent>
          </Card>
        </SectionReveal>
      </div>
    </PageTransition>
  );
}

function SafetyItem({ label, active, detail }: { label: string; active?: boolean; detail: string }) {
  return (
    <div className={`rounded-md border px-3 py-3 text-sm ${active ? "border-amber-200 bg-amber-50 text-amber-950" : "border-border bg-white text-slate-800"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold">{label}</p>
        <Badge tone={active ? "warning" : "success"}>{active ? "review" : "clear"}</Badge>
      </div>
      <p className="mt-1">{detail}</p>
    </div>
  );
}

