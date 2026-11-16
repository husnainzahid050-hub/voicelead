import { describe, expect, it } from "vitest";
import {
  businessProfileSchema,
  businessSettingsSchema,
  readBusinessForm,
} from "@/lib/schemas/business";
import { isReservedSlug, slugCandidates, slugify } from "@/lib/slug";

function form(entries: Array<[string, string]>): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

const base: Array<[string, string]> = [
  ["name", "SmileCare Dental Clinic"],
  ["phone", "05822-000100"],
  ["address", ""],
  ["services", "Cleaning"],
  ["services", "Filling"],
  ["servicesOther", "Teeth whitening\n\n  Cleaning  "],
  ["hours.mon.on", "on"],
  ["hours.mon.open", "10:00"],
  ["hours.mon.close", "20:00"],
  ["hours.tue.open", "10:00"], // not "on": closed, must be ignored
  ["hours.tue.close", "20:00"],
  ["intakeInstructions", "Tell us what you need."],
  ["commonQuestions", "Do you treat children?\n"],
  ["followUpTone", "friendly"],
];

describe("readBusinessForm + businessProfileSchema", () => {
  it("reshapes and validates a complete onboarding form", () => {
    const parsed = businessProfileSchema.parse(readBusinessForm(form(base)));
    expect(parsed.phone).toBe("+925822000100");
    expect(parsed.address).toBeNull();
    expect(parsed.services).toEqual(["Cleaning", "Filling", "Teeth whitening"]); // deduped
    expect(parsed.workingHours).toEqual([{ day: "mon", open: "10:00", close: "20:00" }]);
    expect(parsed.commonQuestions).toEqual(["Do you treat children?"]);
  });

  it("requires at least one service and one open day", () => {
    const noServices = base.filter(([k]) => k !== "services" && k !== "servicesOther");
    expect(businessProfileSchema.safeParse(readBusinessForm(form(noServices))).success).toBe(false);
    const noDays = base.filter(([k]) => !k.startsWith("hours.mon"));
    expect(businessProfileSchema.safeParse(readBusinessForm(form(noDays))).success).toBe(false);
  });

  it("rejects tones and phone numbers outside the allowlist", () => {
    const badTone = base.map(([k, v]): [string, string] =>
      k === "followUpTone" ? [k, "pushy"] : [k, v],
    );
    expect(businessProfileSchema.safeParse(readBusinessForm(form(badTone))).success).toBe(false);
    const badPhone = base.map(([k, v]): [string, string] =>
      k === "phone" ? [k, "12345"] : [k, v],
    );
    expect(businessProfileSchema.safeParse(readBusinessForm(form(badPhone))).success).toBe(false);
  });

  it("ignores client-supplied fields that are not part of the form (e.g. businessId)", () => {
    const raw = readBusinessForm(
      form([...base, ["businessId", "someone-elses-id"], ["role", "owner"]]),
    );
    expect(raw).not.toHaveProperty("businessId");
    expect(raw).not.toHaveProperty("role");
  });

  it("validates settings-only fields", () => {
    const settings = [
      ...base,
      ["slug", "SmileCare-Dental"],
      ["email", ""],
      ["isActive", "on"],
    ] as Array<[string, string]>;
    const parsed = businessSettingsSchema.parse(readBusinessForm(form(settings)));
    expect(parsed.slug).toBe("smilecare-dental"); // lowercased
    expect(parsed.email).toBeNull();
    expect(parsed.isActive).toBe(true);
  });
});

describe("slugs", () => {
  it("derives readable slugs from clinic names", () => {
    expect(slugify("SmileCare Dental Clinic")).toBe("smilecare-dental-clinic");
    expect(slugify("  Dr. Ayesha's Smile & Care!  ")).toBe("dr-ayesha-s-smile-and-care");
    expect(slugify("Clínica Dental")).toBe("clinica-dental");
  });

  it("returns empty for names with no Latin characters, so callers fall back", () => {
    expect(slugify("سمائل کیئر ڈینٹل")).toBe("");
    expect(slugify("!!")).toBe("");
  });

  it("caps length and never ends with a dash", () => {
    const s = slugify("a".repeat(39) + " b c d e f g");
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith("-")).toBe(false);
  });

  it("never offers reserved words", () => {
    expect(isReservedSlug("dashboard")).toBe(true);
    expect(slugCandidates("dashboard")).not.toContain("dashboard");
    expect(slugCandidates("smilecare")[1]).toBe("smilecare-2");
  });
});

describe("greetingName", () => {
  it("skips titles so greetings read naturally", async () => {
    const { greetingName } = await import("@/lib/names");
    expect(greetingName("Dr. Hina Farooq")).toBe("Hina");
    expect(greetingName("dr nadia rehman")).toBe("nadia");
    expect(greetingName("Kamran Yousaf")).toBe("Kamran");
    expect(greetingName("Dr.")).toBe("Dr.");
  });
});
