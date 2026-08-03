import { CalendarDays, Download, FileText, HeartPulse, MessageSquareText, Pill, ShieldCheck, Syringe, UserCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { PageTransition, Reveal, SectionReveal, Stagger } from "../components/motion/PageTransition";
import { useAuthStore } from "../stores/authStore";
import { getDependentsForGuardian, getGuardianProfiles } from "../utils/patientRegistry";
import { fieldPolicy } from "../utils/patientFieldPolicy";
import { useEffect, useState } from "react";
import { useToast } from "../components/ui/toast-context";
import { CLINICAL_INTEGRATION_UPDATED_EVENT, getClinicalIntegrationState, getIntegratedPatientTimeline } from "../services/clinicalIntegrationService";

export function PatientPortal() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const profile = useAuthStore((state) => state.profile);
  const role = useAuthStore((state) => state.role);
  const guardians = getGuardianProfiles();
  const linkedGuardian = guardians.find((guardian) => guardian.dependentPatientIds.includes(profile?.patientId ?? "") || guardian.email === profile?.email || guardian.phone === profile?.phone) ?? guardians[0];
  const linkedDependents = linkedGuardian ? getDependentsForGuardian(linkedGuardian.guardianId) : [];
  const [selectedDependentId, setSelectedDependentId] = useState(linkedDependents[0]?.patientId ?? profile?.patientId ?? "");
  const selectedDependent = linkedDependents.find((patient) => patient?.patientId === selectedDependentId);
  const activePatientId = selectedDependent?.patientId ?? profile?.patientId ?? "";
  const [integrationVersion, setIntegrationVersion] = useState(0);
  const canShow = (field: Parameters<typeof fieldPolicy>[0]) => fieldPolicy(field, role).visible;
  const integrationState = getClinicalIntegrationState();
  const patientTimeline = activePatientId ? getIntegratedPatientTimeline(activePatientId).slice(0, 6) : [];
  const visibleLabResults = integrationState.labOrders.filter((order) => order.patientId === activePatientId && order.releaseStatus === "released");
  const visibleRadiologyResults = integrationState.radiologyOrders.filter((order) => order.patientId === activePatientId && order.releaseStatus === "released");
  const visibleBills = integrationState.billingInvoices.filter((invoice) => invoice.patientId === activePatientId && invoice.releaseStatus === "released");

  useEffect(() => {
    function refreshIntegratedRecords() {
      setIntegrationVersion((current) => current + 1);
    }
    window.addEventListener(CLINICAL_INTEGRATION_UPDATED_EVENT, refreshIntegratedRecords);
    window.addEventListener("storage", refreshIntegratedRecords);
    return () => {
      window.removeEventListener(CLINICAL_INTEGRATION_UPDATED_EVENT, refreshIntegratedRecords);
      window.removeEventListener("storage", refreshIntegratedRecords);
    };
  }, []);

  void integrationVersion;

  return (
    <PageTransition>
    <div className="space-y-5">
      <div className="page-hero">
        <h1 className="text-2xl font-bold">{t("portal.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("portal.welcome", { name: profile?.displayName ?? "Patient" })}</p>
      </div>
      <Stagger>
      <section className="dashboard-grid grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Patient ID", profile?.patientId ?? "Pending hospital match", UserCircle],
          ["Upcoming visits", "2 appointments", CalendarDays],
          ["Reports", "4 available", FileText],
          ["Care status", "Active", HeartPulse],
        ].map(([label, value, Icon]) => (
          <Reveal key={label as string}>
          <Card className="kpi-card">
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label as string}</p>
                <p className="mt-2 text-lg font-bold text-slate-950">{value as string}</p>
              </div>
              <Icon className="h-7 w-7 text-primary" />
            </CardContent>
          </Card>
          </Reveal>
        ))}
      </section>
      </Stagger>
      <SectionReveal>
      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><UserCircle className="h-5 w-5 text-primary" />{t("portal.myProfileDetails")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          {canShow("firstName") && <div className="rounded-md border border-border bg-white p-3 dark:bg-slate-900">
            <p className="text-muted-foreground">{t("portal.name")}</p>
            <p className="mt-1 font-bold text-slate-950 dark:text-slate-50">{profile?.displayName ?? "Patient"}</p>
          </div>}
          <div className="rounded-md border border-border bg-white p-3 dark:bg-slate-900">
            <p className="text-muted-foreground">{t("portal.email")}</p>
            <p className="mt-1 font-bold text-slate-950 dark:text-slate-50">{profile?.email ?? t("portal.notSet")}</p>
          </div>
          {canShow("phone") && <div className="rounded-md border border-border bg-white p-3 dark:bg-slate-900">
            <p className="text-muted-foreground">{t("portal.phone")}</p>
            <p className="mt-1 font-bold text-slate-950 dark:text-slate-50">{profile?.phone || t("portal.notSet")}</p>
          </div>}
          {canShow("address") && <div className="rounded-md border border-border bg-white p-3 dark:bg-slate-900">
            <p className="text-muted-foreground">{t("portal.address")}</p>
            <p className="mt-1 font-bold text-slate-950 dark:text-slate-50">{profile?.address || t("portal.notSet")}</p>
          </div>}
          <div className="rounded-md border border-border bg-white p-3 dark:bg-slate-900">
            <p className="text-muted-foreground">City</p>
            <p className="mt-1 font-bold text-slate-950 dark:text-slate-50">{profile?.city || t("portal.notSet")}</p>
          </div>
          <div className="rounded-md border border-border bg-white p-3 dark:bg-slate-900">
            <p className="text-muted-foreground">Preferred hospital city</p>
            <p className="mt-1 font-bold text-slate-950 dark:text-slate-50">{profile?.hospitalCity || t("portal.notSet")}</p>
          </div>
          <div className="rounded-md border border-border bg-white p-3 dark:bg-slate-900">
            <p className="text-muted-foreground">Preferred hospital</p>
            <p className="mt-1 font-bold text-slate-950 dark:text-slate-50">{profile?.preferredHospital || t("portal.notSet")}</p>
          </div>
          {canShow("preferredLanguage") && <div className="rounded-md border border-border bg-white p-3 dark:bg-slate-900">
            <p className="text-muted-foreground">Preferred language</p>
            <p className="mt-1 font-bold text-slate-950 dark:text-slate-50">{profile?.preferredLanguage || t("portal.notSet")}</p>
          </div>}
          <Link className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-white hover:bg-teal-800 sm:col-span-2" to="/profile">{t("portal.customizeProfile")}</Link>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Family and dependents</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Guardian/parent access can switch between linked children and view only released appointments, prescriptions, reports, vaccinations, admissions, and notifications.</p>
          {linkedGuardian && <div className="rounded-md border border-border bg-card p-3 text-sm"><p className="text-muted-foreground">Guardian</p><p className="font-bold text-foreground">{linkedGuardian.fullName} | {linkedGuardian.guardianId}</p></div>}
          {linkedDependents.length ? (
            <div className="grid gap-2">
              {linkedDependents.map((patient) => patient && (
                <button key={patient.patientId} type="button" onClick={() => setSelectedDependentId(patient.patientId)} className={`rounded-md border p-3 text-left ${selectedDependentId === patient.patientId ? "border-teal-400 bg-teal-50 text-teal-950 dark:bg-teal-950 dark:text-teal-50" : "border-border bg-card text-foreground"}`}>
                  <p className="font-semibold">{patient.name}</p>
                  <p className="text-xs opacity-80">{patient.patientId} | age {patient.age ?? "not set"} | {patient.birthCertificateNo || "Birth certificate pending"}</p>
                </button>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No linked children or dependents found for this demo account.</p>}
          {selectedDependent && <div className="rounded-md border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-50">Selected child: <span className="font-bold">{selectedDependent.name}</span>. Portal actions below apply to this dependent context.</div>}
          <Link className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-muted dark:bg-slate-900 dark:text-slate-50" to="/guardians">Open Guardian Management</Link>
        </CardContent>
      </Card>
      </section>
      </SectionReveal>
      <SectionReveal>
      <Card className="border-teal-200 bg-teal-50">
        <CardContent className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
          <p className="text-sm font-medium text-teal-950">{t("portal.patientPrivacy")}</p>
        </CardContent>
      </Card>
      </SectionReveal>
      <Stagger>
      <section className="mobile-action-grid grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Medical summary", "Blood group, allergies, chronic diseases", HeartPulse],
          ["Prescriptions", "Current medicines and QR/PDF", Pill],
          ["Vaccinations", "Taken vaccines and next due dates", Syringe],
          ["Secure messages", "Released doctor/hospital messages", MessageSquareText],
        ].map(([title, detail, Icon]) => (
          <Reveal key={title as string}>
          <Card className="kpi-card">
            <CardContent>
              <Icon className="mb-3 h-6 w-6 text-primary" />
              <p className="font-semibold">{title as string}</p>
              <p className="mt-1 text-sm text-muted-foreground">{detail as string}</p>
            </CardContent>
          </Card>
          </Reveal>
        ))}
      </section>
      </Stagger>
      <SectionReveal>
      <Card>
        <CardHeader><CardTitle>Connected EHR records</CardTitle></CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-md border border-border bg-card p-3">
            <p className="text-sm text-muted-foreground">Released lab results</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{visibleLabResults.length}</p>
          </div>
          <div className="rounded-md border border-border bg-card p-3">
            <p className="text-sm text-muted-foreground">Released radiology reports</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{visibleRadiologyResults.length}</p>
          </div>
          <div className="rounded-md border border-border bg-card p-3">
            <p className="text-sm text-muted-foreground">Bills / service records</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{visibleBills.length}</p>
          </div>
          <div className="lg:col-span-3">
            <p className="mb-2 text-sm font-semibold text-foreground">Latest connected timeline</p>
            <div className="grid gap-2">
              {patientTimeline.length ? patientTimeline.map((item) => (
                <div key={`${item.date}-${item.type}-${item.title}`} className="rounded-md border border-border bg-white p-3 text-sm dark:bg-slate-900">
                  <p className="font-semibold text-foreground">{item.type}: {item.title}</p>
                  <p className="text-muted-foreground">{new Date(item.date).toLocaleString()} | {item.status}</p>
                </div>
              )) : <p className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">No released connected records yet.</p>}
            </div>
          </div>
        </CardContent>
      </Card>
      </SectionReveal>
      <SectionReveal>
      <Card>
        <CardHeader><CardTitle>{t("portal.patientOptions")}</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-secondary px-4 text-sm font-semibold text-white hover:bg-cyan-900" to="/portal/messages"><MessageSquareText className="h-4 w-4" />{t("portal.careMessages")}</Link>
          <Link className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-muted" to="/portal/reports"><Download className="h-4 w-4" />{t("portal.downloadReports")}</Link>
          {activePatientId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(activePatientId) && <Link className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-muted" to={`/patients/${activePatientId}/documents`}><FileText className="h-4 w-4" />My released PDFs</Link>}
          <Link className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-muted" to="/portal/medical-reports"><FileText className="h-4 w-4" />Official medical report</Link>
          <Link className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-muted" to="/portal/care-summary">{t("portal.uploadReports")}</Link>
          <Link className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-muted" to="/portal/appointments"><CalendarDays className="h-4 w-4" />{t("portal.requestAppointment")}</Link>
          <Button variant="outline" onClick={() => showToast("Open Profile to update your emergency contact details.", "info")}>{t("portal.updateEmergencyContact")}</Button>
        </CardContent>
      </Card>
      </SectionReveal>
    </div>
    </PageTransition>
  );
}
