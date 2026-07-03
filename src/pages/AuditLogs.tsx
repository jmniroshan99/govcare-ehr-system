import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, Td, Th } from "../components/ui/table";

export default function AuditLogs() {
  const rows = [
    ["2026-06-13 08:10", "doctor", "read", "patients/PAT-2026-0001", "10.0.0.22"],
    ["2026-06-13 08:15", "pharmacist", "update", "medicines/MED-018", "10.0.0.31"],
    ["2026-06-13 08:19", "lab_technician", "create", "labResults/LAB-812", "10.0.0.42"],
  ];

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold">Audit logs</h1><p className="text-sm text-muted-foreground">Append-only operational audit trail for clinical and administrative activity.</p></div>
      <Card>
        <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <thead><tr><Th>Timestamp</Th><Th>Role</Th><Th>Action</Th><Th>Document</Th><Th>Device/IP</Th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.join("-")}>{row.map((cell) => <Td key={cell}>{cell}</Td>)}</tr>)}</tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
