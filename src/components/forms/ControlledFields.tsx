import { useId, type InputHTMLAttributes } from "react";
import { MEASUREMENT_LIMITS, YES_NO_UNKNOWN_OPTIONS, type SelectOption } from "../../data/referenceOptions";
import { cn } from "../../lib/utils";
import { Input } from "../ui/input";
import { SearchableSelect } from "./SearchableSelect";

export function YesNoUnknownSelect({ value = "unknown", onChange, id, disabled }: { value?: string; onChange: (value: string) => void; id?: string; disabled?: boolean }) {
  return <SearchableSelect id={id} value={value} options={YES_NO_UNKNOWN_OPTIONS} onChange={onChange} disabled={disabled} clearable={false} />;
}

export function DatePicker(props: InputHTMLAttributes<HTMLInputElement>) { return <Input type="date" {...props} />; }
export function DateTimePicker(props: InputHTMLAttributes<HTMLInputElement>) { return <Input type="datetime-local" {...props} />; }
export function TimePicker(props: InputHTMLAttributes<HTMLInputElement>) { return <Input type="time" {...props} />; }

export function NumericField({ unit, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { unit?: string }) {
  return <div className={cn("relative", className)}><Input type="number" inputMode="decimal" className={unit ? "pr-16" : undefined} {...props} />{unit && <span className="pointer-events-none absolute right-3 top-3 text-xs font-semibold text-muted-foreground">{unit}</span>}</div>;
}

export function MeasurementField({ kind, value, onChange, id, disabled, required }: { kind: keyof typeof MEASUREMENT_LIMITS; value: string | number; onChange: (value: string) => void; id?: string; disabled?: boolean; required?: boolean }) {
  const settings = MEASUREMENT_LIMITS[kind];
  return <NumericField id={id} value={value} min={settings.min} max={settings.max} step={settings.step} unit={settings.unit} disabled={disabled} required={required} onChange={(event) => onChange(event.target.value)} />;
}

export function PhoneNumberField({ value, onChange, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & { value?: string; onChange: (value: string) => void }) {
  return <Input type="tel" inputMode="tel" value={value} placeholder="07XXXXXXXX or +947XXXXXXXX" {...props} onChange={(event) => onChange(event.target.value.replace(/[^+\d\s()-]/g, ""))} />;
}

export function IdentifierField({ kind, value, onChange, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & { kind: "nic" | "passport" | "patient"; value?: string; onChange: (value: string) => void }) {
  const generatedId = useId();
  const pattern = kind === "nic" ? "(?:\\d{9}[VvXx]|\\d{12})" : undefined;
  return <Input id={props.id ?? generatedId} value={value} pattern={pattern} autoCapitalize="characters" {...props} onChange={(event) => onChange(kind === "passport" ? event.target.value.toUpperCase().replace(/\s+/g, "") : event.target.value.trimStart())} />;
}

export function StaticControlledSelect({ value, options, onChange, placeholder = "Select", id, disabled, required }: { value?: string; options: SelectOption[]; onChange: (value: string) => void; placeholder?: string; id?: string; disabled?: boolean; required?: boolean }) {
  return <SearchableSelect id={id} value={value} options={options} onChange={onChange} placeholder={placeholder} disabled={disabled} required={required} />;
}
