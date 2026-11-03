import "server-only";
import * as oidc from "openid-client";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { buildAppleClientSecret, truthy } from "./apple";
import { allowInsecureIssuer, issuerFor, redirectUri, type Provider } from "./config";

const discovered = new Map<Provider, Promise<oidc.Configuration>>();

function credentials(provider: Provider) {
  const e = process.env;
  if (provider === "google") return { clientId: e.GOOGLE_CLIENT_ID!, clientSecret: e.GOOGLE_CLIENT_SECRET! };
  return { clientId: e.APPLE_CLIENT_ID!, clientSecret: undefined };
}

async function clientSecretFor(provider: Provider) {
  if (provider === "google") return process.env.GOOGLE_CLIENT_SECRET!;
  return buildAppleClientSecret({ teamId: process.env.APPLE_TEAM_ID!, keyId: process.env.APPLE_KEY_ID!, clientId: process.env.APPLE_CLIENT_ID!, privateKey: process.env.APPLE_PRIVATE_KEY! });
}

function baseConfig(provider: Provider) {
  let p = discovered.get(provider);
  if (!p) {
    const { clientId } = credentials(provider);
    const insecure = allowInsecureIssuer();
    p = oidc.discovery(new URL(issuerFor(provider)), clientId, undefined, oidc.None(), insecure ? { execute: [oidc.allowInsecureRequests] } : undefined);
    discovered.set(provider, p);
    p.catch(() => discovered.delete(provider)); // don't cache failures
  }
  return p;
}

export interface AuthRequest { url: URL; state: string; nonce: string; codeVerifier?: string }

/** Build the provider authorization URL. State, nonce (and PKCE for Google) are supplied by the caller and stored in the signed flow cookie. */
export async function buildAuthRequest(provider: Provider, flow: { state: string; nonce: string; codeVerifier?: string }): Promise<URL> {
  const cfg = await baseConfig(provider);
  const params: Record<string, string> = { redirect_uri: redirectUri(provider), response_type: "code", scope: provider === "google" ? "openid email profile" : "name email", state: flow.state, nonce: flow.nonce };
  if (provider === "google") {
    params.prompt = "select_account";
    if (flow.codeVerifier) { params.code_challenge = await oidc.calculatePKCECodeChallenge(flow.codeVerifier); params.code_challenge_method = "S256"; }
  } else {
    params.response_mode = "form_post"; // required by Apple when requesting name/email scopes
  }
  return oidc.buildAuthorizationUrl(cfg, params);
}

export interface VerifiedIdentity { subject: string; email?: string; emailVerified: boolean; name?: string; claimNonce?: string }

/**
 * Exchange the authorization code and fully verify the ID token ourselves with jose:
 * signature (provider JWKS), issuer, audience, expiry and nonce. (openid-client alone does not
 * verify the signature of an ID token received directly from the token endpoint.)
 */
export async function exchangeAndVerify(provider: Provider, callbackParams: URLSearchParams, flow: { state: string; nonce: string; codeVerifier?: string }): Promise<VerifiedIdentity> {
  const base = await baseConfig(provider);
  const { clientId } = credentials(provider);
  const insecure = allowInsecureIssuer();
  const cfg = new oidc.Configuration(base.serverMetadata(), clientId, undefined, oidc.ClientSecretPost(await clientSecretFor(provider)));
  if (insecure) oidc.allowInsecureRequests(cfg);

  const current = new URL(redirectUri(provider));
  for (const [k, v] of callbackParams) if (k !== "user") current.searchParams.set(k, v);
  const tokens = await oidc.authorizationCodeGrant(cfg, current, { expectedState: flow.state, expectedNonce: flow.nonce, pkceCodeVerifier: flow.codeVerifier, idTokenExpected: true });
  if (!tokens.id_token) throw new Error("missing id_token");

  const meta = base.serverMetadata();
  if (!meta.jwks_uri) throw new Error("provider has no jwks_uri");
  const issuer = issuerFor(provider);
  const issuers = provider === "google" && issuer === "https://accounts.google.com" ? [issuer, "accounts.google.com"] : issuer;
  const { payload } = await jwtVerify(tokens.id_token, createRemoteJWKSet(new URL(meta.jwks_uri)), { issuer: issuers, audience: clientId, algorithms: ["RS256", "ES256"], clockTolerance: 30 });
  if (payload.nonce !== flow.nonce) throw new Error("nonce mismatch");
  if (!payload.sub) throw new Error("missing sub");
  return {
    subject: String(payload.sub),
    email: typeof payload.email === "string" ? payload.email.trim().toLowerCase() : undefined,
    emailVerified: truthy(payload.email_verified),
    name: typeof payload.name === "string" ? payload.name.trim().slice(0, 80) : undefined,
  };
}
