import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { REFERENCE_DATE, addMonths, daysBetween, expiryInfo, formatDate, formatMoney, escapeHTML, getAlerts, filterRecords } from '../js/core.js';

test('three-calendar-month reminder boundary is inclusive', () => {
  assert.equal(REFERENCE_DATE, '2026-10-13');
  assert.equal(addMonths(REFERENCE_DATE, 3), '2027-01-13');
  assert.equal(daysBetween(REFERENCE_DATE, '2027-01-13'), 92);
  assert.equal(expiryInfo('2027-01-13').status, 'expiring');
  assert.equal(expiryInfo('2027-01-14').status, 'active');
  assert.equal(expiryInfo('2026-10-13').status, 'expiring');
  assert.equal(expiryInfo('2026-10-13').label, 'Expires today');
  assert.deepEqual(expiryInfo('2026-10-12'), { status: 'expired', days: -1, label: 'Expired 1 day ago' });
});

test('month arithmetic clamps month ends and respects leap years', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(addMonths('2024-02-29', 12), '2025-02-28');
  assert.equal(addMonths('2026-12-31', -10), '2026-02-28');
  assert.equal(expiryInfo('2027-02-28', '2026-11-30').status, 'expiring');
  assert.equal(expiryInfo('2027-03-01', '2026-11-30').status, 'active');
  assert.equal(expiryInfo('2026-05-28', '2026-02-28').status, 'expiring');
  assert.equal(expiryInfo('2026-05-31', '2026-02-28').status, 'expiring');
  assert.equal(expiryInfo('2026-05-31', '2026-02-27').status, 'active');
  assert.equal(expiryInfo('2024-05-31', '2024-02-29').status, 'expiring');
  assert.equal(expiryInfo('2024-05-31', '2024-02-28').status, 'active');
});

test('missing and invalid dates never become active', () => {
  for (const date of [undefined, null, '', '2026-02-30', '2025-02-29', '2026-13-01', '13/10/2026', '2026-10-13T12:00:00Z']) {
    assert.equal(expiryInfo(date).status, 'unknown');
    assert.equal(expiryInfo(date).days, null);
    assert.equal(formatDate(date), '—');
    assert.equal(addMonths(date, 3), null);
  }
  assert.equal(daysBetween('2026-02-30', REFERENCE_DATE), null);
  assert.equal(expiryInfo('2027-01-13', 'bad').status, 'unknown');
  assert.equal(addMonths(REFERENCE_DATE, 1.5), null);
});

test('date results do not depend on timezone or daylight saving', () => {
  const script = `import { daysBetween, expiryInfo, formatDate } from ${JSON.stringify(new URL('../js/core.js', import.meta.url).href)}; console.log(JSON.stringify([daysBetween('2026-03-07','2026-03-09'), expiryInfo('2026-10-13'), formatDate('2026-10-13')]));`;
  const results = ['UTC', 'Asia/Kuala_Lumpur', 'America/New_York', 'Pacific/Honolulu'].map(TZ =>
    execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, TZ }, encoding: 'utf8' }).trim());
  assert.equal(new Set(results).size, 1);
  assert.deepEqual(JSON.parse(results[0]), [2, { status: 'expiring', days: 0, label: 'Expires today' }, '13 Oct 2026']);
});

test('money is Malaysian ringgit with appropriate financial precision', () => {
  assert.equal(formatMoney(12345.67), 'RM 12,345.67');
  assert.equal(formatMoney(0), 'RM 0');
  assert.match(formatMoney(2500000, { compact: true }), /^RM\s?2\.5M$/);
  assert.equal(formatMoney(null), '—');
  assert.equal(formatMoney(Number.NaN), '—');
});

test('HTML data is escaped before templating', () => {
  assert.equal(escapeHTML('<img src="x" onerror=\'x\'>&'), '&lt;img src=&quot;x&quot; onerror=&#39;x&#39;&gt;&amp;');
  assert.equal(escapeHTML(null), '');
});

const portfolios = {
  ip: [{ id: 'ip-1', title: 'Smart Soil Patent', owner: 'Amin', faculty: 'SOC', year: 2026, expiryDate: '2027-01-13' }, { id: 'ip-2', title: 'Future Patent', owner: 'Chan', faculty: 'STML', year: 2025, expiryDate: '2028-01-01' }],
  incubators: [{ id: 'inc-1', name: 'AgriHub', founder: 'Aisyah', faculty: 'SOC', effectiveDate: '2025-10-12', expiryDate: '2026-10-12' }, { id: 'inc-2', name: 'Invalid date', faculty: 'SOC', expiryDate: '2026-02-30' }],
  commercialization: [{ id: 'com-1', title: 'Campus License', owner: 'Tan', faculty: 'SQS', expiryDate: '2026-09-01' }, { id: 'com-2', title: 'IP License', expiryDate: '2026-10-13' }],
};

test('reminders include all portfolios, order overdue first, and exclude inactive or unknown dates', () => {
  const alerts = getAlerts(portfolios);
  assert.deepEqual(alerts.map(alert => alert.recordId), ['com-1', 'inc-1', 'com-2', 'ip-1']);
  assert.deepEqual(alerts.map(alert => alert.module), ['commercialization', 'incubators', 'commercialization', 'ip']);
  assert.equal(alerts[1].owner, 'Aisyah');
  assert.equal(alerts[1].title, 'AgriHub');
  assert.equal(alerts[0].status, 'expired');
  assert.equal(new Set(alerts.map(alert => alert.id)).size, 4);
  assert.deepEqual(getAlerts({}), []);
});

test('combined search, faculty, cohort year and lifecycle filters retain original records', () => {
  const records = [...portfolios.ip, ...portfolios.incubators];
  assert.deepEqual(filterRecords(records, { search: '  SMART ', faculty: 'soc', year: '2026', status: 'expiring' }).map(record => record.id), ['ip-1']);
  assert.deepEqual(filterRecords(records, { year: '2025', status: 'expired' }).map(record => record.id), ['inc-1']);
  assert.deepEqual(filterRecords(records, { status: 'unknown' }).map(record => record.id), ['inc-2']);
  assert.equal(filterRecords(records)[0], records[0]);
  assert.equal(records.length, 4);
  assert.deepEqual(filterRecords(null), []);
});

test('cohort filters use the actual date fields for each ICC portfolio', () => {
  const records = [
    { id: 'ip-application', applicationDate: '2024-03-15', expiryDate: '2027-01-13' },
    { id: 'inc-effective', effectiveDate: '2025-09-01', expiryDate: '2026-12-01' },
    { id: 'com-agreement', agreementDate: '2026-02-20', expiryDate: '2026-12-15' },
  ];
  assert.deepEqual(filterRecords(records, { year: '2024' }).map(record => record.id), ['ip-application']);
  assert.deepEqual(filterRecords(records, { year: '2025' }).map(record => record.id), ['inc-effective']);
  assert.deepEqual(filterRecords(records, { year: '2026' }).map(record => record.id), ['com-agreement']);
  assert.deepEqual(filterRecords([{ year: 2023, applicationDate: '2024-03-15' }], { year: '2023' }).length, 1);
});
