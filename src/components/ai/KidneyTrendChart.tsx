import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { ClinicalTrend, ForecastOutput } from "../../services/predictiveIntelligenceService";
import { ChartTooltip } from "../../theme/ChartTooltip";
import { chartColor } from "../../theme/colors";

export function KidneyTrendChart({ trend, days, asOf, forecast }: { trend: ClinicalTrend; days: number | null; asOf: string; forecast?: ForecastOutput | null }) {
  const cutoff = days == null ? -Infinity : new Date(asOf).getTime() - days * 86400000;
  const measured = trend.observations.filter(o => new Date(o.observedAt).getTime() >= cutoff)
    .map(o => ({ ...o, time: new Date(o.observedAt).getTime(), measured: o.value, projected: null as number | null }));
  if (!measured.length) return <div className="pci-chart-empty"><strong>No dated {trend.label} measurements in this period</strong>
    <span>Choose a longer period or review the source report. Upload time does not establish a measurement date.</span></div>;

  const points: Array<Record<string, unknown>> = [...measured];
  let forecastStart: number | null = null;
  let forecastEnd: number | null = null;
  if (trend.metric === "egfr" && forecast?.status === "AVAILABLE" && forecast.projectedEgfr != null) {
    forecastStart = new Date(forecast.forecastOriginDate).getTime();
    forecastEnd = new Date(forecast.forecastDate).getTime();
    points.push({ time: forecastStart, measured: null, projected: forecast.currentEgfr, value: forecast.currentEgfr,
      observedAt: forecast.forecastOriginDate, unit: trend.unit, forecastOrigin: true });
    points.push({ time: forecastEnd, measured: null, projected: forecast.projectedEgfr, value: forecast.projectedEgfr,
      observedAt: forecast.forecastDate, unit: trend.unit, forecast: true });
  }

  const date = (timestamp: number) => new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return <div className="pci-chart" role="img" aria-label={`${trend.label}: ${measured.length} historical measurements${forecastEnd ? " with a dashed projected trajectory" : ""}.`}>
    <ResponsiveContainer width="100%" height="100%" minWidth={1}>
      <LineChart data={points} margin={{ left: -18, right: 14, top: 14, bottom: 6 }} accessibilityLayer>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 5" />
        <XAxis dataKey="time" type="number" domain={["dataMin", "dataMax"]} tickFormatter={date}
          stroke="var(--chart-axis)" tickLine={false} axisLine={false} minTickGap={38} tick={{ fontSize: 11 }} />
        <YAxis stroke="var(--chart-axis)" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
        <ChartTooltip labelFormatter={v => new Date(Number(v)).toLocaleString()}
          formatter={(value, name) => [`${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${trend.unit}`, name === "projected" ? "Projected eGFR" : trend.label]} />
        {trend.metric === "egfr" && [15,30,45,60,90].map(boundary => <ReferenceLine key={boundary} y={boundary}
          stroke={boundary === 60 ? "var(--tone-warning-solid)" : "var(--chart-grid)"} strokeDasharray="5 5" />)}
        {forecastStart != null && forecastEnd != null && forecast?.projectedEgfrLow != null && forecast.projectedEgfrHigh != null &&
          <ReferenceArea x1={forecastStart} x2={forecastEnd} y1={forecast.projectedEgfrLow} y2={forecast.projectedEgfrHigh}
            fill="var(--tone-accent-surface)" fillOpacity={0.25} strokeOpacity={0} />}
        <Line type="linear" dataKey="measured" name={trend.label} stroke={chartColor(0)} strokeWidth={2.5}
          dot={{ fill: "var(--bg-surface)", stroke: chartColor(0), r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false} connectNulls={false} />
        {forecastEnd != null && <Line type="linear" dataKey="projected" name="Projected eGFR" stroke="var(--brand-primary)" strokeWidth={2.5}
          strokeDasharray="7 6" dot={{ fill: "var(--bg-surface)", stroke: "var(--brand-primary)", r: 4, strokeWidth: 2 }} isAnimationActive={false} connectNulls />}
      </LineChart>
    </ResponsiveContainer>
  </div>;
}
