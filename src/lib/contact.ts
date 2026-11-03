import { z } from "zod";
import { isValidEmail, normalizeEmail } from "./email";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";

export { normalizeEmail, isValidEmail } from "./email";

/**
 * Returns the number in E.164 (e.g. "+393331234567") or null if it isn't a valid number.
 * Numbers must either be in international form ("+44 ...") or be accompanied by a country.
 */
export function toE164(input: string, country?: CountryCode): string | null {
  const v = input.trim();
  if (!v) return null;
  const parsed = parsePhoneNumberFromString(v, country);
  return parsed && parsed.isValid() ? parsed.number : null;
}

export const emailField = z.string().trim().max(254, "Email is too long").transform((v, ctx) => {
  if (!isValidEmail(v)) { ctx.addIssue({ code: "custom", message: "Enter a valid email address" }); return z.NEVER; }
  return normalizeEmail(v);
});

/** Optional email: empty string stays empty, anything else must be valid. */
export const optionalEmailField = z.string().trim().max(254, "Email is too long").transform((v, ctx) => {
  if (v === "") return "";
  if (!isValidEmail(v)) { ctx.addIssue({ code: "custom", message: "Enter a valid email address" }); return z.NEVER; }
  return normalizeEmail(v);
});

/** Optional phone: empty stays empty; otherwise validated per country rules and stored as E.164. */
export const optionalPhoneField = z.string().trim().max(40, "Phone number is too long").transform((v, ctx) => {
  if (v === "") return "";
  const e164 = toE164(v);
  if (!e164) { ctx.addIssue({ code: "custom", message: "Enter a valid phone number including the country code" }); return z.NEVER; }
  return e164;
});
