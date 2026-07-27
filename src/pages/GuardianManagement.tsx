import { Baby, CalendarDays, FileText, QrCode, ShieldCheck, UsersRound } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { SmartSearch } from "../components/search/SmartSearch";
import { useToast } from "../components/ui/toast-context";
import { PatientCodeScanner } from "../components/patient/PatientCodeScanner";
import { getDependentsForGuardian, getGuardianDependentLinks, getGuardianProfiles, getPatientClinicalClassification, syncGuardianPatientClassification } from "../utils/patientRegistry";

export function GuardianManagement() {
  const [query, setQuery] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const { showToast } = useToast();
  const guardians = getGuardianProfiles();
  const guardianLinks = getGuardianDependentLinks();
  const filtered = guardians.filter((guardian) => {
    const haystack = [guardian.guardianId, guardian.nic, guardian.fullName, guardian.phone, guardian.email].join(" ").toLowerCase();
    return !query || haystack.includes(query.toLowerCase());
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Guardian management</h1>
          <p className="text-sm text-muted-foreground">One guardian or parent can securely manage multiple children/dependents without duplicate patient records.</p>
        </div>
        <Link className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white hover:bg-teal-800" to="/patients/register"><Baby className="h-4 w-4" />Register child</Link>
      </div>

      <Card>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_auto]">
          <SmartSearch value={query} onChange={setQuery} placeholder="Search guardian ID, NIC, name, phone, or email" scope="guardians" />
          <Button type="button" variant="outline" onClick={() => setScannerOpen(true)}><QrCode className="h-4 w-4" />Scan guardian QR</Button>
        </CardContent>
      </Card>

      <PatientCodeScanner
        open={scannerOpen}
        mode="qr"
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => {
          setQuery(code);
          setScannerOpen(false);
          showToast(`Guardian QR detected: ${code}`, "success");
        }}
      />

      <section className="grid gap-4 xl:grid-cols-2">
        {filtered.map((guardian) => {
          const dependents = getDependentsForGuardian(guardian.guardianId);
          const activeLinks = guardianLinks.filter((link) => link.guardianId === guardian.guardianId && link.status === "active");
          return (
            <Card key={guardian.guardianId}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-primary" />{guardian.fullName}</span>
                  <Badge tone="info">{guardian.relationshipToPatient}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-md border border-border bg-card p-3"><p className="text-muted-foreground">Guardian ID</p><p className="font-bold text-foreground">{guardian.guardianId}</p></div>
                  <div className="rounded-md border border-border bg-card p-3"><p className="text-muted-foreground">NIC</p><p className="font-bold text-foreground">{guardian.nic}</p></div>
                  <div className="rounded-md border border-border bg-card p-3"><p className="text-muted-foreground">Phone</p><p className="font-bold text-foreground">{guardian.phone}</p></div>
                  <div className="rounded-md border border-border bg-card p-3"><p className="text-muted-foreground">Dependents</p><p className="font-bold text-foreground">{dependents.length}</p></div>
                </div>
                <div className="rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-50">
                  <div className="flex items-center gap-2 font-bold"><ShieldCheck className="h-4 w-4" />Family record privacy</div>
                  <p className="mt-1">Guardian access should show released child records only. Patient classification from this guardian link drives OPD, emergency, admission, and ward recommendations. Active secure links: {activeLinks.length}.</p>
                </div>
                <div className="space-y-2">
                  {dependents.length ? dependents.map((patient) => {
                    if (!patient) return null;
                    const classification = getPatientClinicalClassification(patient.patientId, { age: patient.age, gender: patient.sex, guardianId: guardian.guardianId });
                    return (
                      <div key={patient.patientId} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-3">
                        <div>
                          <p className="font-semibold text-foreground">{patient.name}</p>
                          <p className="text-xs text-muted-foreground">{patient.patientId} | {patient.birthCertificateNo || patient.nicOrPassport || "No identifier"} | age {patient.age ?? "not set"}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge tone={classification.dependentCategory === "child_under_guardian" ? "info" : classification.dependentCategory === "adult_female" ? "warning" : "success"}>{classification.dependentCategory.replaceAll("_", " ")}</Badge>
                            <Badge tone="neutral">{classification.recommendedWardLabel}</Badge>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" className="h-9 min-h-9 px-3 text-xs" onClick={() => {
                            syncGuardianPatientClassification(patient.patientId, guardian.guardianId);
                            showToast(`Classification refreshed for ${patient.name}.`, "success");
                          }}>Refresh rule</Button>
                          <Link className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-muted dark:bg-slate-900 dark:text-slate-50" to={`/patients/${patient.patientId}`}><FileText className="h-3.5 w-3.5" />Profile</Link>
                          <Link className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-muted dark:bg-slate-900 dark:text-slate-50" to="/portal/appointments"><CalendarDays className="h-3.5 w-3.5" />Appointment</Link>
                        </div>
                      </div>
                    );
                  }) : <p className="text-sm text-muted-foreground">No linked dependents yet.</p>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
