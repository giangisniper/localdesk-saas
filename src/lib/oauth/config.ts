export type Provider = "google" | "apple";
export const PROVIDERS: Provider[] = ["google", "apple"];
export const isProvider = (v: string): v is Provider => (PROVIDERS as string[]).includes(v);

type Env = Record<string, string | undefined>;

export const ISSUERS: Record<Provider, string> = {
  google: "https://accounts.google.com",
  apple: "https://appleid.apple.com",
};

const REQUIRED: Record<Provider, string[]> = {
  google: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  apple: ["APPLE_CLIENT_ID", "APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY"],
};

export function appUrl(env: Env = process.env): string {
  return (env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/** Exact redirect/callback URL to register with the provider. Always derived from NEXT_PUBLIC_APP_URL, never from request headers. */
export function redirectUri(provider: Provider, env: Env = process.env): string {
  return `${appUrl(env)}/api/auth/${provider}/callback`;
}

/** Test hook: lets the OIDC layer talk to a plain-HTTP mock identity provider. Never enable in production. */
export function issuerFor(provider: Provider, env: Env = process.env): string {
  return (provider === "google" && env.GOOGLE_ISSUER) || ISSUERS[provider];
}
export const allowInsecureIssuer = (env: Env = process.env) => env.OAUTH_ALLOW_INSECURE_ISSUER === "true";

export interface ProviderStatus {
  provider: Provider;
  /** all credentials present AND the callback URL is usable with this provider */
  ready: boolean;
  missing: string[];
  problem?: string;
  redirectUri: string;
}

export function providerStatus(provider: Provider, env: Env = process.env): ProviderStatus {
  const missing = REQUIRED[provider].filter((k) => !env[k]?.trim());
  const url = new URL(appUrl(env));
  const https = url.protocol === "https:";
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  let problem: string | undefined;
  if (provider === "apple" && !https) problem = "Sign in with Apple requires NEXT_PUBLIC_APP_URL to be an https:// domain (localhost and IP addresses are not allowed).";
  if (provider === "google" && !https && !local) problem = "Google only accepts http:// redirect URIs for localhost; use an https:// domain or http://localhost.";
  return { provider, ready: missing.length === 0 && !problem, missing, problem, redirectUri: redirectUri(provider, env) };
}

export const allProviderStatus = (env: Env = process.env) => PROVIDERS.map((p) => providerStatus(p, env));

/** Error codes that may appear in /login?error=… (whitelisted so arbitrary text is never reflected). */
export const OAUTH_ERRORS: Record<string, string> = {
  invalid_state: "Your sign-in session expired or was invalid. Please try again.",
  provider_error: "The provider reported a problem or you cancelled. Please try again.",
  invalid_response: "We couldn't verify the response from the provider. Please try again.",
  not_configured: "That sign-in method isn't available.",
  no_email: "The provider didn't share an email address, so we couldn't create your account.",
  email_unverified: "Your email address isn't verified with the provider.",
  account_exists: "An account with this email already exists. Sign in with your password, then connect the provider from Settings → Account.",
  identity_in_use: "That provider account is already connected to a different LocalDesk user.",
  provider_already_linked: "You already have a different account from this provider connected.",
  rate_limited: "Too many attempts. Please wait a few minutes and try again.",
  session_mismatch: "Your session changed during sign-in. Please try again.",
};

export function oauthErrorMessage(code: string | undefined): string | undefined {
  return code && Object.prototype.hasOwnProperty.call(OAUTH_ERRORS, code) ? OAUTH_ERRORS[code] : undefined;
}
