/**
 * Email syntax validation (client + server). Syntax only: no DNS/MX lookups, no mailbox claims.
 * Accepts internationalised addresses (unicode letters) and rejects the usual malformed shapes
 * (missing parts, consecutive/leading/trailing dots, spaces, single-label domains, bad hyphens).
 */
const LOCAL = /^[\p{L}\p{N}!#$%&'*+/=?^_`{|}~-]+(?:\.[\p{L}\p{N}!#$%&'*+/=?^_`{|}~-]+)*$/u;
const LABEL = /^[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?$/u;
const TLD = /^(?:\p{L}{2,63}|xn--[a-z0-9-]{2,59})$/iu;

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidEmail(input: string): boolean {
  const email = normalizeEmail(input);
  if (email.length === 0 || email.length > 254) return false;
  const at = email.lastIndexOf("@");
  if (at < 1) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > 64 || !LOCAL.test(local)) return false;
  const labels = domain.split(".");
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l))) return false;
  return TLD.test(labels[labels.length - 1]!);
}

/** Message for a form field, or undefined when fine. Optional fields may be empty. */
export function emailError(value: string, opts: { required?: boolean } = {}): string | undefined {
  if (!value.trim()) return opts.required ? "Enter your email address" : undefined;
  return isValidEmail(value) ? undefined : "Enter a valid email address";
}
