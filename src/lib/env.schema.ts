import { z } from "zod";

/**
 * Environment contract. Pure (no `server-only`) so it can be reused by
 * instrumentation (startup check), the seed script and tests.
 * Application code should import `env` from ./env instead.
 */
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, "DATABASE_URL must be a PostgreSQL URL (postgresql://...)"),
  // Connections per server instance. Keep small on serverless + free hosted Postgres.
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
  APP_URL: z.url("APP_URL must be a full URL, e.g. http://localhost:3000"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  IP_HASH_SECRET: z.string().min(32, "IP_HASH_SECRET must be at least 32 characters"),
  // Required from Phase 3 onward; optional so the foundation runs without a key.
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).default("gemini-flash-lite-latest"),
  // "mock" = deterministic rule-based stand-in for automated tests only.
  AI_PROVIDER: z.enum(["gemini", "mock"]).default("gemini"),
  // When "true", the sign-in page shows the seeded demo accounts and password.
  SHOW_DEMO_LOGIN: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  DEMO_OWNER_PASSWORD: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: NodeJS.ProcessEnv): ServerEnv {
  const result = serverEnvSchema.safeParse({
    ...source,
    // Treat empty strings from .env as "unset".
    GEMINI_API_KEY: source.GEMINI_API_KEY || undefined,
    GEMINI_MODEL: source.GEMINI_MODEL || undefined,
    DATABASE_POOL_MAX: source.DATABASE_POOL_MAX || undefined,
    AI_PROVIDER: source.AI_PROVIDER || undefined,
    SHOW_DEMO_LOGIN: source.SHOW_DEMO_LOGIN || undefined,
    DEMO_OWNER_PASSWORD: source.DEMO_OWNER_PASSWORD || undefined,
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
