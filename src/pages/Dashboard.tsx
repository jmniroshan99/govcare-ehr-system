import { Activity, Ambulance, BedDouble, FlaskConical, Pill, UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageTransition, Reveal, SectionReveal, Stagger } from "../components/motion/PageTransition";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, Td, Th } from "../components/ui/table";

const stats = [
  { labelKey: "dashboard.stats.opdToday", value: "1,248", icon: UsersRound, tone: "info" as const },
  { labelKey: "dashboard.stats.activeAdmissions", value: "384", icon: BedDouble, tone: "success" as const },
  { labelKey: "dashboard.stats.emergencyTriage", value: "32", icon: Ambulance, tone: "danger" as const },
  { labelKey: "dashboard.stats.labPending", value: "146", icon: FlaskConical, tone: "warning" as const },
  { labelKey: "dashboard.stats.lowStockMeds", value: "18", icon: Pill, tone: "warning" as const },
  { labelKey: "dashboard.stats.criticalAlerts", value: "7", icon: Activity, tone: "danger" as const },
];

const flow = [
  { hour: "08", opd: 132, admissions: 18 },
  { hour: "10", opd: 248, admissions: 26 },
  { hour: "12", opd: 386, admissions: 38 },
  { hour: "14", opd: 302, admissions: 31 },
  { hour: "16", opd: 180, admissions: 22 },
];

const queues = [
  ["OPD-124", "Nimal Silva", "Medical OPD", "Dr. Perera", "urgent"],
  ["OPD-125", "Fathima Rizna", "Paediatrics", "Dr. Fernando", "routine"],
  ["ED-032", "K. Thevarajah", "Emergency", "Resus team", "critical"],
];

export function Dashboard() {
  const { t } = useTranslation();

  return (
    <PageTransition>
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">{t("dashboard.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
      </div>
      <Stagger>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <Reveal key={stat.labelKey}>
            <Card>
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t(stat.labelKey)}</p>
                  <p className="mt-2 text-3xl font-bold text-slate-950">{stat.value}</p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-md bg-muted">
                  <stat.icon className="h-6 w-6 text-primary" />
                </div>
              </CardContent>
            </Card>
          </Reveal>
        ))}
      </section>
      </Stagger>
      <SectionReveal>
      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader><CardTitle>{t("dashboard.patientFlow")}</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={flow}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="opd" stroke="#0f766e" fill="#99f6e4" />
                <Area type="monotone" dataKey="admissions" stroke="#155e75" fill="#a5f3fc" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("dashboard.priorityQueue")}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <thead><tr><Th>{t("dashboard.table.token")}</Th><Th>{t("dashboard.table.patient")}</Th><Th>{t("dashboard.table.unit")}</Th><Th>{t("dashboard.table.status")}</Th></tr></thead>
              <tbody>
                {queues.map((row) => (
                  <tr key={row[0]}>
                    <Td className="font-semibold">{row[0]}</Td>
                    <Td>{row[1]}<br /><span className="text-xs text-muted-foreground">{row[3]}</span></Td>
                    <Td>{row[2]}</Td>
                    <Td><Badge tone={row[4] === "critical" ? "danger" : row[4] === "urgent" ? "warning" : "success"}>{row[4]}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      </section>
      </SectionReveal>
    </div>
    </PageTransition>
  );
}
