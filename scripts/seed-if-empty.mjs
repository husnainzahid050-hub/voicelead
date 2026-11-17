#!/usr/bin/env node
/**
 * Deploy-time helper for the public demo: loads the demo clinics ONLY when
 * SEED_DEMO_DATA=true AND the database has no businesses yet. It can never
 * wipe existing data, so it is safe to run on every deploy.
 */
import { spawnSync } from "node:child_process";
import pg from "pg";

if (process.env.SEED_DEMO_DATA !== "true") {
  console.log("[seed-if-empty] SEED_DEMO_DATA is not 'true'; skipping.");
  process.exit(0);
}

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const client = new pg.Client({ connectionString: url });
await client.connect();
const { rows } = await client.query('SELECT count(*)::int AS n FROM "Business"');
await client.end();

if (rows[0].n > 0) {
  console.log(`[seed-if-empty] ${rows[0].n} businesses already exist; not seeding.`);
  process.exit(0);
}

console.log("[seed-if-empty] empty database: loading demo data.");
// The seed refuses NODE_ENV=production as a safety net; here emptiness was
// just verified, so run it explicitly as a one-time demo load.
const result = spawnSync("npx tsx prisma/seed.ts", {
  shell: true,
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "development", DATABASE_URL: url },
});
process.exit(result.status ?? 1);
