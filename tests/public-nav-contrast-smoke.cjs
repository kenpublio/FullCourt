const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const base = process.env.APP_URL || 'http://127.0.0.1:5180';
const rgb = value => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const luminance = ([r, g, b]) => {
  const channels = [r, g, b].map(value => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};
const contrast = (foreground, background) => {
  const values = [luminance(rgb(foreground)), luminance(rgb(background))].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  for (const width of [1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await context.newPage();
    await page.goto(`${base}/sports`);
    await page.getByRole('navigation', { name: 'Main navigation' }).waitFor();
    const colors = await page.evaluate(() => {
      const nav = document.querySelector('.court-nav');
      const link = document.querySelector('.court-nav-links a:not(.active)');
      const active = document.querySelector('.court-nav-links a.active');
      const signin = document.querySelector('.court-signin > span:last-child');
      return {
        background: getComputedStyle(nav).backgroundColor,
        link: getComputedStyle(link).color,
        active: getComputedStyle(active).color,
        signin: getComputedStyle(signin).color,
        pageWidth: document.documentElement.scrollWidth,
      };
    });
    for (const key of ['link', 'active', 'signin']) {
      const ratio = contrast(colors[key], colors.background);
      if (ratio < 4.5) throw new Error(`${key} contrast at ${width}px is only ${ratio.toFixed(2)}:1.`);
    }
    const directory = await page.evaluate(() => {
      const title = document.querySelector('.court-tournament h3');
      const card = document.querySelector('.court-tournament');
      return {
        title: title ? getComputedStyle(title).color : null,
        card: card ? getComputedStyle(card).backgroundColor : null,
        featurePills: document.querySelectorAll('.court-picker-features').length,
        countLabel: document.querySelector('.court-directory-mark small')?.textContent.trim(),
      };
    });
    if (directory.featurePills) throw new Error('Removed Game Center feature pills are still rendered.');
    if (directory.countLabel !== 'Official tournaments') throw new Error('Official tournament counter label is unclear.');
    if (directory.title && contrast(directory.title, directory.card) < 4.5) throw new Error(`Tournament title contrast failed at ${width}px.`);
    if (colors.pageWidth > width + 1) throw new Error(`Navigation creates horizontal overflow at ${width}px.`);

    await page.goto(`${base}/`);
    await page.locator('.court-home-dark').waitFor();
    const home = await page.evaluate(() => {
      const tournament = document.querySelector('.court-tournament');
      const title = tournament?.querySelector('h3');
      const status = tournament?.querySelector('.court-status');
      const facts = tournament?.querySelector('.court-tournament-facts');
      const titleStyle = title ? getComputedStyle(title) : null;
      const cardStyle = tournament ? getComputedStyle(tournament) : null;
      return {
        decorativeNumbers: document.querySelectorAll('.court-tournament-number').length,
        titleColor: titleStyle?.color,
        cardBackground: cardStyle?.backgroundColor,
        statusText: status?.textContent.trim(),
        factsText: facts?.textContent.trim(),
        playerCards: document.querySelectorAll('.court-player-grid article').length,
        playerSection: document.querySelectorAll('.court-player-spotlight').length,
        playerTournamentLinks: [...document.querySelectorAll('.court-player-tournament')].map(link => ({ text: link.textContent.trim(), href: link.getAttribute('href') })),
        playerHeading: document.querySelector('.court-player-spotlight h2')?.textContent.trim(),
        playerCopy: document.querySelector('.court-player-spotlight .court-section-heading p')?.textContent.trim(),
        communityCta: document.querySelector('.court-home-community .court-button')?.textContent.trim(),
        communityHref: document.querySelector('.court-home-community .court-button')?.getAttribute('href'),
      };
    });
    if (home.decorativeNumbers) throw new Error('Decorative tournament numbers are still exposed beside the status.');
    if (home.titleColor && contrast(home.titleColor, home.cardBackground) < 4.5) throw new Error(`Homepage tournament title contrast failed at ${width}px.`);
    if (home.factsText && !/Starts|Started/.test(home.factsText)) throw new Error('Tournament start date has no clear label.');
    if (!home.playerCards && home.playerSection) throw new Error('Empty verified-performance placeholder is still shown.');
    if (home.playerCards && home.playerTournamentLinks.some(link => !link.text || !/^\/sports\/tournaments\/\d+$/.test(link.href || ''))) throw new Error('A player leader is missing its tournament name or link.');
    if (home.playerSection && (home.playerHeading !== 'Top performers.' || home.playerCopy !== 'Player rankings update from finalized game statistics.')) throw new Error('Homepage player-leader copy was not updated.');
    if (home.communityCta !== 'View official schedule' || home.communityHref !== '/sports/schedule') throw new Error('Homepage community CTA still duplicates coach registration.');

    await page.goto(`${base}/sports/schedule`);
    await page.locator('.daily-tools input').waitFor();
    const scheduleColors = await page.evaluate(() => {
      const input = document.querySelector('.daily-tools input');
      const link = document.querySelector('.daily-place > a');
      const inputStyle = getComputedStyle(input);
      const linkStyle = link ? getComputedStyle(link) : null;
      return {
        inputText: inputStyle.color,
        inputBackground: inputStyle.backgroundColor,
        linkText: linkStyle?.color,
        linkBackground: linkStyle?.backgroundColor,
      };
    });
    if (contrast(scheduleColors.inputText, scheduleColors.inputBackground) < 4.5) throw new Error(`Schedule search contrast failed at ${width}px.`);
    if (scheduleColors.linkText && contrast(scheduleColors.linkText, scheduleColors.linkBackground) < 4.5) throw new Error(`Game details contrast failed at ${width}px.`);
    await context.close();
  }
  console.log(JSON.stringify({ desktop_contrast: 'passed', mobile_contrast: 'passed', leader_tournament_context: 'passed', community_cta_deduplicated: true, homepage_tournament_cards: 'passed', decorative_numbers_removed: true, empty_performance_section_hidden: true, tournament_titles: 'passed', tournament_counter: 'passed', feature_pills_removed: true, schedule_search: 'passed', game_details_action: 'passed', active_page_indicator: 'visible', overflow: false }, null, 2));
  await browser.close();
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
