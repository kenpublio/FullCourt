const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const webBase = process.env.FULLCOURT_WEB_URL || 'http://127.0.0.1:5173';
const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd: root, encoding: 'utf8' }));
const organizer = sessions.find((entry) => entry.user.role === 'organization_admin');
if (!organizer) throw new Error('Organizer demo account is unavailable.');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript((session) => {
    localStorage.setItem('sportsync_token', session.token);
    localStorage.setItem('sportsync_user', JSON.stringify(session.user));
  }, organizer);
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(`${webBase}/tournaments`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Create Tournament/i }).first().click();
  await page.getByRole('heading', { name: 'Submit Tournament for Review' }).waitFor();
  const modalBody = page.locator('.tournament-create-dialog .modal-body');
  const scrollMetrics = await modalBody.evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, overflowY: getComputedStyle(element).overflowY, position: getComputedStyle(element).position }));
  if (scrollMetrics.scrollHeight <= scrollMetrics.clientHeight) throw new Error('Tournament modal body is not a scroll container.');
  await modalBody.evaluate((element) => { element.scrollTop = Math.min(500, element.scrollHeight); });
  await page.waitForTimeout(500);
  const modalScrollTop = await modalBody.evaluate((element) => element.scrollTop);
  if (modalScrollTop <= 0) throw new Error(`Tournament modal cannot scroll down (${JSON.stringify(scrollMetrics)}).`);
  await modalBody.evaluate((element) => { element.scrollTop = 0; });
  const temporaryVenueName = `FullCourt UI Audit Venue ${Date.now()}`;
  let mapAddressAutofill = false;
  if (!await page.locator('.tournament-venue-option').count()) {
    const map = page.locator('.tournament-leaflet-map');
    await map.waitFor();
    await map.click({ position: { x: 185, y: 125 } });
    try {
      await page.getByRole('button', { name: /Use this address/i }).waitFor({ timeout: 20000 });
      await page.getByRole('button', { name: /Use this address/i }).click();
      mapAddressAutofill = Boolean((await page.getByLabel('Complete address').inputValue()).trim());
      if (!mapAddressAutofill) throw new Error('Map point did not fill the complete address field.');
    } catch {
      // Keep the venue CRUD audit deterministic when the public reverse-geocoder is unavailable.
      await page.getByLabel('Complete address').fill('Ormoc City, Leyte');
    }
    await page.getByLabel('Venue name').fill(temporaryVenueName);
    await page.getByRole('button', { name: /Attach venue/i }).click();
    await page.locator('.tournament-venue-option').first().waitFor({ timeout: 60000 });
  }
  const mapCount = await page.locator('.tournament-map-preview iframe').count();
  const locationChoices = await page.locator('.tournament-venue-option').count();
  const editVenueActions = await page.getByRole('button', { name: /^Edit venue / }).count();
  const deleteVenueActions = await page.getByRole('button', { name: /^Delete venue / }).count();
  if (!editVenueActions || !deleteVenueActions) throw new Error('Venue edit/delete controls are missing.');
  if (!await page.locator('.tournament-court-choice.is-checked').count()) {
    await page.getByRole('button', { name: 'Use venue' }).first().click();
  }
  await page.getByText('Court availability & game timing', { exact: true }).waitFor();
  await page.getByLabel('Courts open').waitFor();
  await page.getByLabel('Courts close').waitFor();
  for (const removedLabel of ['Minutes per game', 'Changeover break', 'Team rest (minutes)', 'Max games/team/day']) {
    if (await page.getByText(removedLabel, { exact: true }).count()) {
      throw new Error(`Removed scheduling field is still visible: ${removedLabel}`);
    }
  }
  const selectedCourts = await page.locator('.tournament-court-choice.is-checked').count();
  const overflow = await page.locator('.tournament-create-dialog').evaluate((element) => element.scrollWidth > element.clientWidth + 2);
  if (pageErrors.length) throw new Error(`Page error: ${pageErrors.join('; ')}`);
  if (locationChoices && !mapCount) throw new Error('Approved venues are listed without a map preview.');
  if (selectedCourts !== 1) throw new Error('A new venue should attach exactly one Main Court.');
  if (overflow) throw new Error('Tournament submission dialog has horizontal overflow on mobile.');
  console.log(JSON.stringify({
    organizer_submission_opened: true,
    modal_scrolls_down: true,
    location_choices: locationChoices,
    venue_edit_action: true,
    venue_delete_action: true,
    map_preview: Boolean(mapCount),
    map_address_autofill: mapAddressAutofill,
    selected_courts: selectedCourts,
    playing_hours_fields: true,
    advanced_timing_fields_removed: true,
    mobile_layout_fits: true,
  }, null, 2));
  const venueResponse = await fetch('http://127.0.0.1:8767/api/venues', { headers: { Authorization: `Bearer ${organizer.token}` } });
  const venuePayload = await venueResponse.json();
  const temporaryVenue = venuePayload.data?.venues?.find((venue) => venue.name === temporaryVenueName);
  if (temporaryVenue) await fetch(`http://127.0.0.1:8767/api/venues/${temporaryVenue.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${organizer.token}` } });
  await browser.close();
})().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
