import { Activity, AlertTriangle, CalendarPlus, Camera, Copy, Fingerprint, Filter, IdCard, Printer, QrCode, Save, ScanBarcode, Search, ShieldCheck, Stethoscope, UserRoundPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { GenderBadge } from "../components/patient/GenderBadge";
import { PatientCodeScanner } from "../components/patient/PatientCodeScanner";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import { getSavedPatientsForDoctors, PATIENTS_UPDATED_EVENT } from "../utils/patientRegistry";

const patients = [
  { id: "PAT-2026-000001", nic: "812345678V", passport: "N8123456", hospitalNo: "NHSL-1001", dob: "1982-03-12", name: "Nimal Silva", phone: "0771234567", age: 44, sex: "male", clinic: "Diabetes", ward: "Ward 12", disease: "Diabetes", photo: "NS", lastVisit: "OPD 2026-06-13", lastAppointment: "Diabetes clinic 2026-06-28", activeAdmission: "Ward 12 Bed 08" },
  { id: "PAT-2026-000088", nic: "BC-2018-4551", passport: "", hospitalNo: "BH-2088", dob: "2018-10-04", name: "Sahan Perera", phone: "0715558888", age: 8, sex: "male", clinic: "Paediatrics", ward: "-", disease: "Asthma", photo: "SP", lastVisit: "Paediatrics 2026-06-10", lastAppointment: "Asthma clinic 2026-06-24", activeAdmission: "No active admission" },
  { id: "PAT-2026-000142", nic: "936542117V", passport: "P9365421", hospitalNo: "DMH-3142", dob: "1993-02-21", name: "Fathima Rizna", phone: "0768899001", age: 33, sex: "female", clinic: "Antenatal", ward: "Ward 03", disease: "Pregnancy", photo: "FR", lastVisit: "Antenatal 2026-06-12", lastAppointment: "Antenatal 2026-06-20", activeAdmission: "Ward 03 Bed 11" },
  { id: "PAT-2026-000162", nic: "936542118V", passport: "", hospitalNo: "DMH-3162", dob: "1993-02-22", name: "Fathima Rizana", phone: "0768899002", age: 33, sex: "female", clinic: "Antenatal", ward: "-", disease: "Pregnancy", photo: "FR", lastVisit: "Clinic 2026-06-09", lastAppointment: "Antenatal 2026-06-25", activeAdmission: "No active admission" },
];

type SearchMethod = "nic" | "passport" | "hospitalNo" | "mobile" | "nameDob" | "biometric" | "face";
type PatientLookup = (typeof patients)[number];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function fuzzyScore(source: string, target: string) {
  const a = normalize(source);
  const b = normalize(target);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 84;
  const sourceTokens = source.toLowerCase().split(/\s+/);
  const targetTokens = target.toLowerCase().split(/\s+/);
  const matched = targetTokens.filter((token) => sourceTokens.some((sourceToken) => sourceToken.startsWith(token[0]) || sourceToken.includes(token))).length;
  return Math.round((matched / Math.max(targetTokens.length, 1)) * 72);
}

function auditLookup(action: string, detail: string) {
  if (typeof window === "undefined") return;
  const key = "govcare-patient-identification-audit";
  const current = JSON.parse(window.localStorage.getItem(key) ?? "[]") as Array<Record<string, string>>;
  window.localStorage.setItem(key, JSON.stringify([{ action, detail, timestamp: new Date().toISOString(), module: "Patient Identification" }, ...current].slice(0, 50)));
}

export function PatientWorkbench() {
  const { showToast } = useToast();
  const [savedPatients, setSavedPatients] = useState(() => getSavedPatientsForDoctors());
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [scannerMode, setScannerMode] = useState<"qr" | "barcode" | null>(null);
  const [forgotQrOpen, setForgotQrOpen] = useState(false);
  const [searchMethod, setSearchMethod] = useState<SearchMethod>("nic");
  const [identifierValue, setIdentifierValue] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [lastIdentified, setLastIdentified] = useState<PatientLookup | null>(null);
  const [temporaryPatients, setTemporaryPatients] = useState<PatientLookup[]>([]);
  const [height, setHeight] = useState(168);
  const [weight, setWeight] = useState(72);
  const bmi = useMemo(() => (weight / ((height / 100) * (height / 100))).toFixed(1), [height, weight]);

  useEffect(() => {
    function refreshSavedPatients() {
      setSavedPatients(getSavedPatientsForDoctors());
    }

    window.addEventListener(PATIENTS_UPDATED_EVENT, refreshSavedPatients);
    window.addEventListener("storage", refreshSavedPatients);
    return () => {
      window.removeEventListener(PATIENTS_UPDATED_EVENT, refreshSavedPatients);
      window.removeEventListener("storage", refreshSavedPatients);
    };
  }, []);

  const allPatients = useMemo(() => [
    ...savedPatients.map((patient) => ({
      id: patient.patientId,
      nic: patient.nicOrPassport || patient.birthCertificateNo || "",
      name: patient.name,
      phone: patient.phone,
      age: patient.age ?? 0,
      sex: patient.sex,
      passport: "",
      hospitalNo: patient.patientId,
      dob: "",
      clinic: patient.assignedDoctor === "Unassigned" ? "New registration" : patient.assignedDoctor,
      ward: "-",
      disease: patient.riskCategory,
      photo: patient.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
      lastVisit: "New registration",
      lastAppointment: "Not booked",
      activeAdmission: "No active admission",
    })),
    ...temporaryPatients,
    ...patients,
  ], [savedPatients, temporaryPatients]);
  const results = allPatients.filter((patient) => {
    const matchesTerm = !term || [patient.id, patient.nic, patient.passport, patient.hospitalNo, patient.name, patient.phone, patient.dob].some((value) => String(value ?? "").toLowerCase().includes(term.toLowerCase())) || fuzzyScore(patient.name, term) > 55;
    const matchesFilter = filter === "all" || patient.sex === filter || patient.clinic === filter || patient.ward === filter || patient.disease === filter;
    return matchesTerm && matchesFilter;
  });
  const similarNameAlerts = useMemo(() => {
    if (!term || term.length < 3) return [];
    return allPatients.filter((patient) => fuzzyScore(patient.name, term) >= 55 && !patient.name.toLowerCase().includes(term.toLowerCase())).slice(0, 4);
  }, [allPatients, term]);

  function handleScannedCode(value: string) {
    setTerm(value);
    auditLookup("qr_scan", value);
    showToast(`Scanner captured: ${value}`, "success");
  }

  function identifyWithoutQr() {
    if (searchMethod === "biometric" || searchMethod === "face") {
      showToast(`${searchMethod === "biometric" ? "Fingerprint" : "Facial recognition"} support is future-ready. Use NIC, mobile, hospital number, or name + DOB now.`, "info");
      auditLookup(searchMethod, "future-ready lookup requested");
      return;
    }
    const value = identifierValue.trim();
    if (!value) {
      showToast("Enter an identifier before searching.", "warning");
      return;
    }
    const found = allPatients.find((patient) => {
      if (searchMethod === "nic") return normalize(patient.nic) === normalize(value);
      if (searchMethod === "passport") return normalize(patient.passport) === normalize(value);
      if (searchMethod === "hospitalNo") return normalize(patient.hospitalNo) === normalize(value) || normalize(patient.id) === normalize(value);
      if (searchMethod === "mobile") return normalize(patient.phone) === normalize(value);
      return fuzzyScore(patient.name, value) > 60 && (!dateOfBirth || patient.dob === dateOfBirth);
    });
    setTerm(value);
    auditLookup(`forgot_qr_${searchMethod}`, value);
    if (found) {
      setLastIdentified(found);
      showToast(`${found.name} identified safely. Verify photo and DOB before issuing duplicate QR.`, "success");
      return;
    }
    showToast("No exact patient found. Review fuzzy matches or create temporary emergency ID if urgent.", "warning");
  }

  function issueDuplicateQr(patient: PatientLookup) {
    setLastIdentified(patient);
    auditLookup("duplicate_qr_issued", patient.id);
    showToast(`Duplicate QR card issued for ${patient.name}.`, "success");
  }

  function printTemporarySlip(patient: PatientLookup) {
    setLastIdentified(patient);
    auditLookup("temporary_qr_slip_printed", patient.id);
    showToast(`Temporary QR slip printed for ${patient.name}.`, "success");
  }

  function createTemporaryEmergencyId() {
    const tempId = `TEMP-${new Date().getFullYear()}-${String(temporaryPatients.length + 1).padStart(4, "0")}`;
    const patient: PatientLookup = {
      id: tempId,
      nic: "Unknown",
      passport: "",
      hospitalNo: tempId,
      dob: "",
      name: "Unidentified emergency patient",
      phone: "",
      age: 0,
      sex: "other",
      clinic: "Emergency fast-track",
      ward: "ETU",
      disease: "critical",
      photo: "UP",
      lastVisit: "Emergency registration now",
      lastAppointment: "None",
      activeAdmission: "ETU pending merge",
    };
    setTemporaryPatients((current) => [patient, ...current]);
    setLastIdentified(patient);
    setTerm(tempId);
    auditLookup("temporary_emergency_id_created", tempId);
    showToast(`${tempId} created. Merge with permanent record after identification.`, "warning");
  }

  return (
    <div className="space-y-5">
      <PatientCodeScanner open={scannerMode !== null} mode={scannerMode ?? "qr"} onClose={() => setScannerMode(null)} onDetected={handleScannedCode} />
      <div>
        <h1 className="text-2xl font-bold">Patient search and visit workbench</h1>
        <p className="text-sm text-muted-foreground">Advanced search, QR/barcode scan UI, visit creation, doctor assignment, vitals, risk flags, and AI-ready triage structures.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5 text-primary" />Advanced search</CardTitle></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_220px_auto_auto]">
          <Input placeholder="Patient ID, NIC, name, phone, QR or barcode value" value={term} onChange={(event) => setTerm(event.target.value)} />
          <Select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">All filters</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="Diabetes">Diabetes clinic</option>
            <option value="Antenatal">Antenatal clinic</option>
            <option value="Ward 12">Ward 12</option>
            <option value="Pregnancy">Pregnancy</option>
          </Select>
          <Button variant="outline" onClick={() => setScannerMode("qr")}><QrCode className="h-4 w-4" />QR scan</Button>
          <Button variant="outline" onClick={() => setScannerMode("barcode")}><ScanBarcode className="h-4 w-4" />Barcode scan</Button>
          <Button type="button" className="lg:col-span-4 justify-start" onClick={() => setForgotQrOpen((current) => !current)}><IdCard className="h-4 w-4" />Forgot QR Code?</Button>
          <div className="lg:col-span-4 flex flex-wrap gap-2 text-sm">
            <Badge tone="neutral"><Filter className="h-3 w-3" />Age</Badge>
            <Badge tone="neutral">Gender</Badge>
            <Badge tone="neutral">Clinic</Badge>
            <Badge tone="neutral">Ward</Badge>
            <Badge tone="neutral">Disease</Badge>
            <Badge tone="neutral">Date range</Badge>
            <Badge tone="info">NIC / passport / hospital no</Badge>
            <Badge tone="warning">fuzzy name safety</Badge>
          </div>
        </CardContent>
      </Card>

      {forgotQrOpen && (
        <Card className="border-cyan-200 bg-cyan-50">
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Forgot QR Code identification</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[220px_1fr_180px_auto]">
              <Select value={searchMethod} onChange={(event) => setSearchMethod(event.target.value as SearchMethod)}>
                <option value="nic">NIC number</option>
                <option value="passport">Passport number</option>
                <option value="hospitalNo">Hospital number</option>
                <option value="mobile">Mobile number</option>
                <option value="nameDob">Full name + DOB</option>
                <option value="biometric">Fingerprint / biometric</option>
                <option value="face">Facial recognition</option>
              </Select>
              <Input value={identifierValue} onChange={(event) => setIdentifierValue(event.target.value)} placeholder="Enter NIC, passport, hospital no, mobile, or full name" />
              <Input type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} disabled={searchMethod !== "nameDob"} />
              <Button onClick={identifyWithoutQr}><Search className="h-4 w-4" />Find patient</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <Button variant="outline" onClick={() => showToast("Fingerprint biometric support is future-ready for device integration.", "info")}><Fingerprint className="h-4 w-4" />Fingerprint</Button>
              <Button variant="outline" onClick={() => showToast("Facial recognition support is optional future enhancement.", "info")}><Camera className="h-4 w-4" />Face verify</Button>
              <Button variant="outline" onClick={createTemporaryEmergencyId}><UserRoundPlus className="h-4 w-4" />Emergency temp ID</Button>
              {lastIdentified && <Button variant="outline" onClick={() => printTemporarySlip(lastIdentified)}><Printer className="h-4 w-4" />Print temp slip</Button>}
            </div>
            {lastIdentified && (
              <div className="grid gap-3 rounded-md border border-teal-200 bg-white p-3 md:grid-cols-[64px_1fr_auto_auto]">
                <div className="grid h-14 w-14 place-items-center rounded-md bg-teal-100 text-lg font-bold text-teal-950">{lastIdentified.photo}</div>
                <div className="text-sm">
                  <p className="font-bold text-slate-950">{lastIdentified.name} | {lastIdentified.id}</p>
                  <p className="text-muted-foreground">DOB {lastIdentified.dob || "unknown"} | NIC {lastIdentified.nic} | Mobile {lastIdentified.phone || "unknown"}</p>
                  <p className="text-muted-foreground">{lastIdentified.lastVisit} | {lastIdentified.lastAppointment} | {lastIdentified.activeAdmission}</p>
                </div>
                <Button variant="outline" onClick={() => issueDuplicateQr(lastIdentified)}><Copy className="h-4 w-4" />Duplicate QR</Button>
                <Button onClick={() => printTemporarySlip(lastIdentified)}><QrCode className="h-4 w-4" />Temporary slip</Button>
              </div>
            )}
            {similarNameAlerts.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                <p className="mb-2 font-bold">Similar-name safety alert: verify DOB, photo, NIC, and active admission before opening the record.</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {similarNameAlerts.map((patient) => <p key={patient.id} className="rounded-md border border-amber-200 bg-white px-3 py-2">{patient.name} | {patient.dob || "DOB pending"} | {patient.id}</p>)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader><CardTitle>Search results</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
          <Table>
              <thead><tr><Th>Photo</Th><Th>Patient ID</Th><Th>Name</Th><Th>Gender</Th><Th>NIC / Passport / Hospital No</Th><Th>Phone</Th><Th>History</Th><Th>Risk</Th><Th>QR</Th></tr></thead>
              <tbody>
                {results.map((patient) => (
                  <tr key={patient.id}>
                    <Td><div className="grid h-10 w-10 place-items-center rounded-md bg-teal-100 text-xs font-bold text-teal-950">{patient.photo}</div></Td>
                    <Td className="font-semibold">{patient.id}</Td>
                    <Td>{patient.name}<br /><span className="text-xs text-muted-foreground">{patient.age ? `${patient.age} years` : "Age pending"}</span></Td>
                    <Td><GenderBadge value={patient.sex} /></Td>
                    <Td>{patient.nic}<br /><span className="text-xs text-muted-foreground">{patient.passport || "No passport"} | {patient.hospitalNo}</span></Td>
                    <Td>{patient.phone}</Td>
                    <Td>{patient.lastVisit}<br /><span className="text-xs text-muted-foreground">{patient.lastAppointment} | {patient.activeAdmission}</span></Td>
                    <Td><Badge tone={patient.disease === "critical" ? "danger" : patient.disease === "Pregnancy" || patient.disease === "high" || patient.disease === "moderate" ? "warning" : "info"}>{patient.disease}</Badge></Td>
                    <Td><Button className="min-h-9 px-3 py-1.5" variant="outline" onClick={() => issueDuplicateQr(patient)}><QrCode className="h-4 w-4" />Issue</Button></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarPlus className="h-5 w-5 text-primary" />New visit</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Token auto: OPD-126" />
              <Select><option>Assign doctor</option><option>Dr. Perera</option><option>Dr. Fernando</option></Select>
            </div>
            <Input placeholder="Visit reason" />
            <Input placeholder="Symptoms" />
            <Input placeholder="Diagnosis" />
            <Input placeholder="Treatment plan" />
            <Input type="date" />
            <Input placeholder="Referral notes" />
            <Button onClick={() => showToast("OPD visit created and ticket queued for the selected patient.", "success")}><Save className="h-4 w-4" />Create visit</Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />Vitals tracking</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Temperature" defaultValue="37.1" />
            <Input placeholder="Blood pressure" defaultValue="136/86" />
            <Input placeholder="Pulse rate" defaultValue="84" />
            <Input placeholder="Respiratory rate" defaultValue="18" />
            <Input placeholder="Oxygen saturation" defaultValue="98" />
            <Input placeholder="Blood sugar" defaultValue="130" />
            <Input placeholder="Pain score" defaultValue="4" />
            <Input placeholder="Height cm" type="number" value={height} onChange={(event) => setHeight(Number(event.target.value))} />
            <Input placeholder="Weight kg" type="number" value={weight} onChange={(event) => setWeight(Number(event.target.value))} />
            <Badge tone="info" className="justify-center">BMI auto calculated: {bmi}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" />Alerts, risk flags, and AI-ready checks</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {[
              "Allergy warning",
              "Critical patient flag",
              "High-risk pregnancy flag",
              "Chronic disease flag",
              "Infectious disease flag",
              "Medication interaction warning",
              "Missed follow-up alert",
              "Missed medication reminder structure",
              "Abnormal vitals alert",
              "Symptom-to-department suggestion",
              "Duplicate record detection",
              "Risk prediction structure",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm">
                <Stethoscope className="h-4 w-4 text-primary" />
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
