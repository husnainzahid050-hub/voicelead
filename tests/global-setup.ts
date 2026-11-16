import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

/**
 * Builds a fresh, seeded SQLite database for integration tests.
 * Env (DATABASE_URL=file:./prisma/test.db) comes from vitest.config.mts,
 * so this never touches the development database.
 */
export default function setup(): void {
  if (!process.env.DATABASE_URL?.includes("test.db")) {
    throw new Error("Refusing to reset a non-test database");
  }
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    rmSync(`prisma/test.db${suffix}`, { force: true });
  }
  execSync("npx prisma migrate deploy", { stdio: "pipe" });
  execSync("npx tsx prisma/seed.ts", { stdio: "pipe" });
}
