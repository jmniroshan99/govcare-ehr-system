import { ChartTooltip as Tooltip, ChartLegend as Legend } from "../theme/ChartTooltip";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis } from "recharts";
import { useTranslation } from "react-i18next";
import { useReducedMotion } from "framer-motion";
import type { IntelligenceChart } from "../services/dashboardService";

import { chartColors as fallbackColors, chartColor } from "../theme/colors";

function numeric(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function EmptyChart() {
  const { t } = useTranslation();
  return <div className="grid h-64 place-items-center text-center text-sm text-muted-foreground">{t("intelligence.noRecords")}</div>;
}

function Heatmap({ chart }: { chart: IntelligenceChart }) {
  const rows = [...new Set(chart.data.map((item) => String(item.row ?? "Unknown")))];
  const columns = [...new Set(chart.data.map((item) => String(item.day ?? item[chart.xKey] ?? "")))];
  const maximum = Math.max(1, ...chart.data.map((item) => numeric(item.count)));
  const values = new Map(chart.data.map((item) => [`${String(item.row)}::${String(item.day ?? item[chart.xKey])}`, numeric(item.count)]));
  return (
    <div className="overflow-x-auto pb-2" role="img" aria-label={`${chart.title}. ${chart.description}`}>
      <div className="grid min-w-[34rem] gap-2" style={{ gridTemplateColumns: `minmax(8rem, 1.2fr) repeat(${columns.length}, minmax(3rem, 1fr))` }}>
        <span aria-hidden="true" />
        {columns.map((column) => <span className="text-center text-xs font-semibold text-muted-foreground" key={column}>{column}</span>)}
        {rows.flatMap((row) => [
          <span className="self-center text-xs font-bold text-foreground" key={`${row}-label`}>{row}</span>,
          ...columns.map((column) => {
            const value = values.get(`${row}::${column}`) ?? 0;
            const alpha = 0.12 + (value / maximum) * 0.78;
            return <div className="grid h-11 place-items-center rounded-lg border border-accent-border text-xs font-bold text-foreground shadow-sm dark:border-accent-border dark:text-foreground" key={`${row}-${column}`} style={{ backgroundColor: `color-mix(in srgb, var(--heatmap-high) ${alpha * 100}%, var(--bg-surface))` }} title={`${row}, ${column}: ${value}`}>{value}</div>;
          }),
        ])}
      </div>
    </div>
  );
}

function Timeline({ chart }: { chart: IntelligenceChart }) {
  return (
    <ol className="relative ml-2 max-h-72 space-y-3 overflow-y-auto border-l border-accent-border pl-5 dark:border-accent-border" aria-label={chart.title}>
      {chart.data.map((item, index) => (
        <li className="relative rounded-xl border border-border bg-surface p-3 dark:bg-surface" key={`${String(item[chart.xKey])}-${index}`}>
          <span className="absolute -left-[1.62rem] top-4 h-3 w-3 rounded-full bg-accent-solid ring-4 ring-accent-border dark:ring-accent-border" aria-hidden="true" />
          <p className="text-sm font-bold text-foreground">{String(item[chart.xKey] ?? "Event")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{chart.series.map((series) => `${series.label}: ${String(item[series.key] ?? "—")}`).join(" · ")}</p>
        </li>
      ))}
    </ol>
  );
}

function ScreenReaderTable({ chart }: { chart: IntelligenceChart }) {
  return (
    <table className="sr-only">
      <caption>{chart.title}. {chart.description}</caption>
      <thead><tr><th scope="col">{chart.xKey}</th>{chart.series.map((series) => <th scope="col" key={series.key}>{series.label}</th>)}</tr></thead>
      <tbody>{chart.data.map((item, index) => <tr key={index}><th scope="row">{String(item[chart.xKey] ?? item.row ?? "")}</th>{chart.series.map((series) => <td key={series.key}>{String(item[series.key] ?? "Not recorded")}</td>)}</tr>)}</tbody>
    </table>
  );
}

export default function DashboardChart({ chart }: { chart: IntelligenceChart }) {
  const reduce = useReducedMotion();
  if (!chart.data.length) return <EmptyChart />;
  if (chart.type === "heatmap") return <><Heatmap chart={chart} /><ScreenReaderTable chart={chart} /></>;
  if (chart.type === "timeline") return <><Timeline chart={chart} /><ScreenReaderTable chart={chart} /></>;
  const common = {
    data: chart.data,
    margin: { top: 10, right: 12, left: -14, bottom: 4 },
  };
  return (
    <>
      <div className="h-64 w-full" role="img" aria-label={`${chart.title}. ${chart.description}`}>
        <ResponsiveContainer width="100%" height="100%">
          {chart.type === "donut" ? (
            <PieChart>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Pie isAnimationActive={!reduce} animationDuration={450} data={chart.data} dataKey={chart.series[0]?.key ?? "count"} nameKey={chart.xKey} innerRadius="46%" outerRadius="76%" paddingAngle={2}>
                {chart.data.map((_, index) => <Cell fill={fallbackColors[index % fallbackColors.length]} key={index} />)}
              </Pie>
            </PieChart>
          ) : chart.type === "line" ? (
            <LineChart {...common}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey={chart.xKey} stroke="var(--chart-axis)" tick={{ fontSize: 11, fill: "var(--chart-axis)" }} minTickGap={22} />
              <YAxis stroke="var(--chart-axis)" tick={{ fontSize: 11, fill: "var(--chart-axis)" }} allowDecimals={false} />
              <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
              {chart.series.map((series, index) => <Line isAnimationActive={!reduce} animationDuration={450} connectNulls={false} dataKey={series.key} dot={{ r: 2 }} key={series.key} name={series.label} stroke={chartColor(index)} strokeWidth={2.5} type="monotone" />)}
            </LineChart>
          ) : chart.type === "area" ? (
            <AreaChart {...common}>
              <defs>{chart.series.map((series, index) => <linearGradient id={`gradient-${chart.id}-${series.key}`} x1="0" x2="0" y1="0" y2="1" key={series.key}><stop offset="5%" stopColor={chartColor(index)} stopOpacity="var(--chart-stop-strong)" /><stop offset="95%" stopColor={chartColor(index)} stopOpacity="var(--chart-stop-weak)" /></linearGradient>)}</defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey={chart.xKey} stroke="var(--chart-axis)" tick={{ fontSize: 11, fill: "var(--chart-axis)" }} minTickGap={22} />
              <YAxis stroke="var(--chart-axis)" tick={{ fontSize: 11, fill: "var(--chart-axis)" }} allowDecimals={false} />
              <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
              {chart.series.map((series, index) => <Area isAnimationActive={!reduce} animationDuration={450} connectNulls={false} dataKey={series.key} fill={`url(#gradient-${chart.id}-${series.key})`} key={series.key} name={series.label} stroke={chartColor(index)} strokeWidth={2.25} type="monotone" />)}
            </AreaChart>
          ) : (
            <BarChart {...common}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey={chart.xKey} stroke="var(--chart-axis)" tick={{ fontSize: 11, fill: "var(--chart-axis)" }} minTickGap={18} />
              <YAxis stroke="var(--chart-axis)" tick={{ fontSize: 11, fill: "var(--chart-axis)" }} allowDecimals={false} />
              <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
              {chart.series.map((series, index) => <Bar isAnimationActive={!reduce} animationDuration={450} dataKey={series.key} fill={series.color || fallbackColors[index % fallbackColors.length]} key={series.key} name={series.label} radius={[5, 5, 0, 0]} />)}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <ScreenReaderTable chart={chart} />
    </>
  );
}
