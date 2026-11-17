import { exec } from "node:child_process";
import { promisify } from "node:util";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

/**
 * Starts a throwaway in-memory PostgreSQL (PGlite) for the test run, applies
 * the real migrations and seeds the demo data. Never touches a real database.
 */
export default async function setup(): Promise<() => Promise<void>> {
  const url = process.env.DATABASE_URL ?? "";
  const port = Number(new URL(url).port);
  if (!url.includes("127.0.0.1") || !port)
    throw new Error("Tests must use the local test database");

  const db = new PGlite();
  await db.waitReady;
  const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 10 });
  await server.start();

  // Async on purpose: the database runs in this same process, so a blocking
  // execSync would stop it from answering the migration.
  const run = promisify(exec);
  await run("npx prisma migrate deploy");
  await run("npx tsx prisma/seed.ts");

  return async () => {
    await server.stop();
    await db.close();
  };
}
