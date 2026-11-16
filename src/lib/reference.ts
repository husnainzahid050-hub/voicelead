import { randomInt } from "node:crypto";

/**
 * Lead reference numbers, e.g. "VL-7K3M9Q".
 * - Cryptographically random (not sequential, so they cannot be enumerated).
 * - Alphabet excludes look-alikes 0/O, 1/I/L so customers can read them over the phone.
 * - 31^6 ≈ 887M combinations; uniqueness is still enforced by the DB unique index.
 */
export const REFERENCE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const REFERENCE_PATTERN = /^VL-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;

export function generateReferenceNumber(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += REFERENCE_ALPHABET.charAt(randomInt(REFERENCE_ALPHABET.length));
  }
  return `VL-${code}`;
}

export function isReferenceNumber(value: string): boolean {
  return REFERENCE_PATTERN.test(value);
}
