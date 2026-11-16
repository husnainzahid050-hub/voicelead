import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Test-only environment. Never the development database or real secrets. */
const TEST_ENV = {
  NODE_ENV: "test",
  DATABASE_URL: "file:./prisma/test.db",
  APP_URL: "http://localhost:3000",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  IP_HASH_SECRET: "test-ip-hash-secret-0123456789abcdef",
  DEMO_OWNER_PASSWORD: "Test-Demo-Password-2026",
  SHOW_DEMO_LOGIN: "false",
  AI_PROVIDER: "mock",
} as const;

// Applied to this process too, so globalSetup (which builds the test DB) sees it.
Object.assign(process.env, TEST_ENV);

const src = fileURLToPath(new URL("./src", import.meta.url));
const serverOnlyStub = fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^server-only$/, replacement: serverOnlyStub },
      { find: /^@\//, replacement: `${src}/` },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: TEST_ENV,
    globalSetup: ["./tests/global-setup.ts"],
    // Integration tests share one SQLite file; run files one at a time.
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
