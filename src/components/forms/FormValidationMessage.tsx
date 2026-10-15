import { AlertCircle } from "lucide-react";

export function FormValidationMessage({ id, message }: { id?: string; message?: string | null }) {
  if (!message) return null;
  return <p id={id} role="alert" className="mt-1 flex items-start gap-1 text-xs font-medium text-danger dark:text-danger"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{message}</p>;
}
