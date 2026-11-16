import { DEFAULT_TIMEZONE } from "./constants";
import { formatDateForMessage, formatTimeForMessage } from "./leads/follow-up";

/** "5 min ago", "3 h ago", "2 days ago" — for scanning a list quickly. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/** "16 Nov 2026, 10:42 AM" in the clinic's timezone. */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: DEFAULT_TIMEZONE,
  }).format(new Date(iso));
}

/** "Tue 17 Nov, 5:00 PM", "Tue 17 Nov", "5:00 PM" or null. */
export function formatPreferred(date: string | null, time: string | null): string | null {
  const d = date ? formatDateForMessage(date) : null;
  const t = time ? formatTimeForMessage(time) : null;
  if (d && t) return `${d}, ${t}`;
  return d ?? t;
}

export function confidenceLabel(value: number): "High" | "Medium" | "Low" {
  return value >= 0.85 ? "High" : value >= 0.6 ? "Medium" : "Low";
}
