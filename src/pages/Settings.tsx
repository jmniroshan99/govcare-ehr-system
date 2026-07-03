import { Building2, ChevronRight, ClipboardList, DoorOpen, HeartPulse, Hospital, Layers3, Save, Settings as SettingsIcon, ShieldCheck, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Select } from "../components/ui/select";
import { useToast } from "../components/ui/toast-context";

interface HospitalUnit {
  name: string;
  children?: string[];
  tone: "info" | "success" | "warning" | "danger" | "neutral";
}

const sriLankaHospitalStructure: HospitalUnit[] = [
  { name: "Administration", tone: "danger", children: ["Hospital Director", "Medical Superintendent", "Deputy Director", "Administrative Officers"] },
  { name: "OPD (Out Patient Department)", tone: "info" },
  { name: "Emergency Treatment Unit (ETU)", tone: "danger" },
  { name: "Clinics", tone: "success", children: ["Medical Clinic", "Surgical Clinic", "Pediatric Clinic", "Gynecology Clinic", "ENT Clinic", "Eye Clinic", "Cardiology Clinic"] },
  { name: "Inward / Wards", tone: "warning", children: ["Medical Ward", "Surgical Ward", "Pediatric Ward", "Obstetrics Ward", "ICU", "HDU", "Isolation Ward"] },
  { name: "Operating Theatre Complex", tone: "danger" },
  { name: "Laboratory Services", tone: "info", children: ["Hematology", "Biochemistry", "Microbiology", "Histopathology"] },
  { name: "Radiology Department", tone: "info", children: ["X-Ray", "Ultrasound", "CT Scan", "MRI", "ECG"] },
  { name: "Pharmacy Department", tone: "success" },
  { name: "Blood Bank", tone: "danger" },
  { name: "Dental Unit", tone: "neutral" },
  { name: "Physiotherapy Unit", tone: "neutral" },
  { name: "Medical Records Unit", tone: "warning" },
  { name: "Public Health Unit", tone: "success" },
  { name: "Mortuary", tone: "neutral" },
  { name: "Finance Department", tone: "warning" },
  { name: "Human Resources Department", tone: "warning" },
  { name: "Inventory and Stores", tone: "warning" },
  { name: "ICT Unit", tone: "info" },
];

const setupCards = [
  ["Departments", "Create department documents for OPD, ETU, clinics, wards, lab, radiology, pharmacy, and support units.", Building2, "info" as const],
  ["Ward and bed map", "Map Medical, Surgical, Pediatric, Obstetrics, ICU, HDU, and Isolation wards to beds.", DoorOpen, "warning" as const],
  ["Staff assignment", "Assign directors, medical superintendent, administrators, doctors, nurses, technicians, and officers.", UsersRound, "success" as const],
  ["Role permissions", "Connect each unit to Firebase custom claims and least-privilege route access.", ShieldCheck, "danger" as const],
  ["Service workflows", "Link OPD, ETU, clinics, diagnostics, pharmacy, records, finance, stores, and ICT workflows.", ClipboardList, "info" as const],
  ["Hospital settings", "Store unit metadata, opening hours, queue rules, report templates, audit retention, and notifications.", SettingsIcon, "neutral" as const],
];

const healthcareCenters = [
  ["National Hospital Colombo", "Hospital", "hosp-colombo-national", "Full clinical modules", "active"],
  ["District General Hospital Gampaha", "Hospital", "hosp-gampaha-dgh", "OPD, wards, lab, pharmacy", "active"],
  ["Kandy Central Clinic", "Clinic", "clinic-kandy-central", "Clinic visits and referrals", "active"],
  ["Regional Diagnostic Lab", "Laboratory", "lab-western-regional", "Authorized lab result sharing", "restricted"],
  ["Government Pharmacy Hub", "Pharmacy", "pharm-colombo-hub", "Prescription dispensing network", "active"],
];

const branchPolicies = [
  ["Tenant isolation", "Every record stores hospitalId/centerId and Firestore rules restrict cross-centre reads by default."],
  ["Separate dashboards", "Each hospital, clinic, lab, and pharmacy can load its own dashboard counters, queues, and reports."],
  ["Authorized sharing", "Referral, lab, radiology, and prescription sharing requires role permission, patient scope, and audit logs."],
  ["Role-based staff access", "Doctors, lab technicians, pharmacists, and admins receive only the modules allowed for their center."],
];

export function Settings() {
  const { showToast } = useToast();
  const [selectedUnit, setSelectedUnit] = useState("Inward / Wards");
  const activeUnit = sriLankaHospitalStructure.find((unit) => unit.name === selectedUnit) ?? sriLankaHospitalStructure[0];
  const totalSubUnits = useMemo(() => sriLankaHospitalStructure.reduce((count, unit) => count + (unit.children?.length ?? 0), 0), []);

  function saveStructure() {
    showToast("Sri Lanka hospital structure saved as the default setup template.", "success");
  }

  function applyHospitalTemplate() {
    setSelectedUnit("Administration");
    showToast("Sri Lanka government hospital template loaded.", "success");
  }

  return (
    <div className="space-y-5">
      <div className="page-hero flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">Hospital settings</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Sri Lanka government hospital structure</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Administration, OPD, ETU, clinics, wards, theatre, diagnostics, pharmacy, blood bank, support units, finance, HR, stores, and ICT mapped for GovCare EHR setup.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={applyHospitalTemplate}><Hospital className="h-4 w-4" />Hospital template</Button>
          <Button onClick={saveStructure}><Save className="h-4 w-4" />Save structure</Button>
        </div>
      </div>

      <div className="help-strip grid gap-3 p-4 text-sm md:grid-cols-4">
        <div className="flex items-center gap-2 font-semibold"><Hospital className="h-4 w-4" />{sriLankaHospitalStructure.length} main units</div>
        <div className="flex items-center gap-2 font-semibold"><Layers3 className="h-4 w-4" />{totalSubUnits} sub-units</div>
        <div className="flex items-center gap-2 font-semibold"><HeartPulse className="h-4 w-4" />Clinical and support services</div>
        <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" />Role-based access ready</div>
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" />Healthcare centers and branches</span>
              <Badge tone="success">multi-centre ready</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {healthcareCenters.map(([name, type, centerId, scope, status]) => (
              <div key={centerId} className="rounded-md border border-border bg-white px-3 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-950">{name}</p>
                    <p className="text-xs text-muted-foreground">{centerId} | {type}</p>
                  </div>
                  <Badge tone={status === "restricted" ? "warning" : "success"}>{status}</Badge>
                </div>
                <p className="mt-2 text-muted-foreground">{scope}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Branch access policies</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {branchPolicies.map(([title, detail]) => (
              <div key={title} className="rounded-md border border-border bg-white p-3 text-sm">
                <p className="font-bold text-slate-950">{title}</p>
                <p className="mt-1 text-muted-foreground">{detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Hospital className="h-5 w-5 text-primary" />Hospital tree</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-3 text-sm font-bold text-teal-950">Hospital</div>
            {sriLankaHospitalStructure.map((unit) => (
              <button
                key={unit.name}
                className={`interactive-control w-full rounded-md border px-3 py-3 text-left text-sm ${unit.name === selectedUnit ? "border-teal-300 bg-teal-50 text-primary shadow-sm" : "border-border bg-white text-slate-800"}`}
                onClick={() => setSelectedUnit(unit.name)}
                type="button"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{unit.name}</span>
                  <Badge tone={unit.tone}>{unit.children?.length ?? 1}</Badge>
                </span>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" />Selected unit</span>
                <Badge tone={activeUnit.tone}>{activeUnit.name}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="block text-sm font-medium">
                Choose hospital unit
                <Select value={selectedUnit} onChange={(event) => setSelectedUnit(event.target.value)}>
                  {sriLankaHospitalStructure.map((unit) => <option key={unit.name}>{unit.name}</option>)}
                </Select>
              </label>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(activeUnit.children ?? [activeUnit.name]).map((child) => (
                  <div key={child} className="rounded-md border border-border bg-white p-4 text-sm shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-slate-950">{child}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Create as `departments` document with hospitalId, status, leadRole, queueEnabled, and serviceType.</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {setupCards.map(([title, description, Icon, tone]) => (
              <Card key={title as string}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    {title as string}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{description as string}</p>
                  <Badge tone={tone as "info" | "success" | "warning" | "danger" | "neutral"}>setup ready</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
