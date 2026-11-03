import { describe, expect, it } from "vitest";
import { shouldUseSecureCookie as s } from "@/lib/cookie";

describe("session cookie Secure flag", () => {
  it("is off for plain-HTTP local and LAN testing (localhost or an IP)", () => {
    expect(s({ appUrl: "http://localhost:3000" })).toBe(false);
    expect(s({ appUrl: "http://localhost:3000", forwardedProto: null })).toBe(false);
    expect(s({})).toBe(false);
  });
  it("is on when the public URL is HTTPS, regardless of headers (no client downgrade)", () => {
    expect(s({ appUrl: "https://app.example.com" })).toBe(true);
    expect(s({ appUrl: "https://app.example.com", forwardedProto: "http" })).toBe(true);
    expect(s({ appUrl: "HTTPS://app.example.com" })).toBe(true);
  });
  it("is on behind a TLS-terminating proxy", () => {
    expect(s({ appUrl: "http://localhost:3000", forwardedProto: "https" })).toBe(true);
    expect(s({ forwardedProto: "https, http" })).toBe(true);
    expect(s({ forwardedProto: "http" })).toBe(false);
  });
  it("honours an explicit override above everything", () => {
    expect(s({ override: "true" })).toBe(true);
    expect(s({ override: "false", appUrl: "https://x.test", forwardedProto: "https" })).toBe(false);
    expect(s({ override: "auto", appUrl: "https://x.test" })).toBe(true);
  });
});
