import { ChartTooltip as Tooltip, ChartLegend as Legend } from "../theme/ChartTooltip";
import { useQuery } from "@tanstack/react-query";
import { Activity, Ambulance, BedDouble, FlaskConical, Pill, RefreshCw, Search, UsersRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid,  ResponsiveContainer,  XAxis, YAxis } from "recharts";
import { PageTransition } from "../components/motion/PageTransition";
import { Badge, type BadgeTone } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { canAccessPath } from "../lib/roleAccess";
import { getDashboardOverview, searchDashboardHospitals, type DashboardOverview } from "../services/dashboardService";
import { useAuthStore } from "../stores/authStore";

type MetricKey = keyof DashboardOverview["metrics"];
const cards: Array<{ key: MetricKey; icon: typeof Activity; destination?: string; tone: string }> = [
  { key: "opdToday", icon: UsersRound, destination: "/opd", tone: "text-info dark:text-info" },
  { key: "activeAdmissions", icon: BedDouble, destination: "/admissions", tone: "text-success dark:text-success" },
  { key: "emergencyTriage", icon: Ambulance, tone: "text-danger dark:text-danger" },
  { key: "labPending", icon: FlaskConical, destination: "/laboratory", tone: "text-warning dark:text-warning" },
  { key: "lowStockMeds", icon: Pill, destination: "/pharmacy", tone: "text-warning dark:text-warning" },
  { key: "criticalAlerts", icon: Activity, tone: "text-danger dark:text-danger" },
];
const localeFor = (language: string) => language.startsWith("si") ? "si-LK" : language.startsWith("ta") ? "ta-LK" : "en-LK";
function queueTone(priority: string): BadgeTone {
  if (priority === "critical" || priority === "stat") return "danger";
  if (priority === "urgent") return "warning";
  return "info";
}

export function Dashboard() {
  const { t, i18n } = useTranslation();
  const profile = useAuthStore((state) => state.profile);
  const [hospitalId, setHospitalId] = useState(profile?.hospitalId ?? "");
  const [hospitalSearch, setHospitalSearch] = useState("");
  const [hospitalQuery, setHospitalQuery] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => setHospitalId(profile?.hospitalId ?? ""), [profile?.uid, profile?.hospitalId]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const overviewQuery = useQuery({
    queryKey: ["dashboard-overview", profile?.uid, hospitalId],
    queryFn: ({ signal }) => getDashboardOverview(hospitalId || undefined, signal),
    enabled: Boolean(profile), staleTime: 60_000, gcTime: 0, retry: 1, refetchOnWindowFocus: true,
  });
  const hospitalOptions = useQuery({
    queryKey: ["dashboard-hospitals", profile?.uid, hospitalQuery],
    queryFn: ({ signal }) => searchDashboardHospitals(hospitalQuery, signal),
    enabled: profile?.role === "super_admin", staleTime: 5 * 60_000, gcTime: 0, retry: 1,
  });

  const overview = overviewQuery.data;
  const locale = localeFor(i18n.language);
  const formattedDate = new Intl.DateTimeFormat(locale, { timeZone: "Asia/Colombo", dateStyle: "full" }).format(
    overview ? new Date(`${overview.date}T00:00:00+05:30`) : new Date(),
  );
  const lastUpdated = overview ? new Intl.DateTimeFormat(locale, { timeZone: "Asia/Colombo", hour: "2-digit", minute: "2-digit" }).format(new Date(overview.capturedAt)) : null;
  const stale = Boolean(overview && (overviewQuery.isError || now - Date.parse(overview.capturedAt) > 5 * 60_000));
  const activeHospitalId = hospitalId || overview?.hospitalId || "";
  const selectableHospitals = hospitalOptions.data ?? [];
  const selectedIsListed = selectableHospitals.some((hospital) => hospital.id === activeHospitalId);
  const chartRows = overview?.flow ?? [];
  const currentHour = overview ? Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", hour: "numeric", hourCycle: "h23" }).format(new Date(overview.capturedAt))) : 0;
  const flowCounts = new Map(chartRows.map((row) => [row.hour, row.count]));
  const flow = chartRows.length ? Array.from({ length: currentHour + 1 }, (_, hour) => ({ hour, count: flowCounts.get(hour) ?? 0 })) : [];
  const chartText = "var(--chart-axis)";

  function searchHospitals(event: FormEvent) {
    event.preventDefault();
    setHospitalQuery(hospitalSearch.trim());
  }

  return <PageTransition><div className="min-w-0 space-y-5">
    <div className="gov-page-header flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">{t("dashboard.eyebrow")}</p>
        <h1 className="mt-1 text-2xl font-bold text-foreground dark:text-foreground">{t("dashboard.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
        <p className="mt-2 text-sm font-medium text-foreground dark:text-foreground">{overview?.hospitalName ?? (hospitalId && hospitalId !== profile?.hospitalId ? t("dashboard.selectedHospital") : profile?.hospitalName ?? t("dashboard.hospitalUnavailable"))} · {formattedDate}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground" role="status">{lastUpdated ? t(stale ? "dashboard.staleAt" : "dashboard.updatedAt", { time: lastUpdated }) : t("dashboard.notUpdated")}</span>
        <Button variant="outline" disabled={overviewQuery.isFetching} onClick={() => void overviewQuery.refetch()} aria-label={t("dashboard.refresh")}>
          <RefreshCw className={`h-4 w-4 ${overviewQuery.isFetching ? "animate-spin" : ""}`} />{t("dashboard.refresh")}
        </Button>
        {profile?.role === "super_admin" && <Link className="interactive-control inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-semibold text-accent hover:bg-muted" to="/super-admin">{t("dashboard.adminCenter")}</Link>}
      </div>
    </div>

    {profile?.role === "super_admin" && <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
      <label className="w-full min-w-0 space-y-1 text-sm font-semibold text-foreground sm:w-auto sm:flex-1 dark:text-foreground">
        <span>{t("dashboard.hospitalScope")}</span>
        <select className="h-11 w-full min-w-0 rounded-md border border-border bg-card px-3 text-sm" value={activeHospitalId} onChange={(event) => setHospitalId(event.target.value)} aria-label={t("dashboard.hospitalScope")}>
          {!selectedIsListed && activeHospitalId && <option value={activeHospitalId}>{overview?.hospitalName ?? profile?.hospitalName ?? t("dashboard.selectedHospital")}</option>}
          {selectableHospitals.map((hospital) => <option key={hospital.id} value={hospital.id}>{hospital.name}</option>)}
        </select>
      </label>
      <form className="flex w-full min-w-0 gap-2 sm:w-auto sm:flex-1" onSubmit={searchHospitals}>
        <label className="min-w-0 flex-1 space-y-1 text-sm font-semibold text-foreground dark:text-foreground">
          <span>{t("dashboard.findHospital")}</span>
          <input className="h-11 w-full min-w-0 rounded-md border border-border bg-card px-3 text-sm" value={hospitalSearch} onChange={(event) => setHospitalSearch(event.target.value)} placeholder={t("dashboard.hospitalSearchPlaceholder")} />
        </label>
        <Button className="self-end" variant="outline" type="submit" aria-label={t("dashboard.findHospital")}><Search className="h-4 w-4" /></Button>
      </form>
      {hospitalOptions.isError && <p className="w-full text-sm text-warning dark:text-warning">{t("dashboard.hospitalSearchError")}</p>}
    </div>}

    {overviewQuery.isError && <div role="alert" className="rounded-lg border border-warning-border bg-warning-surface p-4 text-sm text-warning dark:bg-warning-surface dark:text-warning">{t(overview ? "dashboard.staleError" : "dashboard.loadError")}</div>}

    <section aria-label={t("dashboard.metricsTitle")} className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map(({ key, icon: Icon, destination, tone }) => {
        const metric = overview?.metrics[key];
        const linked = Boolean(metric?.available && destination && canAccessPath(profile, destination));
        const label = t(`dashboard.stats.${key}`);
        const value = metric?.available ? new Intl.NumberFormat(locale).format(metric.value ?? 0)
          : t(metric ? "dashboard.unavailable" : overviewQuery.isFetching ? "dashboard.loading" : "dashboard.unavailable");
        return <Card key={key} className="min-w-0"><CardContent className="flex min-h-36 items-start justify-between gap-3 p-4 sm:p-5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground dark:text-foreground">{label}</h2>
            <p className={`mt-2 font-bold tabular-nums text-foreground dark:text-foreground ${metric?.available ? "text-3xl" : "text-lg"}`} aria-label={`${label}: ${value}`}>{value}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t(`dashboard.definition.${key}`)}</p>
            {metric && !metric.available && <p className="mt-1 text-xs leading-5 text-warning dark:text-warning">{t(`dashboard.reason.${metric.reason ?? "no_source"}`)}</p>}
            {linked && <Link to={destination!} className="mt-2 inline-block text-xs font-bold text-accent underline-offset-2 hover:underline focus-visible:underline">{t("dashboard.openModule", { name: label })}</Link>}
          </div>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-muted" aria-hidden="true"><Icon className={`h-5 w-5 ${tone}`} /></div>
        </CardContent></Card>;
      })}
    </section>

    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <Card className="min-w-0"><CardHeader><CardTitle className="dark:text-foreground">{t("dashboard.patientFlow")}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{t("dashboard.flowDefinition")}</p></CardHeader>
        <CardContent className="min-w-0 p-4 sm:p-5">
          {!overview?.flowAvailable ? <p className="grid min-h-64 place-items-center text-center text-sm text-muted-foreground">{t(overview ? `dashboard.reason.${overview.flowReason ?? "data_error"}` : overviewQuery.isFetching ? "dashboard.loading" : "dashboard.unavailable")}</p>
            : !flow.length ? <p className="grid min-h-64 place-items-center text-center text-sm text-muted-foreground">{t("dashboard.noFlow")}</p>
              : <>
                <div className="h-72 w-full" role="img" aria-label={t("dashboard.flowDescription", { count: chartRows.reduce((sum, row) => sum + row.count, 0) })}>
                  <ResponsiveContainer width="100%" height="100%"><AreaChart data={flow} margin={{ top: 12, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis dataKey="hour" tickFormatter={(hour) => `${String(hour).padStart(2, "0")}:00`} minTickGap={22} stroke={chartText} tick={{ fill: chartText }} />
                    <YAxis allowDecimals={false} stroke={chartText} tick={{ fill: chartText }} />
                    <Tooltip labelFormatter={(hour) => `${String(hour).padStart(2, "0")}:00`} />
                    <Legend wrapperStyle={{ color: chartText }} /><Area type="monotone" dataKey="count" name={t("dashboard.opdRegistrations")} stroke="var(--chart-series-1)" fill="var(--chart-series-1)" fillOpacity="var(--chart-fill-opacity)" />
                  </AreaChart></ResponsiveContainer>
                </div>
                <table className="sr-only"><caption>{t("dashboard.flowDefinition")}</caption><thead><tr><th scope="col">{t("dashboard.hour")}</th><th scope="col">{t("dashboard.opdRegistrations")}</th></tr></thead><tbody>{flow.map((row) => <tr key={row.hour}><td>{String(row.hour).padStart(2, "0")}:00</td><td>{row.count}</td></tr>)}</tbody></table>
              </>}
        </CardContent>
      </Card>

      <Card className="min-w-0"><CardHeader className="flex flex-wrap items-center justify-between gap-2"><div><CardTitle className="dark:text-foreground">{t("dashboard.priorityQueue")}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{t("dashboard.queueDefinition")}</p></div>{overview?.queueAvailable && canAccessPath(profile, "/opd") && <Link className="text-xs font-bold text-accent hover:underline" to="/opd">{t("dashboard.viewQueue")}</Link>}</CardHeader>
        <CardContent className="min-w-0 p-4 sm:p-5">
          {!overview?.queueAvailable ? <p className="grid min-h-64 place-items-center text-center text-sm text-muted-foreground">{t(overview ? `dashboard.reason.${overview.queueReason ?? "data_error"}` : overviewQuery.isFetching ? "dashboard.loading" : "dashboard.unavailable")}</p>
            : !overview.priorityQueue.length ? <p className="grid min-h-64 place-items-center text-center text-sm text-muted-foreground">{t("dashboard.noQueue")}</p>
              : <>
                <div className="space-y-2 md:hidden">{overview.priorityQueue.map((item) => <div className="rounded-lg border border-border p-3" key={item.id}>
                  <div className="flex items-start justify-between gap-2"><strong className="text-sm text-foreground dark:text-foreground">{item.token}</strong><Badge tone={queueTone(item.priority)} className="shrink-0 capitalize">{t(`dashboard.priority.${item.priority}`, { defaultValue: item.priority })}</Badge></div>
                  <p className="mt-1 break-words text-sm text-foreground dark:text-foreground">{item.patient_name ?? t("dashboard.patientRestricted")} · {item.unit ?? t("dashboard.unitUnknown")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("dashboard.table.status")}: {t(`dashboard.queueStatus.${item.status}`, { defaultValue: item.status.replaceAll("-", " ") })} · {t("dashboard.elapsed", { minutes: item.elapsed_minutes })}</p>
                </div>)}</div>
                <table className="hidden w-full table-fixed border-collapse text-left text-sm md:table">
                  <caption className="sr-only">{t("dashboard.priorityQueue")}</caption>
                  <thead><tr className="border-b border-border text-xs uppercase text-muted-foreground"><th className="w-[18%] py-2 pr-2" scope="col">{t("dashboard.table.token")}</th><th className="w-[40%] py-2 pr-2" scope="col">{t("dashboard.table.patient")}</th><th className="w-[27%] py-2 pr-2" scope="col">{t("dashboard.table.status")}</th><th className="w-[15%] py-2 text-right" scope="col">{t("dashboard.table.wait")}</th></tr></thead>
                  <tbody>{overview.priorityQueue.map((item) => <tr className="border-b border-border last:border-0" key={item.id}>
                    <td className="break-all py-3 pr-2 align-top font-semibold text-foreground dark:text-foreground">{item.token}</td>
                    <td className="break-words py-3 pr-2 align-top text-foreground dark:text-foreground">{item.patient_name ?? t("dashboard.patientRestricted")}<span className="block text-xs text-muted-foreground">{item.unit ?? t("dashboard.unitUnknown")}</span></td>
                    <td className="py-3 pr-2 align-top"><Badge tone={queueTone(item.priority)} className="max-w-full break-words capitalize">{t(`dashboard.priority.${item.priority}`, { defaultValue: item.priority })}</Badge><span className="mt-1 block break-words text-xs text-muted-foreground">{t(`dashboard.queueStatus.${item.status}`, { defaultValue: item.status.replaceAll("-", " ") })}</span></td>
                    <td className="py-3 text-right align-top text-xs tabular-nums text-foreground dark:text-foreground">{t("dashboard.elapsed", { minutes: item.elapsed_minutes })}</td>
                  </tr>)}</tbody>
                </table>
              </>}
        </CardContent>
      </Card>
    </div>
  </div></PageTransition>;
}
