import "server-only";
import { hash, verify } from "@node-rs/argon2";

// OWASP-recommended argon2id parameters (19 MiB, 2 iterations, 1 lane).
// @node-rs/argon2 defaults to the argon2id variant.
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    // Malformed hash: treat as a failed match, never as a crash.
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/**
 * Burn the same CPU time as a real verification when the email does not
 * exist, so response timing does not reveal which emails have accounts.
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hash("voicelead-timing-equalizer", OPTIONS);
  await verifyPassword(await dummyHash, password);
  return false;
}
