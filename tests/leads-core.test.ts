import { describe, expect, it } from "vitest";
import { timeAgo } from "@/lib/format";
import {
  buildFollowUpTemplate,
  followUpProblem,
  whatsappLink,
  type FollowUpInput,
} from "@/lib/leads/follow-up";
import { nextAction, primaryNextStatus, transitionError } from "@/lib/leads/workflow";
import { leadListQuerySchema } from "@/lib/schemas/lead";

const base: FollowUpInput = {
  clinicName: "SmileCare Dental Clinic",
  clinicPhone: "05822 000100",
  customerName: "Ali",
  service: "Emergency dental pain",
  preferredDate: "2026-11-17",
  preferredTime: "17:00",
  status: "ready_to_contact",
  language: "en",
  tone: "friendly",
};

describe("lead workflow", () => {
  it("requires a phone before contact and a service before 'ready to contact'", () => {
    const t = (
      to: Parameters<typeof transitionError>[0]["to"],
      hasPhone = true,
      hasService = true,
    ) => transitionError({ from: "new", to, hasPhone, hasService });
    expect(t("ready_to_contact")).toBeNull();
    expect(t("ready_to_contact", false)).toMatch(/phone/);
    expect(t("ready_to_contact", true, false)).toMatch(/needs/);
    expect(t("booked", false)).toMatch(/phone/);
    expect(t("lost", false)).toBeNull(); // closing a lead never needs details
    expect(transitionError({ from: "new", to: "new", hasPhone: true, hasService: true })).toMatch(
      /already/,
    );
  });

  it("puts emergencies first in the next-action wording", () => {
    expect(nextAction("new", "emergency")).toEqual({ label: "Call now: urgent", tone: "urgent" });
    expect(nextAction("booked", "emergency").tone).toBe("done");
    expect(primaryNextStatus("needs_review")?.to).toBe("ready_to_contact");
    expect(primaryNextStatus("lost")).toBeNull();
  });
});

describe("follow-up templates", () => {
  it("never claims a booking that hasn't happened, in any language", () => {
    for (const language of ["en", "ur", "mixed"] as const) {
      for (const tone of ["friendly", "formal", "concise"] as const) {
        const msg = buildFollowUpTemplate({ ...base, language, tone });
        expect(followUpProblem(msg, "ready_to_contact"), `${language}/${tone}: ${msg}`).toBeNull();
        expect(msg.length).toBeLessThanOrEqual(500);
      }
    }
  });

  it("states the booked time once the clinic has booked it", () => {
    const msg = buildFollowUpTemplate({ ...base, status: "booked" });
    expect(msg).toContain("Your appointment is booked for Tue 17 Nov, 5:00 PM");
    expect(followUpProblem(msg, "booked")).toBeNull();
  });

  it("writes Urdu in Urdu script and Roman Urdu for mixed speakers", () => {
    expect(buildFollowUpTemplate({ ...base, language: "ur" })).toMatch(/السلام علیکم/);
    expect(buildFollowUpTemplate({ ...base, language: "mixed" })).toMatch(/^Assalam o alaikum Ali/);
  });

  it("works without a name or preferred time", () => {
    const msg = buildFollowUpTemplate({
      ...base,
      customerName: null,
      preferredDate: null,
      preferredTime: null,
    });
    expect(msg).toMatch(/^Hello, This is SmileCare/);
  });

  it("rejects AI text that promises an unbooked appointment or is too long", () => {
    expect(followUpProblem("Hi Ali, your appointment is confirmed for 5 PM.", "contacted")).toBe(
      "claims_confirmation",
    );
    expect(followUpProblem("Aap ki appointment book ho gayi hai.", "new")).toBe(
      "claims_confirmation",
    );
    expect(followUpProblem("آپ کی اپائنٹمنٹ کنفرم ہو گئی ہے", "new")).toBe("claims_confirmation");
    expect(followUpProblem("x".repeat(501), "booked")).toBe("too_long");
    expect(followUpProblem("Please reply to confirm a time that suits you.", "new")).toBeNull();
  });

  it("builds a wa.me link with the encoded message", () => {
    expect(whatsappLink("923001234567", "Hi Ali & co?")).toBe(
      "https://wa.me/923001234567?text=Hi%20Ali%20%26%20co%3F",
    );
  });
});

describe("lead list query", () => {
  it("falls back to safe defaults on garbage input", () => {
    expect(
      leadListQuerySchema.parse({ filter: "drop table", sort: "x", page: "-3", q: "  " }),
    ).toEqual({
      filter: "all",
      sort: "urgent",
      page: 1,
      q: null,
    });
    expect(leadListQuerySchema.parse({ filter: "priority", page: "2", q: "ali" }).page).toBe(2);
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-11-16T12:00:00Z");
  it("reads naturally", () => {
    expect(timeAgo("2026-11-16T11:59:30Z", now)).toBe("just now");
    expect(timeAgo("2026-11-16T11:35:00Z", now)).toBe("25 min ago");
    expect(timeAgo("2026-11-15T11:00:00Z", now)).toBe("yesterday");
  });
});
