import { z } from "zod";
import { LIMITS } from "../constants";
import { COMMON_PASSWORDS } from "./common-passwords";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Email is too long")
  .pipe(z.email("Enter a valid email address"));

/**
 * NIST 800-63B style policy: length over composition rules, plus a
 * blocklist of very common passwords. The 128 cap bounds hashing cost.
 */
export const newPasswordSchema = z
  .string()
  .min(LIMITS.passwordMinChars, `Use at least ${LIMITS.passwordMinChars} characters`)
  .max(LIMITS.passwordMaxChars, `Use at most ${LIMITS.passwordMaxChars} characters`)
  .refine((pw) => !COMMON_PASSWORDS.has(pw.toLowerCase()), {
    message: "This password is too common. Try a short phrase instead.",
  });

export const signUpSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name").max(80, "Name is too long"),
    email: emailSchema,
    password: newPasswordSchema,
  })
  .refine((v) => v.password.toLowerCase() !== v.email, {
    path: ["password"],
    message: "Password must not be your email address",
  });

/** Sign-in never applies the creation policy (old passwords must still work). */
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(LIMITS.passwordMaxChars),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
