import { describe, expect, it } from "vitest";
import { isValidEmail, normalizeEmail, emailError } from "@/lib/email";
import { toE164 } from "@/lib/contact";
import { customerSchema, loginSchema, registerSchema, businessSchema, staffSchema, publicBookingSchema } from "@/lib/validation";

describe("email validation", () => {
  it.each(["a@b.co", "first.last+tag@example.com", "UPPER@Example.COM", "o'brien@example.ie", "user@sub.domain.example.org", "x@münchen.de", "名前@例え.jp", "a_b-c@ex-ample.io"])("accepts %s", (e) => expect(isValidEmail(e)).toBe(true));
  it.each(["", "plain", "@example.com", "a@", "a@b", "a b@example.com", "a@@b.com", "a..b@example.com", ".a@example.com", "a.@example.com", "a@-bad.com", "a@bad-.com", "a@exa mple.com", "a@example.c", "a@example..com", "a@.example.com", `${"x".repeat(65)}@example.com`, `a@${"x".repeat(250)}.com`])("rejects %j", (e) => expect(isValidEmail(e)).toBe(false));
  it("normalises consistently", () => {
    expect(normalizeEmail("  Ann.Lee@Example.COM ")).toBe("ann.lee@example.com");
    expect(registerSchema.parse({ name: "Ann Lee", email: "  Ann@Example.com ", password: "longpassw0rd" }).email).toBe("ann@example.com");
    expect(loginSchema.parse({ email: " A@B.io ", password: "x" }).email).toBe("a@b.io");
  });
  it("keeps optional fields optional but validates when present", () => {
    expect(customerSchema.parse({ name: "Bo Li", email: "", phone: "", tags: [], marketingOptIn: false }).email).toBe("");
    expect(customerSchema.safeParse({ name: "Bo Li", email: "nope", phone: "" }).success).toBe(false);
    expect(publicBookingSchema.safeParse({ slug: "s", serviceId: crypto.randomUUID(), staffId: "any", date: "2030-01-01", time: "10:00", name: "Bo", email: "bad" }).success).toBe(false);
  });
  it("emailError helper mirrors the rules", () => {
    expect(emailError("", { required: true })).toBeTruthy();
    expect(emailError("")).toBeUndefined();
    expect(emailError("x@y")).toBeTruthy();
    expect(emailError("x@y.com")).toBeUndefined();
  });
});

describe("international phone validation", () => {
  it("normalises valid numbers from many countries to E.164", () => {
    expect(toE164("+39 333 1234567")).toBe("+393331234567");
    expect(toE164("333 123 4567", "IT")).toBe("+393331234567");
    expect(toE164("+44 7911 123456")).toBe("+447911123456");
    expect(toE164("(415) 555-2671", "US")).toBe("+14155552671");
    expect(toE164("+49 30 901820")).toBe("+4930901820");
    expect(toE164("06 12 34 56 78", "FR")).toBe("+33612345678");
    expect(toE164("+81 90 1234 5678")).toBe("+819012345678");
    expect(toE164("+61 412 345 678")).toBe("+61412345678");
    expect(toE164("+55 11 91234-5678")).toBe("+5511912345678");
  });
  it("validates according to the selected country, not a fixed one", () => {
    expect(toE164("333 1234567", "IT")).toBe("+393331234567");
    expect(toE164("333 1234567", "US")).toBeNull(); // not a valid US number
    expect(toE164("7911 123456", "GB")).toBe("+447911123456");
  });
  it("rejects invalid or country-less numbers", () => {
    for (const bad of ["12345", "abc", "+1", "+39 12", "333 1234567", "++44 7911 123456", "+999 123456"]) expect(toE164(bad), bad).toBeNull();
    expect(toE164("")).toBeNull();
  });
  it("is enforced by schemas: optional, E.164 stored, rejects junk", () => {
    const base = { name: "Bo Li", email: "", tags: [], marketingOptIn: false };
    expect(customerSchema.parse({ ...base, phone: "" }).phone).toBe("");
    expect(customerSchema.parse({ ...base, phone: "+44 7911 123456" }).phone).toBe("+447911123456");
    expect(customerSchema.safeParse({ ...base, phone: "not a phone" }).success).toBe(false);
    expect(customerSchema.safeParse({ ...base, phone: "0123" }).success).toBe(false);
    const biz = { name: "Biz", slug: "biz", category: "x y", description: "", email: "", address: "", timezone: "UTC", currency: "EUR" };
    expect(businessSchema.parse({ ...biz, phone: "+1 415 555 2671" }).phone).toBe("+14155552671");
    expect(businessSchema.safeParse({ ...biz, phone: "+1 123" }).success).toBe(false);
    const st = staffSchema.safeParse({ name: "Bo Li", email: "", color: "#112233", active: true, hours: [], phone: "+33 6 12 34 56 78" });
    expect(st.success && st.data.phone).toBe("+33612345678");
  });
});
