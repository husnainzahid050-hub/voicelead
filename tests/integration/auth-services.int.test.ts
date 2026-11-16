import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { businessProfileSchema } from "@/lib/schemas/business";
import { clearRateLimit, isRateLimited, recordHit } from "@/server/rate-limit";
import { registerOwner, verifyCredentials } from "@/server/services/auth";
import { completeOnboarding } from "@/server/services/onboarding";
import type { AuthUser } from "@/server/auth/types";

const DEMO_PASSWORD = process.env.DEMO_OWNER_PASSWORD ?? "";

describe("credentials", () => {
  it("accepts the right password and rejects wrong ones identically", async () => {
    const ok = await verifyCredentials({
      email: "owner@smilecare.demo",
      password: DEMO_PASSWORD,
    });
    expect(ok.ok).toBe(true);

    const wrongPassword = await verifyCredentials({
      email: "owner@smilecare.demo",
      password: "nope",
    });
    const unknownEmail = await verifyCredentials({ email: "nobody@nowhere.pk", password: "nope" });
    // Same shape for both failures: nothing reveals whether the account exists.
    expect(wrongPassword).toEqual({ ok: false });
    expect(unknownEmail).toEqual({ ok: false });
  });

  it("never stores plaintext passwords", async () => {
    const user = await db.user.findUniqueOrThrow({ where: { email: "owner@smilecare.demo" } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.passwordHash).not.toContain(DEMO_PASSWORD);
  });

  it("refuses a duplicate email", async () => {
    const result = await registerOwner({
      name: "Copycat",
      email: "owner@smilecare.demo",
      password: "another long phrase",
    });
    expect(result).toEqual({ ok: false, reason: "email_taken" });
  });
});

describe("onboarding", () => {
  const profile = businessProfileSchema.parse({
    name: "SmileCare Dental Clinic", // same name as the seeded clinic
    phone: "0300 0000999",
    address: "",
    services: ["Cleaning"],
    workingHours: [{ day: "mon", open: "09:00", close: "17:00" }],
    intakeInstructions: "",
    commonQuestions: [],
    followUpTone: "concise",
  });

  async function newUser(email: string): Promise<AuthUser> {
    const r = await registerOwner({ name: "New Owner", email, password: "a calm long phrase" });
    if (!r.ok) throw new Error("setup failed");
    return { id: r.userId, name: "New Owner", email, role: "owner", businessId: null };
  }

  it("creates the clinic with a unique, readable intake link", async () => {
    const user = await newUser("first@clinic.pk");
    const result = await completeOnboarding(user, profile, "ip");
    expect(result).toEqual({ ok: true, slug: "smilecare-dental-clinic" });

    const second = await newUser("second@clinic.pk");
    expect(await completeOnboarding(second, profile, "ip")).toEqual({
      ok: true,
      slug: "smilecare-dental-clinic-2",
    });
  });

  it("cannot attach a second clinic, even with a stale user object (replayed request)", async () => {
    const user = await newUser("replay@clinic.pk");
    expect((await completeOnboarding(user, profile, "ip")).ok).toBe(true);
    // `user.businessId` is still null in this stale copy; the DB guard must catch it.
    expect(await completeOnboarding(user, profile, "ip")).toEqual({
      ok: false,
      reason: "already_onboarded",
    });
    const owned = await db.user.findUniqueOrThrow({ where: { email: "replay@clinic.pk" } });
    const orphanCount = await db.business.count({ where: { users: { none: {} } } });
    expect(owned.businessId).not.toBeNull();
    expect(orphanCount).toBe(0); // the failed attempt was rolled back
  });
});

describe("rate limiting", () => {
  const rule = { limit: 5, windowMs: 60_000 };

  it("blocks after the limit and reports a retry delay", async () => {
    const key = "test:signin:limit";
    await clearRateLimit(key);
    for (let i = 0; i < 4; i++) expect((await recordHit(key, rule)).limited).toBe(false);
    expect((await recordHit(key, rule)).limited).toBe(true);
    const status = await isRateLimited(key, rule);
    expect(status.limited).toBe(true);
    expect(status.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets after the window", async () => {
    const key = "test:signin:window";
    await clearRateLimit(key);
    const shortRule = { limit: 1, windowMs: 1 };
    await recordHit(key, shortRule);
    await new Promise((r) => setTimeout(r, 10));
    expect((await isRateLimited(key, shortRule)).limited).toBe(false);
  });
});
