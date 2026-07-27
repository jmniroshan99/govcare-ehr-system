import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Loader2, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "../../lib/utils";
import { fetchSmartSearchSuggestions, type SearchScope } from "../../services/searchService";
import type { SmartSearchSuggestion } from "../../types/search";
import { Input } from "../ui/input";

interface SmartSearchProps {
  value?: string;
  onChange?: (value: string) => void;
  onSelect?: (suggestion: SmartSearchSuggestion) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  limit?: number;
  navigateOnSelect?: boolean;
  scope?: SearchScope;
}

const categoryTone: Record<string, string> = {
  Patient: "bg-cyan-50 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-100",
  Doctor: "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-100",
  Appointment: "bg-indigo-50 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-100",
  Prescription: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
  Medicine: "bg-lime-50 text-lime-800 dark:bg-lime-950 dark:text-lime-100",
  Laboratory: "bg-violet-50 text-violet-800 dark:bg-violet-950 dark:text-violet-100",
  Radiology: "bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-100",
  Admission: "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  Ward: "bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-100",
  User: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
  Module: "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-100",
  Notification: "bg-orange-50 text-orange-900 dark:bg-orange-950 dark:text-orange-100",
  Report: "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-100",
};

export function SmartSearch({
  value,
  onChange,
  onSelect,
  placeholder = "Search patients, doctors, appointments, reports...",
  className,
  inputClassName,
  limit = 8,
  navigateOnSelect = true,
  scope = "all",
}: SmartSearchProps) {
  const [internalValue, setInternalValue] = useState(value ?? "");
  const [suggestions, setSuggestions] = useState<SmartSearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const navigate = useNavigate();
  const id = useId();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const searchValue = value ?? internalValue;

  useEffect(() => {
    if (value !== undefined) setInternalValue(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = searchValue.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = window.setTimeout(() => {
      void fetchSmartSearchSuggestions(trimmed, limit, scope)
        .then((items) => {
          setSuggestions(items);
          setOpen(true);
          setActiveIndex(items.length ? 0 : -1);
        })
        .catch(() => {
          setSuggestions([]);
          setOpen(true);
          setActiveIndex(-1);
        })
        .finally(() => setLoading(false));
    }, 240);

    return () => window.clearTimeout(timer);
  }, [limit, scope, searchValue]);

  const statusText = useMemo(() => {
    if (loading) return "Loading suggestions";
    if (searchValue.trim().length >= 2 && suggestions.length === 0) return "No results found";
    return `${suggestions.length} suggestions`;
  }, [loading, searchValue, suggestions.length]);

  function updateValue(nextValue: string) {
    setInternalValue(nextValue);
    onChange?.(nextValue);
    setOpen(nextValue.trim().length >= 2);
  }

  function selectSuggestion(suggestion: SmartSearchSuggestion) {
    updateValue(suggestion.label);
    setOpen(false);
    onSelect?.(suggestion);
    if (navigateOnSelect && suggestion.href) navigate(suggestion.href);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, suggestions.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    }
    if (event.key === "Enter" && activeIndex >= 0 && suggestions[activeIndex]) {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    }
    if (event.key === "Escape") setOpen(false);
  }

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        aria-autocomplete="list"
        aria-controls={`${id}-suggestions`}
        aria-expanded={open}
        aria-label={placeholder}
        className={cn("pr-10 pl-9", inputClassName)}
        onChange={(event) => updateValue(event.target.value)}
        onFocus={() => searchValue.trim().length >= 2 && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        role="combobox"
        value={searchValue}
      />
      <div className="absolute right-3 top-1/2 z-10 -translate-y-1/2">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : searchValue ? (
          <button type="button" className="rounded-full text-muted-foreground hover:text-foreground" onClick={() => updateValue("")} aria-label="Clear search">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <span className="sr-only" aria-live="polite">{statusText}</span>
      <AnimatePresence>
        {open && searchValue.trim().length >= 2 && (
          <motion.div
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 overflow-hidden rounded-md border border-border bg-white shadow-2xl shadow-slate-900/16 dark:bg-slate-950"
            exit={{ opacity: 0, y: -4, scale: 0.99 }}
            id={`${id}-suggestions`}
            initial={{ opacity: 0, y: -4, scale: 0.99 }}
            role="listbox"
            transition={{ duration: 0.16 }}
          >
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-3 text-sm font-medium text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Searching records...</div>
            ) : suggestions.length ? (
              <div className="max-h-80 overflow-y-auto py-1">
                {suggestions.map((suggestion, index) => {
                  const active = activeIndex === index;
                  return (
                    <button
                      aria-selected={active}
                      className={cn(
                        "flex w-full items-start gap-3 px-3 py-2.5 text-left transition",
                        active ? "bg-teal-700 text-white dark:bg-teal-500 dark:text-slate-950" : "text-foreground hover:bg-teal-50 dark:hover:bg-slate-900",
                      )}
                      key={suggestion.id}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectSuggestion(suggestion)}
                      role="option"
                      type="button"
                    >
                      <span
                        className={cn(
                          "mt-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold",
                          active ? "bg-white/20 text-white ring-1 ring-white/30 dark:bg-slate-950/15 dark:text-slate-950 dark:ring-slate-950/20" : categoryTone[suggestion.category] ?? categoryTone.Module,
                        )}
                      >
                        {suggestion.category}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-sm font-bold", active ? "text-white dark:text-slate-950" : "text-foreground")}>{suggestion.label}</span>
                        <span className={cn("mt-0.5 block truncate text-xs font-medium", active ? "text-teal-50 dark:text-slate-900" : "text-muted-foreground")}>{suggestion.description}</span>
                      </span>
                      <ArrowRight className={cn("mt-1 h-4 w-4", active ? "text-white dark:text-slate-950" : "text-muted-foreground")} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-3 py-3 text-sm font-medium text-muted-foreground">No results found. Try patient ID, NIC, doctor, report, token, or module name.</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
