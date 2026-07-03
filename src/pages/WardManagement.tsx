import { BedDouble, ClipboardList, DoorOpen, HeartPulse, RefreshCw, ShieldAlert, UserRoundCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageTransition, Reveal, SectionReveal, Stagger } from "../components/motion/PageTransition";
import { GenderBadge } from "../components/patient/GenderBadge";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import { refreshAndRedirectToMainMenu } from "../utils/navigation";
import { getPatientClinicalClassification } from "../utils/patientRegistry";
import { recommendWardCategory, wardAssignmentAllowed, type PatientGenderForWard, type WardCategory } from "../utils/wardPolicy";

type BedStatus = "available" | "occupied" | "cleaning" | "reserved" | "critical";

interface Ward {
  id: string;
  name: string;
  category: WardCategory;
  department: string;
  nurseLead: string;
}

interface BedRecord {
  id: string;
  wardId: string;
  bedNo: string;
  status: BedStatus;
  patientId?: string;
  patientName?: string;
  patientAge?: number;
  patientGender?: PatientGenderForWard;
  diagnosis?: string;
  risk?: string;
  lastVitals?: string;
}

const wards: Ward[] = [
  { id: "male-medical-01", name: "Male Ward 01", category: "male", department: "General Medicine", nurseLead: "Nurse Silva" },
  { id: "male-surgical-02", name: "Male Ward 02", category: "male", department: "Surgery", nurseLead: "Nurse Fernando" },
  { id: "male-specialty-03", name: "Male Ward 03", category: "male", department: "Orthopaedics", nurseLead: "Nurse Kumar" },
  { id: "female-medical-04", name: "Female Ward 01", category: "female", department: "General Medicine", nurseLead: "Nurse Rizna" },
  { id: "female-surgical-05", name: "Female Ward 02", category: "female", department: "Surgery", nurseLead: "Nurse Wijesinghe" },
  { id: "female-obstetrics-06", name: "Female Ward 03", category: "female", department: "Obstetrics and Gynecology", nurseLead: "Nurse Jayasuriya" },
  { id: "children-medical-07", name: "Children Ward 01", category: "children", department: "Paediatrics", nurseLead: "Nurse Perera" },
  { id: "children-surgical-08", name: "Children Ward 02", category: "children", department: "Paediatric Surgery", nurseLead: "Nurse Thevan" },
  { id: "children-isolation-09", name: "Children Ward 03", category: "children", department: "Paediatric Isolation", nurseLead: "Nurse Joseph" },
  { id: "children-hdu-10", name: "Children Ward 04", category: "children", department: "Paediatric HDU", nurseLead: "Nurse Nazeer" },
];

const seedPatients = [
  { id: "PAT-2026-000001", name: "Nimal Silva", age: 67, gender: "male" as PatientGenderForWard, diagnosis: "Diabetes review", risk: "Stable", vitals: "BP 128/82, SpO2 98%" },
  { id: "PAT-2026-000142", name: "Fathima Rizna", age: 31, gender: "female" as PatientGenderForWard, diagnosis: "High-risk pregnancy", risk: "High-risk", vitals: "BP 138/88, HR 92" },
  { id: "PAT-2026-000233", name: "R. Kumar", age: 54, gender: "male" as PatientGenderForWard, diagnosis: "Chest pain observation", risk: "Critical labs", vitals: "BP 150/94, HR 108" },
  { id: "PAT-2026-000301", name: "K. Thevarajah", age: 42, gender: "male" as PatientGenderForWard, diagnosis: "Post-op monitoring", risk: "Fall risk", vitals: "BP 118/76, Temp 37.2C" },
  { id: "PAT-2026-000412", name: "Sahan Perera", age: 7, gender: "male" as PatientGenderForWard, diagnosis: "Asthma exacerbation", risk: "Paediatric", vitals: "SpO2 96%, RR 24" },
  { id: "PAT-2026-000525", name: "M. Ahamed", age: 63, gender: "male" as PatientGenderForWard, diagnosis: "Renal review", risk: "Fluid restriction", vitals: "BP 142/90, HR 84" },
];

function createBeds() {
  return wards.flatMap((ward, wardIndex) =>
    Array.from({ length: 25 }, (_, bedIndex) => {
      const patient = seedPatients[(wardIndex + bedIndex) % seedPatients.length];
      const occupied = bedIndex % 5 === 0 || bedIndex % 7 === 0;
      const critical = occupied && bedIndex % 10 === 0;
      const status: BedStatus = critical ? "critical" : occupied ? "occupied" : bedIndex % 11 === 0 ? "reserved" : bedIndex % 13 === 0 ? "cleaning" : "available";
      return {
        id: `${ward.id}-bed-${String(bedIndex + 1).padStart(2, "0")}`,
        wardId: ward.id,
        bedNo: `${ward.name.replace("Ward ", "W")}-${String(bedIndex + 1).padStart(2, "0")}`,
        status,
        patientId: occupied ? patient.id : undefined,
        patientName: occupied ? patient.name : undefined,
        patientAge: occupied ? patient.age : undefined,
        patientGender: occupied ? patient.gender : undefined,
        diagnosis: occupied ? patient.diagnosis : undefined,
        risk: occupied ? patient.risk : undefined,
        lastVitals: occupied ? patient.vitals : undefined,
      } satisfies BedRecord;
    }),
  );
}

function statusTone(status: BedStatus) {
  if (status === "available") return "success";
  if (status === "critical") return "danger";
  if (status === "cleaning" || status === "reserved") return "warning";
  return "info";
}

function bedCardClass(bed: BedRecord, selectedBedId: string) {
  const isSelected = bed.id === selectedBedId;
  const isAssigned = Boolean(bed.patientId) || bed.status === "occupied" || bed.status === "critical";
  if (bed.status === "critical") {
    return `${isSelected ? "ring-2 ring-rose-400" : ""} border-rose-500 bg-rose-100 text-rose-950 shadow-md`;
  }
  if (isAssigned) {
    return `${isSelected ? "ring-2 ring-red-400" : ""} border-red-400 bg-red-50 text-red-950 shadow-sm`;
  }
  if (isSelected) {
    return "border-teal-400 bg-teal-50 shadow-md ring-2 ring-teal-200";
  }
  return "border-border bg-white";
}

export function WardManagement() {
  const { showToast } = useToast();
  const [selectedWardId, setSelectedWardId] = useState(wards[0].id);
  const [beds, setBeds] = useState<BedRecord[]>(createBeds);
  const [selectedBedId, setSelectedBedId] = useState(`${wards[0].id}-bed-01`);
  const selectedWard = wards.find((ward) => ward.id === selectedWardId) ?? wards[0];
  const wardBeds = beds.filter((bed) => bed.wardId === selectedWardId);
  const selectedBed = beds.find((bed) => bed.id === selectedBedId) ?? wardBeds[0];
  const [patientName, setPatientName] = useState(selectedBed?.patientName ?? "");
  const [patientId, setPatientId] = useState(selectedBed?.patientId ?? "");
  const [diagnosis, setDiagnosis] = useState(selectedBed?.diagnosis ?? "");
  const [risk, setRisk] = useState(selectedBed?.risk ?? "");
  const [status, setStatus] = useState<BedStatus>(selectedBed?.status ?? "available");
  const [patientAge, setPatientAge] = useState(String(selectedBed?.patientAge ?? 35));
  const [patientGender, setPatientGender] = useState<PatientGenderForWard>(selectedBed?.patientGender ?? "male");
  const [overrideApproved, setOverrideApproved] = useState(false);

  const patientClassification = getPatientClinicalClassification(patientId || selectedBed?.patientId || "PAT-UNKNOWN", { age: Number(patientAge) || selectedBed?.patientAge, gender: patientGender });
  const policyPatient = { age: patientClassification.age ?? (Number(patientAge) || 0), gender: patientClassification.gender };
  const wardPolicy = wardAssignmentAllowed(policyPatient, selectedWard.category, overrideApproved);
  const categoryStats = useMemo(() => {
    return (["male", "female", "children"] as WardCategory[]).map((category) => {
      const categoryWardIds = wards.filter((ward) => ward.category === category).map((ward) => ward.id);
      const categoryBeds = beds.filter((bed) => categoryWardIds.includes(bed.wardId));
      return {
        category,
        total: categoryBeds.length,
        occupied: categoryBeds.filter((bed) => bed.status === "occupied" || bed.status === "critical").length,
        available: categoryBeds.filter((bed) => bed.status === "available").length,
      };
    });
  }, [beds]);

  const totals = useMemo(() => {
    const all = beds.filter((bed) => bed.wardId === selectedWardId);
    return {
      total: all.length,
      occupied: all.filter((bed) => bed.status === "occupied" || bed.status === "critical").length,
      available: all.filter((bed) => bed.status === "available").length,
      critical: all.filter((bed) => bed.status === "critical").length,
    };
  }, [beds, selectedWardId]);
  const summaryStats = [
    { label: "Beds in selected ward", value: totals.total, icon: BedDouble, tone: "info" as const },
    { label: "Occupied beds", value: totals.occupied, icon: UserRoundCheck, tone: "warning" as const },
    { label: "Available beds", value: totals.available, icon: DoorOpen, tone: "success" as const },
    { label: "Critical patients", value: totals.critical, icon: ShieldAlert, tone: "danger" as const },
  ];

  function pickWard(wardId: string) {
    const firstBed = beds.find((bed) => bed.wardId === wardId);
    setSelectedWardId(wardId);
    if (firstBed) pickBed(firstBed);
  }

  function pickBed(bed: BedRecord) {
    setSelectedBedId(bed.id);
    setPatientName(bed.patientName ?? "");
    setPatientId(bed.patientId ?? "");
    setDiagnosis(bed.diagnosis ?? "");
    setRisk(bed.risk ?? "");
    setStatus(bed.status);
    setPatientAge(String(bed.patientAge ?? 35));
    setPatientGender(bed.patientGender ?? "male");
    setOverrideApproved(false);
  }

  function updatePatientBed() {
    if ((status === "occupied" || status === "critical" || status === "reserved") && !wardPolicy.allowed) {
      showToast(`${wardPolicy.recommendation.label} recommended. Authorized override is required for cross-assignment.`, "warning");
      return;
    }
    setBeds((current) =>
      current.map((bed) =>
        bed.id === selectedBedId
          ? {
              ...bed,
              status,
              patientId: status === "available" || status === "cleaning" ? undefined : patientId,
              patientName: status === "available" || status === "cleaning" ? undefined : patientName,
              patientAge: status === "available" || status === "cleaning" ? undefined : patientClassification.age ?? (Number(patientAge) || undefined),
              patientGender: status === "available" || status === "cleaning" ? undefined : patientClassification.gender,
              diagnosis: status === "available" || status === "cleaning" ? undefined : diagnosis,
              risk: status === "available" || status === "cleaning" ? undefined : risk,
              lastVitals: status === "available" || status === "cleaning" ? undefined : bed.lastVitals ?? "Vitals pending",
            }
          : bed,
      ),
    );
    showToast(`${selectedBed?.bedNo ?? "Bed"} updated successfully.`, status === "critical" ? "warning" : "success");
    refreshAndRedirectToMainMenu(800, {
      title: `${selectedBed?.bedNo ?? "Bed"} updated`,
      summary: `${status} | ${patientName || "No patient"} | ${diagnosis || "No diagnosis"}`,
      module: "Ward Management",
    });
  }

  function refreshBedMap() {
    setBeds(createBeds());
    showToast("Bed map refreshed with latest ward availability.", "success");
  }

  function allocateSelectedBed() {
    if (!selectedBed) return;
    const recommendation = recommendWardCategory(policyPatient);
    if (selectedWard.category !== recommendation.category && !overrideApproved) {
      showToast(`${recommendation.label} recommended before allocation. Select a matching ward or approve override.`, "warning");
      return;
    }
    setStatus("occupied");
    setPatientId(patientId || "PAT-NEW");
    setPatientName(patientName || "New admitted patient");
    setDiagnosis(diagnosis || "Admission pending doctor review");
    showToast(`${selectedBed.bedNo} prepared for allocation. Click Update patient to save.`, "info");
  }

  function loadPatientClassification() {
    const classification = getPatientClinicalClassification(patientId || selectedBed?.patientId || "PAT-UNKNOWN", { age: Number(patientAge) || undefined, gender: patientGender });
    setPatientAge(String(classification.age ?? patientAge));
    setPatientGender(classification.gender);
    showToast(`${classification.recommendedWardLabel} recommended from patient/guardian profile.`, classification.dependentCategory === "clinical_review" ? "warning" : "success");
  }

  return (
    <PageTransition>
      <div className="space-y-5">
        <div className="page-hero flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">Inpatient workspace</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Manage wards, beds, and admitted patients</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Choose a male, female, or children ward, select a bed, validate the patient age/gender policy, then update admitted patient details.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={refreshBedMap}><RefreshCw className="h-4 w-4" />Refresh bed map</Button>
            <Button onClick={allocateSelectedBed}><BedDouble className="h-4 w-4" />Allocate bed</Button>
          </div>
        </div>

        <div className="help-strip grid gap-3 p-4 text-sm md:grid-cols-4">
          {["1. Validate age/gender", "2. Pick matching ward", "3. Select bed", "4. Update patient"].map((step) => (
            <div key={step} className="flex items-center gap-2 font-semibold"><UserRoundCheck className="h-4 w-4" />{step}</div>
          ))}
        </div>
        <section className="grid gap-3 md:grid-cols-3">
          {categoryStats.map((item) => (
            <Card key={item.category}>
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold capitalize text-muted-foreground">{item.category} wards</p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">{item.occupied}/{item.total}</p>
                  <p className="text-xs text-muted-foreground">{item.available} beds available</p>
                </div>
                <Badge tone={item.category === "children" ? "info" : item.category === "female" ? "warning" : "success"}>{item.category}</Badge>
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

        <section className="grid gap-4 xl:grid-cols-[300px_1fr]">
          <Card>
            <CardHeader><CardTitle>Hospital wards</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {wards.map((ward) => {
                const wardCount = beds.filter((bed) => bed.wardId === ward.id && bed.status !== "available").length;
                return (
                  <button
                    key={ward.id}
                    className={`interactive-control w-full rounded-md border px-3 py-3 text-left text-sm ${ward.id === selectedWardId ? "border-teal-300 bg-teal-50 text-primary shadow-sm" : "border-border bg-white text-slate-800"}`}
                    onClick={() => pickWard(ward.id)}
                    type="button"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{ward.name}</span>
                      <Badge tone={wardCount > 20 ? "danger" : wardCount > 12 ? "warning" : "success"}>{wardCount}/25 used</Badge>
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">{ward.department} - {ward.nurseLead}</span>
                    <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold capitalize text-slate-700">{ward.category} category</span>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                <span>{selectedWard.name} bed map</span>
                <span className="text-sm font-normal text-muted-foreground">{selectedWard.department} - 25 beds</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="selection-panel mb-4 flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                <div>
                  <p className="font-bold text-slate-950">Selected bed: {selectedBed?.bedNo}</p>
                  <p className="text-muted-foreground">{selectedBed?.patientName ?? "No patient assigned"} | {selectedBed?.diagnosis ?? "Ready for allocation"}</p>
                  {(selectedBed?.patientGender || patientGender) && <div className="mt-2"><GenderBadge value={selectedBed?.patientGender ?? patientGender} /></div>}
                  <p className={`mt-2 text-xs font-bold ${wardPolicy.allowed ? "text-teal-800" : "text-rose-700"}`}>
                    Source: Patient/Guardian profile | {patientClassification.dependentCategory.replaceAll("_", " ")} | {wardPolicy.recommendation.label} | Current ward: {selectedWard.category} | {patientClassification.reason}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["available", "occupied", "critical", "reserved", "cleaning"] as BedStatus[]).map((item) => <Badge key={item} tone={statusTone(item)}>{item}</Badge>)}
                  <span className="inline-flex items-center rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs font-bold text-red-800">red = assigned patient</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-5">
                {wardBeds.map((bed) => (
                  <button
                    key={bed.id}
                    className={`interactive-control min-h-32 rounded-md border p-3 text-left text-sm ${bedCardClass(bed, selectedBedId)}`}
                    onClick={() => pickBed(bed)}
                    type="button"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className={bed.patientId || bed.status === "critical" ? "font-bold text-red-950" : "font-bold text-slate-950"}>{bed.bedNo}</span>
                      <Badge tone={statusTone(bed.status)}>{bed.status}</Badge>
                    </span>
                        <span className={bed.patientId ? "mt-2 block truncate font-bold text-red-950" : "mt-2 block truncate font-medium text-slate-800"}>{bed.patientName ?? "No patient assigned"}</span>
                        {bed.patientId && <span className="mt-1 block"><GenderBadge value={bed.patientGender} compact /></span>}
                        <span className={bed.patientId ? "mt-1 block text-xs font-medium text-red-700" : "mt-1 block text-xs text-muted-foreground"}>{bed.diagnosis ?? "Ready for allocation"}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <SectionReveal>
          <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" />Update patient bed</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="help-strip p-3 text-sm">Use this form for admission, transfer, discharge preparation, or marking a bed for cleaning.</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-sm font-medium">
                    Bed
                    <Input value={selectedBed?.bedNo ?? ""} readOnly />
                  </label>
                  <label className="text-sm font-medium">
                    Bed status
                    <Select value={status} onChange={(event) => setStatus(event.target.value as BedStatus)}>
                      <option value="available">Available</option>
                      <option value="occupied">Occupied</option>
                      <option value="critical">Critical</option>
                      <option value="reserved">Reserved</option>
                      <option value="cleaning">Cleaning</option>
                    </Select>
                  </label>
                  <label className="text-sm font-medium">
                    Patient ID
                    <Input value={patientId} onChange={(event) => setPatientId(event.target.value)} placeholder="PAT-2026-000001" />
                  </label>
                  <label className="text-sm font-medium">
                    Patient name
                    <Input value={patientName} onChange={(event) => setPatientName(event.target.value)} placeholder="Patient full name" />
                  </label>
                  <label className="text-sm font-medium">
                    Age
                    <Input value={patientAge} onChange={(event) => setPatientAge(event.target.value)} placeholder="Age in years" inputMode="numeric" />
                  </label>
                  <label className="text-sm font-medium">
                    Gender
                    <Select value={patientGender} onChange={(event) => setPatientGender(event.target.value as PatientGenderForWard)}>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other / clinical review</option>
                      <option value="unknown">Unknown / emergency</option>
                    </Select>
                  </label>
                  <label className="text-sm font-medium">
                    Diagnosis
                    <Input value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} placeholder="Admission diagnosis" />
                  </label>
                  <label className="text-sm font-medium">
                    Risk flag
                    <Input value={risk} onChange={(event) => setRisk(event.target.value)} placeholder="Stable, fall risk, critical labs" />
                  </label>
                </div>
                <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
                  <input type="checkbox" checked={overrideApproved} onChange={(event) => setOverrideApproved(event.target.checked)} />
                  Authorized clinical override for cross-assignment. Use only when infection control, emergency, or consultant approval requires it.
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={loadPatientClassification}><ShieldAlert className="h-4 w-4" />Load patient rule</Button>
                  <Button onClick={updatePatientBed}><UserRoundCheck className="h-4 w-4" />Update patient</Button>
                  {patientId && <Link className="interactive-control inline-flex h-10 items-center justify-center rounded-md border border-border bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-muted" to={`/patients/${patientId}`}>Open patient profile</Link>}
                </div>
                <p className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-950">
                  In production this update should write to Firestore admissions, beds, patients, and auditLogs through a Cloud Function.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><HeartPulse className="h-5 w-5 text-primary" />Current admitted patients</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <thead><tr><Th>Bed</Th><Th>Patient</Th><Th>Gender</Th><Th>Diagnosis</Th><Th>Risk</Th><Th>Vitals</Th></tr></thead>
                  <tbody>
                    {wardBeds.filter((bed) => bed.patientId).slice(0, 12).map((bed) => (
                      <tr key={bed.id}>
                        <Td className="font-semibold">{bed.bedNo}</Td>
                        <Td>{bed.patientName}<br /><span className="text-xs text-muted-foreground">{bed.patientId}</span></Td>
                        <Td><GenderBadge value={bed.patientGender} /></Td>
                        <Td>{bed.diagnosis}</Td>
                        <Td><Badge tone={bed.status === "critical" ? "danger" : bed.risk?.includes("High") ? "warning" : "info"}>{bed.risk}</Badge></Td>
                        <Td>{bed.lastVitals}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </CardContent>
            </Card>
          </section>
        </SectionReveal>
      </div>
    </PageTransition>
  );
}
