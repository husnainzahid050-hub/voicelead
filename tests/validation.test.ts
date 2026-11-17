import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  LEAD_FIELD_NAMES,
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  URGENCIES,
  URGENCY_RANK,
} from "@/lib/constants";
import { parseServerEnv } from "@/lib/env.schema";
import { generateReferenceNumber, isReferenceNumber } from "@/lib/reference";
import {
  leadStatusSchema,
  parseJsonColumn,
  pkPhoneSchema,
  slugSchema,
  timeSchema,
  urgencySchema,
  workingHoursSchema,
} from "@/lib/validation";

describe("allowlists", () => {
  it("accepts every declared status and urgency", () => {
    for (const s of LEAD_STATUSES) expect(leadStatusSchema.parse(s)).toBe(s);
    for (const u of URGENCIES) expect(urgencySchema.parse(u)).toBe(u);
  });

  it("rejects values outside the allowlist", () => {
    expect(leadStatusSchema.safeParse("confirmed").success).toBe(false);
    expect(urgencySchema.safeParse("URGENT").success).toBe(false);
    expect(leadStatusSchema.safeParse("").success).toBe(false);
  });

  it("has a label for every status and ranks urgency in order", () => {
    expect(Object.keys(LEAD_STATUS_LABELS).sort()).toEqual([...LEAD_STATUSES].sort());
    expect(URGENCIES.map((u) => URGENCY_RANK[u])).toEqual([0, 1, 2, 3]);
  });

  it("asks for the customer's name and phone before anything else", () => {
    expect(LEAD_FIELD_NAMES.slice(0, 2)).toEqual(["customer_name", "phone"]);
  });
});

describe("primitive schemas", () => {
  it("validates 24h times", () => {
    expect(timeSchema.safeParse("17:00").success).toBe(true);
    expect(timeSchema.safeParse("24:00").success).toBe(false);
    expect(timeSchema.safeParse("5pm").success).toBe(false);
  });

  it("normalizes phones through the schema", () => {
    expect(pkPhoneSchema.parse(" 0300-1234567 ")).toBe("+923001234567");
    expect(pkPhoneSchema.safeParse("12345").success).toBe(false);
  });

  it("validates slugs", () => {
    expect(slugSchema.safeParse("smilecare-dental").success).toBe(true);
    expect(slugSchema.safeParse("SmileCare").success).toBe(false);
    expect(slugSchema.safeParse("a--b").success).toBe(false);
    expect(slugSchema.safeParse("../admin").success).toBe(false);
  });
});

describe("workingHoursSchema", () => {
  it("accepts a normal week", () => {
    expect(
      workingHoursSchema.safeParse([{ day: "mon", open: "10:00", close: "20:00" }]).success,
    ).toBe(true);
  });

  it("rejects closing before opening and duplicate days", () => {
    expect(
      workingHoursSchema.safeParse([{ day: "mon", open: "20:00", close: "10:00" }]).success,
    ).toBe(false);
    expect(
      workingHoursSchema.safeParse([
        { day: "mon", open: "10:00", close: "12:00" },
        { day: "mon", open: "13:00", close: "18:00" },
      ]).success,
    ).toBe(false);
  });
});

describe("parseJsonColumn", () => {
  const schema = z.array(z.string());
  it("returns parsed data when valid", () => {
    expect(parseJsonColumn('["a","b"]', schema, [])).toEqual(["a", "b"]);
  });
  it("falls back on corrupt JSON or wrong shape instead of throwing", () => {
    expect(parseJsonColumn("{not json", schema, [])).toEqual([]);
    expect(parseJsonColumn("[1,2]", schema, [])).toEqual([]);
    expect(parseJsonColumn(null, schema, ["x"])).toEqual(["x"]);
  });
});

describe("reference numbers", () => {
  it("match the public format and avoid look-alike characters", () => {
    for (let i = 0; i < 500; i++) {
      const ref = generateReferenceNumber();
      expect(isReferenceNumber(ref)).toBe(true);
      expect(ref.slice(3)).not.toMatch(/[01OIL]/);
    }
  });

  it("are not trivially repeated", () => {
    const refs = new Set(Array.from({ length: 1000 }, generateReferenceNumber));
    expect(refs.size).toBeGreaterThan(995);
  });
});

describe("parseServerEnv", () => {
  const valid = {
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    APP_URL: "http://localhost:3000",
    SESSION_SECRET: "s".repeat(32),
    IP_HASH_SECRET: "i".repeat(32),
  } as const;

  it("accepts a complete config and treats an empty Gemini key as unset", () => {
    const env = parseServerEnv({ ...valid, GEMINI_API_KEY: "" });
    expect(env.GEMINI_API_KEY).toBeUndefined();
    expect(env.GEMINI_MODEL).toBe("gemini-flash-lite-latest");
  });

  it("requires a PostgreSQL database URL", () => {
    expect(() => parseServerEnv({ ...valid, DATABASE_URL: "file:./dev.db" })).toThrow(/PostgreSQL/);
  });

  it("rejects short secrets without echoing their values", () => {
    const secret = "tooshort-secret-value";
    expect(() => parseServerEnv({ ...valid, SESSION_SECRET: secret })).toThrow(/SESSION_SECRET/);
    try {
      parseServerEnv({ ...valid, SESSION_SECRET: secret });
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});
