import {
  Activity,
  AlertTriangle,
  Ambulance,
  BedDouble,
  BellRing,
  ClipboardList,
  Droplets,
  FlaskConical,
  HeartPulse,
  MapPin,
  MessageSquareText,
  Pill,
  Radio,
  ShieldAlert,
  Siren,
  Stethoscope,
  Timer,
  UsersRound,
  Video,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageTransition, Reveal, SectionReveal, Stagger } from "../components/motion/PageTransition";
import { GenderBadge } from "../components/patient/GenderBadge";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { SmartSearch } from "../components/search/SmartSearch";
import { Select } from "../components/ui/select";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";

type TriageLevel = "Resuscitation" | "Emergency" | "Urgent" | "Semi-urgent" | "Non-urgent";
type EDStatus = "waiting" | "triage" | "resus" | "treatment" | "investigations" | "admission" | "icu-transfer" | "discharge";
type Pathway = "Code Blue" | "Trauma" | "Stroke" | "Cardiac" | "Sepsis" | "Disaster" | "General";

interface EDCase {
  id: string;
  patientId: string;
  patientName: string;
  age: string;
  arrival: string;
  triage: TriageLevel;
  pathway: Pathway;
  status: EDStatus;
  vitals: string;
  risk: number;
  allergies: string;
  meds: string;
  bed: string;
  alerts: string[];
}

const initialCases: EDCase[] = [
  { id: "ED-2026-032", patientId: "PAT-2026-000233", patientName: "R. Kumar", age: "58M", arrival: "Ambulance A12", triage: "Resuscitation", pathway: "Cardiac", status: "resus", vitals: "BP 88/54, HR 132, SpO2 91%", risk: 94, allergies: "None known", meds: "Aspirin at home", bed: "Resus 01", alerts: ["Hypotension", "Critical troponin", "ICU review"] },
  { id: "ED-2026-033", patientId: "PAT-2026-000301", patientName: "K. Thevarajah", age: "44M", arrival: "Walk-in", triage: "Emergency", pathway: "Trauma", status: "investigations", vitals: "BP 142/90, HR 104, GCS 15", risk: 78, allergies: "Penicillin", meds: "Metformin", bed: "Trauma 02", alerts: ["Fall injury", "X-ray pending"] },
  { id: "ED-2026-034", patientId: "PAT-2026-000142", patientName: "Fathima Rizna", age: "33F", arrival: "OPD referral", triage: "Urgent", pathway: "Sepsis", status: "treatment", vitals: "Temp 39.1, HR 118, BP 104/70", risk: 82, allergies: "No known allergy", meds: "Iron, folate", bed: "ED Bay 04", alerts: ["Pregnancy", "Sepsis screen positive"] },
  { id: "ED-2026-035", patientId: "PAT-2026-000525", patientName: "M. Ahamed", age: "67M", arrival: "Ambulance B04", triage: "Emergency", pathway: "Stroke", status: "triage", vitals: "BP 176/96, FAST positive", risk: 88, allergies: "Sulfa", meds: "Warfarin", bed: "Stroke Bay", alerts: ["CT brain STAT", "Thrombolysis window"] },
  { id: "ED-2026-036", patientId: "PAT-2026-000412", patientName: "Sahan Perera", age: "8M", arrival: "Parent", triage: "Semi-urgent", pathway: "General", status: "waiting", vitals: "SpO2 96%, RR 26", risk: 42, allergies: "Dust", meds: "Salbutamol", bed: "Waiting", alerts: ["Paediatric asthma"] },
];

const ambulances = [
  ["A12", "3 min", "Chest pain, unstable vitals", "GPS 6.9271, 79.8612"],
  ["B04", "7 min", "FAST positive stroke alert", "GPS 6.9147, 79.9729"],
  ["C02", "12 min", "Road traffic trauma, 2 patients", "GPS 6.9000, 79.8750"],
];

const serviceStatus = [
  ["Laboratory", "Troponin STAT", "processing", FlaskConical],
  ["Radiology", "CT brain", "room ready", Radio],
  ["Pharmacy", "Emergency meds", "preparing", Pill],
  ["Blood bank", "O negative pack", "reserved", Droplets],
  ["ICU", "Bed request", "1 bed available", BedDouble],
  ["Operating theater", "Trauma standby", "notified", Stethoscope],
];

const flow = [
  { hour: "08", arrivals: 18, critical: 3, admissions: 2 },
  { hour: "10", arrivals: 31, critical: 6, admissions: 5 },
  { hour: "12", arrivals: 44, critical: 9, admissions: 8 },
  { hour: "14", arrivals: 39, critical: 7, admissions: 6 },
  { hour: "16", arrivals: 28, critical: 4, admissions: 3 },
];

function triageTone(level: TriageLevel) {
  if (level === "Resuscitation") return "danger";
  if (level === "Emergency" || level === "Urgent") return "warning";
  return "info";
}

function pathwayTone(pathway: Pathway) {
  if (pathway === "Code Blue" || pathway === "Trauma" || pathway === "Stroke" || pathway === "Cardiac" || pathway === "Sepsis") return "danger";
  if (pathway === "Disaster") return "warning";
  return "info";
}

function genderFromAgeCode(age: string) {
  if (age.toUpperCase().endsWith("F")) return "Female";
  if (age.toUpperCase().endsWith("M")) return "Male";
  return "Not recorded";
}

export function EmergencyManagement() {
  const { showToast } = useToast();
  const [cases, setCases] = useState(initialCases);
  const [selectedId, setSelectedId] = useState(initialCases[0].id);
  const [triageFilter, setTriageFilter] = useState<"all" | TriageLevel>("all");
  const [search, setSearch] = useState("");
  const selected = cases.find((item) => item.id === selectedId) ?? cases[0];

  const visibleCases = useMemo(() => {
    const query = search.toLowerCase();
    return cases.filter((item) => {
      const matchesSearch = [item.id, item.patientId, item.patientName, item.pathway, item.arrival].some((value) => value.toLowerCase().includes(query));
      return matchesSearch && (triageFilter === "all" || item.triage === triageFilter);
    });
  }, [cases, search, triageFilter]);

  const summaryStats = [
    { label: "Waiting patients", value: cases.filter((item) => item.status === "waiting" || item.status === "triage").length, icon: UsersRound, tone: "info" as const },
    { label: "Critical patients", value: cases.filter((item) => item.risk >= 80).length, icon: ShieldAlert, tone: "danger" as const },
    { label: "Available ED beds", value: "6", icon: BedDouble, tone: "success" as const },
    { label: "Ambulance arrivals", value: ambulances.length, icon: Ambulance, tone: "warning" as const },
  ];

  function updateSelected(status: EDStatus) {
    setCases((current) => current.map((item) => item.id === selectedId ? { ...item, status } : item));
    showToast(`${selected.patientName} status updated to ${status}.`, status === "icu-transfer" ? "warning" : "success");
  }

  function activatePathway(pathway: Pathway) {
    setCases((current) => current.map((item) => item.id === selectedId ? { ...item, pathway, triage: pathway === "Code Blue" ? "Resuscitation" : item.triage } : item));
    showToast(`${pathway} activated. Teams notified by priority channel.`, pathway === "General" ? "info" : "danger");
  }

  function oneClick(label: string, tone: "success" | "warning" | "danger" | "info" = "info") {
    showToast(`${label} requested for ${selected.patientName}.`, tone);
  }

  return (
    <PageTransition>
      <div className="space-y-5">
        <div className="page-hero flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">Emergency Department Command</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Live emergency care coordination</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Triage, ambulance pre-arrival, critical pathways, investigations, medication, blood, bed requests, ICU transfer, and team communication in one low-latency ED workspace.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" onClick={() => activatePathway("Code Blue")}><Siren className="h-4 w-4" />Code Blue</Button>
            <Button variant="outline" onClick={() => activatePathway("Trauma")}><AlertTriangle className="h-4 w-4" />Trauma alert</Button>
            <Button onClick={() => updateSelected("icu-transfer")}><BedDouble className="h-4 w-4" />ICU transfer</Button>
          </div>
        </div>

        <div className="help-strip grid gap-3 p-4 text-sm md:grid-cols-4">
          {["Real-time ED queue", "Auto-notify care teams", "One-click urgent services", "Audit every emergency action"].map((item) => (
            <div key={item} className="flex items-center gap-2 font-semibold"><BellRing className="h-4 w-4" />{item}</div>
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

        <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" />Live triage board</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="selection-panel grid gap-2 p-3 text-sm md:grid-cols-[1fr_auto_auto]">
                <div>
                  <p className="font-bold text-slate-950">Selected: {selected.patientName} - {selected.pathway}</p>
                  <p className="text-muted-foreground">{selected.id} | {selected.patientId} | {selected.vitals} | {selected.bed}</p>
                </div>
                <Badge tone={triageTone(selected.triage)}>{selected.triage}</Badge>
                <Badge tone={selected.risk >= 80 ? "danger" : selected.risk >= 60 ? "warning" : "success"}>Risk {selected.risk}</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_190px]">
                <SmartSearch value={search} onChange={setSearch} placeholder="Search patient, ED case, pathway, ambulance" scope="clinical" />
                <Select value={triageFilter} onChange={(event) => setTriageFilter(event.target.value as "all" | TriageLevel)}>
                  <option value="all">All triage</option>
                  <option value="Resuscitation">Resuscitation</option>
                  <option value="Emergency">Emergency</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Semi-urgent">Semi-urgent</option>
                  <option value="Non-urgent">Non-urgent</option>
                </Select>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <thead><tr><Th>Case</Th><Th>Patient</Th><Th>Gender</Th><Th>Triage</Th><Th>Pathway</Th><Th>Status</Th><Th>Risk</Th></tr></thead>
                  <tbody>
                    {visibleCases.map((item) => (
                      <tr key={item.id} onClick={() => setSelectedId(item.id)} className={item.id === selectedId ? "cursor-pointer bg-teal-50" : "cursor-pointer"}>
                        <Td className="font-semibold">{item.id}<br /><span className="text-xs text-muted-foreground">{item.arrival}</span></Td>
                        <Td>{item.patientName}<br /><span className="text-xs text-muted-foreground">{item.age} | {item.patientId}</span></Td>
                        <Td><GenderBadge value={genderFromAgeCode(item.age)} compact /></Td>
                        <Td><Badge tone={triageTone(item.triage)}>{item.triage}</Badge></Td>
                        <Td><Badge tone={pathwayTone(item.pathway)}>{item.pathway}</Badge></Td>
                        <Td>{item.status}</Td>
                        <Td><Badge tone={item.risk >= 80 ? "danger" : item.risk >= 60 ? "warning" : "success"}>{item.risk}</Badge></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Ambulance className="h-5 w-5 text-primary" />Ambulance pre-arrivals</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {ambulances.map(([unit, eta, handover, gps]) => (
                <div key={unit} className="rounded-md border border-border bg-white px-3 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-slate-950">Ambulance {unit}</p>
                    <Badge tone={eta === "3 min" ? "danger" : "warning"}>{eta}</Badge>
                  </div>
                  <p className="text-muted-foreground">{handover}</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{gps}</p>
                </div>
              ))}
              <Button className="w-full" variant="outline" onClick={() => oneClick("Digital ambulance handover", "warning")}><Ambulance className="h-4 w-4" />Open handover form</Button>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><HeartPulse className="h-5 w-5 text-primary" />Patient snapshot</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="selection-panel p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-slate-950">{selected.patientName}</p>
                  <GenderBadge value={genderFromAgeCode(selected.age)} />
                </div>
                <p className="text-muted-foreground">{selected.vitals}</p>
              </div>
              <Snapshot label="Allergies" value={selected.allergies} tone={selected.allergies.includes("None") ? "success" : "danger"} />
              <Snapshot label="Current meds" value={selected.meds} tone="info" />
              <Snapshot label="Chronic disease" value="Diabetes / hypertension risk available from EHR" tone="warning" />
              <Snapshot label="Previous admissions" value="1 admission, discharged stable" tone="neutral" />
              <Snapshot label="Recent results" value="Troponin critical, CT pending, FBC pending" tone="danger" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Timer className="h-5 w-5 text-primary" />One-click emergency services</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              <Button variant="outline" onClick={() => oneClick("STAT laboratory panel", "warning")}><FlaskConical className="h-4 w-4" />Emergency labs</Button>
              <Button variant="outline" onClick={() => oneClick("Urgent imaging", "warning")}><Radio className="h-4 w-4" />Urgent imaging</Button>
              <Button variant="outline" onClick={() => oneClick("Emergency medication dispense", "info")}><Pill className="h-4 w-4" />Emergency meds</Button>
              <Button variant="outline" onClick={() => oneClick("Blood bank pack", "danger")}><Droplets className="h-4 w-4" />Blood request</Button>
              <Button variant="outline" onClick={() => updateSelected("admission")}><BedDouble className="h-4 w-4" />Admit now</Button>
              <Button variant="outline" onClick={() => oneClick("Operating theater standby", "danger")}><Stethoscope className="h-4 w-4" />Theater standby</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquareText className="h-5 w-5 text-primary" />Emergency communication</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2">
                <Button variant="outline" onClick={() => oneClick("Secure ED team message", "info")}><MessageSquareText className="h-4 w-4" />Secure message</Button>
                <Button variant="outline" onClick={() => oneClick("Voice call to consultant", "warning")}><BellRing className="h-4 w-4" />Voice call</Button>
                <Button variant="outline" onClick={() => oneClick("Video consult", "info")}><Video className="h-4 w-4" />Video consult</Button>
              </div>
              <p className="help-strip p-3 text-sm">Priority notifications are designed for PostgreSQL API Cloud Messaging with audit logs for every alert, call, message, and escalation.</p>
            </CardContent>
          </Card>
        </section>

        <SectionReveal>
          <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />Protocol activation</CardTitle></CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {(["Code Blue", "Trauma", "Stroke", "Cardiac", "Sepsis", "Disaster"] as Pathway[]).map((pathway) => (
                  <Button key={pathway} variant={pathway === "Code Blue" ? "destructive" : "outline"} onClick={() => activatePathway(pathway)}>
                    <Siren className="h-4 w-4" />{pathway}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-primary" />AI-ready deterioration monitoring</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {selected.alerts.map((alert) => (
                  <div key={alert} className="clinical-alert-pulse rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-950">{alert}</div>
                ))}
                <div className="grid gap-2 md:grid-cols-3">
                  <Badge tone="danger">Risk score {selected.risk}</Badge>
                  <Badge tone="warning">Abnormal vitals detection</Badge>
                  <Badge tone="info">Specialist escalation ready</Badge>
                </div>
              </CardContent>
            </Card>
          </section>
        </SectionReveal>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader><CardTitle>ED flow analytics</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={flow}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="arrivals" stroke="#0f766e" fill="#99f6e4" />
                  <Area type="monotone" dataKey="critical" stroke="#be123c" fill="#fecdd3" />
                  <Area type="monotone" dataKey="admissions" stroke="#155e75" fill="#a5f3fc" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" />Service status tracking</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {serviceStatus.map(([service, request, status, Icon]) => (
                <div key={`${service}-${request}`} className="rounded-md border border-border bg-white px-3 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-2 font-bold text-slate-950"><Icon className="h-4 w-4 text-primary" />{service as string}</p>
                    <Badge tone={(status as string).includes("ready") || (status as string).includes("available") ? "success" : "warning"}>{status as string}</Badge>
                  </div>
                  <p className="text-muted-foreground">{request as string}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader><CardTitle>Security, performance, and offline resilience</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-3">
            <p className="help-strip p-3">Low-latency ED queues should use PostgreSQL API refreshs only for critical cases, ambulance arrivals, and bed availability, with React Query for cached lists.</p>
            <p className="help-strip p-3">Spring Boot services should validate code activations, blood requests, ICU transfers, and notifications before writing hospital records.</p>
            <p className="help-strip p-3">MFA, API request validation, AES-256 encrypted sensitive fields, role claims, and immutable audit logs protect emergency data access.</p>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}

function Snapshot({ label, value, tone }: { label: string; value: string; tone: "neutral" | "success" | "warning" | "danger" | "info" }) {
  return (
    <div className="rounded-md border border-border bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-slate-950">{label}</p>
        <Badge tone={tone}>{tone}</Badge>
      </div>
      <p className="text-muted-foreground">{value}</p>
    </div>
  );
}

