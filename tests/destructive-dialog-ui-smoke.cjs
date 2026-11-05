const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const base = process.env.APP_URL || 'http://127.0.0.1:5180';
const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd: root, encoding: 'utf8' }));
const admin = sessions.find((entry) => entry.user.role === 'platform_admin');
if (!admin) throw new Error('Platform Admin session is unavailable.');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript((session) => {
    localStorage.setItem('sportsync_token', session.token);
    localStorage.setItem('sportsync_user', JSON.stringify(session.user));
  }, admin);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  const checks = [
    ['/users', 'button[title="Delete account access"]'],
    ['/teams', 'button[aria-label^="Delete "]'],
    ['/venues', 'button[aria-label^="Delete "]'],
  ];
  const results = [];
  for (const [route, selector] of checks) {
    await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    if(route==='/teams'){
      const picker=page.locator('#team-tournament-filter');
      if(await picker.count()){await picker.selectOption({index:1});await page.waitForTimeout(800);}
    }
    const action = page.locator(selector).first();
    if (!await action.count()) {
      results.push({ route, skipped: 'no removable record', buttons: (await page.getByRole('button').allTextContents()).filter(Boolean).slice(0, 12) });
      continue;
    }
    await action.click();
    const dialog = page.getByRole('alertdialog');
    await dialog.waitFor({ timeout: 10000 });
    const fitsViewport = await dialog.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;
    });
    if (!fitsViewport) {
      const metrics = await dialog.evaluate((node) => { const rect=node.getBoundingClientRect(); const backdrop=node.parentElement; return { left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:innerWidth,height:innerHeight,scrollY,backdropPosition:getComputedStyle(backdrop).position,backdropTop:backdrop.getBoundingClientRect().top,bodyTransform:getComputedStyle(document.body).transform,htmlTransform:getComputedStyle(document.documentElement).transform }; });
      throw new Error(`${route} confirmation dialog overflows mobile viewport: ${JSON.stringify(metrics)}`);
    }
    await dialog.getByRole('button', { name: 'Keep it' }).click();
    await dialog.waitFor({ state: 'detached' });
    results.push({ route, branded_dialog: true, mobile_fit: true, cancelled_without_deleting: true });
  }
  await page.goto(`${base}/tournaments`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const createTournament = page.getByRole('button', { name: /Create Tournament/i }).first();
  if (await createTournament.count()) {
    await createTournament.click();
    const venueDelete = page.getByRole('button', { name: /^Delete venue / }).first();
    if (await venueDelete.count()) {
      await venueDelete.click();
      const dialog = page.getByRole('alertdialog');
      await dialog.waitFor();
      await dialog.getByRole('button', { name: 'Keep it' }).click();
      results.push({ route: '/tournaments', branded_dialog: true, cancelled_without_deleting: true });
    }
  }
  if (errors.length) throw new Error(errors.join(' | '));
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
