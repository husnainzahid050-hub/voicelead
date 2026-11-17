import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations prefer a direct (unpooled) connection when the host provides one
// (Neon via Vercel sets DATABASE_URL_UNPOOLED); the app itself uses DATABASE_URL.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: { url },
});
