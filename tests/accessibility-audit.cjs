const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output', 'browser-audit', 'accessibility-results.json');
const base = 'http://127.0.0.1:5180';
const axeUrl = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.3/axe.min.js';

(async () => {
  const axeResponse = await fetch(axeUrl);
  if (!axeResponse.ok) throw new Error(`Could not load axe-core (${axeResponse.status}).`);
  const axeSource = await axeResponse.text();
  const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd: root, encoding: 'utf8' }));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [];
  const selectedRoles = process.env.AUDIT_ROLES?.split(',').map((role) => role.trim()).filter(Boolean);
  const selectedRoutes = process.env.AUDIT_ROUTES?.split(',').map((route) => route.trim()).filter(Boolean);

  for (const session of [null, ...sessions].filter((entry) => !selectedRoles || selectedRoles.includes(entry?.user.role || 'public'))) {
    const role = session?.user.role || 'public';
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    if (session) await context.addInitScript((value) => {
      localStorage.setItem('sportsync_token', value.token);
      localStorage.setItem('sportsync_user', JSON.stringify(value.user));
    }, session);
    const page = await context.newPage();
    const home = { platform_admin: '/platform', organization_admin: '/organizer', coach: '/coach', player: '/player' }[role] || '/';
    await page.goto(base + home, { waitUntil: 'domcontentloaded' });
    if (session) await page.locator('.sidebar-menu').waitFor({ timeout: 20000 });
    const routes = session
      ? await page.locator('.sidebar-menu a').evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href')))])
      : ['/', '/login', '/admin', '/register', '/forgot-password', '/sports', '/sports/tournaments/2'];
    const routesToScan = selectedRoutes ? routes.filter((route) => selectedRoutes.includes(route)) : routes;

    for (const route of routesToScan) {
      await page.goto(base + route, { waitUntil: 'domcontentloaded' });
      if (session) await page.locator('.sidebar-menu').waitFor({ timeout: 20000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(150);
      await page.addScriptTag({ content: axeSource });
      const scan = await page.evaluate(async () => {
        const result = await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
        });
        return result.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          help: violation.help,
          helpUrl: violation.helpUrl,
          nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
        }));
      });
      results.push({ role, route, violations: scan });
      console.log(JSON.stringify({ role, route, violationCount: scan.reduce((count, violation) => count + violation.nodes.length, 0) }));
    }
    await context.close();
  }

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(results, null, 2));
  await browser.close();
  const grouped = new Map();
  for (const result of results) for (const violation of result.violations) {
    const entry = grouped.get(violation.id) || { id: violation.id, impact: violation.impact, help: violation.help, occurrences: 0, routes: new Set() };
    entry.occurrences += violation.nodes.length;
    entry.routes.add(`${result.role}:${result.route}`);
    grouped.set(violation.id, entry);
  }
  console.log(JSON.stringify({
    scannedPages: results.length,
    totalViolations: [...grouped.values()].reduce((sum, item) => sum + item.occurrences, 0),
    violations: [...grouped.values()].map((item) => ({ ...item, routes: [...item.routes] })),
    report: output,
  }, null, 2));
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
