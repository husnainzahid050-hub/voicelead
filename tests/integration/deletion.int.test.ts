/** The customer's right to withdraw a request within 24 hours. */
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { submitBodySchema } from "@/lib/schemas/intake";
import {
  deleteRequestByCustomer,
  getPublicBusiness,
  resolveIntakeBusiness,
  submitIntake,
  type IntakeBusiness,
} from "@/server/services/intake";

async function business(slug: string): Promise<IntakeBusiness> {
  const page = await getPublicBusiness(slug);
  const resolved = await resolveIntakeBusiness(page?.intakeToken ?? null, slug);
  if (!resolved.ok) throw new Error(resolved.code);
  return resolved.business;
}

async function submit(b: IntakeBusiness) {
  return submitIntake(
    b,
    submitBodySchema.parse({
      transcript: "Need a cleaning next week",
      consent: true,
      fields: { customerName: "Hina", phone: "0333 4445556", serviceNeeded: "Cleaning" },
    }),
    "ip",
  );
}

describe("customer deletion request", () => {
  it("erases the request with the right reference and secret, exactly once", async () => {
    const smile = await business("smilecare-dental");
    const { referenceNumber, deletionToken } = await submit(smile);

    expect(await deleteRequestByCustomer(smile, referenceNumber, "A".repeat(43), "ip")).toBe(false);
    expect(await deleteRequestByCustomer(smile, referenceNumber, deletionToken, "ip")).toBe(true);
    // A second attempt (replay) fails: the secret was wiped with the data.
    expect(await deleteRequestByCustomer(smile, referenceNumber, deletionToken, "ip")).toBe(false);

    const row = await db.lead.findUniqueOrThrow({ where: { referenceNumber } });
    expect(row.deletedAt).not.toBeNull();
    expect(row.customerName).toBeNull();
    expect(row.phone).toBeNull();
    expect(row.deletionTokenHash).toBeNull();
    const actions = await db.auditLog.findMany({
      where: { leadId: row.id },
      select: { action: true, userId: true },
    });
    expect(actions.map((a) => a.action).sort()).toEqual([
      "lead.created",
      "lead.deleted",
      "lead.deletion_requested",
    ]);
    expect(actions.every((a) => a.userId === null)).toBe(true);
  });

  it("refuses after the 24-hour window", async () => {
    const smile = await business("smilecare-dental");
    const { referenceNumber, deletionToken } = await submit(smile);
    const tomorrowAndABit = new Date(Date.now() + 25 * 60 * 60 * 1000);
    expect(
      await deleteRequestByCustomer(smile, referenceNumber, deletionToken, "ip", tomorrowAndABit),
    ).toBe(false);
    expect((await db.lead.findUniqueOrThrow({ where: { referenceNumber } })).deletedAt).toBeNull();
  });

  it("cannot delete through another clinic's page", async () => {
    const smile = await business("smilecare-dental");
    const bright = await business("bright-smile-dental");
    const { referenceNumber, deletionToken } = await submit(smile);
    expect(await deleteRequestByCustomer(bright, referenceNumber, deletionToken, "ip")).toBe(false);
    expect((await db.lead.findUniqueOrThrow({ where: { referenceNumber } })).deletedAt).toBeNull();
  });
});
