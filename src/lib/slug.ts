/**
 * Public intake URL slugs: /intake/<slug>.
 * Lowercase ASCII, digits and single dashes; 3–48 chars (see slugSchema).
 */

/** Paths and words a clinic must never be able to claim. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "dashboard",
  "help",
  "intake",
  "login",
  "logout",
  "new",
  "onboarding",
  "settings",
  "sign-in",
  "sign-out",
  "sign-up",
  "signin",
  "signup",
  "static",
  "support",
  "voicelead",
  "www",
]);

const MAX_BASE_LENGTH = 40; // leaves room for a "-NN" suffix within 48

/**
 * Best-effort slug from a display name. Returns "" when nothing usable
 * remains (e.g. a name written only in Urdu script); callers then fall back
 * to a generated slug.
 */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_BASE_LENGTH)
    .replace(/-+$/g, "");
  return slug.length >= 3 ? slug : "";
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

/**
 * Candidate slugs in the order they should be tried:
 * "smilecare-dental", "smilecare-dental-2", "smilecare-dental-3", …
 */
export function slugCandidates(base: string, count = 20): string[] {
  const candidates = [base];
  for (let n = 2; n <= count; n++) candidates.push(`${base}-${n}`);
  return candidates.filter((s) => !isReservedSlug(s));
}
