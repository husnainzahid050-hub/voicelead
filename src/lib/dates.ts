import { DEFAULT_TIMEZONE } from "./constants";

/** YYYY-MM-DD for `date` in `timeZone` (en-CA formats as ISO). */
export function isoDateInTimezone(date: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(date);
}

/** Weekday name ("Monday") for `date` in `timeZone`. */
export function weekdayInTimezone(date: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(date);
}

/** Add whole days to a YYYY-MM-DD string (calendar arithmetic in UTC, DST-safe). */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** ISO date strings compare correctly as strings. */
export function isIsoDateWithin(iso: string, fromIso: string, toIso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && iso >= fromIso && iso <= toIso;
}
