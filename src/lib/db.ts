import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";

function createClient(): PrismaClient {
  // Small pool: on serverless every instance has its own pool, and hosted
  // Postgres free tiers allow few connections.
  const adapter = new PrismaPg({
    connectionString: strictSsl(env.DATABASE_URL),
    max: env.DATABASE_POOL_MAX,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
}

/**
 * Hosted providers hand out `sslmode=require`, which node-postgres already
 * treats as full certificate verification (and warns about on every cold
 * start). Spell out `verify-full` so the behaviour stays strict when pg 9
 * switches `require` to the weaker libpq meaning.
 */
function strictSsl(url: string): string {
  return url.replace(/([?&]sslmode=)(require|prefer|verify-ca)\b/, "$1verify-full");
}

// Reuse one client across hot reloads in development and warm serverless invocations.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db: PrismaClient = globalForPrisma.prisma ?? createClient();

globalForPrisma.prisma = db;
