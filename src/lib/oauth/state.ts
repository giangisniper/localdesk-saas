import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { Provider } from "./config";

export const FLOW_COOKIE = "ld_oauth";
export const FLOW_TTL_SECONDS = 600;

export interface Flow {
  provider: Provider;
  state: string;
  nonce: string;
  codeVerifier?: string;
  mode: "login" | "link";
  /** user that started a "link" flow; the callback must still be in that user's session */
  userId?: string;
}

/** Key is derived separately from the session key so a flow token can never be used as a session token (and vice versa). */
function key() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set and at least 32 characters long");
  return createHash("sha256").update(`oauth-flow|${s}`).digest();
}

export const randomToken = () => randomBytes(32).toString("base64url");

export async function signFlow(flow: Flow): Promise<string> {
  return new SignJWT({ typ: "oauth-flow", ...flow }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${FLOW_TTL_SECONDS}s`).sign(key());
}

/** Returns the flow only if the signature, expiry, type and provider are all valid. */
export async function verifyFlow(token: string | undefined, provider: Provider): Promise<Flow | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.typ !== "oauth-flow" || payload.provider !== provider) return null;
    const { state, nonce, mode } = payload as Record<string, unknown>;
    if (typeof state !== "string" || typeof nonce !== "string" || (mode !== "login" && mode !== "link")) return null;
    return { provider, state, nonce, mode, codeVerifier: payload.codeVerifier as string | undefined, userId: payload.userId as string | undefined };
  } catch {
    return null;
  }
}

/** Constant-time-ish equality for the `state` echoed back by the provider. */
export function statesMatch(expected: string, received: string | null | undefined): boolean {
  if (!received || expected.length !== received.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  return diff === 0;
}
