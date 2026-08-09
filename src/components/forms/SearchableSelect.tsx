import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { SelectOption } from "../../data/referenceOptions";
import { cn } from "../../lib/utils";
import { Input } from "../ui/input";

export type SearchableSelectProps = {
  id?: string;
  value?: string;
  options: SelectOption[];
  onChange: (value: string, option?: SelectOption) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  clearable?: boolean;
  invalid?: boolean;
  ariaDescribedBy?: string;
  className?: string;
  emptyMessage?: string;
};

export function SearchableSelect({ id, value = "", options, onChange, placeholder = "Select an option", searchPlaceholder = "Type to search…", disabled, required, clearable = true, invalid, ariaDescribedBy, className, emptyMessage = "No matching options." }: SearchableSelectProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter((option) => [option.label, option.value, option.description, ...(option.keywords ?? [])].filter(Boolean).some((item) => String(item).toLowerCase().includes(term)));
  }, [options, query]);

  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, []);

  useEffect(() => setActiveIndex(0), [query, open]);

  function select(option: SelectOption) {
    if (option.disabled) return;
    onChange(option.value, option);
    setQuery("");
    setOpen(false);
  }

  return <div ref={wrapperRef} className={cn("relative", className)}>
    <button
      id={inputId}
      type="button"
      role="combobox"
      aria-expanded={open}
      aria-controls={`${inputId}-listbox`}
      aria-invalid={invalid || undefined}
      aria-describedby={ariaDescribedBy}
      aria-required={required || undefined}
      disabled={disabled}
      className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-border bg-white px-3 text-left text-sm font-medium text-slate-900 shadow-sm focus:border-primary focus:ring-2 focus:ring-teal-600/20 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      onClick={() => setOpen((current) => !current)}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0))); }
        if (event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.max(index - 1, 0)); }
        if (event.key === "Enter" && open && filtered[activeIndex]) { event.preventDefault(); select(filtered[activeIndex]); }
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <span className={selected ? "truncate" : "truncate text-muted-foreground"}>{selected?.label ?? placeholder}</span>
      <span className="flex shrink-0 items-center gap-1">
        {clearable && value && !disabled && <span role="button" tabIndex={-1} aria-label="Clear selection" className="rounded p-0.5 hover:bg-muted" onClick={(event) => { event.stopPropagation(); onChange(""); }}><X className="h-4 w-4" /></span>}
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </span>
    </button>
    {open && !disabled && <div className="absolute z-50 mt-1 w-full min-w-[260px] rounded-lg border border-border bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-950">
      <div className="relative mb-2"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} className="pl-9" onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0))); } if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); } if (event.key === "Enter" && filtered[activeIndex]) { event.preventDefault(); select(filtered[activeIndex]); } if (event.key === "Escape") setOpen(false); }} /></div>
      <div id={`${inputId}-listbox`} role="listbox" className="max-h-64 overflow-y-auto">
        {filtered.map((option, index) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} disabled={option.disabled} className={cn("flex w-full items-start justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-teal-50 focus:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-teal-950/60 dark:focus:bg-teal-950/60", index === activeIndex && "bg-teal-50 dark:bg-teal-950/60")} onMouseEnter={() => setActiveIndex(index)} onClick={() => select(option)}><span><span className="block font-semibold">{option.label}</span>{option.description && <span className="block text-xs text-muted-foreground">{option.description}</span>}</span>{option.value === value && <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />}</button>)}
        {filtered.length === 0 && <p className="px-3 py-4 text-center text-sm text-muted-foreground">{emptyMessage}</p>}
      </div>
    </div>}
  </div>;
}
