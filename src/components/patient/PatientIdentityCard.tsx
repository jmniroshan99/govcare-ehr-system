import { QrCode, ShieldCheck } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import type { SelectedPatientContext } from "../../stores/selectedPatientStore";
import { PatientPhoto } from "./PatientPhoto";

type Props = {
  patient: SelectedPatientContext;
  onOpen?: () => void;
  compact?: boolean;
};

export function PatientIdentityCard({ patient, onOpen, compact = false }: Props) {
  return (
    <Card className="border border-cyan-500/30 bg-slate-950/60">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start gap-4">
          <PatientPhoto
            src={patient.photoUrl}
            name={patient.fullName}
            className={`${compact ? "h-20 w-20" : "h-28 w-28"} rounded-xl border border-cyan-400/30 bg-cyan-500/10`}
            fallbackClassName="text-2xl font-bold text-cyan-100"
          />

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-bold text-white">{patient.fullName}</h3>
              <Badge tone={patient.verified ? "success" : "danger"}>
                <ShieldCheck className="h-3.5 w-3.5" />
                {patient.verified ? "PostgreSQL verified" : "Not verified"}
              </Badge>
            </div>
            <p className="font-semibold text-cyan-300">{patient.patientNo}</p>
            <div className="grid gap-x-5 gap-y-1 text-sm text-slate-200 sm:grid-cols-2">
              <span><strong>NIC:</strong> {patient.nic || "Not recorded"}</span>
              <span><strong>DOB:</strong> {patient.dateOfBirth || "Not recorded"}</span>
              <span><strong>Age:</strong> {patient.age ?? "N/A"}</span>
              <span><strong>Gender:</strong> {patient.gender || "Not recorded"}</span>
              <span><strong>Blood group:</strong> {patient.bloodGroup || "N/A"}</span>
              <span><strong>Phone:</strong> {patient.phone || "Not recorded"}</span>
              {patient.tokenNo && <span><strong>Queue token:</strong> {patient.tokenNo}</span>}
              {patient.departmentName && <span><strong>Department:</strong> {patient.departmentName}</span>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {patient.allergies.length ? patient.allergies.map((item) => <Badge key={`allergy-${item}`} tone="danger">Allergy: {item}</Badge>) : <Badge tone="success">No recorded allergies</Badge>}
          {patient.chronicDiseases.map((item) => <Badge key={`disease-${item}`} tone="warning">{item}</Badge>)}
          {patient.riskFlags.map((item) => <Badge key={`risk-${item}`} tone="info">{item}</Badge>)}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
          <span className="inline-flex items-center gap-1 rounded border border-cyan-500/30 px-2 py-1"><QrCode className="h-3.5 w-3.5" />QR identity linked</span>
          <span className="inline-flex items-center gap-1 rounded border border-cyan-500/30 px-2 py-1"><ShieldCheck className="h-3.5 w-3.5" />Selected patient locked</span>
        </div>

        {onOpen && <Button onClick={onOpen} className="w-full">Open selected patient</Button>}
      </CardContent>
    </Card>
  );
}
