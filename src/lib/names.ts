const HONORIFICS = new Set([
  "dr",
  "mr",
  "mrs",
  "ms",
  "miss",
  "prof",
  "sir",
  "madam",
  "syed",
  "hafiz",
]);

/**
 * Friendly short name for greetings: "Dr. Hina Farooq" → "Hina",
 * "Syed Ali Raza" → "Ali". Falls back to the full name.
 */
export function greetingName(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  const first = words.find((w) => !HONORIFICS.has(w.toLowerCase().replace(/\.$/, "")));
  return first ?? fullName.trim();
}
