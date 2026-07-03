import { QRCodeSVG } from "qrcode.react";
import { Activity, AlertTriangle, Bell, BrainCircuit, CalendarPlus, Camera, Download, FileText, HeartPulse, LockKeyhole, QrCode, ScanBarcode, Stethoscope, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GenderBadge } from "../components/patient/GenderBadge";
import { PatientCodeScanner } from "../components/patient/PatientCodeScanner";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import { downloadTextFile, timestampedFilename } from "../utils/download";
import { normaliseGenderLabel } from "../utils/gender";
import { getSavedPatientsForDoctors, PATIENTS_UPDATED_EVENT } from "../utils/patientRegistry";

const timeline = [
  ["OPD", "2026-06-13", "Medical OPD", "Fever and cough, diagnosis pending"],
  ["Lab", "2026-06-12", "Haematology", "FBC uploaded"],
  ["Prescription", "2026-06-10", "Pharmacy", "Metformin continued"],
  ["Emergency", "2026-05-29", "ED", "Hypoglycaemia observation"],
  ["Admission", "2026-05-20", "Ward 12", "Discharged with follow-up"],
  ["Referral", "2026-05-18", "Cardiology", "Clinic review requested"],
];

const vitals = [
  { day: "Mon", bp: 128, pulse: 82, spo2: 98, sugar: 122 },
  { day: "Tue", bp: 132, pulse: 86, spo2: 97, sugar: 140 },
  { day: "Wed", bp: 126, pulse: 80, spo2: 99, sugar: 118 },
  { day: "Thu", bp: 144, pulse: 92, spo2: 96, sugar: 168 },
  { day: "Fri", bp: 136, pulse: 84, spo2: 98, sugar: 130 },
];

const docs = [
  ["LAB-812", "Full Blood Count", "Laboratory", "PDF", "2026-06-12"],
  ["RAD-091", "Chest X-ray", "Radiology", "Image", "2026-06-08"],
  ["DS-204", "Discharge Card", "Ward", "PDF", "2026-05-20"],
];

export function PatientProfile() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [scannerMode, setScannerMode] = useState<"qr" | "barcode" | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [savedPatients, setSavedPatients] = useState(() => getSavedPatientsForDoctors());
  const savedPatient = savedPatients.find((patient) => patient.patientId === "PAT-2026-000001");
  const patientName = savedPatient?.name ?? "Nimal Silva";
  const patientId = savedPatient?.patientId ?? "PAT-2026-000001";
  const patientGender = normaliseGenderLabel(savedPatient?.sex ?? "Male");
  const patientAge = savedPatient?.age ?? 44;
  const patientPhone = savedPatient?.phone ?? "0771234567";
  const patientDistrict = savedPatient?.district || "Colombo";
  const patientBloodGroup = savedPatient?.bloodGroup || "B+";
  const bmi = (72 / ((1.68 * 1.68))).toFixed(1);

  useEffect(() => {
    function refreshPatients() {
      setSavedPatients(getSavedPatientsForDoctors());
    }
    window.addEventListener(PATIENTS_UPDATED_EVENT, refreshPatients);
    window.addEventListener("storage", refreshPatients);
    return () => {
      window.removeEventListener(PATIENTS_UPDATED_EVENT, refreshPatients);
      window.removeEventListener("storage", refreshPatients);
    };
  }, []);

  function downloadMedicalSummary() {
    downloadTextFile(timestampedFilename("patient-medical-summary", "txt"), `GovCare EHR System\nMedical Summary\n\nPatient: ${patientName}\nPatient ID: ${patientId}\nGender: ${patientGender}\nAge: ${patientAge}\nBlood group: ${patientBloodGroup}\nAllergies: Penicillin\nActive problems: Diabetes, hypertension\nLatest vitals: BP 136/86, BMI ${bmi}\nFollow-up: Diabetes clinic in 14 days`, "text/plain;charset=utf-8");
    showToast("Medical summary downloaded.", "success");
  }

  function downloadDocument(id: string, name: string, unit: string, format: string, date: string) {
    downloadTextFile(timestampedFilename(id.toLowerCase(), format === "Image" ? "txt" : "txt"), `GovCare EHR System\nPatient document\n\nID: ${id}\nDocument: ${name}\nUnit: ${unit}\nFormat: ${format}\nDate: ${date}\nPatient: ${patientName}\nGender: ${patientGender}`, "text/plain;charset=utf-8");
    showToast(`${name} downloaded.`, "success");
  }

  function handleScannedCode(value: string) {
    showToast(`Patient scanner captured: ${value}`, "success");
  }

  function handleProfilePhotoUpload(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Please upload an image file for the patient profile picture.", "warning");
      return;
    }
    setProfilePhoto(URL.createObjectURL(file));
    showToast("Patient profile picture preview updated. Production upload should save to Firebase Storage with audit metadata.", "success");
  }

  return (
    <div className="space-y-5">
      <PatientCodeScanner open={scannerMode !== null} mode={scannerMode ?? "qr"} onClose={() => setScannerMode(null)} onDetected={handleScannedCode} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Modern patient profile</h1>
          <p className="text-sm text-muted-foreground">Longitudinal record with timeline, health summary, alerts, vitals, documents, consent, and audit-aware access.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigate("/opd")}><CalendarPlus className="h-4 w-4" />New visit</Button>
          <Button variant="outline" onClick={() => navigate("/media")}><Upload className="h-4 w-4" />Upload document</Button>
          <Button variant="outline" onClick={downloadMedicalSummary}><Download className="h-4 w-4" />Medical summary</Button>
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-[340px_1fr]">
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative">
                {profilePhoto ? (
                  <img className="h-28 w-28 rounded-xl object-cover ring-2 ring-teal-100" src={profilePhoto} alt={`${patientName} profile`} />
                ) : (
                  <div className="grid h-28 w-28 place-items-center rounded-xl bg-teal-50 text-3xl font-bold text-teal-950 ring-2 ring-teal-100">
                    {patientName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <button
                  type="button"
                  className="absolute -bottom-2 -right-2 grid h-9 w-9 place-items-center rounded-full bg-primary text-white shadow-md"
                  onClick={() => photoInputRef.current?.click()}
                  aria-label="Upload patient profile picture"
                >
                  <Camera className="h-4 w-4" />
                </button>
                <input ref={photoInputRef} className="hidden" type="file" accept="image/*" onChange={(event) => handleProfilePhotoUpload(event.target.files?.[0])} />
              </div>
              <QRCodeSVG value={patientId} size={118} />
              <div className="text-right">
                <p className="font-mono text-xl tracking-widest">*PAT2026000001*</p>
                <p className="text-xs text-muted-foreground">Barcode scan supported</p>
              </div>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold">{patientName}</h2>
                <GenderBadge value={patientGender} />
              </div>
              <p className="text-sm text-muted-foreground">{patientId} | NIC {savedPatient?.nicOrPassport || "812345678V"}</p>
              <p className="text-sm text-muted-foreground">{patientBloodGroup} | {patientAge} years | {patientDistrict} | {patientPhone}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="danger">Penicillin allergy</Badge>
              <Badge tone="warning">Diabetes</Badge>
              <Badge tone="warning">Missed follow-up</Badge>
              <Badge tone="info">Consent active</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="outline" onClick={() => setScannerMode("qr")}><QrCode className="h-4 w-4" />QR scan</Button>
              <Button variant="outline" onClick={() => setScannerMode("barcode")}><ScanBarcode className="h-4 w-4" />Barcode scan</Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Active problems", "Diabetes, hypertension", AlertTriangle, "warning"],
            ["Recent diagnosis", "Viral fever", Stethoscope, "info"],
            ["Latest vitals", `BP 136/86, BMI ${bmi}`, HeartPulse, "success"],
            ["Critical warnings", "Allergy alert active", Bell, "danger"],
          ].map(([label, value, Icon, tone]) => (
            <Card key={label as string}>
              <CardContent className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">{label as string}</p>
                  <p className="mt-2 font-bold text-slate-950">{value as string}</p>
                </div>
                <Badge tone={tone as "warning" | "info" | "success" | "danger"}><Icon className="h-4 w-4" /></Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="flex flex-wrap items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-700" />
          <p className="text-sm font-semibold text-amber-950">Allergy alert: Penicillin. Infectious disease flag and medication interaction checks should run before prescribing.</p>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />Smart medical timeline</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {timeline.map(([type, date, unit, note]) => (
              <div key={`${type}-${date}`} className="grid gap-2 rounded-md border border-border bg-white p-3 sm:grid-cols-[110px_120px_1fr]">
                <Badge tone={type === "Emergency" ? "danger" : type === "Lab" ? "info" : "neutral"}>{type}</Badge>
                <p className="text-sm font-semibold">{date}</p>
                <p className="text-sm text-slate-700"><span className="font-semibold">{unit}</span> - {note}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Vitals trend</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
              <Badge tone="success">Temp 37.1 C</Badge>
              <Badge tone="info">SpO2 98%</Badge>
              <Badge tone="warning">Pain score 4</Badge>
              <Badge tone="neutral">BMI {bmi}</Badge>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={vitals}>
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="bp" stroke="#0f766e" strokeWidth={2} />
                  <Line type="monotone" dataKey="pulse" stroke="#155e75" strokeWidth={2} />
                  <Line type="monotone" dataKey="sugar" stroke="#f59e0b" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Digital health summary</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <p><strong>Current prescriptions:</strong> Metformin, Losartan</p>
            <p><strong>Latest lab:</strong> HbA1c 7.8%, FBC normal</p>
            <p><strong>Risk category:</strong> High chronic disease risk</p>
            <p><strong>Follow-up:</strong> Diabetes clinic in 14 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-primary" />Privacy and consent</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <p>Data-sharing permission: granted</p>
            <p>Emergency access mode: audited break-glass only</p>
            <p>Restricted records: pregnancy history and disability notes</p>
            <p>Every view/edit writes an audit log entry.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-primary" />AI-ready signals</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <p>Duplicate probability: low</p>
            <p>Department suggestion: Medical OPD</p>
            <p>Abnormal vitals alert: blood sugar trend</p>
            <p>Missed medication reminder: enabled structure</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Documents</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <thead><tr><Th>ID</Th><Th>Document</Th><Th>Type</Th><Th>Format</Th><Th>Date</Th><Th>Action</Th></tr></thead>
            <tbody>
              {docs.map((doc) => (
                <tr key={doc[0]}>
                  {doc.map((cell) => <Td key={cell}>{cell}</Td>)}
                  <Td><Button variant="outline" onClick={() => downloadDocument(doc[0], doc[1], doc[2], doc[3], doc[4])}><Download className="h-4 w-4" />Download</Button></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
