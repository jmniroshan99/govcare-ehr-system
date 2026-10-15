import { Badge } from "../ui/badge";
import { genderShortLabel, normaliseGenderLabel, type PatientGenderDisplay } from "../../utils/gender";

export function GenderBadge({ value, compact = false }: { value?: PatientGenderDisplay; compact?: boolean }) {
  const label = normaliseGenderLabel(value);
  const tone = label === "Male" ? "info" : label === "Female" ? "warning" : label === "Not recorded" ? "neutral" : "success";
  return (
    <Badge tone={tone}>
      <span aria-hidden="true" className="font-mono">{genderShortLabel(label)}</span>
      {!compact && <span>Gender: {label}</span>}
    </Badge>
  );
}
