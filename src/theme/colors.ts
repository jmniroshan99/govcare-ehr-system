/** Healthcare colors live here. Run npm run theme:generate after editing tokens. */
export type Theme = "light" | "dark";

/** Shared geometry and motion keep legacy and new screens visually consistent. */
export const designTokens = {
  "--radius-panel": "1.25rem", "--radius-control": ".7rem", "--space-panel": "1.35rem",
  "--motion-fast": "160ms ease", "--motion-enter": "240ms",
} as const;

export const themeColors = {
  dark: {
    background: "#061F1B", surface: "#0D2924", card: "rgba(255,255,255,0.08)",
    primary: "#00C9A7", text: "#FFFFFF", muted: "#A8C8C0",
    surfaceMuted: "#173B34", border: "#395C52", controlBorder: "#6A9990",
    accentText: "#70E4CD", action: "#00C9A7", actionHover: "#70E4CD", onAction: "#061F1B",
    glass: "rgba(13,41,36,0.85)", chartAxis: "#B7DCD3", chartGrid: "rgba(255,255,255,0.1)",
    shadow: "0 1px 2px rgba(0,0,0,0.2), 0 16px 42px rgba(0,0,0,0.24)",
    hoverShadow: "0 18px 46px rgba(0,0,0,0.32)",
    ambient: "rgba(0,201,167,0.12)", heroStart: "#0D2924", heroEnd: "#103C33", heatmapHigh: "#1F6755",
    shimmer: "rgba(112,228,205,0.08)", selection: "#174F43",
    chartSeries: ["#00C9A7", "#66CDE5", "#BAA0FF", "#E6B862", "#FB91A8", "#6FD29F", "#8CABFA", "#E9AD7D"],
    tones: {
      accent: { text: "#70E4CD", surface: "#123D34", border: "#457D6E", solid: "#176856" },
      success: { text: "#8BE0AF", surface: "#123C2B", border: "#438461", solid: "#176B4D" },
      info: { text: "#9DE0ED", surface: "#103540", border: "#4B7E8A", solid: "#135E75" },
      warning: { text: "#F5D69A", surface: "#3E3018", border: "#997A3E", solid: "#865300" },
      danger: { text: "#FFADC0", surface: "#42242C", border: "#B06578", solid: "#B42342" },
      violet: { text: "#D6BCFF", surface: "#322947", border: "#8B6EB4", solid: "#6442A5" },
      orange: { text: "#FFC49A", surface: "#422F20", border: "#AB7B53", solid: "#A14610" },
    },
  },
  light: {
    background: "#F4FAF8", surface: "#FFFFFF", card: "#FFFFFF",
    primary: "#008F78", text: "#12312D", muted: "#52706A",
    surfaceMuted: "#EAF3EF", border: "#B3CBC4", controlBorder: "#74958C",
    accentText: "#007360", action: "#007561", actionHover: "#005B4C", onAction: "#FFFFFF",
    glass: "rgba(255,255,255,0.92)", chartAxis: "#355E56", chartGrid: "rgba(0,0,0,0.1)",
    shadow: "0 1px 2px rgba(18,49,45,0.06), 0 16px 42px rgba(0,115,96,0.08)",
    hoverShadow: "0 18px 46px rgba(0,115,96,0.14)",
    ambient: "rgba(0,143,120,0.07)", heroStart: "#FFFFFF", heroEnd: "#E4F4EE", heatmapHigh: "#9FD8C5",
    shimmer: "rgba(0,143,120,0.04)", selection: "#D8F1E7",
    chartSeries: ["#007565", "#176B8A", "#7448B0", "#A9650A", "#BD2850", "#176B4D", "#335BD5", "#A34A1A"],
    tones: {
      accent: { text: "#007360", surface: "#E4F5EF", border: "#80B8A9", solid: "#176856" },
      success: { text: "#176B4D", surface: "#E6F4EA", border: "#88B798", solid: "#176B4D" },
      info: { text: "#135E75", surface: "#E7F3F8", border: "#86ADBE", solid: "#135E75" },
      warning: { text: "#865300", surface: "#FFF3D8", border: "#C6A667", solid: "#865300" },
      danger: { text: "#B42342", surface: "#FFF0F3", border: "#D495A5", solid: "#B42342" },
      violet: { text: "#6442A5", surface: "#F2EBFF", border: "#B49BCD", solid: "#6442A5" },
      orange: { text: "#A14610", surface: "#FFF0E3", border: "#CCA480", solid: "#A14610" },
    },
  },
} as const;

/** Fixed colors for QR codes, printed documents and branded inverse surfaces. */
export const exportColors = { paper: "#FFFFFF", ink: "#12312D", qrInk: "#0F172A", brand: "#007360" } as const;

export function themeVariables(theme: Theme): Record<string, string> {
  const c = themeColors[theme];
  const variables: Record<string, string> = {
    ...designTokens,
    "--bg-primary": c.background, "--bg-surface": c.surface, "--bg-card": c.card,
    "--bg-muted": c.surfaceMuted, "--brand-primary": c.primary,
    "--text-primary": c.text, "--text-secondary": c.muted, "--text-accent": c.accentText,
    "--border-color": c.border, "--control-border": c.controlBorder,
    "--card-shadow": c.shadow, "--card-hover-shadow": c.hoverShadow,
    "--action-primary": c.action, "--action-primary-hover": c.actionHover, "--on-primary": c.onAction,
    "--glass-background": c.glass, "--chart-axis": c.chartAxis, "--chart-grid": c.chartGrid,
    "--ambient-color": c.ambient, "--hero-start": c.heroStart, "--hero-end": c.heroEnd,
    "--shimmer-color": c.shimmer, "--selection-color": c.selection, "--heatmap-high": c.heatmapHigh,
    "--chart-fill-opacity": "0.18", "--chart-stop-strong": "0.45", "--chart-stop-weak": "0.02",
    "--text-inverse": exportColors.paper, "--bg-inverse": exportColors.ink,
    "--paper": exportColors.paper, "--paper-ink": exportColors.ink,
    "--print-brand": exportColors.brand, "--print-text-secondary": themeColors.light.muted,
    "--print-bg-muted": themeColors.light.surfaceMuted, "--print-border": themeColors.light.border,
    "--backdrop-color": "rgba(6,31,27,0.65)", "--scanner-mask": "0 0 0 999px rgba(6,31,27,0.55)",
    "--brand-gradient": "linear-gradient(135deg,#075B4C,#135E75)",
    "--opacity-disabled": "0.6", "--opacity-inactive": "0.7", "--opacity-decoration": "0.04",
  };
  c.chartSeries.forEach((color, index) => { variables[`--chart-series-${index + 1}`] = color; });
  Object.entries(c.tones).forEach(([tone, values]) => {
    Object.entries(values as Record<string, string>).forEach(([name, value]) => { variables[`--tone-${tone}-${name}`] = value; });
  });
  return variables;
}

export const chartColors = Array.from({ length: 8 }, (_, index) => `var(--chart-series-${index + 1})`);
export function chartColor(index: number) { return chartColors[index % chartColors.length]; }
