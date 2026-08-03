import DOMPurify from "dompurify";

export function sanitizeInput(value: string) {
  return DOMPurify.sanitize(value.trim(), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}
