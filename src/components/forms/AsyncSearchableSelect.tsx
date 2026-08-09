import { Check, LoaderCircle, RotateCcw, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { SelectOption } from "../../data/referenceOptions";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { cn } from "../../lib/utils";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

export type AsyncSearchableSelectProps = {
  id?: string;
  value?: string;
  selectedOption?: SelectOption | null;
  onChange: (value: string, option?: SelectOption) => void;
  loadOptions: (query: string) => Promise<SelectOption[]>;
  placeholder?: string;
  minQueryLength?: number;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  ariaDescribedBy?: string;
  emptyMessage?: string;
  className?: string;
};

export function AsyncSearchableSelect({
  id,
  value = "",
  selectedOption,
  onChange,
  loadOptions,
  placeholder = "Type to search…",
  minQueryLength = 2,
  disabled,
  required,
  invalid,
  ariaDescribedBy,
  emptyMessage = "No results found.",
  className,
}: AsyncSearchableSelectProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(selectedOption?.label ?? "");
  const [options, setOptions] = useState<SelectOption[]>(selectedOption ? [selectedOption] : []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const debounced = useDebouncedValue(query, 300);

  const selected = useMemo(
    () => options.find((item) => item.value === value) ?? selectedOption ?? null,
    [options, selectedOption, value],
  );

  async function runSearch(term: string) {
    const normalised = term.trim();
    if (normalised.length < minQueryLength) {
      setOptions(selectedOption ? [selectedOption] : []);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const next = await loadOptions(normalised);
      setOptions(next.filter((item, index, values) => values.findIndex((candidate) => candidate.value === item.value) === index));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Search failed.");
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void runSearch(debounced);
    // loadOptions is intentionally controlled by the parent; the debounced term is the search trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  useEffect(() => {
    if (selectedOption && !query) setQuery(selectedOption.label);
  }, [query, selectedOption]);

  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, []);

  useEffect(() => setActiveIndex(0), [options, query]);

  function select(option: SelectOption) {
    if (option.disabled) return;
    onChange(option.value, option);
    setQuery(option.label);
    setOpen(false);
  }

  function moveActive(direction: 1 | -1) {
    if (!options.length) return;
    setActiveIndex((current) => {
      let next = current;
      for (let attempt = 0; attempt < options.length; attempt += 1) {
        next = (next + direction + options.length) % options.length;
        if (!options[next]?.disabled) return next;
      }
      return current;
    });
  }

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
        <Input
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${inputId}-listbox`}
          aria-activedescendant={open && options[activeIndex] ? `${inputId}-option-${activeIndex}` : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={ariaDescribedBy}
          aria-required={required || undefined}
          value={query}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          className="pl-9 pr-16"
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            if (!event.target.value) onChange("");
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); moveActive(1); }
            if (event.key === "ArrowUp") { event.preventDefault(); setOpen(true); moveActive(-1); }
            if (event.key === "Enter" && open && options[activeIndex]) { event.preventDefault(); select(options[activeIndex]); }
            if (event.key === "Escape") setOpen(false);
          }}
        />
        <span className="absolute right-2 top-2.5 flex items-center gap-1">
          {loading && <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />}
          {value && !disabled && (
            <button
              type="button"
              aria-label="Clear selected value"
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => { onChange(""); setQuery(""); setOptions([]); setOpen(false); }}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </span>
      </div>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full min-w-[300px] rounded-lg border border-border bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-950">
          {error && (
            <div className="flex items-center justify-between gap-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-200" role="alert">
              <span>{error}</span>
              <Button type="button" variant="outline" className="min-h-7 px-2 py-1 text-xs" onClick={() => void runSearch(query)}>
                <RotateCcw className="h-3.5 w-3.5" />Retry
              </Button>
            </div>
          )}
          {!error && query.trim().length < minQueryLength && (
            <p className="px-3 py-3 text-sm text-muted-foreground">Enter at least {minQueryLength} characters.</p>
          )}
          {!error && query.trim().length >= minQueryLength && !loading && options.length === 0 && (
            <p className="px-3 py-3 text-sm text-muted-foreground">{emptyMessage}</p>
          )}
          <div id={`${inputId}-listbox`} role="listbox" className="max-h-64 overflow-y-auto">
            {options.map((option, index) => (
              <button
                id={`${inputId}-option-${index}`}
                type="button"
                role="option"
                aria-selected={option.value === value}
                disabled={option.disabled}
                key={option.value}
                className={cn(
                  "flex w-full items-start justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-teal-50 focus:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-teal-950/60 dark:focus:bg-teal-950/60",
                  index === activeIndex && "bg-teal-50 dark:bg-teal-950/60",
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(option)}
              >
                <span>
                  <span className="block font-semibold">{option.label}</span>
                  {option.description && <span className="block text-xs text-muted-foreground">{option.description}</span>}
                </span>
                {option.value === value && <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />}
              </button>
            ))}
          </div>
          {selected && <p className="mt-1 border-t border-border px-3 py-2 text-xs text-muted-foreground">Selected: {selected.label}</p>}
        </div>
      )}
    </div>
  );
}
