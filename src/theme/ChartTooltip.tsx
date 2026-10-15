import { Legend, Tooltip, type LegendProps, type TooltipProps } from "recharts";

/** Shared tooltip surface; CSS variables update immediately with the theme. */
export function ChartTooltip(props: TooltipProps) {
  return <Tooltip {...props}
    contentStyle={{ backgroundColor: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: 10, boxShadow: "var(--card-shadow)", ...props.contentStyle }}
    labelStyle={{ color: "var(--text-primary)", ...props.labelStyle }}
    itemStyle={{ color: "var(--text-secondary)", ...props.itemStyle }}
    cursor={props.cursor ?? { stroke: "var(--chart-axis)", fill: "var(--selection-color)" }} />;
}

export function ChartLegend(props: LegendProps) {
  return <Legend {...props} wrapperStyle={{ fontSize: 12, ...props.wrapperStyle }}
    formatter={props.formatter ?? ((value) => <span style={{ color: "var(--text-secondary)" }}>{value}</span>)} />;
}
