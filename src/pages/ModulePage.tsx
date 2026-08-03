import type { ReactNode } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";

interface ModulePageProps {
  title: string;
  description: string;
  action: string;
  rows: string[][];
  children?: ReactNode;
}

export function ModulePage({ title, description, action, rows, children }: ModulePageProps) {
  const { showToast } = useToast();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold">{title}</h1><p className="text-sm text-muted-foreground">{description}</p></div>
        <Button onClick={() => showToast(`${action} is ready for ${title}.`, "success")}>{action}</Button>
      </div>
      {children}
      <Card>
        <CardHeader><CardTitle>Worklist</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <thead><tr><Th>ID</Th><Th>Patient or item</Th><Th>Department</Th><Th>Owner</Th><Th>Status</Th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) => <Td key={cell}>{index === 4 ? <Badge tone={cell === "critical" ? "danger" : cell === "pending" ? "warning" : "success"}>{cell}</Badge> : cell}</Td>)}
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
