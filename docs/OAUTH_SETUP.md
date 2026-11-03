# Social sign-in setup (Google & Apple)

LocalDesk supports **Continue with Google** and **Continue with Apple** next to email/password.
A provider's button is only shown when *all* of its environment variables are set **and** the callback URL is usable with that provider. Check the current state any time:

```bash
npm run oauth:status
```

```
READY      google  redirect URI: http://localhost:3000/api/auth/google/callback
NOT READY  apple   redirect URI: http://localhost:3000/api/auth/apple/callback
           missing env: APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY
           problem: Sign in with Apple requires NEXT_PUBLIC_APP_URL to be an https:// domain …
```

The same status appears under **Settings → Account → Sign-in methods** (owners/admins).

> Never commit secrets. Put them in `.env` (git-ignored) or your host's secret store. Do not paste private keys into chat or issues.

## How it behaves

- Standard OIDC *authorization-code* flow with a signed, single-use, 10-minute flow cookie holding `state`, `nonce` (and PKCE for Google). The ID token's **signature (provider JWKS), issuer, audience, expiry and nonce** are verified server-side before anything is trusted.
- Identities are stored in `oauth_accounts` and keyed by the provider's stable subject (`sub`), **never by email**. `(provider, sub)` is unique.
- First successful sign-in creates a LocalDesk account (no password) and continues into the normal onboarding. Returning users go straight to the dashboard.
- **No automatic linking by email.** If a provider returns an email that already belongs to a LocalDesk account, sign-in is refused with an explanation. The account owner signs in with their existing method and connects the provider from **Settings → Account → Sign-in methods**. This prevents account takeover through unverified or recycled email addresses.
- A new account requires an email the provider reports as *verified*. Apple "Hide My Email" relay addresses (`…@privaterelay.appleid.com`) are accepted as normal addresses.
- Apple only sends the user's name on the *first* authorization; LocalDesk stores it when the account is created.
- Sessions are the existing LocalDesk signed, `HttpOnly`, `SameSite=Lax` cookie; roles and tenant checks are unchanged. A passwordless user can set a password in Settings; the last remaining sign-in method can't be disconnected.
- All flows use `NEXT_PUBLIC_APP_URL` as the canonical origin (never the `Host` header). Start the flow from that same origin.

## Google

### 1. Create the project and consent screen
1. Open <https://console.cloud.google.com/> → project picker → **New project** (e.g. "LocalDesk").
2. **APIs & Services → OAuth consent screen** (now called *Google Auth Platform → Branding/Audience*).
   - User type **External**; app name, support email, developer contact email.
   - Scopes: the default `openid`, `email`, `profile` are all that is needed (no verification review required for these).
   - While *Testing*, add your own Google account(s) under **Test users**. Publish the app to allow anyone.

### 2. Create the web client
1. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
2. **Authorized JavaScript origins** (optional for this server-side flow, but harmless):
   - Local: `http://localhost:3000`
   - Production: `https://your-domain.com`
3. **Authorized redirect URIs** — must match *exactly* (scheme, host, port, path, no trailing slash):
   - Local: `http://localhost:3000/api/auth/google/callback`
   - Production: `https://your-domain.com/api/auth/google/callback`
4. Copy the **Client ID** and **Client secret**.

### 3. Configure LocalDesk
```bash
# .env
NEXT_PUBLIC_APP_URL=http://localhost:3000        # must equal the origin you registered
GOOGLE_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
```
Restart the server (`npm run build && npm start`, or `npm run dev`) and run `npm run oauth:status`. The "Continue with Google" button now appears on `/login` and `/register`.

### Local testing notes
- Google accepts `http://` redirect URIs only for `localhost`. Browse the app at `http://localhost:3000` (not a LAN IP) when testing Google. Raw IPs such as `http://192.168.0.34:3000` are rejected by Google; LocalDesk hides the button in that configuration and shows why in Settings.
- If you open the app on a host that differs from `NEXT_PUBLIC_APP_URL`, the start route redirects you to the canonical origin so the flow cookie and callback agree.
- Email/password login keeps working over any LAN address as before.

## Apple

Sign in with Apple's web flow **requires HTTPS on a real, verified domain**. `localhost`, `http://` URLs and raw IP addresses are not accepted by Apple, so Apple sign-in cannot be tested locally. Use a deployed HTTPS environment (or an HTTPS tunnel with a stable domain that you can verify).

You need a paid **Apple Developer Program** membership.

### 1. Primary App ID
1. <https://developer.apple.com/account> → **Certificates, Identifiers & Profiles → Identifiers → +** → **App IDs** → *App*.
2. Description + Bundle ID (e.g. `com.example.localdesk`), enable the **Sign in with Apple** capability → *Register*.

### 2. Services ID (this is the OAuth client)
1. **Identifiers → + → Services IDs**. Identifier e.g. `com.example.localdesk.web` → *Register*.
2. Open it, enable **Sign in with Apple → Configure**:
   - **Primary App ID**: the App ID from step 1.
   - **Domains and Subdomains**: `your-domain.com` (no scheme, no path). Apple gives a domain-verification file — host it at `https://your-domain.com/.well-known/apple-developer-domain-association.txt` (place the file in `public/.well-known/` of this project and redeploy), then press **Verify**.
   - **Return URLs** — exact: `https://your-domain.com/api/auth/apple/callback`
3. Save. The Services ID identifier is your **`APPLE_CLIENT_ID`**.

### 3. Private key
1. **Keys → + →** name it, tick **Sign in with Apple → Configure →** choose the Primary App ID → *Save → Continue → Register*.
2. **Download the `.p8` file once** (Apple won't show it again) and note the **Key ID** (`APPLE_KEY_ID`).
3. Your **Team ID** (`APPLE_TEAM_ID`) is shown under *Membership details* (top right of the developer portal).

### 4. Configure LocalDesk (production host)
```bash
NEXT_PUBLIC_APP_URL=https://your-domain.com
APPLE_CLIENT_ID=com.example.localdesk.web
APPLE_TEAM_ID=ABCDE12345
APPLE_KEY_ID=ABC123DEFG
# the .p8 contents; either a real multi-line secret from your host's secret store,
# or one line with literal \n between lines:
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIGT...\n-----END PRIVATE KEY-----"
```
Run `npm run oauth:status` on the server; when Apple shows `READY` the button appears.

LocalDesk generates Apple's short-lived (5 min) ES256 `client_secret` JWT per request from these values, so there is nothing to rotate every six months.

### Apple specifics handled
- Apple returns via a **cross-site `form_post`**; the flow cookie for Apple is therefore `SameSite=None; Secure` (HTTPS only) and scoped to `/api/auth`.
- Name and email arrive in the `user` field only on the first authorization; the email is also in the ID token.
- `email_verified` / `is_private_email` may be the strings `"true"`/`"false"` — both forms are accepted.

## Local vs production summary

| | Local (`http://localhost:3000`) | Production (`https://…`) |
|---|---|---|
| Email/password | works (also via LAN IP) | works |
| Google | works with a `localhost` redirect URI | works |
| Apple | **not possible** (HTTPS + verified domain required) | works once configured |
| Session cookie `Secure` | off over plain HTTP | on (`NEXT_PUBLIC_APP_URL=https://…` forces it) |

## Troubleshooting
- **Button missing** → `npm run oauth:status`; every variable must be set and `NEXT_PUBLIC_APP_URL` must suit the provider.
- **`redirect_uri_mismatch` (Google)** → the registered URI differs from `<NEXT_PUBLIC_APP_URL>/api/auth/google/callback` (port, scheme, trailing slash).
- **"An account with this email already exists"** → expected; sign in with your password, then use *Connect* in Settings → Account.
- **"Your sign-in session expired"** → the flow cookie was missing/expired (10 min), or you started on a different origin than `NEXT_PUBLIC_APP_URL`.
- Server logs show a one-line reason for rejected provider responses (never tokens, codes or secrets).

## What has been verified
Automated: unit tests (state signing, Apple client-secret JWT, readiness rules), database tests (identity uniqueness, no auto-linking, link/unlink rules) and `scripts/oauth-mock-e2e.cjs`, which runs the real callback/verification code against a **local mock OIDC provider** (valid login, returning login, linking, takeover refusal, and rejection of bad signature/nonce/audience/issuer/expiry/state, replay).
**Not verified:** live Google and live Apple sign-in — that needs your real credentials (and, for Apple, an HTTPS domain). The Apple callback path (`form_post`) has no end-to-end test.
