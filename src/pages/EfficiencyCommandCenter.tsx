import { Activity, AlertTriangle, ArrowRight, BedDouble, ClipboardCheck, Database, FileText, HeartPulse, Search, ShieldCheck, UsersRound } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, Td, Th } from "../components/ui/table";
import { cn } from "../lib/utils";

const upgrades = [
  {
    name: "Patient Master Index",
    purpose: "Prevent duplicate patient records and wrong-patient care.",
    workflow: "Checks NIC, passport, birth certificate, guardian link, phone, date of birth, QR ID, and fuzzy name matches before registration.",
    impact: "Reduces duplicate registrations, repeated tests, and patient identification risk.",
    implementation: "Use indexed PostgreSQL search fields in patients and guardians. Run final duplicate validation in the REST API transaction.",
    icon: Search,
    priority: "Critical",
    route: "/patients/search",
  },
  {
    name: "Clinical Safety Alerts",
    purpose: "Warn clinical staff before unsafe decisions are saved.",
    workflow: "Displays allergy, drug interaction, abnormal vitals, pregnancy, pediatric dose, renal/liver warning, duplicate medicine, and critical lab alerts inside consultation and pharmacy workflows.",
    impact: "Reduces medication errors and prevents missed high-risk conditions.",
    implementation: "Store alert rules in clinicalRules. Evaluate sensitive actions through callable backend API jobs and write immutable audit logs.",
    icon: AlertTriangle,
    priority: "Critical",
    route: "/doctor/workspace",
  },
  {
    name: "AI-Ready Clinical Summary",
    purpose: "Give doctors a fast patient snapshot before consultation.",
    workflow: "Combines visits, diagnoses, allergies, vitals, prescriptions, lab results, radiology reports, admissions, and care plans into a structured summary.",
    impact: "Cuts patient review time and improves continuity of care.",
    implementation: "Maintain patientSummaries documents updated by backend API jobs when clinical records change.",
    icon: HeartPulse,
    priority: "High",
    route: "/portal/care-summary",
  },
  {
    name: "Real-Time Bed Management Map",
    purpose: "Improve admissions, transfers, ICU/HDU allocation, and discharge planning.",
    workflow: "Shows ward, room, and bed states such as available, occupied, reserved, cleaning, isolation, ICU, HDU, and discharge-ready.",
    impact: "Speeds up admission decisions and reduces phone calls between units.",
    implementation: "Use wards and beds collections with real-time listeners only on active bed status dashboards.",
    icon: BedDouble,
    priority: "Critical",
    route: "/wards",
  },
  {
    name: "Discharge Planning Dashboard",
    purpose: "Coordinate discharge tasks across doctors, nurses, pharmacy, lab, radiology, and records.",
    workflow: "Tracks summary, medicine, pending reports, nursing checklist, follow-up, transport, certificates, and service records.",
    impact: "Reduces discharge delays and bed blocking.",
    implementation: "Use dischargePlans and task documents with role-based assignment and notification triggers.",
    icon: ClipboardCheck,
    priority: "High",
    route: "/admissions",
  },
  {
    name: "Hospital Command Center",
    purpose: "Give administrators a live hospital pressure view.",
    workflow: "Aggregates OPD load, ETU pressure, bed occupancy, pharmacy stock, lab backlog, radiology queue, critical alerts, and staff coverage.",
    impact: "Improves daily management decisions and escalation speed.",
    implementation: "Write aggregated commandCenterStats via scheduled and trigger-based backend API jobs.",
    icon: Activity,
    priority: "High",
    route: "/",
  },
  {
    name: "Digital Consent System",
    purpose: "Secure patient or guardian consent for procedures and data sharing.",
    workflow: "Captures signed admission, surgery, telemedicine, procedure, and data-sharing consent with QR verification.",
    impact: "Reduces paperwork and improves legal readiness.",
    implementation: "Use consents collection, PostgreSQL API Storage for signed files, and audit every view/sign/download event.",
    icon: FileText,
    priority: "High",
    route: "/operation-theatre",
  },
  {
    name: "Patient Family Account",
    purpose: "Allow one guardian to manage children and dependents safely.",
    workflow: "Links guardian records to dependent patients for appointments, vaccination, prescriptions, reports, and notifications.",
    impact: "Makes pediatric and family care easier while keeping record isolation.",
    implementation: "Use guardians and guardianPatients mapping with strict PostgreSQL rules for linked patient access only.",
    icon: UsersRound,
    priority: "High",
    route: "/guardians",
  },
  {
    name: "Audit and Compliance Dashboard",
    purpose: "Track privacy, legal, and security activity.",
    workflow: "Shows patient record views, edits, downloads, exports, failed logins, role changes, report approvals, and suspicious access.",
    impact: "Improves accountability and reduces unauthorized access risk.",
    implementation: "Make auditLogs append-only. Admin dashboards query indexed audit summaries with export controls.",
    icon: ShieldCheck,
    priority: "Critical",
    route: "/audit-logs",
  },
  {
    name: "Data Export and Backup",
    purpose: "Protect hospital continuity and reporting needs.",
    workflow: "Supports scheduled backups, role-restricted exports, PDF/CSV reports, and recovery readiness.",
    impact: "Reduces data loss risk and speeds official reporting.",
    implementation: "Use scheduled backend API jobs, Storage backup buckets, export audit logs, and admin-only actions.",
    icon: Database,
    priority: "High",
    route: "/reports",
  },
];

const topFive = [
  "Patient Master Index",
  "Clinical Safety Alerts",
  "Real-Time Bed Management Map",
  "Discharge Planning Dashboard",
  "Hospital Command Center",
];

const statusRows = [
  ["Duplicate prevention", "patients, guardians, patientIdentifiers", "PostgreSQL API validation", "Ready to implement"],
  ["Safety alerts", "clinicalRules, prescriptions, labResults", "Sensitive-write checks", "High priority"],
  ["Bed map", "wards, beds, admissions", "Real-time bed listeners", "High impact"],
  ["Discharge planning", "dischargePlans, tasks, notifications", "Role task automation", "High impact"],
  ["Command center", "commandCenterStats, auditLogs", "Aggregated dashboards", "Admin priority"],
];

function priorityTone(priority: string) {
  return priority === "Critical" ? "danger" : "warning";
}

export function EfficiencyCommandCenter() {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="overflow-hidden rounded-lg border border-teal-200 bg-gradient-to-br from-teal-900 via-emerald-800 to-slate-950 p-6 text-white shadow-xl"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <Badge tone="success">Efficiency Upgrade Plan</Badge>
            <h1 className="mt-4 text-3xl font-bold tracking-normal text-white">GovCare hospital efficiency command center</h1>
            <p className="mt-3 text-sm leading-6 text-teal-50">
              A practical upgrade map for faster clinical decisions, safer patient identification, fewer manual steps, and scalable PostgreSQL API-backed hospital operations.
            </p>
          </div>
          <div className="grid min-w-56 gap-2 rounded-md border border-white/20 bg-white/10 p-4 text-sm backdrop-blur">
            <span className="font-semibold text-teal-50">Top priority</span>
            <span className="text-2xl font-bold text-white">5 critical upgrades</span>
            <span className="text-teal-100">Patient safety, bed flow, discharge speed, and command visibility.</span>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-5">
        {topFive.map((item, index) => (
          <Card key={item} className="border-teal-200 bg-white dark:border-teal-900 dark:bg-slate-950">
            <CardContent className="p-4">
              <p className="text-xs font-bold uppercase text-primary">Rank {index + 1}</p>
              <p className="mt-2 text-sm font-bold text-slate-950 dark:text-slate-50">{item}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {upgrades.map((upgrade, index) => (
          <motion.div
            key={upgrade.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03, duration: 0.25 }}
          >
            <Card className="h-full border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-md bg-teal-50 text-primary dark:bg-teal-950 dark:text-teal-200">
                      <upgrade.icon className="h-5 w-5" />
                    </span>
                    <div>
                      <CardTitle className="text-lg">{upgrade.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{upgrade.purpose}</p>
                    </div>
                  </div>
                  <Badge tone={priorityTone(upgrade.priority)}>{upgrade.priority}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="font-bold text-slate-950 dark:text-slate-50">How it works</p>
                  <p className="mt-1 leading-6 text-muted-foreground">{upgrade.workflow}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-950 dark:text-slate-50">Efficiency gain</p>
                  <p className="mt-1 leading-6 text-muted-foreground">{upgrade.impact}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-950 dark:text-slate-50">Implementation hint</p>
                  <p className="mt-1 leading-6 text-muted-foreground">{upgrade.implementation}</p>
                </div>
                <Link
                  to={upgrade.route}
                  className={cn(
                    "interactive-control mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-muted",
                    "dark:bg-slate-900 dark:text-slate-50 dark:hover:bg-slate-800",
                  )}
                >
                  Open related module <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>PostgreSQL API production structure</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <Th>Capability</Th>
                <Th>Collections</Th>
                <Th>Backend control</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {statusRows.map((row) => (
                <tr key={row[0]}>
                  <Td>{row[0]}</Td>
                  <Td>{row[1]}</Td>
                  <Td>{row[2]}</Td>
                  <Td><Badge tone={row[3].includes("Ready") ? "success" : "warning"}>{row[3]}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
