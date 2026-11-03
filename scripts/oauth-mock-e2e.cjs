// End-to-end test of the real OAuth/OIDC code path against a LOCAL MOCK identity provider.
// This exercises our callback, state/nonce/PKCE, ID-token verification, account rules and sessions.
// It does NOT talk to Google or Apple. Prereq: `npm run build`, migrated + seeded DB.   node scripts/oauth-mock-e2e.cjs
const http = require('http'); const crypto = require('crypto'); const { spawn } = require('child_process');
const { chromium } = require('playwright'); const assert = require('assert');
const IDP = 'http://localhost:4010', APP_PORT = 3100, APP = `http://localhost:${APP_PORT}`;
const CLIENT_ID = 'mock-client-id', CLIENT_SECRET = 'mock-client-secret';
const stamp = Date.now().toString().slice(-7);
let jose, keys, otherKeys; const codes = new Map(); let scenario = {};
require('dotenv').config();
async function cleanDb() { const { Client } = require('pg'); const c = new Client({ connectionString: process.env.DATABASE_URL }); await c.connect();
  await c.query("delete from oauth_accounts where provider_account_id like 'g-%'"); await c.query("delete from users where password_hash is null and email like '%@example.com' and email ~ '[0-9]{7}@'"); await c.end(); }
const ok = (m) => console.log('  ✔', m);

function startIdp() {
  const srv = http.createServer(async (req, res) => {
    const u = new URL(req.url, IDP); const json = (o, s = 200) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/.well-known/openid-configuration') return json({ issuer: IDP, authorization_endpoint: IDP + '/authorize', token_endpoint: IDP + '/token', jwks_uri: IDP + '/jwks', response_types_supported: ['code'], subject_types_supported: ['public'], id_token_signing_alg_values_supported: ['RS256'], token_endpoint_auth_methods_supported: ['client_secret_post'], code_challenge_methods_supported: ['S256'] });
    if (u.pathname === '/jwks') return json({ keys: [{ ...(await jose.exportJWK(keys.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' }] });
    if (u.pathname === '/authorize') { // auto-approve
      const code = crypto.randomBytes(12).toString('hex'); codes.set(code, { nonce: u.searchParams.get('nonce'), challenge: u.searchParams.get('code_challenge'), s: { ...scenario } });
      const back = new URL(u.searchParams.get('redirect_uri')); back.searchParams.set('code', code); if (!scenario.dropState) back.searchParams.set('state', scenario.badState ? 'forged' : u.searchParams.get('state'));
      res.writeHead(302, { location: back.toString() }); return res.end();
    }
    if (u.pathname === '/token' && req.method === 'POST') {
      let body = ''; for await (const c of req) body += c; const f = new URLSearchParams(body); const rec = codes.get(f.get('code')); codes.delete(f.get('code'));
      if (!rec || f.get('client_secret') !== CLIENT_SECRET || f.get('client_id') !== CLIENT_ID) return json({ error: 'invalid_client' }, 401);
      const verifier = f.get('code_verifier'); if (!verifier || crypto.createHash('sha256').update(verifier).digest('base64url') !== rec.challenge) return json({ error: 'invalid_grant', error_description: 'PKCE' }, 400);
      const s = rec.s; const now = Math.floor(Date.now() / 1000);
      const idt = await new jose.SignJWT({ email: s.email, email_verified: s.emailVerified ?? true, name: s.name, nonce: s.wrongNonce ? 'other' : rec.nonce })
        .setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer(s.badIssuer ? 'https://evil.example' : IDP).setAudience(s.wrongAud ? 'someone-else' : CLIENT_ID).setSubject(s.sub)
        .setIssuedAt(now - 5).setExpirationTime(s.expired ? now - 3600 : now + 300).sign(s.badSig ? otherKeys.privateKey : keys.privateKey);
      return json({ access_token: 'at-' + stamp, token_type: 'Bearer', expires_in: 3600, id_token: idt });
    }
    res.writeHead(404); res.end();
  });
  return new Promise((r) => srv.listen(4010, () => r(srv)));
}
async function startApp() {
  const p = spawn('npx', ['next', 'start', '-p', String(APP_PORT)], { env: { ...process.env, NEXT_PUBLIC_APP_URL: APP, GOOGLE_CLIENT_ID: CLIENT_ID, GOOGLE_CLIENT_SECRET: CLIENT_SECRET, GOOGLE_ISSUER: IDP, OAUTH_ALLOW_INSECURE_ISSUER: 'true' }, stdio: 'pipe' });
  p.stderr.on('data', (d) => process.env.DEBUG_APP && process.stderr.write(d));
  for (let i = 0; i < 60; i++) { try { if ((await fetch(APP + '/login')).ok) return p; } catch {} await new Promise((r) => setTimeout(r, 500)); }
  throw new Error('app did not start');
}
const sessionCookie = async (ctx) => (await ctx.cookies()).find((c) => c.name === 'ld_session');
async function googleLogin(page) { await page.goto(APP + '/login'); await page.click('a:has-text("Continue with Google")'); await page.waitForURL((u) => u.origin === APP, { timeout: 20000 }); await page.waitForLoadState('networkidle'); }

(async () => {
  await cleanDb(); // idempotent: remove identities/users created by previous runs
  jose = await import('jose'); keys = await jose.generateKeyPair('RS256', { extractable: true }); otherKeys = await jose.generateKeyPair('RS256');
  const idp = await startIdp(); const app = await startApp(); const browser = await chromium.launch(); let ipn = 10;
  // each browser context gets its own client IP so the in-memory rate limiter doesn't trip over the many test logins
  const b = { newContext: (o = {}) => browser.newContext({ ...o, extraHTTPHeaders: { 'x-forwarded-for': `10.9.${Math.floor(++ipn / 250)}.${ipn % 250}` } }), close: () => browser.close() };
  try {
    const email = `ada${stamp}@example.com`;
    console.log('1. New Google user → onboarding → persistent session');
    scenario = { sub: 'g-' + stamp, email, name: 'Ada OAuth' };
    let ctx = await b.newContext(); let p = await ctx.newPage(); await googleLogin(p);
    assert(p.url().endsWith('/onboarding'), p.url()); const c = await sessionCookie(ctx); assert(c && c.httpOnly && c.sameSite === 'Lax'); ok('lands on /onboarding with an HttpOnly, SameSite=Lax session cookie (same cookie as password login)');
    await p.fill('input[placeholder="Studio Luna"]', 'OAuth Co ' + stamp); await p.click('text=Continue'); await p.click('text=Continue');
    await p.fill('input[placeholder="Initial consultation"]', 'Cut'); await p.fill('input[placeholder="45"]', '20'); await p.click('text=Finish setup'); await p.waitForURL('**/dashboard');
    await p.reload(); assert(p.url().endsWith('/dashboard')); await p.goto(APP + '/settings'); assert(p.url().endsWith('/settings')); ok('onboarding reused; session persists; owner role/tenant authorisation applies');
    await p.goto(APP + '/dashboard'); await p.click('button[aria-label="Sign out"]:visible'); await p.waitForURL('**/login');
    await googleLogin(p); assert(p.url().endsWith('/dashboard'), p.url()); ok('returning Google user signs in without re-registering');
    await ctx.close();

    console.log('2. Account-takeover protection');
    const demo = 'owner@demo.localdesk.app';
    scenario = { sub: 'g-attacker-' + stamp, email: demo, name: 'Mallory' };
    ctx = await b.newContext(); p = await ctx.newPage(); await googleLogin(p);
    assert(p.url().includes('/login?error=account_exists'), p.url()); assert(!(await sessionCookie(ctx))); await p.waitForSelector('text=already exists'); ok('Google identity with an existing account\'s email is refused, no session created');
    await ctx.close();

    console.log('3. Secure linking from an authenticated session');
    ctx = await b.newContext(); p = await ctx.newPage();
    await p.goto(APP + '/login'); await p.fill('input[name=email]', demo); await p.fill('input[name=password]', 'LocalDesk2026!'); await p.click('button[type=submit]'); await p.waitForURL('**/dashboard');
    scenario = { sub: 'g-owner-' + stamp, email: 'unrelated@example.com', name: 'Owner G' };
    await p.goto(APP + '/settings?tab=account'); await p.click('a:has-text("Connect")'); await p.waitForURL((u) => u.origin === APP && u.pathname === '/settings', { timeout: 20000 });
    await p.waitForSelector('text=Google connected'); ok('owner linked Google while signed in (provider email differs, still linked by authenticated session)');
    await p.goto(APP + '/dashboard'); await p.click('button[aria-label="Sign out"]:visible'); await p.waitForURL('**/login');
    await googleLogin(p); assert(p.url().endsWith('/dashboard')); await p.goto(APP + '/analytics'); assert(p.url().endsWith('/analytics')); ok('Google login now opens the same owner account with the same permissions');
    // someone else cannot attach the same Google identity
    const ctx2 = await b.newContext(); const p2 = await ctx2.newPage(); await p2.goto(APP + '/login'); await p2.fill('input[name=email]', 'manager@demo.localdesk.app'); await p2.fill('input[name=password]', 'LocalDesk2026!'); await p2.click('button[type=submit]'); await p2.waitForURL(/dashboard/);
    await p2.goto(APP + '/settings?tab=account'); await p2.click('a:has-text("Connect")'); await p2.waitForURL(/settings/); await p2.waitForSelector('text=already connected to a different'); ok('identity already owned by another user cannot be linked to a second account');
    await ctx2.close();
    // link flow requires being logged in
    const anon = await b.newContext(); const ap = await anon.newPage(); await ap.goto(APP + '/api/auth/google/start?mode=link'); assert(ap.url().includes('/login'), ap.url()); assert(!(await sessionCookie(anon))); ok('link flow without a session is refused'); await anon.close();
    await ctx.close();

    console.log('4. Invalid / forged identity tokens and responses');
    const bad = { badSig: 'invalid signature', wrongNonce: 'wrong nonce', wrongAud: 'wrong audience', expired: 'expired token', badIssuer: 'wrong issuer' };
    for (const [k, label] of Object.entries(bad)) {
      scenario = { sub: 'g-bad-' + k + stamp, email: `bad${k}${stamp}@example.com`, name: 'Bad', [k]: true };
      const c1 = await b.newContext(); const q = await c1.newPage(); await googleLogin(q);
      assert(q.url().includes('/login?error=invalid_response'), `${label}: ${q.url()}`); assert(!(await sessionCookie(c1)), label + ' created a session!'); ok(label + ' → rejected, no session'); await c1.close();
    }
    scenario = { sub: 'g-st' + stamp, email: `st${stamp}@example.com`, name: 'S', badState: true };
    let c2 = await b.newContext(); let q = await c2.newPage(); await googleLogin(q); assert(q.url().includes('error=invalid_state')); assert(!(await sessionCookie(c2))); ok('mismatched state → rejected'); await c2.close();
    scenario = { sub: 'g-st2' + stamp, email: `st2${stamp}@example.com`, name: 'S', dropState: true };
    c2 = await b.newContext(); q = await c2.newPage(); await googleLogin(q); assert(q.url().includes('error=invalid_state')); ok('missing state → rejected'); await c2.close();
    // callback without our flow cookie (e.g. login-CSRF / replay): craft a valid-looking URL
    c2 = await b.newContext(); q = await c2.newPage(); await q.goto(APP + '/api/auth/google/callback?code=abc&state=xyz'); assert(q.url().includes('error=invalid_state')); assert(!(await sessionCookie(c2))); ok('callback without flow cookie → rejected'); await c2.close();
    // replay of a completed callback
    scenario = { sub: 'g-rp' + stamp, email: `rp${stamp}@example.com`, name: 'R' };
    c2 = await b.newContext(); q = await c2.newPage(); let cb; q.on('request', (r) => { if (r.url().includes('/api/auth/google/callback')) cb = r.url(); });
    await googleLogin(q); assert(!(await c2.cookies()).find((c) => c.name === 'ld_oauth'), 'flow cookie must be cleared after use'); await c2.clearCookies(); await q.goto(cb); assert(q.url().includes('error=invalid_state'), q.url()); assert(!(await sessionCookie(c2))); ok('replayed callback URL → rejected (flow cookie is single-use)'); await c2.close();
    // provider-reported error
    { const start = await fetch(APP + '/api/auth/google/start', { redirect: 'manual', headers: { 'x-forwarded-for': '10.8.8.8' } });
      const st = new URL(start.headers.get('location')).searchParams.get('state'); const cookie = start.headers.get('set-cookie').split(';')[0];
      assert(/HttpOnly/i.test(start.headers.get('set-cookie')) && /Path=\/api\/auth/i.test(start.headers.get('set-cookie')), 'flow cookie must be HttpOnly and path-scoped');
      assert(new URL(start.headers.get('location')).searchParams.get('code_challenge_method') === 'S256', 'PKCE S256 expected');
      const cb = await fetch(APP + '/api/auth/google/callback?error=access_denied&state=' + st, { redirect: 'manual', headers: { cookie, 'x-forwarded-for': '10.8.8.8' } });
      assert(cb.headers.get('location').includes('error=provider_error') && !/ld_session/.test(cb.headers.get('set-cookie') || ''), cb.headers.get('location')); ok('start sets HttpOnly path-scoped flow cookie + PKCE S256; provider error (user cancelled) handled gracefully, no session'); }
    // unverified email
    scenario = { sub: 'g-uv' + stamp, email: `uv${stamp}@example.com`, name: 'U', emailVerified: false };
    c2 = await b.newContext(); q = await c2.newPage(); await googleLogin(q); assert(q.url().includes('error=email_unverified')); ok('unverified provider email → no account created'); await c2.close();

    console.log('5. Unsupported / unconfigured providers');
    const r = await fetch(APP + '/api/auth/apple/start', { redirect: 'manual' }); assert(r.status === 303 && r.headers.get('location').includes('error=not_configured')); ok('unconfigured Apple start → not_configured (and no Apple button shown)');
    const pg = await (await b.newContext()).newPage(); await pg.goto(APP + '/login'); assert(await pg.locator('a:has-text("Continue with Google")').count() === 1 && await pg.locator('a:has-text("Apple")').count() === 0); ok('only the configured provider button is rendered');
    console.log('\nAll mock-IdP OAuth checks passed (mock provider only — not live Google/Apple).');
  } finally { await b.close(); idp.close(); app.kill(); await cleanDb(); }
})().catch((e) => { console.error('FAIL', e.message.split('\n').slice(0, 3).join(' | ')); process.exit(1); });
