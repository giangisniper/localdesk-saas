// Auth regression: localhost + every LAN IP of this machine, plain HTTP. Run against a running seeded production server:
//   node scripts/auth-regression.cjs [port]       (logs contain no secrets)
const { chromium } = require('playwright');
const os = require('os');
const assert = require('assert');
const PORT = process.argv[2] || '3000';
const lan = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
const bases = [`http://localhost:${PORT}`, ...lan.map((ip) => `http://${ip}:${PORT}`)];
const ok = (m) => console.log('  ✔', m);
const fill = async (p, base, pw = 'LocalDesk2026!') => { await p.goto(base + '/login'); await p.fill('input[name=email]', 'owner@demo.localdesk.app'); await p.fill('input[name=password]', pw); };

(async () => {
  const b = await chromium.launch();
  for (const base of bases) {
    console.log(base);
    const ctx = await b.newContext(); const p = await ctx.newPage();
    const setCookies = []; let actionId;
    p.on('response', async (r) => { const sc = (await r.allHeaders())['set-cookie']; if (sc) setCookies.push(sc); });
    p.on('request', (r) => { if (r.headers()['next-action']) actionId = r.headers()['next-action']; });
    await fill(p, base); await p.click('button[type=submit]'); await p.waitForURL('**/dashboard', { timeout: 15000 });
    ok('login lands on /dashboard');
    const c = (await ctx.cookies()).find((x) => x.name === 'ld_session');
    assert(c, 'session cookie was NOT stored by the browser'); assert(c.httpOnly && c.sameSite === 'Lax' && c.path === '/');
    assert(!/;\s*Domain=/i.test(setCookies[0]), 'cookie must be host-only (no Domain)');
    ok(`cookie stored (HttpOnly, SameSite=Lax, host-only, Secure=${c.secure}) — not Secure over plain HTTP`);
    assert.strictEqual(c.secure, false);
    await p.reload(); assert(p.url().endsWith('/dashboard')); await p.goto(base + '/customers'); assert(p.url().endsWith('/customers')); await p.goto(base + '/settings'); assert(p.url().endsWith('/settings'));
    ok('session persists across reload and protected pages');
    await p.click('button[aria-label="Sign out"]:visible'); await p.waitForURL('**/login'); assert(!(await ctx.cookies()).find((x) => x.name === 'ld_session'));
    await p.goto(base + '/dashboard'); assert(p.url().endsWith('/login')); ok('logout clears cookie; dashboard redirects to /login');
    await ctx.addCookies([{ name: 'ld_session', value: 'not.a.jwt', url: base }]); await p.goto(base + '/dashboard'); assert(p.url().endsWith('/login'));
    ok('invalid session cookie rejected');
    // Foreign Origin must be rejected by the Server Action origin check
    const evil = await ctx.request.post(base + '/login', { headers: { 'next-action': actionId, origin: 'http://evil.example', 'content-type': 'text/plain;charset=UTF-8', accept: 'text/x-component' },
      data: JSON.stringify([{ email: 'owner@demo.localdesk.app', password: 'LocalDesk2026!' }]) });
    assert(!(evil.headers()['set-cookie']), 'cross-origin action must not set a session'); ok(`cross-origin server action rejected (HTTP ${evil.status()}, no cookie)`);
    // Behind an HTTPS-terminating proxy the cookie must be Secure
    const sctx = await b.newContext({ extraHTTPHeaders: { 'x-forwarded-proto': 'https' } }); const sp = await sctx.newPage(); const sc = [];
    sp.on('response', async (r) => { const h = (await r.allHeaders())['set-cookie']; if (h) sc.push(h); });
    await fill(sp, base); await sp.click('button[type=submit]'); await sp.waitForTimeout(2500);
    assert(sc.length && /;\s*Secure/i.test(sc[0]) && /HttpOnly/i.test(sc[0]) && /SameSite=lax/i.test(sc[0]), 'HTTPS (X-Forwarded-Proto) must yield Secure cookie');
    ok('X-Forwarded-Proto: https → Set-Cookie has Secure; HttpOnly; SameSite=Lax'); await sctx.close(); await ctx.close();
  }
  await b.close();
  console.log(`\nAll auth regression checks passed for: ${bases.join(', ')}`);
})().catch((e) => { console.error('FAIL', e.message.split('\n')[0]); process.exit(1); });
