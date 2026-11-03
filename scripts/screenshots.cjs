const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const mk = async (vp) => { const c = await b.newContext({ viewport: vp }); const p = await c.newPage();
    p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
    p.on('console', m => { if (m.type()==='error') errs.push('CONSOLE ' + m.text().slice(0,300)); }); return p; };
  const pub = await mk({ width: 1360, height: 900 });
  for (const [n,u,full] of [['landing','/',true],['book','/book/studio-luna',false],['login','/login',false]]) {
    await pub.goto('http://localhost:3000'+u, { waitUntil: 'networkidle', timeout: 60000 }); await pub.waitForTimeout(500);
    await pub.screenshot({ path: `docs/screenshots/${n}.png`, fullPage: full });
  }
  const p = await mk({ width: 1360, height: 900 });
  await p.goto('http://localhost:3000/login');
  await p.fill('input[name=email]', 'owner@demo.localdesk.app'); await p.fill('input[name=password]', 'LocalDesk2026!');
  await p.click('button[type=submit]'); await p.waitForURL('**/dashboard', { timeout: 30000 });
  for (const n of ['analytics','settings','services','staff','customers','appointments','calendar?view=week&staff=all']) {
    await p.goto('http://localhost:3000/'+n, { waitUntil: 'networkidle', timeout: 60000 }); await p.waitForTimeout(1500);
    await p.screenshot({ path: `docs/screenshots/${n.split('?')[0]}.png` });
  }
  await b.close();
  console.log(errs.join('\n') || 'no errors');
})();
