import "server-only";
import type { SignInInput, SignUpInput } from "@/lib/schemas/auth";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "@/server/auth/password";
import { isUniqueViolation } from "@/server/repositories/errors";
import { createOwnerUser, findUserCredentialsByEmail } from "@/server/repositories/user";

/**
 * Credential logic only. Cookies, rate limits and redirects live in the
 * Server Actions so this stays testable and transport-agnostic.
 */

export type SignUpResult = { ok: true; userId: string } | { ok: false; reason: "email_taken" };

export async function registerOwner(input: SignUpInput): Promise<SignUpResult> {
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await createOwnerUser({ name: input.name, email: input.email, passwordHash });
    return { ok: true, userId: user.id };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "email_taken" };
    throw error;
  }
}

export type SignInResult = { ok: true; userId: string; businessId: string | null } | { ok: false };

export async function verifyCredentials(input: SignInInput): Promise<SignInResult> {
  const user = await findUserCredentialsByEmail(input.email);
  if (!user) {
    await verifyAgainstDummy(input.password); // equalize timing
    return { ok: false };
  }
  const valid = await verifyPassword(user.passwordHash, input.password);
  return valid ? { ok: true, userId: user.id, businessId: user.businessId } : { ok: false };
}
