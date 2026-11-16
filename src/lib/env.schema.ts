import { z } from "zod";

/**
 * Environment contract. Pure (no `server-only`) so it can be reused by
 * instrumentation (startup check), the seed script and tests.
 * Application code should import `env` from ./env instead.
 */
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_URL: z.url("APP_URL must be a full URL, e.g. http://localhost:3000"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  IP_HASH_SECRET: z.string().min(32, "IP_HASH_SECRET must be at least 32 characters"),
  // Required from Phase 3 onward; optional so the foundation runs without a key.
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: NodeJS.ProcessEnv): ServerEnv {
  const result = serverEnvSchema.safeParse({
    ...source,
    // Treat empty strings from .env as "unset".
    GEMINI_API_KEY: source.GEMINI_API_KEY || undefined,
    GEMINI_MODEL: source.GEMINI_MODEL || undefined,
  });
  if (!result.success) {
    // Only variable names and rule messages are printed, never values.
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}\nSee .env.example.`);
  }
  return result.data;
}
