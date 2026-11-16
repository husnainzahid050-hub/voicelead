/**
 * Validates a post-login `?next=` target. Only same-origin paths inside the
 * dashboard are allowed, which blocks open redirects such as
 * "https://evil.com", "//evil.com", "/\\evil.com" or "javascript:…".
 */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  // Reject control characters and whitespace (header/URL smuggling).
  if (/[\u0000-\u001f\u007f\s]/.test(value)) return null;

  const base = "http://voicelead.invalid";
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return null;
  }
  if (url.origin !== base) return null;
  if (url.pathname !== "/dashboard" && !url.pathname.startsWith("/dashboard/")) return null;

  return `${url.pathname}${url.search}`;
}
