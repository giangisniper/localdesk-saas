// End-to-end audit script. Run against a running, seeded app: node scripts/e2e.cjs
const { chromium } = require('playwright');
const assert = require('assert');
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const log = (m) => console.log('✔', m);
async function login(page, email, pw = 'LocalDesk2026!') {
  await page.goto(BASE + '/login'); await page.fill('input[name=email]', email); await page.fill('input[name=password]', pw);
  await page.click('button[type=submit]'); await page.waitForURL(/dashboard|calendar/, { timeout: 30000 });
}
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const watch = (p) => { p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); }); return p; };
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = watch(await ctx.newPage());
  await login(p, 'owner@demo.localdesk.app');
  const stamp = Date.now().toString().slice(-6);

  // --- Appointment create + conflict + edit + cancel via calendar dialog
  const d = new Date(Date.now() + (60 + Math.floor(Math.random() * 300)) * 86400_000); const date = d.toISOString().slice(0, 10);
  await p.goto(`${BASE}/calendar?view=day&date=${date}`);
  const book = async (time) => {
    await p.click('button:has-text("New")');
    await p.fill('input[role=combobox]', 'Rossi'); await p.locator('[role=option] button').first().click();
    const svc = p.locator('dialog select').first();
    await svc.selectOption({ index: (await svc.locator('option').allTextContents()).findIndex((t) => t.startsWith("Men's Cut")) });
    await p.fill('dialog input[type=date]', date); await p.fill('dialog input[type=time]', time);
    await p.click('dialog button:has-text("Book appointment")');
  };
  await book('16:00'); await p.locator('text=Appointment booked').or(p.locator('dialog [role=alert]')).first().waitFor(); if (await p.locator('dialog [role=alert]').count()) throw new Error('book failed: ' + await p.locator('dialog [role=alert]').first().innerText()); log('appointment created from calendar');
  await p.waitForTimeout(800);
  await book('16:10');
  await p.waitForSelector('dialog [role=alert]'); const msg = await p.locator('dialog [role=alert]').first().innerText();
  assert(/not available|just booked/i.test(msg), msg); log('conflicting booking rejected: ' + msg.slice(0, 60));
  await p.keyboard.press('Escape');

  await p.goto(`${BASE}/appointments?q=Rossi&when=upcoming`);
  await p.locator('tbody tr', { hasText: 'Men' }).filter({ hasNotText: 'Cancelled' }).first().click();
  await p.waitForSelector('dialog:has-text("Edit appointment")');
  await p.click('dialog button:has-text("Cancel"):not(:has-text("Close"))'); await p.waitForSelector('text=Appointment cancelled'); log('appointment cancelled');

  // --- Month / week views render
  for (const v of ['week', 'month']) { await p.goto(`${BASE}/calendar?view=${v}&date=${date}`); await p.waitForSelector(v === 'month' ? 'text=Mon' : 'text=MON'); }
  log('week + month views render');

  // --- Customers: add, note
  await p.goto(BASE + '/customers'); await p.click('button:has-text("Add customer")');
  await p.fill('dialog input >> nth=0', `Audit Person ${stamp}`); await p.fill('dialog input[type=email]', `audit${stamp}@example.com`);
  await p.click('dialog button[type=submit]'); await p.waitForURL(/customers\/[0-9a-f-]{36}/);
  await p.fill('textarea[aria-label="New note"]', 'Audit note ' + stamp); await p.click('button:has-text("Add note")'); await p.waitForSelector('text=Audit note ' + stamp);
  log('customer created + note added');
  await p.goto(BASE + '/customers?q=Audit+Person+' + stamp); await p.waitForSelector('text=Audit Person ' + stamp); log('customer search works');
  await p.goto(BASE + '/customers/00000000-0000-0000-0000-000000000000'); assert(await p.locator('text=404').count() || await p.locator('text=could not be found').count()); log('unknown customer → 404');

  // --- Services
  await p.goto(BASE + '/services'); await p.click('button:has-text("New service")');
  await p.fill('dialog input >> nth=0', 'Audit Service ' + stamp); await p.fill('dialog input[inputmode=decimal]', '19,50');
  await p.click('dialog button:has-text("Save service")'); await p.waitForSelector('text=Audit Service ' + stamp); log('service created');
  await p.click(`button[aria-label="Edit Audit Service ${stamp}"]`); p.once('dialog', (x) => x.accept());
  await p.click('dialog button:has-text("Delete")'); await p.waitForSelector('text=Audit Service ' + stamp, { state: 'detached' }); log('service deleted');

  // --- Team: time off
  await p.goto(BASE + '/staff'); await p.click('button[aria-label="Edit Nina Petrova"]');
  await p.click('dialog button:has-text("Add"):not(:has-text("Add team"))'); await p.waitForSelector('text=Time off added'); log('time off added');
  const rm = p.locator('dialog button[aria-label="Remove time off"]').last(); await rm.click(); await p.waitForTimeout(600); await p.keyboard.press('Escape');

  // --- Settings
  await p.goto(BASE + '/settings'); await p.click('button[role=tab]:has-text("Booking rules")');
  await p.fill('input[type=number] >> nth=1', '3'); await p.click('button:has-text("Save rules")'); await p.waitForSelector('text=Saved'); log('booking rules saved');
  await p.fill('input[type=number] >> nth=1', '2'); await p.click('button:has-text("Save rules")'); await p.waitForTimeout(500);

  // --- Dashboard range filter
  await p.goto(BASE + '/dashboard'); await p.click('button:has-text("7 days")'); await p.waitForURL(/range=7d/); log('dashboard range filter');

  // --- Password change invalidates other sessions
  const email = `pw${stamp}@example.com`;
  const c1 = await b.newContext(); const a = watch(await c1.newPage());
  await a.goto(BASE + '/register'); await a.fill('input[name=name]', 'Pw Tester'); await a.fill('input[name=email]', email); await a.fill('input[name=password]', 'firstpass1234');
  await a.click('button[type=submit]'); await a.waitForURL('**/onboarding');
  const c2 = await b.newContext(); const a2 = await c2.newPage(); await a2.goto(BASE + '/login'); await a2.fill('input[name=email]', email); await a2.fill('input[name=password]', 'firstpass1234'); await a2.click('button[type=submit]'); await a2.waitForURL('**/onboarding');
  // finish onboarding in c1 then change password
  await a.fill('input[placeholder="Studio Luna"]', 'Pw Co ' + stamp); await a.click('text=Continue'); await a.click('text=Continue');
  await a.fill('input[placeholder="Initial consultation"]', 'Cut'); await a.fill('input[placeholder="45"]', '20'); await a.click('text=Finish setup'); await a.waitForURL('**/dashboard');
  await a.goto(BASE + '/settings'); await a.click('button[role=tab]:has-text("Account")');
  await a.fill('input[autocomplete=current-password]', 'firstpass1234'); await a.fill('input[autocomplete=new-password]', 'secondpass5678'); await a.click('button:has-text("Update password")'); await a.waitForSelector('text=Password updated');
  await a.goto(BASE + '/dashboard'); assert(a.url().includes('/dashboard'), 'current device should stay signed in');
  await a2.goto(BASE + '/dashboard'); assert(a2.url().includes('/login'), 'other session must be invalidated: ' + a2.url());
  log('password change keeps this device, revokes other sessions');

  // --- Mobile layout check
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const mp = watch(await m.newPage());
  const pubPages = ['/', '/login', '/register', '/book/studio-luna'];
  const overflow = [];
  const check = async (url, shot) => { await mp.goto(BASE + url, { waitUntil: 'networkidle' }); await mp.waitForTimeout(900);
    const o = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (o > 1) overflow.push(`${url} (+${o}px)`);
    if (shot) await mp.screenshot({ path: `docs/screenshots/mobile-${shot}.png` }); };
  await check('/', 'landing'); await check('/login'); await check('/register'); await check('/book/studio-luna', 'booking');
  await login(mp, 'owner@demo.localdesk.app');
  for (const [u, s] of [['/dashboard', 'dashboard'], ['/calendar?view=week', 'calendar'], ['/calendar?view=month', null], ['/appointments', null], ['/customers', 'customers'], ['/services', null], ['/staff', null], ['/analytics', 'analytics'], ['/settings', null]]) await check(u, s);
  console.log(overflow.length ? '✘ horizontal overflow on: ' + overflow.join(', ') : '✔ no horizontal page overflow on 13 mobile pages');
  const real = errs.filter((e) => !/Failed to load resource.*(401|404)|favicon/i.test(e));
  console.log(real.length ? 'console/page errors:\n' + real.join('\n') : '✔ no console/page errors');
  await b.close();
  if (overflow.length) process.exit(2);
})().catch((e) => { console.error('FAIL', e.message.split('\n').slice(0,4).join(' | ')); process.exit(1); });
