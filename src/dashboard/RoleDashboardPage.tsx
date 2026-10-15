import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Activity, AlertTriangle, ArrowUpRight, Clock3, DatabaseZap, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { PageTransition, Reveal, SectionReveal, Stagger } from "../components/motion/PageTransition";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { PageHeader } from "../components/ui/page-header";
import { Skeleton } from "../components/ui/skeleton";
import { authorizationContextKey } from "../lib/accessControl";
import { canAccessPath } from "../lib/roleAccess";
import {
  getIntelligenceDashboard,
  searchDashboardHospitals,
  type DashboardHospital,
  type IntelligenceChart,
  type IntelligenceMetric,
  type IntelligenceWorklist,
} from "../services/dashboardService";
import { useAuthStore } from "../stores/authStore";
import type { DashboardDefinition } from "./dashboardDefinitions";

const DashboardChart = lazy(() => import("./DashboardChart"));

const toneStyles: Record<IntelligenceMetric["tone"], string> = {
  neutral: "border-border bg-surface dark:border-border dark:bg-surface",
  success: "border-success-border bg-success-surface dark:border-success-border dark:bg-success-surface",
  warning: "border-warning-border bg-warning-surface dark:border-warning-border dark:bg-warning-surface",
  danger: "border-danger-border bg-danger-surface dark:border-danger-border dark:bg-danger-surface",
  info: "border-info-border bg-info-surface dark:border-info-border dark:bg-info-surface",
};

function reasonText(reason: string | undefined, t: (key: string, options?: Record<string, unknown>) => string) {
  if (!reason) return t("intelligence.unavailable");
  return t(`intelligence.reason.${reason}`, { defaultValue: t("intelligence.unavailable") });
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
  const dateCandidate = typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) ? new Date(value) : null;
  if (dateCandidate && !Number.isNaN(dateCandidate.getTime())) return dateCandidate.toLocaleString();
  return String(value).replaceAll("_", " ");
}

function MetricCard({ metric }: { metric: IntelligenceMetric }) {
  const { t } = useTranslation();
  return (
    <Reveal>
      <article className={`intelligence-metric relative h-full min-h-40 overflow-hidden rounded-2xl border p-4 shadow-sm ${toneStyles[metric.tone]}`} aria-label={metric.label}>
        <div className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-current opacity-decoration" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{metric.label}</p>
          <Activity className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
        </div>
        {metric.available ? (
          <p className="mt-4 text-3xl font-black tracking-tight text-foreground"><span className="tabular-nums">{displayValue(metric.value)}</span>{metric.unit && <span className="ml-1.5 text-sm font-bold text-muted-foreground">{metric.unit}</span>}</p>
        ) : (
          <div className="mt-4"><Badge tone="neutral">{t("intelligence.unavailable")}</Badge><p className="mt-2 text-xs font-semibold text-muted-foreground">{reasonText(metric.reason, t)}</p></div>
        )}
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{metric.definition}</p>
      </article>
    </Reveal>
  );
}

function ChartPanel({ chart }: { chart: IntelligenceChart }) {
  const { t } = useTranslation();
  return (
    <Card className="intelligence-panel glass-panel min-w-0 overflow-hidden rounded-2xl">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><CardTitle className="dark:text-foreground">{chart.title}</CardTitle><p className="mt-1 text-xs leading-5 text-muted-foreground">{chart.description}</p></div>
          <Badge tone={chart.available ? "info" : "neutral"}>{chart.available ? t("intelligence.liveSource") : t("intelligence.unavailable")}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {!chart.available ? (
          <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-border bg-muted p-6 text-center">
            <div><DatabaseZap className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" /><p className="mt-3 text-sm font-bold text-foreground">{t("intelligence.unavailable")}</p><p className="mt-1 text-xs font-semibold text-muted-foreground">{reasonText(chart.reason, t)}</p><p className="mt-1 max-w-md text-xs text-muted-foreground">{chart.description}</p></div>
          </div>
        ) : (
          <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}><DashboardChart chart={chart} /></Suspense>
        )}
        {chart.unavailableSeries.length > 0 && <p className="mt-3 rounded-lg border border-warning-border bg-warning-surface p-2.5 text-xs text-warning dark:border-warning-border dark:bg-warning-surface dark:text-warning">{t("intelligence.notCharted")}: {chart.unavailableSeries.join(", ")}</p>}
      </CardContent>
    </Card>
  );
}

function WorklistPanel({ worklist }: { worklist: IntelligenceWorklist }) {
  const { t } = useTranslation();
  return (
    <Card className="intelligence-panel glass-panel min-w-0 overflow-hidden rounded-2xl">
      <CardHeader><CardTitle className="dark:text-foreground">{worklist.title}</CardTitle><p className="mt-1 text-xs leading-5 text-muted-foreground">{worklist.description}</p></CardHeader>
      <CardContent>
        {!worklist.available ? <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-border bg-muted p-6 text-center"><div><p className="text-sm font-bold text-foreground">{t("intelligence.unavailable")}</p><p className="mt-1 text-xs font-semibold text-muted-foreground">{reasonText(worklist.reason, t)}</p><p className="mt-1 text-xs text-muted-foreground">{worklist.description}</p></div></div>
          : worklist.rows.length === 0 ? <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-border bg-muted p-6 text-center text-sm text-muted-foreground">{t("intelligence.noRecords")}</div>
            : <>
              <div className="space-y-2 md:hidden">{worklist.rows.map((row, rowIndex) => <div className="rounded-xl border border-border bg-surface p-3 dark:bg-surface" key={rowIndex}>{worklist.columns.map((column, columnIndex) => <div className="flex items-start justify-between gap-3 border-b border-border/60 py-1.5 last:border-0" key={column.key}><span className="text-xs font-semibold text-muted-foreground">{column.label}</span><span className={`max-w-[62%] text-right text-sm ${columnIndex === 0 ? "font-bold text-foreground" : "text-foreground dark:text-foreground"}`}>{displayValue(row[column.key])}</span></div>)}</div>)}</div>
              <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[42rem] border-collapse text-left text-sm"><caption className="sr-only">{worklist.title}. {worklist.description}</caption><thead><tr className="border-b border-border">{worklist.columns.map((column) => <th className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground" key={column.key} scope="col">{column.label}</th>)}</tr></thead><tbody>{worklist.rows.map((row, rowIndex) => <tr className="table-row-motion border-b border-border/70 last:border-0" key={rowIndex}>{worklist.columns.map((column, columnIndex) => <td className={`px-3 py-3 ${columnIndex === 0 ? "font-bold text-foreground" : "text-foreground dark:text-foreground"}`} key={column.key}>{displayValue(row[column.key])}</td>)}</tr>)}</tbody></table></div>
            </>}
      </CardContent>
    </Card>
  );
}

export function RoleDashboardPage({ definition }: { definition: DashboardDefinition }) {
  const { t } = useTranslation();
  const profile = useAuthStore((state) => state.profile);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | undefined>();
  const [hospitalQuery, setHospitalQuery] = useState("");
  const [hospitalResults, setHospitalResults] = useState<DashboardHospital[]>([]);
  const [hospitalSearchError, setHospitalSearchError] = useState("");
  const isSuper = profile?.role === "super_admin";
  const dashboardQuery = useQuery({
    queryKey: ["intelligence-dashboard", authorizationContextKey(profile), selectedHospitalId ?? "network"],
    queryFn: ({ signal }) => getIntelligenceDashboard(selectedHospitalId, signal),
    enabled: Boolean(profile),
    staleTime: 60_000,
    gcTime: 0,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const data = dashboardQuery.data;
  const Icon = definition.icon;
  const quickActions = useMemo(() => definition.quickActions.filter((action) => canAccessPath(profile, action.href)), [definition.quickActions, profile]);

  async function searchHospitals(event: FormEvent) {
    event.preventDefault();
    setHospitalSearchError("");
    try {
      setHospitalResults(await searchDashboardHospitals(hospitalQuery));
    } catch (error) {
      setHospitalSearchError(error instanceof Error ? error.message : t("intelligence.hospitalSearchError"));
    }
  }

  if (dashboardQuery.isLoading) return <div className="space-y-4"><Skeleton className="h-52 w-full rounded-3xl" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <Skeleton className="h-40 rounded-2xl" key={index} />)}</div></div>;
  if (dashboardQuery.isError || !data) return <div className="mx-auto mt-12 max-w-xl rounded-2xl border border-danger-border bg-danger-surface p-7 text-center dark:border-danger-border dark:bg-danger-surface"><AlertTriangle className="mx-auto h-9 w-9 text-danger" /><h1 className="mt-3 text-xl font-bold">{t("intelligence.loadError")}</h1><p className="mt-2 text-sm text-muted-foreground">{dashboardQuery.error instanceof Error ? dashboardQuery.error.message : t("intelligence.tryAgain")}</p><Button className="mt-5" onClick={() => void dashboardQuery.refetch()}><RefreshCw className="h-4 w-4" />{t("intelligence.retry")}</Button></div>;

  return (
    <PageTransition>
      <div className="intelligence-dashboard space-y-5">
        <PageHeader className="intelligence-hero" eyebrow={<>{definition.eyebrow} · {data.scope.hospitalName}</>} icon={<Icon className="h-4 w-4" />} title={data.title} description={data.subtitle}
          actions={<><Badge tone="success"><ShieldCheck className="h-3.5 w-3.5" />{t("intelligence.scopeEnforced")}</Badge><span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="h-4 w-4" />{t("intelligence.updated", { time: new Date(data.capturedAt).toLocaleTimeString() })}</span><Button disabled={dashboardQuery.isFetching} onClick={() => void dashboardQuery.refetch()} variant="outline"><RefreshCw className={`h-4 w-4 ${dashboardQuery.isFetching ? "animate-spin" : ""}`} />{t("intelligence.refresh")}</Button></>}>
          {quickActions.map(action => <Link className="gov-button focus-ring inline-flex min-h-11 items-center gap-2 border border-control-border bg-surface px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent-surface" key={action.href} to={action.href}>{action.label}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>)}
        </PageHeader>

        {isSuper && <SectionReveal><Card className="rounded-2xl"><CardContent className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-bold text-foreground">{t("intelligence.networkScope")}</p><p className="text-xs text-muted-foreground">{t("intelligence.networkScopeHelp")}</p></div><Button onClick={() => setSelectedHospitalId(undefined)} variant={!selectedHospitalId ? "primary" : "outline"}>{t("intelligence.allHospitals")}</Button></div><form className="flex flex-col gap-2 sm:flex-row" onSubmit={searchHospitals}><label className="sr-only" htmlFor="dashboard-hospital-search">{t("intelligence.findHospital")}</label><Input id="dashboard-hospital-search" onChange={(event) => setHospitalQuery(event.target.value)} placeholder={t("intelligence.hospitalPlaceholder")} value={hospitalQuery} /><Button type="submit" variant="secondary"><Search className="h-4 w-4" />{t("intelligence.search")}</Button></form>{hospitalSearchError && <p className="text-xs font-semibold text-danger dark:text-danger">{hospitalSearchError}</p>}{hospitalResults.length > 0 && <div className="flex flex-wrap gap-2">{hospitalResults.map((hospital) => <button className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-bold ${selectedHospitalId === hospital.id ? "border-accent-border bg-accent-solid text-foreground" : "border-border bg-surface text-foreground dark:bg-surface dark:text-foreground"}`} key={hospital.id} onClick={() => setSelectedHospitalId(hospital.id)} type="button">{hospital.name}</button>)}</div>}</CardContent></Card></SectionReveal>}

        {data.alerts.length > 0 && <SectionReveal><section aria-labelledby="dashboard-alerts-title"><div className="mb-2 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /><h2 className="text-sm font-black uppercase tracking-[0.14em] text-foreground" id="dashboard-alerts-title">{t("intelligence.operationalAlerts")}</h2></div><div className="grid gap-2 lg:grid-cols-2">{data.alerts.map((alert) => <div className={`rounded-xl border p-3 text-sm font-semibold ${alert.severity === "danger" ? "border-danger-border bg-danger-surface text-danger dark:border-danger-border dark:bg-danger-surface dark:text-danger" : "border-warning-border bg-warning-surface text-warning dark:border-warning-border dark:bg-warning-surface dark:text-warning"}`} key={alert.id}>{alert.message}<span className="mt-1 block text-[11px] font-medium text-muted-foreground">{t("intelligence.source")}: {alert.source}</span></div>)}</div></section></SectionReveal>}

        <section aria-labelledby="dashboard-kpis-title"><div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-accent">{t("intelligence.liveMetrics")}</p><h2 className="mt-1 text-xl font-black text-foreground" id="dashboard-kpis-title">{t("intelligence.roleSnapshot")}</h2></div><p className="hidden text-xs text-muted-foreground sm:block">{t("intelligence.manualRefresh")}</p></div><Stagger><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{data.metrics.map((metric) => <MetricCard key={metric.id} metric={metric} />)}</div></Stagger></section>

        <section aria-labelledby="dashboard-analytics-title"><div className="mb-3"><p className="text-xs font-black uppercase tracking-[0.18em] text-accent">{t("intelligence.analytics")}</p><h2 className="mt-1 text-xl font-black text-foreground" id="dashboard-analytics-title">{t("intelligence.activityTrends")}</h2></div><div className="grid gap-4 2xl:grid-cols-2">{data.charts.map((chart) => <ChartPanel chart={chart} key={chart.id} />)}</div></section>

        {data.worklists.length > 0 && <section aria-labelledby="dashboard-worklists-title"><div className="mb-3"><p className="text-xs font-black uppercase tracking-[0.18em] text-accent">{t("intelligence.workflow")}</p><h2 className="mt-1 text-xl font-black text-foreground" id="dashboard-worklists-title">{t("intelligence.priorityWork")}</h2></div><div className="grid gap-4 2xl:grid-cols-2">{data.worklists.map((worklist) => <WorklistPanel key={worklist.id} worklist={worklist} />)}</div></section>}

        {data.unavailableCapabilities.length > 0 && <SectionReveal><Card className="rounded-2xl border-dashed"><CardHeader><CardTitle className="flex items-center gap-2 dark:text-foreground"><DatabaseZap className="h-5 w-5 text-warning" />{t("intelligence.sourceReadiness")}</CardTitle></CardHeader><CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{data.unavailableCapabilities.map((capability) => <div className="rounded-xl border border-border bg-muted p-3" key={capability.id}><p className="text-sm font-bold text-foreground">{capability.label}</p><p className="mt-1 text-xs text-muted-foreground">{reasonText(capability.reason, t)}</p></div>)}</CardContent></Card></SectionReveal>}
      </div>
    </PageTransition>
  );
}
