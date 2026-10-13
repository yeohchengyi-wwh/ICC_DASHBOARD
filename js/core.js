/** Shared, DOM-independent helpers for the ICC dashboard prototype. */
export const REFERENCE_DATE = '2026-10-13';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Read only valid ISO calendar dates; never infer a date from a locale string. */
function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

function toISO(date) {
  const year = date.getUTCFullYear();
  if (year < 0 || year > 9999 || !Number.isFinite(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

/** Add calendar months, clamping dates such as January 31 to February's last day. */
export function addMonths(dateString, months) {
  const date = parseDate(dateString);
  if (!date || !Number.isSafeInteger(months)) return null;
  const originalDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  if (!Number.isFinite(date.getTime())) return null;
  const lastDay = new Date(date.getTime());
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0);
  date.setUTCDate(Math.min(originalDay, lastDay.getUTCDate()));
  return toISO(date);
}

/** Signed calendar days from the first ISO date to the second, independent of DST. */
export function daysBetween(fromISO, toISO) {
  const from = parseDate(fromISO);
  const to = parseDate(toISO);
  return from && to ? Math.round((to.getTime() - from.getTime()) / DAY_MS) : null;
}

/** Amber begins three calendar months before each expiry; overdue dates are red. */
export function expiryInfo(expiryDate, asOf = REFERENCE_DATE) {
  const expiry = parseDate(expiryDate);
  const today = parseDate(asOf);
  if (!expiry || !today) {
    return { status: 'unknown', days: null, label: expiryDate ? 'Expiry unavailable' : 'No expiry date' };
  }
  const days = daysBetween(asOf, expiryDate);
  if (days < 0) {
    const elapsed = Math.abs(days);
    return { status: 'expired', days, label: `Expired ${elapsed} ${elapsed === 1 ? 'day' : 'days'} ago` };
  }
  // Calculate from the record's deadline, clamping its reminder start at month
  // ends: May 31 expiry starts its three-month reminder on February 28/29.
  const reminderStart = parseDate(addMonths(expiryDate, -3));
  const status = reminderStart && today >= reminderStart ? 'expiring' : 'active';
  const label = days === 0 ? 'Expires today' : `Expires in ${days} ${days === 1 ? 'day' : 'days'}`;
  return { status, days, label };
}

export function formatDate(iso) {
  const date = parseDate(iso);
  return date
    ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
    : '—';
}

/** Render Malaysian ringgit, preserving cents where present. */
export function formatMoney(value, { compact = false } = {}) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    notation: compact ? 'compact' : 'standard',
    minimumFractionDigits: 0,
    maximumFractionDigits: compact ? 1 : 2,
  }).format(Number(value)).replace(/[\u00a0\u202f]/g, ' ');
}

/** Escape data before inserting it into an HTML template. */
export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function expiryOf(record) {
  return record.expiryDate ?? record.expiry_date ?? record.endDate ?? record.expirationDate ?? null;
}

/** Urgent reminders across the three portfolios; expired records sort first. */
export function getAlerts(data = {}, asOf = REFERENCE_DATE) {
  const alerts = [];
  for (const module of ['ip', 'incubators', 'commercialization']) {
    const records = Array.isArray(data[module]) ? data[module] : [];
    records.forEach((record, index) => {
      if (!record || typeof record !== 'object') return;
      const expiryDate = expiryOf(record);
      const info = expiryInfo(expiryDate, asOf);
      if (info.status !== 'expired' && info.status !== 'expiring') return;
      const recordId = record.id ?? record.recordId ?? `${index + 1}`;
      alerts.push({
        id: `${module}-${recordId}`,
        recordId,
        module,
        title: record.title ?? record.name ?? record.company ?? 'Untitled record',
        owner: record.owner ?? record.founder ?? record.inventor ?? record.contact ?? 'Unassigned',
        faculty: record.faculty ?? '',
        expiryDate,
        ...info,
      });
    });
  }
  return alerts.sort((a, b) => {
    const priority = Number(a.status !== 'expired') - Number(b.status !== 'expired');
    return priority || a.days - b.days || a.title.localeCompare(b.title);
  });
}

function recordYear(record) {
  if (record.year !== undefined && record.year !== null) return String(record.year);
  const date = record.effectiveDate ?? record.applicationDate ?? record.agreementDate ?? record.filingDate ?? record.registrationDate ?? record.startDate ?? record.createdAt;
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 4) : '';
}

function searchableText(record) {
  return Object.values(record).flatMap(value => {
    if (typeof value === 'string' || typeof value === 'number') return [String(value)];
    if (Array.isArray(value)) return value.filter(item => typeof item === 'string' || typeof item === 'number');
    return [];
  }).join(' ').toLocaleLowerCase('en');
}

/** Apply optional portfolio filters without mutating the source records. */
export function filterRecords(records = [], { search = '', faculty = 'all', year = 'all', status = 'all', asOf = REFERENCE_DATE } = {}) {
  if (!Array.isArray(records)) return [];
  const query = String(search ?? '').trim().toLocaleLowerCase('en');
  const facultyQuery = String(faculty ?? 'all').toLocaleLowerCase('en');
  const selectedYear = String(year ?? 'all');
  const selectedStatus = String(status ?? 'all').toLocaleLowerCase('en');
  return records.filter(record => {
    if (!record || typeof record !== 'object') return false;
    if (query && !searchableText(record).includes(query)) return false;
    if (facultyQuery && facultyQuery !== 'all' && String(record.faculty ?? '').toLocaleLowerCase('en') !== facultyQuery) return false;
    if (selectedYear && selectedYear !== 'all' && recordYear(record) !== selectedYear) return false;
    if (selectedStatus && selectedStatus !== 'all' && expiryInfo(expiryOf(record), asOf).status !== selectedStatus) return false;
    return true;
  });
}
