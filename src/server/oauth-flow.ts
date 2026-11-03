import "server-only";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { shouldUseSecureCookie } from "@/lib/cookie";
import { appUrl, isProvider, providerStatus, type Provider } from "@/lib/oauth/config";
import { FLOW_COOKIE, FLOW_TTL_SECONDS, randomToken, signFlow, statesMatch, verifyFlow, type Flow } from "@/lib/oauth/state";
import { buildAuthRequest, exchangeAndVerify } from "@/lib/oauth/client";
import { parseAppleUserField } from "@/lib/oauth/apple";
import { linkIdentity, loginWithIdentity } from "@/server/oauth";

const to = (path: string) => NextResponse.redirect(new URL(path, appUrl()), 303);
const fail = (mode: "login" | "link", code: string) => to(mode === "link" ? `/settings?tab=account&error=${code}` : `/login?error=${code}`);

async function clientIp() {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

function flowCookieOptions(provider: Provider) {
  // Apple returns via a cross-site POST (response_mode=form_post), so its flow cookie must be SameSite=None; Secure.
  // That is acceptable because Apple sign-in is only offered on HTTPS. Google's top-level GET redirect works with Lax.
  const apple = provider === "apple";
  return { httpOnly: true, sameSite: (apple ? "none" : "lax") as "none" | "lax", secure: apple ? true : shouldUseSecureCookie({ override: process.env.AUTH_COOKIE_SECURE, appUrl: appUrl() }), path: "/api/auth", maxAge: FLOW_TTL_SECONDS };
}

export async function startOAuth(providerParam: string, requestHost: string | null, modeParam: string | null): Promise<NextResponse> {
  const mode = modeParam === "link" ? "link" : "login";
  if (!isProvider(providerParam) || !providerStatus(providerParam).ready) return fail(mode, "not_configured");
  const provider = providerParam;
  if (!rateLimit(`oauth-start:${await clientIp()}`, 20, 10 * 60_000)) return fail(mode, "rate_limited");

  // The callback always lands on NEXT_PUBLIC_APP_URL, so the flow cookie must be set on that host.
  if (requestHost && requestHost !== new URL(appUrl()).host) return NextResponse.redirect(new URL(`/api/auth/${provider}/start${mode === "link" ? "?mode=link" : ""}`, appUrl()), 302);

  let userId: string | undefined;
  if (mode === "link") {
    const s = await getSession();
    if (!s) return to("/login");
    userId = s.user.id;
  }
  const flow: Flow = { provider, state: randomToken(), nonce: randomToken(), codeVerifier: provider === "google" ? randomToken() : undefined, mode, userId };
  let url: URL;
  try {
    url = await buildAuthRequest(provider, flow);
  } catch (e) {
    console.error(`[oauth] ${provider} discovery failed:`, (e as Error).message);
    return fail(mode, "provider_error");
  }
  (await cookies()).set(FLOW_COOKIE, await signFlow(flow), flowCookieOptions(provider));
  return NextResponse.redirect(url, 302);
}

export async function finishOAuth(providerParam: string, params: URLSearchParams): Promise<NextResponse> {
  const store = await cookies();
  const raw = store.get(FLOW_COOKIE)?.value;
  const respond = (r: NextResponse) => { store.set(FLOW_COOKIE, "", { ...flowCookieOptions(isProvider(providerParam) ? providerParam : "google"), maxAge: 0 }); return r; }; // single use

  if (!isProvider(providerParam) || !providerStatus(providerParam).ready) return respond(fail("login", "not_configured"));
  const provider = providerParam;
  const flow = await verifyFlow(raw, provider);
  const mode = flow?.mode ?? "login";
  if (!rateLimit(`oauth-cb:${await clientIp()}`, 30, 10 * 60_000)) return respond(fail(mode, "rate_limited"));
  if (!flow) return respond(fail("login", "invalid_state"));
  if (!statesMatch(flow.state, params.get("state"))) return respond(fail(mode, "invalid_state"));
  if (params.get("error")) return respond(fail(mode, "provider_error"));
  if (!params.get("code")) return respond(fail(mode, "invalid_response"));

  let identity;
  try {
    identity = await exchangeAndVerify(provider, params, flow);
  } catch (e) {
    console.error(`[oauth] ${provider} verification failed:`, (e as Error).name, (e as Error).message.slice(0, 160)); // never log tokens or codes
    return respond(fail(mode, "invalid_response"));
  }
  const name = identity.name ?? (provider === "apple" ? parseAppleUserField(params.get("user")).name : undefined);
  const profile = { provider, subject: identity.subject, email: identity.email, emailVerified: identity.emailVerified, name };

  if (flow.mode === "link") {
    const s = await getSession();
    if (!s || s.user.id !== flow.userId) return respond(fail("link", "session_mismatch"));
    const r = await linkIdentity(s.user.id, profile);
    return respond(r.ok ? to(`/settings?tab=account&linked=${provider}`) : fail("link", r.code));
  }

  const r = await loginWithIdentity(profile);
  if (!r.ok) return respond(fail("login", r.code));
  const [u] = await db.select({ sv: users.sessionVersion }).from(users).where(eq(users.id, r.userId));
  await createSession(r.userId, u!.sv); // same signed, HttpOnly session cookie as password login
  return respond(to(r.isNew ? "/onboarding" : "/dashboard"));
}
