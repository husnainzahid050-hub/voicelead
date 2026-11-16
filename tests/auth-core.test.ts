import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, can } from "@/lib/permissions";
import { safeNextPath } from "@/lib/safe-redirect";
import { signInSchema, signUpSchema } from "@/lib/schemas/auth";
import {
  generateSessionToken,
  hashSessionToken,
  isExpired,
  isWellFormedToken,
  nextExpiry,
  shouldExtend,
} from "@/server/auth/session-core";

describe("permissions matrix", () => {
  it("gives owners every permission", () => {
    for (const p of ALL_PERMISSIONS) expect(can("owner", p)).toBe(true);
  });

  it("lets staff work leads and share the link, but not touch settings or delete", () => {
    expect(can("staff", "leads:read")).toBe(true);
    expect(can("staff", "leads:update")).toBe(true);
    expect(can("staff", "intake-link:read")).toBe(true);
    expect(can("staff", "settings:read")).toBe(false);
    expect(can("staff", "settings:update")).toBe(false);
    expect(can("staff", "leads:delete")).toBe(false);
  });
});

describe("safeNextPath (open-redirect protection)", () => {
  it.each(["/dashboard", "/dashboard/settings", "/dashboard/leads?status=new"])(
    "allows %s",
    (p) => {
      expect(safeNextPath(p)).toBe(p);
    },
  );

  it.each([
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "javascript:alert(1)",
    "/dashboard\n/x",
    "/ dashboard",
    "/sign-in",
    "/dashboardevil",
    "/dashboard/../admin",
    "",
    null,
    123,
  ])("rejects %j", (p) => {
    expect(safeNextPath(p)).toBeNull();
  });
});

describe("auth schemas", () => {
  const valid = { name: "Nadia", email: "Nadia@Clinic.PK ", password: "quiet morning tea" };

  it("normalizes email to trimmed lowercase", () => {
    expect(signUpSchema.parse(valid).email).toBe("nadia@clinic.pk");
  });

  it("enforces length and blocks common passwords", () => {
    expect(signUpSchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...valid, password: "Password1234" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...valid, password: "x".repeat(129) }).success).toBe(false);
  });

  it("rejects a password equal to the email", () => {
    const r = signUpSchema.safeParse({
      ...valid,
      email: "longemail@x.pk",
      password: "LongEmail@x.pk",
    });
    expect(r.success).toBe(false);
  });

  it("does not apply the creation policy on sign-in", () => {
    expect(signInSchema.safeParse({ email: "a@b.pk", password: "old" }).success).toBe(true);
  });
});

describe("session tokens", () => {
  it("are 256-bit base64url and well-formed", () => {
    const token = generateSessionToken();
    expect(token).toHaveLength(43);
    expect(isWellFormedToken(token)).toBe(true);
  });

  it("rejects malformed tokens before any database lookup", () => {
    expect(isWellFormedToken("")).toBe(false);
    expect(isWellFormedToken("' OR 1=1 --")).toBe(false);
    expect(isWellFormedToken(undefined)).toBe(false);
  });

  it("stores a keyed hash, not the token", () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token, "secret-a".repeat(4));
    expect(hash).not.toContain(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // A different server secret yields a different id: a leaked DB is useless alone.
    expect(hashSessionToken(token, "secret-b".repeat(4))).not.toBe(hash);
  });
});

describe("session expiry", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const created = new Date("2026-01-01T00:00:00Z");

  it("starts with a 7-day idle window", () => {
    expect(nextExpiry(created, created).getTime() - created.getTime()).toBe(7 * DAY);
  });

  it("slides, but never past the 30-day absolute cap", () => {
    const day29 = new Date(created.getTime() + 29 * DAY);
    expect(nextExpiry(created, day29).getTime()).toBe(created.getTime() + 30 * DAY);
  });

  it("extends only when under half the idle window remains", () => {
    const expires = nextExpiry(created, created);
    expect(shouldExtend(expires, created, new Date(created.getTime() + 1 * DAY))).toBe(false);
    expect(shouldExtend(expires, created, new Date(created.getTime() + 5 * DAY))).toBe(true);
  });

  it("does not extend once the absolute cap is reached", () => {
    const capped = new Date(created.getTime() + 30 * DAY);
    expect(shouldExtend(capped, created, new Date(created.getTime() + 29.5 * DAY))).toBe(false);
  });

  it("treats the exact expiry instant as expired", () => {
    expect(isExpired(created, created)).toBe(true);
  });
});
