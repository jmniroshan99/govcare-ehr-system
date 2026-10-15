import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Loader2, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { canAccessPath } from "../../lib/roleAccess";
import { useAuthStore } from "../../stores/authStore";
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
  Patient: "bg-info-surface text-info dark:bg-info-solid dark:text-info",
  Doctor: "bg-accent-surface text-accent dark:bg-accent-solid dark:text-accent",
  Appointment: "bg-violet-surface text-violet dark:bg-violet-solid dark:text-violet",
  Prescription: "bg-success-surface text-success dark:bg-success-solid dark:text-success",
  Medicine: "bg-success-surface text-success dark:bg-success-solid dark:text-success",
  Laboratory: "bg-violet-surface text-violet dark:bg-violet-solid dark:text-violet",
  Radiology: "bg-info-surface text-info dark:bg-info-solid dark:text-info",
  Admission: "bg-warning-surface text-warning dark:bg-warning-solid dark:text-warning",
  Ward: "bg-danger-surface text-danger dark:bg-danger-solid dark:text-danger",
  User: "bg-muted text-foreground dark:bg-surface dark:text-on-solid",
  Module: "bg-accent-surface text-accent dark:bg-accent-solid dark:text-accent",
  Notification: "bg-orange-surface text-orange dark:bg-orange-solid dark:text-orange",
  Report: "bg-info-surface text-info dark:bg-info-solid dark:text-info",
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
  const profile = useAuthStore((state) => state.profile);
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

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void fetchSmartSearchSuggestions(trimmed, limit, scope)
        .then((items) => {
          if (cancelled) return;
          const accessible = navigateOnSelect ? items.filter((item) => canAccessPath(profile, item.href)) : items;
          setSuggestions(accessible);
          setOpen(true);
          setActiveIndex(accessible.length ? 0 : -1);
        })
        .catch(() => {
          if (cancelled) return;
          setSuggestions([]);
          setOpen(true);
          setActiveIndex(-1);
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 240);

    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [limit, navigateOnSelect, profile, scope, searchValue]);

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
    if (navigateOnSelect && suggestion.href && canAccessPath(profile, suggestion.href)) navigate(suggestion.href);
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
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
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
            className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 overflow-hidden rounded-md border border-border bg-surface shadow-2xl shadow-shadow-tone dark:bg-surface"
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
                        active ? "bg-accent-solid text-on-solid dark:bg-accent-solid dark:text-on-solid" : "text-foreground hover:bg-accent-surface dark:hover:bg-surface",
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
                          active ? "bg-surface text-on-solid ring-1 ring-border dark:bg-surface dark:text-on-solid dark:ring-border" : categoryTone[suggestion.category] ?? categoryTone.Module,
                        )}
                      >
                        {suggestion.category}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-sm font-bold", active ? "text-on-solid dark:text-on-solid" : "text-foreground")}>{suggestion.label}</span>
                        <span className={cn("mt-0.5 block truncate text-xs font-medium", active ? "text-accent dark:text-on-solid" : "text-muted-foreground")}>{suggestion.description}</span>
                      </span>
                      <ArrowRight className={cn("mt-1 h-4 w-4", active ? "text-on-solid dark:text-on-solid" : "text-muted-foreground")} />
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
