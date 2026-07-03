import { Eye, EyeOff, Lock, Plus, Save, Settings2, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { useToast } from "../components/ui/toast-context";
import type { Role } from "../types/ehr";
import { createDefaultPatientFieldConfiguration, getPatientFieldConfiguration, patientFieldDefinitions, savePatientFieldConfiguration, type PatientFieldId, type PatientFieldState } from "../utils/patientFieldPolicy";
import { useAuthStore } from "../stores/authStore";

const fieldStates: PatientFieldState[] = ["visible", "hidden", "required", "optional", "read-only"];
const roleOptions: Role[] = ["super_admin", "hospital_admin", "doctor", "nurse", "receptionist", "records_officer", "patient"];

export function PatientFieldConfiguration() {
  const { showToast } = useToast();
  const profile = useAuthStore((state) => state.profile);
  const [config, setConfig] = useState(() => getPatientFieldConfiguration());
  const [section, setSection] = useState("all");
  const [newGender, setNewGender] = useState("");
  const filteredFields = useMemo(() => section === "all" ? patientFieldDefinitions : patientFieldDefinitions.filter((field) => field.section === section), [section]);

  function updateFieldState(fieldId: PatientFieldId, state: PatientFieldState) {
    setConfig((current) => ({
      ...current,
      fields: { ...current.fields, [fieldId]: { ...current.fields[fieldId], state } },
    }));
  }

  function toggleRole(fieldId: PatientFieldId, role: Role) {
    setConfig((current) => {
      const policy = current.fields[fieldId];
      const visibleToRoles = policy.visibleToRoles.includes(role) ? policy.visibleToRoles.filter((item) => item !== role) : [...policy.visibleToRoles, role];
      return { ...current, fields: { ...current.fields, [fieldId]: { ...policy, visibleToRoles } } };
    });
  }

  function saveConfig() {
    const updated = { ...config, updatedBy: profile?.uid ?? "local-admin" };
    savePatientFieldConfiguration(updated);
    setConfig(updated);
    showToast("Patient field policy saved.", "success");
  }

  function resetConfig() {
    const next = createDefaultPatientFieldConfiguration(profile?.hospitalId);
    savePatientFieldConfiguration(next);
    setConfig(next);
    showToast("Default patient field policy restored.", "info");
  }

  function addGenderOption() {
    const value = newGender.trim();
    if (!value || config.genderOptions.includes(value)) return;
    setConfig((current) => ({ ...current, genderOptions: [...current.genderOptions, value] }));
    setNewGender("");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Patient field configuration</h1>
          <p className="text-sm text-muted-foreground">Control patient registration/profile fields as visible, hidden, required, optional, or read-only by hospital policy.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={resetConfig}><SlidersHorizontal className="h-4 w-4" />Reset defaults</Button>
          <Button onClick={saveConfig}><Save className="h-4 w-4" />Save policy</Button>
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary" />Production storage</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">Firestore-ready collection: <span className="font-mono font-semibold text-foreground">patientFieldConfigurations/{config.hospitalId}</span></p>
              <div className="grid gap-2">
                <Badge tone="success">Hospital isolation: {config.hospitalId}</Badge>
                <Badge tone="info">Admin writes through Cloud Function</Badge>
                <Badge tone="warning">Sensitive fields can be hidden by role</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Gender options</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={config.genderEnabled} onChange={(event) => setConfig((current) => ({ ...current, genderEnabled: event.target.checked }))} />
                Enable gender field
              </label>
              <div className="flex flex-wrap gap-2">
                {config.genderOptions.map((option) => (
                  <button key={option} className="rounded-full border border-border bg-card px-3 py-1 text-sm font-semibold text-foreground" type="button" onClick={() => setConfig((current) => ({ ...current, genderOptions: current.genderOptions.filter((item) => item !== option) }))}>
                    {option}
                  </button>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input value={newGender} onChange={(event) => setNewGender(event.target.value)} placeholder="Add custom gender option" />
                <Button type="button" variant="outline" onClick={addGenderOption}><Plus className="h-4 w-4" />Add</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Patient field policies</CardTitle>
              <Select className="max-w-56" value={section} onChange={(event) => setSection(event.target.value)}>
                <option value="all">All sections</option>
                <option value="identity">Identity</option>
                <option value="contact">Contact</option>
                <option value="guardian">Guardian</option>
                <option value="medical">Medical</option>
                <option value="social">Social</option>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredFields.map((field) => {
              const policy = config.fields[field.id];
              return (
                <div key={field.id} className="rounded-md border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{field.label}</p>
                      <p className="text-xs text-muted-foreground">{field.section} | {field.type}{field.sensitive ? " | sensitive" : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {policy.state === "hidden" ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : policy.state === "read-only" ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-primary" />}
                      <Select className="w-36" value={policy.state} onChange={(event) => updateFieldState(field.id, event.target.value as PatientFieldState)}>
                        {fieldStates.map((state) => <option key={state} value={state}>{state}</option>)}
                      </Select>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {roleOptions.map((role) => (
                      <button
                        key={role}
                        type="button"
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${policy.visibleToRoles.includes(role) ? "border-teal-300 bg-teal-50 text-teal-950 dark:bg-teal-950 dark:text-teal-50" : "border-border bg-muted text-muted-foreground"}`}
                        onClick={() => toggleRole(field.id, role)}
                      >
                        {role.replaceAll("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
