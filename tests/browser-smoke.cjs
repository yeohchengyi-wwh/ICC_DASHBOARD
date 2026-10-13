/* Optional integration check. Requires Playwright and a running local server. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const baseURL = process.env.ICC_TEST_URL || 'http://127.0.0.1:3000';

function parseCSV(source) {
  const rows = []; let row = [], cell = '', quoted = false;
  source = source.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\r' || char === '\n') && !quoted) {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

(async () => {
  const { getAlerts, filterRecords } = await import('../js/core.js');
  const browser = await chromium.launch({ executablePath: process.env.ICC_CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'icc-browser-smoke-'));
  const stat = async label => page.locator('.stat-card').filter({ has: page.locator('.stat-label', { hasText: label }) }).locator('.stat-value').innerText();
  const go = async module => {
    await page.locator(`[data-page="${module}"]`).click();
    await page.waitForFunction(value => location.hash === `#${value}` && document.querySelector('.main-nav a.active')?.dataset.page === value, module);
  };
  const exportRows = async action => {
    const waiting = page.waitForEvent('download'); await page.locator(`[data-action="${action}"]`).click();
    const download = await waiting; const destination = path.join(temp, download.suggestedFilename());
    await download.saveAs(destination); return parseCSV(await fs.readFile(destination, 'utf8'));
  };
  const renew = async (id, expiryDate) => {
    await page.locator('#table-search').fill(id);
    await page.locator(`.record-link[data-id="${id}"]`).click();
    await page.locator('[data-action="renew"]').click();
    await page.locator('#new-expiry').fill(expiryDate);
    await page.getByRole('button', { name: 'Save renewal date', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#record-dialog').open);
  };

  try {
    await page.goto(baseURL);
    await page.getByRole('heading', { name: 'Innovation overview', exact: true }).waitFor();
    const response = await page.request.get(`${baseURL}/data/dashboard.json`); const data = await response.json();
    const baselineAlerts = getAlerts(data).length;
    const baselineRevenue = await stat('Collected revenue');
    assert.equal(await stat('Intellectual property'), String(data.ip.length));
    assert.equal(await stat('Incubator ventures'), String(data.incubators.length));

    await page.locator('#year-filter').selectOption('2024');
    await page.locator('#faculty-filter').selectOption(data.faculties[0]);
    await page.locator('#portfolio-filter').selectOption('ip');
    const scopedIP = filterRecords(data.ip, { year: '2024', faculty: data.faculties[0] });
    assert.equal(await stat('Intellectual property'), String(scopedIP.length));
    assert.equal(await stat('Incubator ventures'), '0');
    const scopedCSV = await exportRows('export');
    assert.equal(scopedCSV.length, scopedIP.length + 1);
    assert.ok(scopedCSV.slice(1).every(row => row[0] === 'IP portfolio' && row[4] === data.faculties[0] && row[6].startsWith('2024-')));
    await page.locator('[data-action="clear-filters"]').click();
    console.log('PASS: combined cohort, school, portfolio filters and scoped CSV');

    await go('notifications');
    assert.equal(await stat('Unread reminders'), String(baselineAlerts));
    await page.locator('[data-action="read"]').first().click();
    assert.equal(await stat('Unread reminders'), String(baselineAlerts - 1));
    await page.reload(); await page.getByRole('heading', { name: 'Notifications', exact: true }).waitFor();
    assert.equal(await stat('Unread reminders'), String(baselineAlerts - 1));
    await page.locator('[data-action="read-all"]').click();
    assert.equal(await stat('Unread reminders'), '0');
    console.log('PASS: notification acknowledgement persists across reload');

    await go('commercialization');
    const baselineTrend = await page.evaluate(() => Chart.getChart('module-trend').data.datasets[0].data);
    await renew('COM-001', '2027-10-22');
    assert.equal(await stat('Collected revenue'), baselineRevenue);
    assert.deepEqual(await page.evaluate(() => Chart.getChart('module-trend').data.datasets[0].data), baselineTrend);
    await page.reload(); await page.getByRole('heading', { name: 'Commercialization', exact: true }).waitFor();
    assert.equal(await stat('Collected revenue'), baselineRevenue);
    await renew('COM-001', '2026-12-22');
    await go('notifications');
    assert.equal(await stat('Unread reminders'), '1');
    const renewedAlert = page.locator('.notification-item').filter({ has: page.locator('[data-id="COM-001"]') });
    assert.ok((await renewedAlert.innerText()).includes('Due 22 Dec 2026'));
    assert.equal(await renewedAlert.locator('[data-action="read"]').count(), 1);
    console.log('PASS: renewing an original agreement preserves revenue and creates a new unread deadline');

    await go('commercialization'); await page.locator('[data-action="add"]').click();
    await page.locator('#field-title').fill('FYP <Pilot> licensing');
    await page.locator('#field-partner').fill('FYP research team');
    await page.locator('#field-faculty').selectOption(data.faculties[0]);
    await page.locator('#field-category').selectOption('Licensed');
    await page.locator('#field-agreementDate').fill('2026-10-13');
    await page.locator('#field-expiryDate').fill('2027-10-13');
    await page.locator('#field-revenue').fill('12500');
    await page.getByRole('button', { name: 'Add record', exact: true }).last().click();
    await page.waitForFunction(() => !document.querySelector('#record-dialog').open);
    assert.equal(await stat('Commercialization deals'), String(data.commercialization.length + 1));
    const localId = await page.locator('.record-link').filter({ hasText: 'FYP <Pilot> licensing' }).getAttribute('data-id');
    assert.ok(localId.startsWith('COM-LOCAL-'));
    await renew(localId, '2026-11-30');
    await page.reload(); await page.getByRole('heading', { name: 'Commercialization', exact: true }).waitFor();
    await page.locator('#year-filter').selectOption('2026');
    await page.locator('#faculty-filter').selectOption(data.faculties[0]);
    await page.locator('#table-search').fill('FYP <Pilot>');
    await page.locator('[data-action="status"][data-status="expiring"]').click();
    const localCSV = await exportRows('export');
    assert.equal(localCSV.length, 2);
    assert.equal(localCSV[1][1], localId);
    assert.equal(localCSV[1][2], 'FYP <Pilot> licensing');
    assert.equal(localCSV[1][7], '2026-11-30');
    assert.equal(localCSV[1][8], 'expiring');
    assert.equal(localCSV[1][10], '12500');
    assert.equal(await page.locator('[data-status="expiring"]').getAttribute('aria-pressed'), 'true');
    console.log('PASS: adding, renewing and persisting a local agreement; scoped CSV includes exact collected revenue');

    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('#sidebar').evaluate(element => element.inert), true);
    await page.locator('#menu-button').click();
    assert.equal(await page.locator('#sidebar').evaluate(element => element.inert), false);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#sidebar').evaluate(element => element.inert), true);
    assert.ok(await page.locator('[data-action="export"]').getAttribute('aria-label'));
    assert.ok(await page.locator('#search-button').getAttribute('aria-label'));
    console.log('PASS: mobile navigation inert state and icon-button accessible names');
    assert.deepEqual(errors, [], `Unexpected browser errors: ${errors.join('; ')}`);
  } finally {
    await browser.close(); await fs.rm(temp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
