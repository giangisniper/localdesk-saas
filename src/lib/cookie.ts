/**
 * Decide whether the session cookie gets the `Secure` attribute.
 *
 * Why this exists: with `next start` NODE_ENV is "production" even when you browse over plain
 * HTTP on a LAN (http://192.168.x.x). Browsers only accept `Secure` cookies from HTTPS origins —
 * plus the special-cased `localhost` — so a hard-coded `secure: NODE_ENV === "production"` makes the
 * session cookie vanish on LAN IPs while still working on localhost.
 *
 * Precedence (first match wins):
 *  1. AUTH_COOKIE_SECURE=true|false   explicit operator override
 *  2. NEXT_PUBLIC_APP_URL is https:// canonical public URL is HTTPS → always Secure.
 *                                     A client-supplied header can never downgrade this.
 *  3. X-Forwarded-Proto: https        TLS-terminating proxy told us the request was HTTPS
 *  4. otherwise                       plain-HTTP local testing → not Secure
 */
export function shouldUseSecureCookie(opts: { override?: string; appUrl?: string; forwardedProto?: string | null }): boolean {
  const override = opts.override?.trim().toLowerCase();
  if (override === "true") return true;
  if (override === "false") return false;
  if (opts.appUrl?.trim().toLowerCase().startsWith("https://")) return true;
  const proto = opts.forwardedProto?.split(",")[0]?.trim().toLowerCase();
  return proto === "https";
}
