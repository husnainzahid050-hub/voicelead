#!/usr/bin/env node
/**
 * Local PostgreSQL without installing PostgreSQL.
 *
 * Starts an embedded Postgres (PGlite, a real Postgres compiled to WebAssembly)
 * behind a normal Postgres socket, applies migrations, optionally seeds, then
 * runs the given command with DATABASE_URL pointing at it.
 *
 *   node scripts/local-db.mjs next dev          # persistent data in .pglite/dev
 *   node scripts/local-db.mjs --seed            # (re)seed demo data and exit
 *   node scripts/local-db.mjs --memory ...      # throwaway in-memory database
 *
 * Production uses a hosted Postgres; this script is development-only.
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const args = process.argv.slice(2);
const seed = args.includes("--seed");
const memory = args.includes("--memory");
const command = args.filter((a) => !a.startsWith("--")).join(" ");
const port = Number(process.env.LOCAL_DB_PORT ?? 5433);

let db;
if (memory) {
  db = new PGlite();
} else {
  mkdirSync(".pglite", { recursive: true });
  db = new PGlite("./.pglite/dev");
}
await db.waitReady;

const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 10 });
await server.start();

const url = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable`;
const env = { ...process.env, DATABASE_URL: url, DATABASE_POOL_MAX: "5" };

function run(cmd) {
  return new Promise((resolve) => {
    const child = spawn(cmd, { stdio: "inherit", shell: true, env });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function shutdown(code) {
  await server.stop().catch(() => {});
  await db.close().catch(() => {});
  process.exit(code);
}

console.log(`[local-db] Postgres (PGlite) on ${url}`);
if ((await run("npx prisma migrate deploy")) !== 0) await shutdown(1);
if (seed && (await run("npx tsx prisma/seed.ts")) !== 0) await shutdown(1);

if (!command) await shutdown(0);

const child = spawn(command, { stdio: "inherit", shell: true, env });
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code) => void shutdown(code ?? 0));
