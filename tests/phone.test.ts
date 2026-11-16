import { describe, expect, it } from "vitest";
import { formatPkPhone, maskPhone, normalizePkPhone, toWhatsAppDigits } from "@/lib/phone";

describe("normalizePkPhone", () => {
  it.each([
    "03001234567",
    "0300-1234567",
    "0300 1234567",
    "+92 300 1234567",
    "+923001234567",
    "00923001234567",
    "923001234567",
    "(0300) 123-4567",
  ])("normalizes mobile input %s to E.164", (input) => {
    expect(normalizePkPhone(input)).toEqual({ e164: "+923001234567", kind: "mobile" });
  });

  it("normalizes a Muzaffarabad landline", () => {
    expect(normalizePkPhone("05822-123456")).toEqual({ e164: "+925822123456", kind: "landline" });
  });

  it.each([
    "",
    "abc",
    "0300123456", // too short
    "030012345678", // too long
    "+1 415 555 0100", // not Pakistan
    "0300-123-4567; DROP TABLE", // injection-looking junk
    "0300 1234567x",
    "1".repeat(40), // oversized
  ])("rejects %j", (input) => {
    expect(normalizePkPhone(input)).toBeNull();
  });
});

describe("maskPhone", () => {
  it("shows only prefix and last four digits", () => {
    expect(maskPhone("+923001234567")).toBe("+92 300 ***4567");
  });

  it("never leaks the middle digits", () => {
    expect(maskPhone("+923001234567")).not.toContain("123");
  });

  it("handles missing numbers", () => {
    expect(maskPhone(null)).toBe("—");
    expect(maskPhone(undefined)).toBe("—");
  });
});

describe("formatting helpers", () => {
  it("formats mobile numbers for local display", () => {
    expect(formatPkPhone("+923001234567")).toBe("0300 1234567");
  });

  it("produces digits for wa.me links", () => {
    expect(toWhatsAppDigits("+923001234567")).toBe("923001234567");
  });
});

describe("landline display", () => {
  it("groups by area code", () => {
    expect(formatPkPhone("+925822000100")).toBe("05822 000100"); // Muzaffarabad
    expect(formatPkPhone("+922134567890")).toBe("021 34567890"); // Karachi
    expect(formatPkPhone("+92992123456")).toBe("0992 123456"); // Abbottabad
  });
});
