import { describe, expect, it } from "vitest";
import { can } from "@/lib/permissions";
import { parsePriceToCents } from "@/lib/money";
import { resolveRange, granularity } from "@/lib/range";
import { registerSchema, staffSchema, openingHoursSchema } from "@/lib/validation";
import { addDaysStr, weekStart } from "@/lib/time";
import { changePct, slugify } from "@/lib/utils";

describe("permissions", () => {
  it("restricts staff and admins appropriately", () => {
    expect(can("staff", "analytics:view")).toBe(false);
    expect(can("staff", "appointments:manage")).toBe(true);
    expect(can("admin", "team:manage")).toBe(false);
    expect(can("owner", "team:manage")).toBe(true);
  });
});
describe("money", () => {
  it("parses prices", () => {
    expect(parsePriceToCents("35")).toBe(3500);
    expect(parsePriceToCents("35,5")).toBe(3550);
    expect(parsePriceToCents("€12.99")).toBe(1299);
    expect(parsePriceToCents("abc")).toBeNull();
    expect(parsePriceToCents("1.234")).toBeNull();
  });
});
describe("date ranges", () => {
  const now = new Date("2030-06-15T12:00:00Z");
  it("resolves presets and previous period", () => {
    const r = resolveRange({ range: "7d" }, "UTC", now);
    expect(r).toMatchObject({ from: "2030-06-09", to: "2030-06-15", days: 7, prevFrom: "2030-06-02", prevTo: "2030-06-08" });
  });
  it("falls back to 30d for invalid custom input", () => {
    expect(resolveRange({ range: "custom", from: "bad", to: "x" }, "UTC", now).days).toBe(30);
    expect(resolveRange({ range: "custom", from: "2030-06-10", to: "2030-06-01" }, "UTC", now).days).toBe(30);
  });
  it("chooses granularity", () => { expect(granularity(30)).toBe("day"); expect(granularity(90)).toBe("week"); expect(granularity(365)).toBe("month"); });
  it("computes week start (Monday)", () => { expect(weekStart("2030-06-15")).toBe("2030-06-10"); expect(addDaysStr("2030-02-28", 1)).toBe("2030-03-01"); });
});
describe("validation", () => {
  it("enforces password strength", () => {
    expect(registerSchema.safeParse({ name: "Ann Lee", email: "A@B.com", password: "short1" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "Ann Lee", email: "A@B.com", password: "longpassword" }).success).toBe(false);
    const ok = registerSchema.safeParse({ name: "Ann Lee", email: "A@B.com", password: "longpassw0rd" });
    expect(ok.success && ok.data.email).toBe("a@b.com");
  });
  it("rejects inverted opening hours and shifts", () => {
    expect(openingHoursSchema.safeParse({ "1": [{ open: "18:00", close: "09:00" }] }).success).toBe(false);
    expect(staffSchema.safeParse({ name: "Bo", email: "", color: "#112233", active: true, hours: [{ weekday: 1, startTime: "17:00", endTime: "09:00" }] }).success).toBe(false);
  });
});
describe("utils", () => {
  it("slugifies and computes change", () => {
    expect(slugify("Café Münch & Co.")).toBe("cafe-munch-co");
    expect(changePct(110, 100)).toBe(10);
    expect(changePct(5, 0)).toBeNull();
  });
});
