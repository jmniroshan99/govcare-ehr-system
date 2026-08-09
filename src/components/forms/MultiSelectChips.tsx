import { Plus, X } from "lucide-react";
import { useState } from "react";
import type { SelectOption } from "../../data/referenceOptions";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { SearchableSelect } from "./SearchableSelect";

export function MultiSelectChips({ values, options, onChange, allowCustom = false, placeholder = "Select values", noValueLabel }: { values: string[]; options: SelectOption[]; onChange: (values: string[]) => void; allowCustom?: boolean; placeholder?: string; noValueLabel?: string }) {
  const [custom, setCustom] = useState("");
  const remaining = options.filter((option) => !values.includes(option.value));
  function add(value: string) { if (value && !values.includes(value)) onChange([...values, value]); }
  return <div className="space-y-2">
    <SearchableSelect value="" options={remaining} onChange={add} placeholder={placeholder} clearable={false} />
    {allowCustom && <div className="flex gap-2"><Input value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Other — specify" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(custom.trim()); setCustom(""); } }} /><Button type="button" variant="outline" onClick={() => { add(custom.trim()); setCustom(""); }}><Plus className="h-4 w-4" />Add</Button></div>}
    <div className="flex min-h-8 flex-wrap gap-2">{values.length === 0 && noValueLabel && <span className="text-xs text-muted-foreground">{noValueLabel}</span>}{values.map((value) => <span key={value} className="inline-flex items-center gap-1 rounded-full border border-teal-300 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-900 dark:border-teal-700 dark:bg-teal-950/60 dark:text-teal-100">{options.find((item) => item.value === value)?.label ?? value}<button type="button" aria-label={`Remove ${value}`} onClick={() => onChange(values.filter((item) => item !== value))}><X className="h-3.5 w-3.5" /></button></span>)}</div>
  </div>;
}
