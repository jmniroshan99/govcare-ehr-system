import type { SelectHTMLAttributes } from "react";
import { FormFieldLabel } from "../ui/form-field-label";
import { Select } from "../ui/select";

export function ClinicalEnumSelect({ label, options, ...props }: {
  label: string; options: Array<{ value: string; label: string }>;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  return <label className="block text-sm font-medium"><FormFieldLabel required={props.required}>{label}</FormFieldLabel>
    <Select {...props} aria-required={props.required || undefined} className={`mt-2 ${props.className ?? ""}`}>
      <option value="">Not recorded</option>
      {options.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
    </Select>
  </label>;
}
