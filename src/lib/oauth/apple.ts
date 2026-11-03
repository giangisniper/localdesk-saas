import { SignJWT, importPKCS8 } from "jose";

/** Apple's `client_secret` is a short-lived ES256 JWT signed with the Sign in with Apple private key (.p8). */
export async function buildAppleClientSecret(opts: { teamId: string; keyId: string; clientId: string; privateKey: string }, now = Math.floor(Date.now() / 1000)) {
  // .env files usually store the PEM on one line with literal "\n" sequences
  const pem = opts.privateKey.includes("\\n") ? opts.privateKey.replace(/\\n/g, "\n") : opts.privateKey;
  const key = await importPKCS8(pem, "ES256");
  return new SignJWT({}).setProtectedHeader({ alg: "ES256", kid: opts.keyId })
    .setIssuer(opts.teamId).setSubject(opts.clientId).setAudience("https://appleid.apple.com")
    .setIssuedAt(now).setExpirationTime(now + 300).sign(key);
}

/** Apple sends the user's name only on the first authorization, as a JSON string in the `user` form field (untrusted, display-only). */
export function parseAppleUserField(raw: string | null | undefined): { name?: string } {
  if (!raw) return {};
  try {
    const u = JSON.parse(raw) as { name?: { firstName?: string; lastName?: string } };
    const name = [u.name?.firstName, u.name?.lastName].filter((x): x is string => typeof x === "string").join(" ").trim().slice(0, 80);
    return name ? { name } : {};
  } catch {
    return {};
  }
}

/** Apple reports booleans as the strings "true"/"false" in some tokens. */
export const truthy = (v: unknown) => v === true || v === "true";
