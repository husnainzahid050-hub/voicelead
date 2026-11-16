/**
 * Server-side authorization against a real (test) database.
 * Proves that the service layer enforces roles and tenant isolation on its
 * own, independent of what the UI shows.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { businessSettingsSchema } from "@/lib/schemas/business";
import { ForbiddenError, type AuthContext } from "@/server/auth/types";
import {
  getBusinessSettings,
  getDashboardSummary,
  updateBusinessSettings,
  type BusinessSettingsDTO,
} from "@/server/services/business-settings";

let smileOwner: AuthContext;
let smileStaff: AuthContext;
let brightOwner: AuthContext;

async function ctxFor(email: string): Promise<AuthContext> {
  const u = await db.user.findUniqueOrThrow({ where: { email } });
  if (!u.businessId) throw new Error(`${email} has no business`);
  return { userId: u.id, businessId: u.businessId, role: u.role as AuthContext["role"] };
}

function toInput(s: BusinessSettingsDTO, overrides: Partial<BusinessSettingsDTO> = {}) {
  return businessSettingsSchema.parse({
    ...s,
    address: s.address ?? "",
    intakeInstructions: s.intakeInstructions ?? "",
    description: s.description ?? "",
    email: s.email ?? "",
    ...overrides,
  });
}

beforeAll(async () => {
  smileOwner = await ctxFor("owner@smilecare.demo");
  smileStaff = await ctxFor("staff@smilecare.demo");
  brightOwner = await ctxFor("owner@brightsmile.demo");
});

describe("tenant isolation", () => {
  it("each owner only ever reads their own clinic", async () => {
    expect((await getBusinessSettings(smileOwner)).name).toBe("SmileCare Dental Clinic");
    expect((await getBusinessSettings(brightOwner)).name).toBe("Bright Smile Dental");
  });

  it("lead counts are scoped to the caller's clinic", async () => {
    expect((await getDashboardSummary(smileOwner)).leadCount).toBe(13);
    expect((await getDashboardSummary(brightOwner)).leadCount).toBe(2);
  });

  it("an update by one owner never touches another clinic", async () => {
    const smileBefore = await db.business.findUniqueOrThrow({
      where: { id: smileOwner.businessId },
    });
    const bright = await getBusinessSettings(brightOwner);

    const result = await updateBusinessSettings(
      brightOwner,
      toInput(bright, { description: "Updated by Bright Smile" }),
      "test-ip",
    );
    expect(result).toEqual({ ok: true, changed: ["description"] });

    const smileAfter = await db.business.findUniqueOrThrow({
      where: { id: smileOwner.businessId },
    });
    expect(smileAfter.updatedAt).toEqual(smileBefore.updatedAt);
    expect(smileAfter.description).toBe(smileBefore.description);
  });

  it("cannot take another clinic's intake link", async () => {
    const bright = await getBusinessSettings(brightOwner);
    const result = await updateBusinessSettings(
      brightOwner,
      toInput(bright, { slug: "smilecare-dental" }),
      "test-ip",
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.fieldErrors.slug).toMatch(/already uses/);
  });

  it("cannot claim a reserved link name", async () => {
    const bright = await getBusinessSettings(brightOwner);
    const result = await updateBusinessSettings(
      brightOwner,
      toInput(bright, { slug: "dashboard" }),
      "x",
    );
    expect(!result.ok && result.fieldErrors.slug).toMatch(/reserved/);
  });

  it("audits which fields changed without storing their values", async () => {
    const log = await db.auditLog.findFirstOrThrow({
      where: { businessId: brightOwner.businessId, action: "business.updated" },
      orderBy: { createdAt: "desc" },
    });
    expect(log.userId).toBe(brightOwner.userId);
    expect(log.metadata).toBe(JSON.stringify({ fields: ["description"] }));
    expect(log.metadata).not.toContain("Updated by Bright Smile");
  });
});

describe("role-based access", () => {
  it("staff cannot read settings, even by calling the service directly", async () => {
    await expect(getBusinessSettings(smileStaff)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("staff cannot update settings, and nothing is written", async () => {
    const owner = await getBusinessSettings(smileOwner);
    const before = await db.business.findUniqueOrThrow({ where: { id: smileOwner.businessId } });

    await expect(
      updateBusinessSettings(smileStaff, toInput(owner, { name: "Hijacked" }), "x"),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const after = await db.business.findUniqueOrThrow({ where: { id: smileOwner.businessId } });
    expect(after.name).toBe(before.name);
    expect(after.updatedAt).toEqual(before.updatedAt);
  });

  it("staff can still see the dashboard summary for their own clinic", async () => {
    expect((await getDashboardSummary(smileStaff)).businessName).toBe("SmileCare Dental Clinic");
  });
});
