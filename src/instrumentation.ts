import { parseServerEnv } from "@/lib/env.schema";

/**
 * Runs once when the server starts. Validating here makes a misconfigured
 * deployment fail immediately instead of on the first request that needs a secret.
 */
export function register(): void {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    parseServerEnv(process.env);
  }
}
