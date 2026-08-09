function parseDateOnly(value?: string | null) {
  const raw = value?.trim();
  if (!raw) return null;

  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    const parsed = new Date(year, month - 1, day);
    if (parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day) return parsed;
    return null;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function calculateAgeYears(dateOfBirth?: string | null, asOf = new Date()) {
  const birthday = parseDateOnly(dateOfBirth);
  if (!birthday || birthday.getTime() > asOf.getTime()) return undefined;

  let age = asOf.getFullYear() - birthday.getFullYear();
  const birthdayPassed = asOf.getMonth() > birthday.getMonth()
    || (asOf.getMonth() === birthday.getMonth() && asOf.getDate() >= birthday.getDate());
  if (!birthdayPassed) age -= 1;
  return age >= 0 && age <= 130 ? age : undefined;
}

export function resolveAgeYears(dateOfBirth?: string | null, storedAge?: number | null) {
  const calculated = calculateAgeYears(dateOfBirth);
  if (calculated !== undefined) return calculated;
  return typeof storedAge === "number" && Number.isFinite(storedAge) && storedAge >= 0 ? Math.floor(storedAge) : undefined;
}

export function formatPatientAge(dateOfBirth?: string | null, storedAge?: number | null) {
  const age = resolveAgeYears(dateOfBirth, storedAge);
  return age === undefined ? "Age not recorded" : `${age} ${age === 1 ? "year" : "years"}`;
}
